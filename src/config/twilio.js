const twilio = require('twilio');

// التحقق من وجود المتغيرات
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

// التحقق من صحة البيانات
if (!accountSid || !authToken || !phoneNumber) {
  console.warn('⚠️ Twilio credentials missing. SMS service will be disabled.');
}

// إنشاء عميل Twilio (أو null لو مش متوفر)
const client = (accountSid && authToken) 
  ? twilio(accountSid, authToken)
  : null;

module.exports = {
  client,
  phoneNumber,
  isEnabled: !!client
};