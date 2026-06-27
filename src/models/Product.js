const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم المنتج مطلوب'],
      unique: true,
      trim: true,
      minlength: [2, 'اسم المنتج قصير جدًا'],
      maxlength: [100, 'اسم المنتج طويل جدًا']
    },
    unit: {
      type: String,
      required: [true, 'الوحدة مطلوبة'],
      enum: {
        values: ['كيس', 'طوبة', 'متر', 'كيلو', 'طن', 'قطعة', 'علبة', 'ربطة', 'مكعب', 'لفة'],
        message: 'وحدة غير صحيحة'
      },
      default: 'قطعة'
    },
    currentBuyPrice: {
      type: Number,
      required: [true, 'سعر الشراء مطلوب'],
      min: [0, 'السعر لا يمكن أن يكون سالبًا'],
      default: 0
    },
    currentSellPrice: {
      type: Number,
      required: [true, 'سعر البيع مطلوب'],
      min: [0, 'السعر لا يمكن أن يكون سالبًا'],
      default: 0
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'الكمية لا يمكن أن تكون سالبة']
    },
    minStockWarning: {
      type: Number,
      default: 10,
      min: [0, 'الحد الأدنى لا يمكن أن يكون سالبًا']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'الوصف طويل جدًا']
    },
    category: {
      type: String,
      trim: true,
      default: 'عام'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ✅ Virtual: حساب هامش الربح
productSchema.virtual('profitMargin').get(function() {
  if (this.currentBuyPrice === 0) return 0;
  return ((this.currentSellPrice - this.currentBuyPrice) / this.currentBuyPrice) * 100;
});

// ✅ Virtual: التحقق من انخفاض المخزون
productSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.minStockWarning;
});

// ✅ Virtual: حساب قيمة المخزون
productSchema.virtual('stockValue').get(function() {
  return this.quantity * this.currentBuyPrice;
});

// ✅ Method: إضافة كمية
productSchema.methods.addStock = function(quantity) {
  this.quantity += quantity;
  return this.save();
};

// ✅ Method: خصم كمية
productSchema.methods.removeStock = function(quantity) {
  if (this.quantity < quantity) {
    throw new Error(`الكمية غير كافية. المتوفرة: ${this.quantity}`);
  }
  this.quantity -= quantity;
  return this.save();
};

// ✅ Static: البحث عن المنتجات المنخفضة
productSchema.statics.findLowStock = function() {
  return this.find({
    $expr: {
      $lte: ['$quantity', '$minStockWarning']
    },
    isActive: true
  });
};

module.exports = mongoose.model('Product', productSchema);