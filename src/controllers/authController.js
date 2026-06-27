const User = require('../models/User');
const { logActivity } = require('../middleware/activityLogger');

// @desc    تسجيل الدخول
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // ✅ التحقق من وجود المستخدم
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
      });
    }

    // ✅ التحقق من نشاط الحساب
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير نشط، يرجى التواصل مع الإدارة'
      });
    }

    // ✅ التحقق من كلمة المرور
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
      });
    }

    // ✅ تحديث آخر تسجيل دخول
    user.lastLogin = new Date();
    await user.save();

    // ✅ توليد Token
    const token = user.generateToken();

    // ✅ تسجيل النشاط (تسجيل الدخول)
    await logActivity(
      req,
      'LOGIN',
      'USER',
      user._id,
      user.username,
      {},
      `تم تسجيل الدخول: ${user.username} (${user.role})`
    );

    res.status(200).json({
      success: true,
      message: '✅ تم تسجيل الدخول بنجاح',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin(),
          isAdmin: user.isAdmin()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    إضافة مستخدم جديد (فقط Super Admin)
exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;

    // ✅ التحقق من أن المستخدم الحالي هو Super Admin
    if (!req.user.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: '❌ غير مصرح بهذه العملية. فقط الأدمن الرئيسي يمكنه إضافة أدمن جدد'
      });
    }

    // ✅ التحقق من وجود المستخدم
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم أو البريد الإلكتروني موجود بالفعل'
      });
    }

    // ✅ إنشاء المستخدم (دائمًا يكون Admin)
    const user = await User.create({
      username,
      email,
      password,
      fullName,
      phone,
      role: 'admin',
      isActive: true,
      createdBy: req.user._id
    });

    // ✅ تسجيل النشاط
    await logActivity(
      req,
      'CREATE',
      'USER',
      user._id,
      user.username,
      {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdBy: req.user.username
      },
      `تم إضافة مستخدم جديد: ${user.username} (${user.fullName}) بواسطة ${req.user.username}`
    );

    res.status(201).json({
      success: true,
      message: '✅ تم إضافة الأدمن بنجاح',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    جلب كل المستخدمين (فقط Super Admin)
exports.getUsers = async (req, res) => {
  try {
    // ✅ التحقق من أن المستخدم الحالي هو Super Admin
    if (!req.user.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: '❌ غير مصرح بهذه العملية. فقط الأدمن الرئيسي يمكنه عرض المستخدمين'
      });
    }

    const users = await User.find()
      .select('-password')
      .populate('createdBy', 'username fullName')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    تحديث مستخدم (فقط Super Admin)
exports.updateUser = async (req, res) => {
  try {
    // ✅ التحقق من أن المستخدم الحالي هو Super Admin
    if (!req.user.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: '❌ غير مصرح بهذه العملية. فقط الأدمن الرئيسي يمكنه تعديل المستخدمين'
      });
    }

    const { username, email, fullName, phone, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // ❌ منع تعديل الـ Super Admin
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: '❌ لا يمكن تعديل الأدمن الرئيسي'
      });
    }

    // ✅ تسجيل التغييرات
    const changes = {};
    if (username && username !== user.username) changes.username = { old: user.username, new: username };
    if (email && email !== user.email) changes.email = { old: user.email, new: email };
    if (fullName && fullName !== user.fullName) changes.fullName = { old: user.fullName, new: fullName };
    if (phone !== undefined && phone !== user.phone) changes.phone = { old: user.phone, new: phone };
    if (isActive !== undefined && isActive !== user.isActive) changes.isActive = { old: user.isActive, new: isActive };

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, fullName, phone, isActive },
      { new: true, runValidators: true }
    ).select('-password');

    // ✅ تسجيل النشاط (لو في تغييرات)
    if (Object.keys(changes).length > 0) {
      await logActivity(
        req,
        'UPDATE',
        'USER',
        updatedUser._id,
        updatedUser.username,
        changes,
        `تم تحديث المستخدم: ${updatedUser.username} بواسطة ${req.user.username}`
      );
    }

    res.status(200).json({
      success: true,
      message: '✅ تم تحديث المستخدم',
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    حذف مستخدم (فقط Super Admin)
exports.deleteUser = async (req, res) => {
  try {
    // ✅ التحقق من أن المستخدم الحالي هو Super Admin
    if (!req.user.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: '❌ غير مصرح بهذه العملية. فقط الأدمن الرئيسي يمكنه حذف المستخدمين'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // ❌ منع حذف الـ Super Admin
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: '❌ لا يمكن حذف الأدمن الرئيسي'
      });
    }

    const username = user.username;
    await user.deleteOne();

    // ✅ تسجيل النشاط
    await logActivity(
      req,
      'DELETE',
      'USER',
      req.params.id,
      username,
      {},
      `تم حذف المستخدم: ${username} بواسطة ${req.user.username}`
    );

    res.status(200).json({
      success: true,
      message: '✅ تم حذف المستخدم'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    تغيير كلمة المرور
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة'
      });
    }

    user.password = newPassword;
    await user.save();

    // ✅ تسجيل النشاط
    await logActivity(
      req,
      'UPDATE',
      'USER',
      user._id,
      user.username,
      { password: 'تم التغيير' },
      `تم تغيير كلمة المرور للمستخدم: ${user.username}`
    );

    res.status(200).json({
      success: true,
      message: '✅ تم تغيير كلمة المرور بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    الحصول على معلومات المستخدم الحالي
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};