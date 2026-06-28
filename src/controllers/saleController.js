const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const { sendLowStockAlert } = require("../services/smsService");
const { logActivity } = require("../middleware/activityLogger");

// ========================================
// @desc    تسجيل فاتورة بيع (FIFO + Fallback)
// @route   POST /api/sales
// ========================================

exports.addSale = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      sellPrice,
      customer,
      customerPhone,
      invoiceNumber,
      notes,
      paymentMethod,
      isPaid,
    } = req.body;

    // ✅ التأكد من وجود المنتج
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "المنتج غير موجود",
      });
    }

    // ✅ التأكد من وجود كمية بالمخزن
    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `الكمية غير متوفرة. المتاح ${product.quantity} ${product.unit}`,
      });
    }

    // ==========================
    // ✅ حساب التكلفة (FIFO أو Fallback)
    // ==========================

    let totalCost = 0;
    let usedPurchases = [];
    let qtyNeeded = quantity;

    // ✅ جلب دفعات الشراء اللي فيها كمية متبقية
    const purchases = await Purchase.find({
      productId: productId,
      remainingQuantity: { $gt: 0 },
    }).sort({ purchaseDate: 1 });

    console.log(`📦 Found ${purchases.length} purchase records for product ${product.name}`);

    // ✅ لو في دفعات شراء، استخدم FIFO
    if (purchases.length > 0) {
      for (const purchase of purchases) {
        if (qtyNeeded <= 0) break;

        const usedQty = Math.min(qtyNeeded, purchase.remainingQuantity);

        if (usedQty > 0) {
          totalCost += usedQty * purchase.buyPrice;
          purchase.remainingQuantity -= usedQty;
          await purchase.save();
          qtyNeeded -= usedQty;

          usedPurchases.push({
            purchaseId: purchase._id,
            usedQty,
            price: purchase.buyPrice,
          });

          console.log(`✅ Used ${usedQty} from purchase at price ${purchase.buyPrice}`);
        }
      }

      // ✅ لو الكمية المطلوبة مش متوفرة في الدفعات، استخدم currentBuyPrice
      if (qtyNeeded > 0) {
        console.log(`⚠️ Not enough in purchases. Using currentBuyPrice for remaining ${qtyNeeded}`);
        totalCost += qtyNeeded * product.currentBuyPrice;
        
        usedPurchases.push({
          purchaseId: null,
          usedQty: qtyNeeded,
          price: product.currentBuyPrice,
          note: "استخدم سعر الشراء الحالي (لا توجد دفعات كافية)",
        });
      }
    } else {
      // ✅ لو مفيش دفعات شراء نهائي، استخدم currentBuyPrice
      console.log(`⚠️ No purchases found. Using currentBuyPrice (${product.currentBuyPrice})`);
      totalCost = quantity * product.currentBuyPrice;
      
      usedPurchases.push({
        purchaseId: null,
        usedQty: quantity,
        price: product.currentBuyPrice,
        note: "استخدم سعر الشراء الحالي (لا توجد دفعات شراء)",
      });
    }

    // ==========================
    // ✅ حساب الإجمالي والربح
    // ==========================

    const totalPrice = quantity * sellPrice;
    const profit = totalPrice - totalCost;
    const profitMargin = totalCost > 0
      ? Number(((profit / totalCost) * 100).toFixed(2))
      : 0;

    // ==========================
    // ✅ إنشاء فاتورة البيع
    // ==========================

    const sale = new Sale({
      productId,
      quantity,
      sellPrice,
      totalPrice,
      costPrice: totalCost,
      profit,
      profitMargin,
      customer: customer || "عميل نقدي",
      customerPhone,
      invoiceNumber,
      notes,
      paymentMethod: paymentMethod || "نقدي",
      isPaid: isPaid ?? true,
    });

    await sale.save();

    // ==========================
    // ✅ تحديث المخزون
    // ==========================

    const oldQuantity = product.quantity;
    product.quantity -= quantity;
    await product.save();

    // ==========================
    // ✅ إرسال تنبيه المخزون المنخفض
    // ==========================

    let alertSent = false;
    if (product.quantity <= product.minStockWarning) {
      try {
        await sendLowStockAlert(product, product.quantity);
        alertSent = true;
      } catch (err) {
        console.log(err.message);
      }
    }

    // ==========================
    // ✅ تسجيل النشاط
    // ==========================

    await logActivity(
      req,
      'SALE',
      'SALE',
      sale._id,
      `${product.name} - ${quantity} ${product.unit}`,
      {
        quantity,
        sellPrice,
        totalPrice,
        costPrice: totalCost,
        profit,
        profitMargin,
        customer: customer || 'عميل نقدي',
        paymentMethod: paymentMethod || 'نقدي',
        oldStock: oldQuantity,
        newStock: product.quantity,
        usedPurchases: usedPurchases.map(p => ({
          price: p.price,
          quantity: p.usedQty,
          fromPurchase: p.purchaseId ? 'دفعة شراء' : 'سعر الحالي'
        }))
      },
      `تم تسجيل فاتورة بيع: ${product.name} (${quantity} × ${sellPrice} = ${totalPrice} ج) - الربح: ${profit} ج - المخزون: ${oldQuantity} → ${product.quantity}`
    );

    return res.status(201).json({
      success: true,
      message: "✅ تم تسجيل عملية البيع بنجاح",
      data: {
        sale,
        stock: {
          product: product.name,
          quantity: product.quantity,
        },
        alertSent,
        fifoDetails: {
          totalCost,
          totalRevenue: totalPrice,
          profit,
          profitMargin,
          usedPurchases,
        },
      },
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ========================================
// @desc    جلب كل فواتير البيع
// @route   GET /api/sales
// ========================================

exports.getAllSales = async (req, res) => {
  try {
    console.log('💰 Fetching all sales...');
    
    const {
      page = 1,
      limit = 20,
      customer,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (customer) {
      query.customer = {
        $regex: customer,
        $options: "i",
      };
    }

    if (startDate || endDate) {
      query.saleDate = {};

      if (startDate) {
        query.saleDate.$gte = new Date(startDate);
      }

      if (endDate) {
        query.saleDate.$lte = new Date(endDate);
      }
    }

    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Sale.countDocuments(query);

    const stats = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$profit" },
          totalRevenue: { $sum: "$totalPrice" },
          totalCost: { $sum: "$costPrice" },
          totalSales: { $sum: 1 },
        },
      },
    ]);

    console.log(`✅ Found ${sales.length} sales`);
    
    res.status(200).json({
      success: true,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalSales: total,
      stats: stats[0] || {
        totalProfit: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalSales: 0,
      },
      data: sales,
    });
  } catch (error) {
    console.error('❌ Error fetching sales:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب المبيعات: ' + error.message
    });
  }
};

// ========================================
// @desc    جلب فاتورة بيع واحدة
// @route   GET /api/sales/:id
// ========================================

exports.getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "فاتورة البيع غير موجودة",
      });
    }

    res.status(200).json({
      success: true,
      data: sale,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ========================================
// @desc    أرباح اليوم
// @route   GET /api/sales/daily-profit
// ========================================

exports.getDailyProfit = async (req, res) => {
  try {
    const stats = await Sale.getTodayProfit();

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ========================================
// @desc    تقرير الأرباح الشهرية
// @route   GET /api/sales/monthly-profit
// ========================================

exports.getMonthlyProfit = async (req, res) => {
  try {
    const { year, month } = req.query;

    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const result = await Sale.aggregate([
      {
        $match: {
          saleDate: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dayOfMonth: "$saleDate",
            },
          },
          totalRevenue: {
            $sum: "$totalPrice",
          },
          totalCost: {
            $sum: "$costPrice",
          },
          totalProfit: {
            $sum: "$profit",
          },
          totalSales: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          "_id.day": 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      year: y,
      month: m,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};