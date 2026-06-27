const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // ✅ تأكد من وجود MONGODB_URI
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️ MONGODB_URI is not defined. Skipping database connection.');
      return null;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "Building_db",
      // ✅ خيارات إضافية للاستقرار
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📁 Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    // ✅ في Vercel، مش نوقف السيرفر (لأنه Serverless)
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    return null;
  }
};

module.exports = connectDB;