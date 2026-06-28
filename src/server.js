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

// ============================================
// ✅ الاتصال بقاعدة البيانات
// ============================================

let isConnected = false;
let adminSeeded = false;

const initDB = async () => {
  if (isConnected) return;
  try {
    await connectDB();
    if (!adminSeeded) {
      await seedAdmin();
      adminSeeded = true;
    }
    isConnected = true;
    console.log('✅ Database initialized');
  } catch (error) {
    isConnected = false;
    console.error('❌ Database init failed:', error.message);
    throw error;
  }
};

// ============================================
// ✅ Middleware
// ============================================

app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ ضمان اتصال DB قبل كل request (ضروري على Vercel serverless)
app.use(async (req, res, next) => {
  try {
    await initDB();
    next();
  } catch (error) {
    console.error('❌ DB Connection Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// ✅ Routes
// ============================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏗️ Material Store API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: {
      database: isConnected ? 'connected' : 'connecting',
      sms: process.env.TWILIO_ACCOUNT_SID ? 'enabled' : 'disabled'
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    uptime: process.uptime(),
    database: isConnected ? 'connected' : 'connecting',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', protect, adminOnly, productRoutes);
app.use('/api/purchases', protect, adminOnly, purchaseRoutes);
app.use('/api/sales', protect, adminOnly, saleRoutes);
app.use('/api/activity-logs', protect, adminOnly, activityLogRoutes);

app.post('/api/admin/check-stock', protect, adminOnly, async (req, res) => {
  try {
    await checkLowStock();
    res.json({ success: true, message: 'Stock check completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use(errorHandler);

// ✅ للـ Vercel
module.exports = app;

// ✅ للتشغيل المحلي
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  initDB().then(() => {
    startStockChecker();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  });
}