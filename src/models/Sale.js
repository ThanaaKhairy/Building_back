const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
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

    sellPrice: {
      type: Number,
      required: [true, "سعر البيع مطلوب"],
      min: [0, "السعر لا يمكن أن يكون سالبًا"],
    },

    totalPrice: {
      type: Number,
      default: 0,
    },

    // ✅ تكلفة البضاعة المباعة (FIFO)
    costPrice: {
      type: Number,
      default: 0,
    },

    // ✅ الربح
    profit: {
      type: Number,
      default: 0,
    },

    // ✅ نسبة الربح
    profitMargin: {
      type: Number,
      default: 0,
    },

    customer: {
      type: String,
      trim: true,
      default: "عميل نقدي",
    },

    customerPhone: {
      type: String,
      trim: true,
    },

    invoiceNumber: {
      type: String,
      unique: true,
      default: () => `SALE-${Date.now()}`,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "الملاحظات طويلة جدًا"],
    },

    saleDate: {
      type: Date,
      default: Date.now,
    },

    paymentMethod: {
      type: String,
      enum: ["نقدي", "تحويل", "أجل", "بطاقة"],
      default: "نقدي",
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

// ✅ حساب إجمالي الفاتورة
saleSchema.pre("save", function() {
  this.totalPrice = this.quantity * this.sellPrice;
});

// Populate تلقائي
saleSchema.pre(/^find/, function() {
  this.populate("productId", "name unit");
});

// أرباح اليوم
saleSchema.statics.getTodayProfit = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await this.aggregate([
    {
      $match: {
        saleDate: {
          $gte: today,
          $lt: tomorrow,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalProfit: {
          $sum: "$profit",
        },
        totalRevenue: {
          $sum: "$totalPrice",
        },
        totalSales: {
          $sum: 1,
        },
      },
    },
  ]);

  return (
    result[0] || {
      totalProfit: 0,
      totalRevenue: 0,
      totalSales: 0,
    }
  );
};

module.exports = mongoose.model("Sale", saleSchema);