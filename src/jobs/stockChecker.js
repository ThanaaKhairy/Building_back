const cron = require('node-cron');
const Product = require('../models/Product');
const { sendLowStockAlert } = require('../services/smsService');

/**
 * فحص المخزون المنخفض وإرسال تنبيهات
 */
const checkLowStock = async () => {
  try {
    console.log('🔍 Checking low stock products...');
    
    const lowStockProducts = await Product.findLowStock();
    
    if (lowStockProducts.length === 0) {
      console.log('✅ No low stock products found');
      return;
    }

    console.log(`⚠️ Found ${lowStockProducts.length} low stock products`);
    
    // إرسال تنبيه لكل منتج منخفض
    for (const product of lowStockProducts) {
      try {
        await sendLowStockAlert(product, product.quantity);
        console.log(`📱 Alert sent for: ${product.name}`);
      } catch (error) {
        console.error(`❌ Failed to send alert for ${product.name}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ Stock check failed:', error.message);
  }
};

/**
 * بدء جدولة المهام
 */
const startStockChecker = () => {
  // تشغيل كل يوم الساعة 8 صباحًا و 8 مساءً
  cron.schedule('0 8,20 * * *', async () => {
    console.log('⏰ Running scheduled stock check...');
    await checkLowStock();
  });

  // تشغيل كل ساعة (اختياري - للاختبار)
  // cron.schedule('0 * * * *', async () => {
  //   console.log('⏰ Running hourly stock check...');
  //   await checkLowStock();
  // });

  console.log('✅ Stock checker scheduled: 8:00 AM & 8:00 PM daily');
};

module.exports = {
  startStockChecker,
  checkLowStock
};