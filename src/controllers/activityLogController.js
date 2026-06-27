const ActivityLog = require("../models/ActivityLog");

// ========================================
// @desc    جلب سجل النشاطات (للكل)
// @route   GET /api/activity-logs
// ========================================

exports.getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      entity,
      userId,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (userId) query.userId = userId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await ActivityLog.find(query)
      .populate("userId", "username fullName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ActivityLog.countDocuments(query);

    res.status(200).json({
      success: true,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalLogs: total,
      data: logs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ========================================
// @desc    جلب نشاطات مستخدم معين (سوبر أدمن فقط)
// @route   GET /api/activity-logs/user/:userId
// ========================================

exports.getUserActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const logs = await ActivityLog.find({ userId })
      .populate("userId", "username fullName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ActivityLog.countDocuments({ userId });

    res.status(200).json({
      success: true,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalLogs: total,
      data: logs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};