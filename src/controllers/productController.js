const Product = require('../models/Product');
const { logActivity } = require('../middleware/activityLogger');

// @desc    إضافة منتج جديد
// @route   POST /api/products
// @access  Admin Only
exports.addProduct = async (req, res) => {
  try {
    const { name, unit, currentBuyPrice, currentSellPrice, quantity, minStockWarning, category, description } = req.body;

    // التحقق من وجود المنتج
    const existingProduct = await Product.findOne({ name });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'هذا المنتج موجود بالفعل'
      });
    }

    const product = new Product({
      name,
      unit: unit || 'قطعة',
      currentBuyPrice: currentBuyPrice || 0,
      currentSellPrice: currentSellPrice || 0,
      quantity: quantity || 0,
      minStockWarning: minStockWarning || 10,
      category: category || 'عام',
      description: description || ''
    });

    await product.save();

    // ✅ تسجيل النشاط
    await logActivity(
      req,
      'CREATE',
      'PRODUCT',
      product._id,
      product.name,
      {
        unit: product.unit,
        currentBuyPrice: product.currentBuyPrice,
        currentSellPrice: product.currentSellPrice,
        quantity: product.quantity,
        minStockWarning: product.minStockWarning
      },
      `تم إضافة منتج جديد: ${product.name} (${product.quantity} ${product.unit})`
    );

    res.status(201).json({
      success: true,
      message: '✅ تم إضافة المنتج بنجاح',
      data: product
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'حدث خطأ أثناء إضافة المنتج'
    });
  }
};

// @desc    جلب كل المنتجات
// @route   GET /api/products
exports.getAllProducts = async (req, res) => {
  try {
    console.log('📦 Fetching all products...');
    
    const { page = 1, limit = 50, search, category, lowStock } = req.query;
    const query = { isActive: true };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (category) {
      query.category = category;
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$minStockWarning'] };
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    console.log(`✅ Found ${products.length} products`);
    
    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      data: products
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل في جلب المنتجات: ' + error.message
    });
  }
};

// @desc    جلب منتج واحد
// @route   GET /api/products/:id
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    تحديث منتج
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }

    // ✅ تسجيل التغييرات
    const changes = {};
    const allowedUpdates = ['name', 'unit', 'currentBuyPrice', 'currentSellPrice', 'minStockWarning', 'category', 'description', 'isActive'];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== product[field]) {
        changes[field] = {
          old: product[field],
          new: req.body[field]
        };
      }
    });

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }

    // ✅ تسجيل النشاط (لو في تغييرات)
    if (Object.keys(changes).length > 0) {
      await logActivity(
        req,
        'UPDATE',
        'PRODUCT',
        updatedProduct._id,
        updatedProduct.name,
        changes,
        `تم تحديث المنتج: ${updatedProduct.name}`
      );
    }

    res.status(200).json({
      success: true,
      message: '✅ تم تحديث المنتج',
      data: updatedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    حذف منتج (soft delete)
// @route   DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }

    const productName = product.name;

    // Soft delete - بخلّي المنتج موجود لكن غير نشط
    const deletedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    // ✅ تسجيل النشاط
    await logActivity(
      req,
      'DELETE',
      'PRODUCT',
      req.params.id,
      productName,
      {},
      `تم حذف المنتج: ${productName}`
    );

    res.status(200).json({
      success: true,
      message: '✅ تم حذف المنتج',
      data: deletedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    إضافة كمية للمخزون
// @route   POST /api/products/:id/add-stock
exports.addStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'الكمية يجب أن تكون أكبر من صفر'
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }

    const oldQuantity = product.quantity;
    product.quantity += quantity;
    await product.save();

    // ✅ تسجيل النشاط
    await logActivity(
      req,
      'UPDATE',
      'PRODUCT',
      product._id,
      product.name,
      {
        quantity: {
          old: oldQuantity,
          new: product.quantity,
          added: quantity
        }
      },
      `تم إضافة ${quantity} ${product.unit} إلى مخزون ${product.name} (كان ${oldQuantity} أصبح ${product.quantity})`
    );

    res.status(200).json({
      success: true,
      message: `✅ تم إضافة ${quantity} إلى المخزون`,
      data: {
        product,
        added: quantity,
        oldQuantity,
        newQuantity: product.quantity
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};