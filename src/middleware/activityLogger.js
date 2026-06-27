const ActivityLog = require("../models/ActivityLog");

/**
 * ✅ تسجيل نشاط
 */
const logActivity = async (req, action, entity, entityId, entityName = "", changes = {}, details = "") => {
  try {
    if (!req.user) {
      return;
    }

    const log = new ActivityLog({
      userId: req.user._id,
      username: req.user.username,
      userRole: req.user.role,
      action,
      entity,
      entityId,
      entityName,
      changes,
      details,
      ipAddress: req.ip || req.connection?.remoteAddress || "",
    });

    await log.save();
  } catch (error) {
    console.error("❌ Failed to log activity:", error.message);
  }
};

module.exports = {
  logActivity,
};