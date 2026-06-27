const express = require('express');
const router = express.Router();
const {
  login,
  register,
  getUsers,
  updateUser,
  deleteUser,
  changePassword,
  getMe
} = require('../controllers/authController');
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');

// ✅ Routes العامة (مش محتاجة توكن)
router.post('/login', login);

// ✅ Routes المحمية (تحتاج تسجيل دخول)
router.get('/me', protect, adminOnly, getMe);
router.put('/change-password', protect, adminOnly, changePassword);

// ✅ Routes للسوبر أدمن فقط
router.post('/register', protect, superAdminOnly, register);
router.get('/users', protect, superAdminOnly, getUsers);
router.put('/users/:id', protect, superAdminOnly, updateUser);
router.delete('/users/:id', protect, superAdminOnly, deleteUser);

module.exports = router;