const { Op } = require('sequelize');
const Log = require('../models/Log');
const SuspiciousUser = require('../models/SuspiciousUser');

const logAction = async ({ userId, userEmail, userRole, action, details = null, ipAddress = null, success = true }) => {
  try {
    await Log.create({
      userId: userId || null,
      userEmail: userEmail || null,
      userRole: userRole || null,
      action,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      success,
      timestamp: new Date(),
    });
    if (userId || userEmail) {
      await detectMalevolentBehavior(userId, userEmail, userRole);
    }
  } catch (err) {
    console.error('[Logger] Failed to log action:', err.message);
  }
};

const detectMalevolentBehavior = async (userId, userEmail, userRole) => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
  const oneMinuteAgo   = new Date(now - 60 * 1000);

  try {
    if (userId) {
      const deleteCount = await Log.count({
        where: {
          userId,
          action: { [Op.in]: ['DELETE_TRANSACTION', 'DELETE_TRIP'] },
          timestamp: { [Op.gte]: fiveMinutesAgo },
        },
      });
      if (deleteCount >= 3) {
        await flagUser(userId, userEmail, userRole, `${deleteCount} DELETE actions in 5 minutes`, deleteCount);
        return;
      }

      const rapidCount = await Log.count({
        where: {
          userId,
          timestamp: { [Op.gte]: oneMinuteAgo },
        },
      });
      if (rapidCount >= 10) {
        await flagUser(userId, userEmail, userRole, `${rapidCount} actions in 1 minute (possible bot)`, rapidCount);
        return;
      }
    }

    if (userEmail) {
      const failedLogins = await Log.count({
        where: {
          userEmail,
          action: 'LOGIN',
          success: false,
          timestamp: { [Op.gte]: fiveMinutesAgo },
        },
      });
      if (failedLogins >= 2) {
        await flagUser(userId || null, userEmail, userRole || 'unknown',
          `${failedLogins} failed login attempts in 5 minutes`, failedLogins);
      }
    }
  } catch (err) {
    console.error('[Logger] Detection error:', err.message);
  }
};

const flagUser = async (userId, userEmail, userRole, reason, actionCount) => {
  try {
    const where = userId
      ? { userId, reason, resolved: false }
      : { userEmail, reason, resolved: false };
    const existing = await SuspiciousUser.findOne({ where });
    if (!existing) {
      await SuspiciousUser.create({
        userId: userId || '00000000-0000-0000-0000-000000000000',
        userEmail, userRole, reason, actionCount,
        detectedAt: new Date(), resolved: false,
      });
      console.warn(`[Security] 🚨 Flagged: ${userEmail} — ${reason}`);
    }
  } catch (err) {
    console.error('[Logger] Failed to flag user:', err.message);
  }
};

const getLogs = async (limit = 100) => {
  return await Log.findAll({ order: [['timestamp', 'DESC']], limit });
};

const getSuspiciousUsers = async () => {
  return await SuspiciousUser.findAll({ order: [['detectedAt', 'DESC']] });
};

const resolveFlag = async (id) => {
  const flag = await SuspiciousUser.findByPk(id);
  if (!flag) return null;
  await flag.update({ resolved: true });
  return flag;
};

module.exports = { logAction, getLogs, getSuspiciousUsers, resolveFlag };
