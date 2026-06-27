const express = require('express');
const router = express.Router();
const {
  getActivityLogs,
  getUserActivityLogs,
} = require('../controllers/activityLogController');
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');

// ✅ كل الأدمنز يقدر يشوف سجل النشاطات
router.get('/', protect, adminOnly, getActivityLogs);

// ✅ السوبر أدمن فقط يقدر يشوف نشاطات مستخدم معين
router.get('/user/:userId', protect, superAdminOnly, getUserActivityLogs);

module.exports = router;