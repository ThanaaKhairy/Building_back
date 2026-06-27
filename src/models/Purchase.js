const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "معرف المنتج مطلوب"],
    },

    quantity: {
      type: Number,
      required: [true, "الكمية مطلوبة"],
      min: [0.1, "الكمية يجب أن تكون أكبر من صفر"],
    },

    // ✅ الكمية المتبقية من الدفعة (FIFO)
    remainingQuantity: {
      type: Number,
      default: 0,
    },

    buyPrice: {
      type: Number,
      required: [true, "سعر الشراء مطلوب"],
      min: [0, "السعر لا يمكن أن يكون سالبًا"],
    },

    totalPrice: {
      type: Number,
      default: 0,
    },

    supplier: {
      type: String,
      trim: true,
      default: "مورد غير محدد",
    },

    supplierPhone: {
      type: String,
      trim: true,
    },

    invoiceNumber: {
      type: String,
      unique: true,
      default: () => `PUR-${Date.now()}`,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "الملاحظات طويلة جدًا"],
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    isPaid: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ حساب الإجمالي والكمية المتبقية
purchaseSchema.pre("save", function() {
  this.totalPrice = this.quantity * this.buyPrice;
  
  // ✅ مهم جداً: لو أول مرة، خلي remainingQuantity = quantity
  if (this.isNew) {
    this.remainingQuantity = this.quantity;
  }
  
  // next();
});

// Populate تلقائي
purchaseSchema.pre(/^find/, function() {
  this.populate("productId", "name unit");
});

module.exports = mongoose.model("Purchase", purchaseSchema);