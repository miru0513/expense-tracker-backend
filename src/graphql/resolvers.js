const crypto = require('crypto');
const bcrypt = require('bcrypt');
const store = require('../store/dbStore');
const userStore = require('../store/userStore');
const generator = require('../services/generatorService');
const logger = require('../services/loggerService');
const { signToken, JWT_SECRET } = require('../services/jwtService');
const sessionService = require('../services/sessionService');
const { sendPasswordResetEmail, sendLoginOtpEmail } = require('../services/emailService');
const { PasswordResetToken, User, LoginOtp } = require('../models');
const jwt = require('jsonwebtoken');
const { requireAuth, requireAdmin, requirePermission } = require('../middleware/authMiddleware');

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Other'];
const INCOME_CATEGORIES  = ['Salary', 'Freelance', 'Gifts', 'Investments', 'Refund', 'Other'];
const ALL_CATEGORIES     = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

const validateTransaction = ({ type, title, amount, category, date }) => {
  if (!['expense', 'income'].includes(type)) throw new Error('type must be "expense" or "income"');
  if (!title || title.trim().length < 3) throw new Error('title must be at least 3 characters');
  if (!amount || amount <= 0) throw new Error('amount must be a positive number greater than 0');
  if (!ALL_CATEGORIES.includes(category)) throw new Error(`category must be one of: ${ALL_CATEGORIES.join(', ')}`);
  if (!date || isNaN(Date.parse(date))) throw new Error('date must be a valid date (YYYY-MM-DD)');
};

const formatStats = (stats) => ({
  ...stats,
  byCategory: Object.entries(stats.byCategory).map(([category, total]) => ({ category, total })),
});

const formatLog = (l) => ({
  id:        l.id,
  userId:    l.userId,
  userEmail: l.userEmail,
  userRole:  l.userRole,
  action:    l.action,
  details:   l.details,
  ipAddress: l.ipAddress,
  success:   l.success,
  timestamp: l.timestamp ? new Date(l.timestamp).toISOString() : new Date().toISOString(),
});

const formatFlag = (f) => ({
  id:          f.id,
  userId:      f.userId,
  userEmail:   f.userEmail,
  userRole:    f.userRole,
  reason:      f.reason,
  actionCount: f.actionCount,
  detectedAt:  f.detectedAt ? new Date(f.detectedAt).toISOString() : new Date().toISOString(),
  resolved:    f.resolved,
});

