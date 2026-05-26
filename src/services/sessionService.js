const { Session } = require('../models');
const { Op } = require('sequelize');

const DURATION_MS = {
  '1h':  1  * 60 * 60 * 1000,
  '6h':  6  * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const expiresAtFrom = (dur) =>
  new Date(Date.now() + (DURATION_MS[dur] || DURATION_MS['24h']));

const createSession = ({ userId, tokenId, name = 'Session', permissions = [], expiresIn = '24h', ipAddress = null }) =>
  Session.create({ userId, tokenId, name, permissions, expiresAt: expiresAtFrom(expiresIn), ipAddress });

const isSessionValid = async (jti) => {
  if (!jti) return false;
  const s = await Session.findOne({
    where: { tokenId: jti, isRevoked: false, expiresAt: { [Op.gt]: new Date() } },
    attributes: ['id'],
  });
  return !!s;
};

const getUserSessions = (userId) =>
  Session.findAll({
    where: { userId, isRevoked: false, expiresAt: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });

const getAllSessions = () =>
  Session.findAll({
    where: { isRevoked: false, expiresAt: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });

const revokeSession = async (sessionId, requestingUserId, isAdmin) => {
  const s = await Session.findByPk(sessionId);
  if (!s) throw new Error('Session not found');
  if (!isAdmin && s.userId !== requestingUserId) throw new Error('Not authorized');
  await s.update({ isRevoked: true });
  return true;
};

const revokeAllUserSessions = (userId) =>
  Session.update({ isRevoked: true }, { where: { userId, isRevoked: false } });

const revokeByTokenId = (jti) =>
  Session.update({ isRevoked: true }, { where: { tokenId: jti } });

const formatSession = (s) => ({
  id:          s.id,
  userId:      s.userId,
  name:        s.name,
  permissions: s.permissions || [],
  expiresAt:   new Date(s.expiresAt).toISOString(),
  isRevoked:   s.isRevoked,
  ipAddress:   s.ipAddress || null,
  createdAt:   new Date(s.createdAt).toISOString(),
});

module.exports = {
  createSession, isSessionValid,
  getUserSessions, getAllSessions,
  revokeSession, revokeAllUserSessions, revokeByTokenId,
  formatSession, expiresAtFrom, DURATION_MS,
};
