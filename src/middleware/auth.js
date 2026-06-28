const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ✅ التحقق من وجود Token وصلاحيته
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'غير مصرح بالدخول، يرجى تسجيل الدخول'
    });
  }

  try {
    // ✅ التحقق من صحة Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ جلب المستخدم - مع معالجة الخطأ
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير نشط'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Auth Error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token غير صالح'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى'
      });
    }
    // ✅ أي خطأ تاني - 500 مع رسالة واضحة
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في المصادقة: ' + error.message
    });
  }
};

// ✅ التحقق من أن المستخدم Admin (أي نوع)
exports.adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'غير مصرح بالدخول'
    });
  }
  
  if (!req.user.isAdmin()) {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح بهذه العملية، تحتاج صلاحية أدمن'
    });
  }
  next();
};

// ✅ التحقق من أن المستخدم Super Admin فقط
exports.superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'غير مصرح بالدخول'
    });
  }
  
  if (!req.user.isSuperAdmin()) {
    return res.status(403).json({
      success: false,
      message: '❌ غير مصرح بهذه العملية. فقط الأدمن الرئيسي يمكنه تنفيذها'
    });
  }
  next();
};