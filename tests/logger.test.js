// Mock Log and SuspiciousUser models
const mockLogs = [];
const mockFlags = [];

jest.mock('../src/models/Log', () => {
  const { Op } = require('sequelize');
  return {
    create: jest.fn(async (data) => {
      const log = { id: `log-${Date.now()}-${Math.random()}`, ...data };
      mockLogs.push(log);
      return log;
    }),
    findAll: jest.fn(async ({ limit = 100 }) => {
      return [...mockLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }),
    count: jest.fn(async ({ where = {} }) => {
      return mockLogs.filter(l => {
        const userOk    = where.userId    ? l.userId === where.userId       : true;
        const emailOk   = where.userEmail ? l.userEmail === where.userEmail : true;
        const actionOk  = where.action
          ? (Array.isArray(where.action?.['Symbol(in)']) ? where.action['Symbol(in)'].includes(l.action) : l.action === where.action)
          : true;
        const successOk = where.success !== undefined ? l.success === where.success : true;
        const timeOk    = where.timestamp?.['Symbol(gte)']
          ? new Date(l.timestamp) >= where.timestamp['Symbol(gte)']
          : true;
        return userOk && emailOk && actionOk && successOk && timeOk;
      }).length;
    }),
  };
});

jest.mock('../src/models/SuspiciousUser', () => ({
  create: jest.fn(async (data) => {
    const flag = { id: `flag-${Date.now()}`, ...data };
    mockFlags.push(flag);
    return flag;
  }),
  findOne: jest.fn(async ({ where = {} }) => {
    return mockFlags.find(f =>
      (!where.userId || f.userId === where.userId) &&
      (!where.userEmail || f.userEmail === where.userEmail) &&
      (!where.reason || f.reason === where.reason) &&
      (where.resolved === undefined || f.resolved === where.resolved)
    ) || null;
  }),
  findAll: jest.fn(async () => [...mockFlags].sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))),
  findByPk: jest.fn(async (id) => {
    const flag = mockFlags.find(f => f.id === id);
    if (!flag) return null;
    flag.update = async (d) => { Object.assign(flag, d); return flag; };
    return flag;
  }),
}));

beforeEach(() => {
  mockLogs.length = 0;
  mockFlags.length = 0;
  jest.clearAllMocks();
});

const logger = require('../src/services/loggerService');

describe('logAction', () => {
  it('creates a log entry with all fields', async () => {
    const Log = require('../src/models/Log');
    await logger.logAction({ userId: 'u1', userEmail: 'a@b.com', userRole: 'admin', action: 'LOGIN', success: true });
    expect(Log.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', userEmail: 'a@b.com', userRole: 'admin', action: 'LOGIN', success: true,
    }));
  });

  it('logs with null userId when not provided', async () => {
    const Log = require('../src/models/Log');
    await logger.logAction({ action: 'LOGIN', success: false, userEmail: 'x@y.com' });
    expect(Log.create).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it('serializes details as JSON string', async () => {
    const Log = require('../src/models/Log');
    await logger.logAction({ userId: 'u1', action: 'CREATE_TRANSACTION', details: { amount: 50 } });
    expect(Log.create).toHaveBeenCalledWith(expect.objectContaining({ details: '{"amount":50}' }));
  });

  it('stores null details when not provided', async () => {
    const Log = require('../src/models/Log');
    await logger.logAction({ userId: 'u1', action: 'LOGIN' });
    expect(Log.create).toHaveBeenCalledWith(expect.objectContaining({ details: null }));
  });

  it('does not throw if Log.create fails', async () => {
    const Log = require('../src/models/Log');
    Log.create.mockRejectedValueOnce(new Error('DB error'));
    await expect(logger.logAction({ action: 'LOGIN' })).resolves.not.toThrow();
  });
});

describe('getLogs', () => {
  it('returns all logs', async () => {
    await logger.logAction({ userId: 'u1', action: 'LOGIN' });
    await logger.logAction({ userId: 'u1', action: 'CREATE_TRANSACTION' });
    const logs = await logger.getLogs(100);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('respects the limit parameter', async () => {
    const Log = require('../src/models/Log');
    await logger.getLogs(50);
    expect(Log.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });
});

describe('getSuspiciousUsers', () => {
  it('returns empty array when no flags', async () => {
    const flags = await logger.getSuspiciousUsers();
    expect(Array.isArray(flags)).toBe(true);
  });
});

describe('resolveFlag', () => {
  it('resolves an existing flag', async () => {
    const SuspiciousUser = require('../src/models/SuspiciousUser');
    const flag = { id: 'flag-1', resolved: false, update: jest.fn(async (d) => Object.assign(flag, d)) };
    SuspiciousUser.findByPk.mockResolvedValueOnce(flag);
    const result = await logger.resolveFlag('flag-1');
    expect(flag.update).toHaveBeenCalledWith({ resolved: true });
    expect(result.resolved).toBe(true);
  });

  it('returns null for unknown flag id', async () => {
    const SuspiciousUser = require('../src/models/SuspiciousUser');
    SuspiciousUser.findByPk.mockResolvedValueOnce(null);
    const result = await logger.resolveFlag('bad-id');
    expect(result).toBeNull();
  });
});