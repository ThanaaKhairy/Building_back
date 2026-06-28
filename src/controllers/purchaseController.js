const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const { sendLowStockAlert } = require("../services/smsService");
const { logActivity } = require("../middleware/activityLogger");

// ========================================
// @desc    تسجيل فاتورة شراء
// @route   POST /api/purchases
// ========================================

exports.addPurchase = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      buyPrice,
      supplier,
      supplierPhone,
      invoiceNumber,
      notes,
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

    // ✅ إنشاء فاتورة الشراء
    const purchase = new Purchase({
      productId,
      quantity,
      buyPrice,
      supplier: supplier || "مورد غير محدد",
      supplierPhone,
      invoiceNumber,
      notes,
      isPaid: isPaid ?? true,
    });

    await purchase.save();

    // ✅ تحديث المخزون
    const oldQuantity = product.quantity;
    product.quantity += quantity;
    product.currentBuyPrice = buyPrice;
    await product.save();

    let alertSent = false;

    // ✅ لو المخزون مازال أقل من الحد الأدنى
    if (product.quantity <= product.minStockWarning) {
      try {
        await sendLowStockAlert(product, product.quantity);
        alertSent = true;
      } catch (err) {
        console.log(err.message);
      }
    }

    // ✅ تسجيل النشاط
    await logActivity(
      req,
      'PURCHASE',
      'PURCHASE',
      purchase._id,
      `${product.name} - ${quantity} ${product.unit}`,
      {
        quantity,
        buyPrice,
        totalPrice: purchase.totalPrice,
        supplier: supplier || 'مورد غير محدد',
        oldStock: oldQuantity,
        newStock: product.quantity
      },
      `تم تسجيل فاتورة شراء: ${product.name} (${quantity} × ${buyPrice} = ${purchase.totalPrice} ج) - المخزون: ${oldQuantity} → ${product.quantity}`
    );

    return res.status(201).json({
      success: true,
      message: "تم تسجيل عملية الشراء بنجاح",
      data: {
        purchase,
        stock: {
          product: product.name,
          quantity: product.quantity,
        },
        alertSent,
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
// @desc    جلب كل فواتير الشراء
// @route   GET /api/purchases
// ========================================

exports.getAllPurchases = async (req, res) => {
  try {
    console.log('🛒 Fetching all purchases...');
    
    const {
      page = 1,
      limit = 20,
      supplier,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (supplier) {
      query.supplier = {
        $regex: supplier,
        $options: "i",
      };
    }

    if (startDate || endDate) {
      query.purchaseDate = {};

      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }

      if (endDate) {
        query.purchaseDate.$lte = new Date(endDate);
      }
    }

    const purchases = await Purchase.find(query)
      .sort({ purchaseDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Purchase.countDocuments(query);

    const totalAmount = await Purchase.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: "$totalPrice",
          },
        },
      },
    ]);

    console.log(`✅ Found ${purchases.length} purchases`);
    
    res.status(200).json({
      success: true,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalPurchases: total,
      totalAmount: totalAmount[0]?.total || 0,
      data: purchases,
    });
  } catch (err) {
    console.error('❌ Error fetching purchases:', err.message);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب المشتريات: ' + err.message
    });
  }
};

// ========================================
// @desc    جلب فاتورة شراء واحدة
// @route   GET /api/purchases/:id
// ========================================

exports.getPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "فاتورة الشراء غير موجودة",
      });
    }

    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};