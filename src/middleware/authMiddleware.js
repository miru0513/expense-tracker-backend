const { verifyToken } = require('../services/jwtService');
const { isSessionValid } = require('../services/sessionService');

// Async — verifies JWT signature then confirms the session has not been revoked.
const extractUserFromRequest = async (req) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decoded = verifyToken(authHeader.slice(7));
  if (!decoded) return null;
  if (!await isSessionValid(decoded.jti)) return null;
  return decoded;
};

const requireAuth = (context) => {
  if (!context || !context.user) throw new Error('Authentication required');
  return context.user;
};

const requireAdmin = (context) => {
  const user = requireAuth(context);
  if (user.role !== 'admin') throw new Error('Admin access required');
  return user;
};

// Checks a named permission from the JWT payload.
// Admins always pass (they hold every permission).
// Throws if the token doesn't carry the required permission.
const requirePermission = (context, permName) => {
  const user = requireAuth(context);
  if (user.role === 'admin') return user;
  if (!Array.isArray(user.permissions) || !user.permissions.includes(permName)) {
    throw new Error(`Permission denied: "${permName}" required`);
  }
  return user;
};

module.exports = { extractUserFromRequest, requireAuth, requireAdmin, requirePermission };
