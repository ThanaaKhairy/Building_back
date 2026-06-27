const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'اسم المستخدم مطلوب'],
      unique: true,
      trim: true,
      minlength: [3, 'اسم المستخدم قصير جدًا'],
      maxlength: [30, 'اسم المستخدم طويل جدًا']
    },
    email: {
      type: String,
      required: [true, 'البريد الإلكتروني مطلوب'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'البريد الإلكتروني غير صحيح']
    },
    password: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة'],
      minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'],
      select: false
    },
    fullName: {
      type: String,
      required: [true, 'الاسم الكامل مطلوب'],
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: {
        values: ['super_admin', 'admin'],
        message: 'صلاحية غير صحيحة'
      },
      default: 'admin'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// ✅ تشفير كلمة المرور قبل الحفظ
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
// ✅ طريقة للتحقق من كلمة المرور
userSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    throw error;
  }
};

// ✅ توليد JWT Token
userSchema.methods.generateToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      username: this.username, 
      role: this.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// ✅ التحقق من أن المستخدم هو Super Admin
userSchema.methods.isSuperAdmin = function() {
  return this.role === 'super_admin';
};

// ✅ التحقق من أن المستخدم Admin (أي نوع)
userSchema.methods.isAdmin = function() {
  return ['super_admin', 'admin'].includes(this.role);
};

module.exports = mongoose.model('User', userSchema);