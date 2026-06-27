const express = require('express');
require('dotenv').config();

// ✅ استيراد الملفات
const connectDB = require('./config/database');
const corsMiddleware = require('./middleware/corsMiddleware');
const errorHandler = require('./middleware/errorHandler');
const { startStockChecker, checkLowStock } = require('./jobs/stockChecker');
const seedAdmin = require('./utils/seedAdmin');

// ✅ استيراد الـ Routes
const productRoutes = require('./routes/productRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const saleRoutes = require('./routes/saleRoutes');
const authRoutes = require('./routes/authRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');

// ✅ استيراد الـ Middleware
const { protect, adminOnly } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// ✅ Middleware
// ============================================

app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// ✅ Routes
// ============================================

// ✅ Routes العامة
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏗️ Material Store API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      purchases: '/api/purchases',
      sales: '/api/sales',
      'activity-logs': '/api/activity-logs'
    },
    status: {
      database: process.env.MONGODB_URI ? 'configured' : 'not configured',
      sms: process.env.TWILIO_ACCOUNT_SID ? 'enabled' : 'disabled'
    }
  });
});

// ✅ Health check
app.get('/health', async (req, res) => {
  try {
    await connectDB();
    res.status(200).json({
      success: true,
      status: 'OK',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'Database connection failed',
      error: error.message
    });
  }
});

// ✅ Routes المحمية
app.use('/api/auth', authRoutes);
app.use('/api/products', protect, adminOnly, productRoutes);
app.use('/api/purchases', protect, adminOnly, purchaseRoutes);
app.use('/api/sales', protect, adminOnly, saleRoutes);
app.use('/api/activity-logs', protect, adminOnly, activityLogRoutes);

// ✅ Admin route لفحص المخزون يدويًا
app.post('/api/admin/check-stock', protect, adminOnly, async (req, res) => {
  try {
    await checkLowStock();
    res.json({
      success: true,
      message: 'Stock check completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ✅ Error handler
app.use(errorHandler);

// ============================================
// ✅ الاتصال بقاعدة البيانات
// ============================================

let isInitialized = false;

const initialize = async () => {
  if (isInitialized) return;
  
  try {
    await connectDB();
    await seedAdmin();
    isInitialized = true;
    console.log('✅ Server initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error.message);
  }
};

// ✅ للتشغيل المحلي
if (require.main === module) {
  initialize().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  });
}

// ✅ للـ Vercel - تأكد من التهيئة قبل أي طلب
app.use(async (req, res, next) => {
  await initialize();
  next();
});

// ✅ تصدير التطبيق لـ Vercel
module.exports = app;