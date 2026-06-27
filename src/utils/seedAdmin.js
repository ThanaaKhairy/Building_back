const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
  try {
    // ✅ تأكد من وجود اتصال بقاعدة البيانات
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️ MONGODB_URI not defined. Skipping admin seeding.');
      return;
    }

    console.log('🔍 Checking for Super Admin...');
    
    const adminExists = await User.findOne({ role: 'super_admin' });
    
    if (adminExists) {
      console.log('✅ Super Admin already exists');
      console.log(`📝 Username: ${adminExists.username}`);
      console.log(`📧 Email: ${adminExists.email}`);
      return;
    }

    console.log('👤 Creating Super Admin...');

    // ✅ تشفير كلمة المرور يدويًا عشان نضمن التشفير
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('SuperAdmin@123', salt);

    // ✅ إنشاء Super Admin
    const admin = new User({
      username: 'superadmin',
      email: 'superadmin@materialstore.com',
      password: hashedPassword,
      fullName: 'المدير الرئيسي',
      phone: '01000000000',
      role: 'super_admin',
      isActive: true
    });

    await admin.save();

    console.log('✅ Super Admin created successfully!');
    console.log('📝 Username: superadmin');
    console.log('📧 Email: superadmin@materialstore.com');
    console.log('🔑 Password: SuperAdmin@123');
    console.log('⚠️  يرجى تغيير كلمة المرور بعد أول تسجيل دخول');
    console.log(`🆔 Admin ID: ${admin._id}`);
    
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    
    // ✅ عرض تفاصيل الخطأ
    if (error.name === 'ValidationError') {
      console.log('📋 Validation Errors:');
      Object.keys(error.errors).forEach(key => {
        console.log(`   - ${key}: ${error.errors[key].message}`);
      });
    }
    
    if (error.code === 11000) {
      console.log('📋 Duplicate key error:');
      console.log(`   - ${Object.keys(error.keyPattern).join(', ')} already exists`);
    }
    
    // ✅ عرض الـ stack trace كامل في حالة الأخطاء الغريبة
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Stack trace:', error.stack);
    }
  }
};

module.exports = seedAdmin;