const resolvers = {
  Query: {
    transactions: async (_, { page = 1, limit = 5, tripId = null, type = null, userId = null }, context) => {
      const ctxUser = requirePermission(context, 'transaction:read');
      const effectiveUserId = ctxUser.role === 'admin' ? userId : ctxUser.id;
      return await store.getTransactions(tripId, page, limit, type, effectiveUserId);
    },
    transaction: async (_, { id }, context) => {
      const ctxUser = requirePermission(context, 'transaction:read');
      const t = await store.getTransactionById(id);
      if (!t) throw new Error('Transaction not found');
      if (ctxUser.role !== 'admin' && t.userId !== ctxUser.id) throw new Error('Not authorized');
      return t;
    },
    statistics: async (_, { tripId = null, userId = null }, context) => {
      const ctxUser = requirePermission(context, 'stats:view');
      const effectiveUserId = ctxUser.role === 'admin' ? userId : ctxUser.id;
      return formatStats(await store.getStatistics(tripId, effectiveUserId));
    },
    trips: async (_, { page = 1, limit = 10, userId = null }, context) => {
      const ctxUser = requirePermission(context, 'trip:read');
      const effectiveUserId = ctxUser.role === 'admin' ? userId : ctxUser.id;
      return await store.getTrips(page, limit, effectiveUserId);
    },
    trip: async (_, { id }, context) => {
      const ctxUser = requirePermission(context, 'trip:read');
      const t = await store.getTripById(id);
      if (!t) throw new Error('Trip not found');
      if (ctxUser.role !== 'admin' && t.userId !== ctxUser.id) throw new Error('Not authorized');
      return t;
    },
    tripStatistics: async (_, { id, userId = null }, context) => {
      const ctxUser = requirePermission(context, 'trip:read');
      const trip = await store.getTripById(id);
      if (!trip) throw new Error('Trip not found');
      if (ctxUser.role !== 'admin' && trip.userId !== ctxUser.id) throw new Error('Not authorized');
      return { trip, stats: formatStats(await store.getStatistics(id, userId)) };
    },
    generatorStatus: (_, __, context) => { requireAuth(context); return { running: generator.isRunning() }; },
    users: async (_, __, context) => {
      requireAdmin(context);
      return await userStore.getUsers();
    },
    user: async (_, { id }, context) => {
      const ctxUser = requireAuth(context);
      if (ctxUser.role !== 'admin' && ctxUser.id !== id) throw new Error('Not authorized');
      const u = await userStore.getUserById(id);
      if (!u) throw new Error('User not found');
      return u;
    },
    roles: async (_, __, context) => {
      requireAuth(context);
      return await userStore.getRoles();
    },
    role: async (_, { id }, context) => {
      requireAuth(context);
      const r = await userStore.getRoleById(id);
      if (!r) throw new Error('Role not found');
      return r;
    },
    permissions: async (_, __, context) => {
      requireAuth(context);
      return await userStore.getPermissions();
    },
    myPermissions: async (_, { userId }, context) => {
      const ctxUser = requireAuth(context);
      if (ctxUser.role !== 'admin' && ctxUser.id !== userId) throw new Error('Not authorized');
      return await userStore.getUserPermissions(userId);
    },
    logs: async (_, { limit = 100 }, context) => {
      requireAdmin(context);
      const logs = await logger.getLogs(limit);
      return logs.map(formatLog);
    },
    suspiciousUsers: async (_, __, context) => {
      requireAdmin(context);
      const flags = await logger.getSuspiciousUsers();
      return flags.map(formatFlag);
    },
    mySessions: async (_, __, context) => {
      const user = requireAuth(context);
      const sessions = await sessionService.getUserSessions(user.id);
      return sessions.map(sessionService.formatSession);
    },
    allSessions: async (_, __, context) => {
      requireAdmin(context);
      const sessions = await sessionService.getAllSessions();
      return sessions.map(sessionService.formatSession);
    },
    me: async (_, __, context) => {
      const user = requireAuth(context);
      return userStore.getUserById(user.id);
    },

  },

  Mutation: {
    // ── Transactions ───────────────────────────────────────────────────────────
    createTransaction: async (_, args, context) => {
      const ctxUser = requirePermission(context, 'transaction:create');
      validateTransaction(args);
      const userId = ctxUser.role === 'admin' ? (args.userId || ctxUser.id) : ctxUser.id;
      const t = await store.addTransaction({
        type: args.type, title: args.title.trim(), amount: parseFloat(args.amount),
        category: args.category, date: args.date, tripId: args.tripId || null, userId,
      });
      await logger.logAction({ userId: ctxUser.id, action: 'CREATE_TRANSACTION', details: { title: t.title, amount: t.amount, type: t.type } });
      return t;
    },
    updateTransaction: async (_, args, context) => {
      const ctxUser = requirePermission(context, 'transaction:update');
      const existing = await store.getTransactionById(args.id);
      if (!existing) throw new Error('Transaction not found');
      if (ctxUser.role !== 'admin' && existing.userId !== ctxUser.id) throw new Error('Not authorized');
      validateTransaction(args);
      const t = await store.updateTransaction(args.id, {
        type: args.type, title: args.title.trim(), amount: parseFloat(args.amount),
        category: args.category, date: args.date,
        tripId: args.tripId !== undefined ? args.tripId : existing.tripId,
        userId: existing.userId,
      });
      await logger.logAction({ userId: ctxUser.id, action: 'UPDATE_TRANSACTION', details: { id: args.id, title: t.title } });
      return t;
    },
    deleteTransaction: async (_, { id }, context) => {
      const ctxUser = requirePermission(context, 'transaction:delete');
      if (ctxUser.role !== 'admin') {
        const tx = await store.getTransactionById(id);
        if (!tx) throw new Error('Transaction not found');
        if (tx.userId !== ctxUser.id) throw new Error('Not authorized to delete this transaction');
      }
      const deleted = await store.deleteTransaction(id);
      if (!deleted) throw new Error('Transaction not found');
      await logger.logAction({ userId: ctxUser.id, userEmail: ctxUser.email, userRole: ctxUser.role, action: 'DELETE_TRANSACTION', details: { id } });
      return true;
    },

    // ── Trips ──────────────────────────────────────────────────────────────────
    createTrip: async (_, { name, icon }, context) => {
      const ctxUser = requirePermission(context, 'trip:create');
      if (!name || name.trim().length === 0) throw new Error('name must not be empty');
      const t = await store.addTrip({ name, icon, userId: ctxUser.id });
      await logger.logAction({ userId: ctxUser.id, action: 'CREATE_TRIP', details: { name } });
      return t;
    },
    updateTrip: async (_, { id, name, icon }, context) => {
      const ctxUser = requirePermission(context, 'trip:update');
      const existing = await store.getTripById(id);
      if (!existing) throw new Error('Trip not found');
      if (ctxUser.role !== 'admin' && existing.userId !== ctxUser.id) throw new Error('Not authorized');
      const t = await store.updateTrip(id, { name, icon });
      await logger.logAction({ userId: ctxUser.id, userEmail: ctxUser.email, userRole: ctxUser.role, action: 'UPDATE_TRIP', details: { id, name } });
      return t;
    },
    deleteTrip: async (_, { id }, context) => {
      const ctxUser = requirePermission(context, 'trip:delete');
      if (ctxUser.role !== 'admin') {
        const trip = await store.getTripById(id);
        if (!trip) throw new Error('Trip not found');
        if (trip.userId !== ctxUser.id) throw new Error('Not authorized to delete this trip');
      }
      const deleted = await store.deleteTrip(id);
      if (!deleted) throw new Error('Trip not found');
      await logger.logAction({ userId: ctxUser.id, userEmail: ctxUser.email, userRole: ctxUser.role, action: 'DELETE_TRIP', details: { id } });
      return true;
    },

    // ── Generator ──────────────────────────────────────────────────────────────
    startGenerator: (_, { batchSize = 3, intervalMs = 2000, tripId = null, userId = null }, context) => {
      const ctxUser = requirePermission(context, 'generator:start');
      if (batchSize < 1 || batchSize > 20) throw new Error('batchSize must be between 1 and 20');
      if (intervalMs < 500 || intervalMs > 30000) throw new Error('intervalMs must be between 500 and 30000');
      logger.logAction({ userId: ctxUser.id, action: 'START_GENERATOR', details: { batchSize, intervalMs } });
      return generator.startGenerator(batchSize, intervalMs, tripId, ctxUser.id);
    },
    stopGenerator: (_, __, context) => {
      requirePermission(context, 'generator:stop');
      logger.logAction({ action: 'STOP_GENERATOR' });
      return generator.stopGenerator();
    },

    // ── Auth (public — no requireAuth) ─────────────────────────────────────────
    register: async (_, { name, email, password, role, securityQuestion, securityAnswer }, context) => {
      try {
        if (!name || name.trim().length < 2) throw new Error('Name must be at least 2 characters');
        if (!email || !email.includes('@')) throw new Error('Must be a valid email');
        if (!password || password.length < 4) throw new Error('Password must be at least 4 characters');
        if (!securityQuestion || !securityQuestion.trim()) throw new Error('Security question is required');
        if (!securityAnswer || securityAnswer.trim().length < 2) throw new Error('Security answer must be at least 2 characters');
        const user = await userStore.registerUser({ name, email, password, roleName: role || 'normal_user', securityQuestion: securityQuestion.trim(), securityAnswer });
        const perms = user.role?.permissions?.map(p => p.name) || [];
        const { token, jti } = signToken({ id: user.id, name: user.name, email: user.email, role: user.role?.name, permissions: perms });
        await sessionService.createSession({ userId: user.id, tokenId: jti, name: 'Registration', permissions: perms, expiresIn: '24h', ipAddress: context.ip });
        await logger.logAction({ userId: user.id, userEmail: email, userRole: user.role?.name, action: 'REGISTER', success: true });
        return { success: true, message: 'Registration successful', user, token };
      } catch (err) {
        await logger.logAction({ userEmail: email, action: 'REGISTER', success: false, details: { error: err.message } });
        return { success: false, message: err.message, user: null, token: null };
      }
    },
    login: async (_, { email, password }, context) => {
      try {
        // Step 1: validate credentials
        const user = await userStore.loginUser({ email, password });

        // Invalidate any existing unused OTPs
        await LoginOtp.update({ used: true }, { where: { userId: user.id, used: false } });

        // Generate 6-digit OTP
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await LoginOtp.create({ userId: user.id, code, expiresAt });

        await sendLoginOtpEmail(email, code);
        await logger.logAction({ userId: user.id, userEmail: email, action: 'LOGIN_STEP1', success: true });

        // Pending token carries just enough info to identify the user in next steps
        const pendingToken = jwt.sign(
          { userId: user.id, step: 'otp' },
          JWT_SECRET,
          { expiresIn: '15m' }
        );
        return { success: true, message: 'Verification code sent to your email.', pendingToken };
      } catch (err) {
        await logger.logAction({ userEmail: email, action: 'LOGIN_STEP1', success: false, details: { error: err.message } });
        return { success: false, message: err.message };
      }
    },

    verifyLoginCode: async (_, { pendingToken, code }) => {
      try {
        let payload;
        try {
          payload = jwt.verify(pendingToken, JWT_SECRET);
        } catch {
          return { success: false, message: 'Session expired. Please log in again.' };
        }
        if (payload.step !== 'otp') return { success: false, message: 'Invalid authentication step.' };

        const otpRecord = await LoginOtp.findOne({ where: { userId: payload.userId, used: false } });
        if (!otpRecord || new Date(otpRecord.expiresAt) < new Date())
          return { success: false, message: 'Code has expired. Please log in again.' };
        if (otpRecord.code !== code.trim())
          return { success: false, message: 'Incorrect code. Please try again.' };

        await otpRecord.update({ used: true });

        const rawUser = await userStore.getRawUserById(payload.userId);
        if (!rawUser) return { success: false, message: 'User not found.' };

        // If user has no security question, skip step 3 and issue full token
        if (!rawUser.securityQuestion) {
          const user = await userStore.getUserById(payload.userId);
          const perms = rawUser.role?.permissions?.map(p => p.name) || [];
          const { token, jti } = signToken({ id: rawUser.id, name: rawUser.name, email: rawUser.email, role: rawUser.role?.name, permissions: perms });
          await sessionService.createSession({ userId: rawUser.id, tokenId: jti, name: 'Login', permissions: perms, expiresIn: '24h' });
          await logger.logAction({ userId: rawUser.id, userEmail: rawUser.email, action: 'LOGIN', success: true });
          return { success: true, message: 'Login successful', user, token };
        }

        // Advance to step 3 — security question
        const nextToken = jwt.sign(
          { userId: payload.userId, step: 'security' },
          JWT_SECRET,
          { expiresIn: '10m' }
        );
        return { success: true, message: 'Code verified.', pendingToken: nextToken, securityQuestion: rawUser.securityQuestion };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },

    verifySecurityQuestion: async (_, { pendingToken, answer }, context) => {
      try {
        let payload;
        try {
          payload = jwt.verify(pendingToken, JWT_SECRET);
        } catch {
          return { success: false, message: 'Session expired. Please log in again.' };
        }
        if (payload.step !== 'security') return { success: false, message: 'Invalid authentication step.' };

        const rawUser = await userStore.getRawUserById(payload.userId);
        if (!rawUser) return { success: false, message: 'User not found.' };

        const isCorrect = await bcrypt.compare(answer.trim().toLowerCase(), rawUser.securityAnswerHash);
        if (!isCorrect) return { success: false, message: 'Incorrect answer. Please try again.' };

        const formatted = await userStore.getUserById(payload.userId);
        const perms = rawUser.role?.permissions?.map(p => p.name) || [];
        const { token, jti } = signToken({ id: rawUser.id, name: rawUser.name, email: rawUser.email, role: rawUser.role?.name, permissions: perms });
        await sessionService.createSession({ userId: rawUser.id, tokenId: jti, name: 'Login', permissions: perms, expiresIn: '24h', ipAddress: context.ip });
        await logger.logAction({ userId: rawUser.id, userEmail: rawUser.email, action: 'LOGIN', success: true });
        return { success: true, message: 'Login successful', user: formatted, token };
      } catch (err) {
        return { success: false, message: err.message };
      }
    },
    logout: async (_, __, context) => {
      const user = requireAuth(context);
      if (user.jti) await sessionService.revokeByTokenId(user.jti);
      await logger.logAction({ userId: user.id, userEmail: user.email, userRole: user.role, action: 'LOGOUT', success: true });
      return true;
    },

    // ── User management (admin only) ───────────────────────────────────────────
    updateUserRole: async (_, { userId, roleName }, context) => {
      requirePermission(context, 'user:manage');
      const u = await userStore.updateUserRole(userId, roleName);
      await logger.logAction({ action: 'UPDATE_USER_ROLE', details: { userId, roleName } });
      return u;
    },
    deactivateUser: async (_, { userId }, context) => {
      requirePermission(context, 'user:manage');
      const u = await userStore.deactivateUser(userId);
      await logger.logAction({ action: 'DEACTIVATE_USER', details: { userId } });
      return u;
    },

    // ── Security ───────────────────────────────────────────────────────────────
    resolveFlag: async (_, { id }, context) => {
      requireAdmin(context);
      const flag = await logger.resolveFlag(id);
      if (!flag) throw new Error('Flag not found');
      return formatFlag(flag);
    },

    // ── Password recovery ──────────────────────────────────────────────────────
    forgotPassword: async (_, { email }) => {
      // Always return success to avoid user enumeration
      const user = await userStore.getUserByEmail(email);
      if (!user) return { success: true, message: 'If that email exists, a reset link has been sent.' };

      // Invalidate any existing unused tokens for this user
      await PasswordResetToken.update({ used: true }, { where: { userId: user.id, used: false } });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await PasswordResetToken.create({ userId: user.id, token, expiresAt });

      const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';
      const resetLink = `${frontendUrl}?reset_token=${token}`;
      await sendPasswordResetEmail(email, resetLink);

      return { success: true, message: 'If that email exists, a reset link has been sent.' };
    },
    resetPassword: async (_, { token, newPassword }) => {
      if (!newPassword || newPassword.length < 4)
        return { success: false, message: 'Password must be at least 4 characters' };

      const record = await PasswordResetToken.findOne({ where: { token, used: false } });
      if (!record || new Date(record.expiresAt) < new Date())
        return { success: false, message: 'Reset link is invalid or has expired' };

      const hashed = await bcrypt.hash(newPassword, 10);
      await User.update({ password: hashed }, { where: { id: record.userId } });
      await record.update({ used: true });

      return { success: true, message: 'Password updated successfully. You can now log in.' };
    },

    // ── Sessions ───────────────────────────────────────────────────────────────
    revokeSession: async (_, { sessionId }, context) => {
      const user = requireAuth(context);
      return sessionService.revokeSession(sessionId, user.id, user.role === 'admin');
    },
    revokeAllSessions: async (_, __, context) => {
      const user = requireAuth(context);
      await sessionService.revokeAllUserSessions(user.id);
      return true;
    },
    generateToken: async (_, { name, permissions: requested, expiresIn = '24h' }, context) => {
      const user = requireAuth(context);
      const allowed = user.role === 'admin'
        ? requested  // admin can generate any permission set
        : requested.filter(p => (user.permissions || []).includes(p)); // normal user: only subset of own perms
      if (allowed.length === 0) throw new Error('No valid permissions requested');
      const validExpiry = ['1h', '6h', '24h', '7d', '30d'].includes(expiresIn) ? expiresIn : '24h';
      const { token, jti } = signToken({ id: user.id, name: user.name, email: user.email, role: user.role, permissions: allowed }, validExpiry);
      const session = await sessionService.createSession({ userId: user.id, tokenId: jti, name, permissions: allowed, expiresIn: validExpiry, ipAddress: context.ip });
      await logger.logAction({ userId: user.id, userEmail: user.email, userRole: user.role, action: 'GENERATE_TOKEN', details: { name, permissions: allowed, expiresIn: validExpiry } });
      return {
        token,
        sessionId: session.id,
        name,
        permissions: allowed,
        expiresAt: sessionService.expiresAtFrom(validExpiry).toISOString(),
      };
    },
  },
};

module.exports = resolvers;
