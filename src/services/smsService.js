const { client, phoneNumber, isEnabled } = require('../config/twilio');

/**
 * إرسال رسالة SMS
 * @param {string} to - رقم المستلم (بصيغة دولية)
 * @param {string} message - نص الرسالة
 * @returns {Promise<object>} - بيانات الرسالة
 */
const sendSMS = async (to, message) => {
  try {
    if (!isEnabled) {
      console.log('📱 SMS (simulated):', { to, message });
      return { simulated: true, to, message };
    }

    if (!to || !message) {
      throw new Error('رقم الهاتف أو نص الرسالة مفقود');
    }

    const result = await client.messages.create({
      body: message,
      from: phoneNumber,
      to: to
    });

    console.log(`✅ SMS sent to ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    console.error('❌ SMS Error:', error.message);
    throw error;
  }
};

/**
 * إرسال تنبيه انخفاض المخزون
 * @param {object} product - بيانات المنتج
 * @param {number} currentQuantity - الكمية الحالية
 */
const sendLowStockAlert = async (product, currentQuantity) => {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  
  if (!adminPhone) {
    console.warn('⚠️ ADMIN_PHONE_NUMBER not set in .env');
    return;
  }

  const message = `
⚠️ تنبيه: المخزون منخفض!
المنتج: ${product.name}
الكمية المتوفرة: ${currentQuantity} ${product.unit}
الحد الأدنى: ${product.minStockWarning}
التاريخ: ${new Date().toLocaleString('ar-EG')}
`.trim();

  return await sendSMS(adminPhone, message);
};

module.exports = {
  sendSMS,
  sendLowStockAlert
};