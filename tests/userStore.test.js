// Bcrypt mock — deterministic hash so tests run fast without real hashing
jest.mock('bcrypt', () => ({
  hash:    jest.fn(async (plain)        => `$2b$10$hashed_${plain}`),
  compare: jest.fn(async (plain, hash) => hash === `$2b$10$hashed_${plain}`),
}));

// Mock models/index for userStore
const mockUsers = [];
const mockRoles = [
  { id: 1, name: 'admin',       description: 'Full access',  permissions: [] },
  { id: 2, name: 'normal_user', description: 'Restricted',   permissions: [] },
];
const mockPerms = [
  { id: 1, name: 'transaction:create', description: 'Create transactions' },
  { id: 2, name: 'transaction:delete', description: 'Delete transactions' },
];

const makeUser = (data) => {
  const role = mockRoles.find(r => r.id === data.roleId) || mockRoles[1];
  return {
    id:        data.id || `user-${Date.now()}-${Math.random()}`,
    name:      data.name,
    email:     data.email,
    // Store the "hashed" version so bcrypt.compare works with the mock
    password:  data.password ? `$2b$10$hashed_${data.password}` : '',
    roleId:    data.roleId,
    isActive:  data.isActive !== false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    role:      { ...role, permissions: mockPerms },
    toJSON()   { return { ...this }; },
    update:    async function(d) { Object.assign(this, d); return this; },
  };
};

jest.mock('../src/models/index', () => {
  const User = {
    findOne: jest.fn(async ({ where }) =>
      mockUsers.find(u => {
        if (where.email !== undefined && u.email !== where.email) return false;
        if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
        return true;
      }) || null
    ),
    findByPk: jest.fn(async (id) => {
      const u = mockUsers.find(u => u.id === id);
      return u ? { ...u, createdAt: new Date('2026-01-01T00:00:00.000Z') } : null;
    }),
    findAll: jest.fn(async () => [...mockUsers]),
    create:  jest.fn(async (data) => {
      const u = makeUser(data);
      u.createdAt = new Date('2026-01-01T00:00:00.000Z');
      // Store already-hashed password as-is (register hashes before calling create)
      u.password = data.password;
      mockUsers.push(u);
      return u;
    }),
  };

  const Role = {
    findOne:  jest.fn(async ({ where }) => mockRoles.find(r => r.name === where.name) || null),
    findByPk: jest.fn(async (id)        => mockRoles.find(r => r.id === id) || null),
    findAll:  jest.fn(async ()          => mockRoles),
  };

  const Permission = {
    findAll:  jest.fn(async () => mockPerms),
    findByPk: jest.fn(async (id) => mockPerms.find(p => p.id === id) || null),
  };

  return { User, Role, Permission };
});

beforeEach(() => {
  mockUsers.length = 0;
  jest.clearAllMocks();
});

const userStore = require('../src/store/userStore');
const bcrypt    = require('bcrypt');

// ── registerUser ──────────────────────────────────────────────────────────────

describe('registerUser', () => {
  it('creates a new user with a hashed password', async () => {
    const user = await userStore.registerUser({ name: 'Alice', email: 'alice@test.com', password: 'pass123' });
    expect(user).toBeDefined();
    expect(user.email).toBe('alice@test.com');
    expect(user.name).toBe('Alice');
    expect(bcrypt.hash).toHaveBeenCalledWith('pass123', 10);
  });

  it('does not expose the password in the returned user object', async () => {
    const user = await userStore.registerUser({ name: 'Alice', email: 'alice@test.com', password: 'pass123' });
    expect(user.password).toBeUndefined();
  });

  it('throws if email already registered', async () => {
    const { User } = require('../src/models/index');
    User.findOne.mockResolvedValueOnce({ id: 'existing', email: 'dupe@test.com' });
    await expect(userStore.registerUser({ name: 'Bob', email: 'dupe@test.com', password: 'pass' }))
      .rejects.toThrow('Email already registered');
  });

  it('throws if role not found', async () => {
    const { Role } = require('../src/models/index');
    Role.findOne.mockResolvedValueOnce(null);
    await expect(userStore.registerUser({ name: 'Bob', email: 'bob@test.com', password: 'pass', roleName: 'superadmin' }))
      .rejects.toThrow('Role "superadmin" not found');
  });
});

// ── loginUser ─────────────────────────────────────────────────────────────────

describe('loginUser', () => {
  it('returns user on valid credentials', async () => {
    const { User } = require('../src/models/index');
    const fakeUser = makeUser({ name: 'Carol', email: 'carol@test.com', password: 'secret', roleId: 2 });
    User.findOne.mockResolvedValueOnce(fakeUser);

    const result = await userStore.loginUser({ email: 'carol@test.com', password: 'secret' });
    expect(result.email).toBe('carol@test.com');
    expect(bcrypt.compare).toHaveBeenCalledWith('secret', fakeUser.password);
  });

  it('throws on wrong password', async () => {
    const { User } = require('../src/models/index');
    const fakeUser = makeUser({ name: 'Carol', email: 'carol@test.com', password: 'secret', roleId: 2 });
    User.findOne.mockResolvedValueOnce(fakeUser);

    await expect(userStore.loginUser({ email: 'carol@test.com', password: 'wrong' }))
      .rejects.toThrow('Invalid password');
  });

  it('throws if user not found or inactive', async () => {
    const { User } = require('../src/models/index');
    User.findOne.mockResolvedValueOnce(null);
    await expect(userStore.loginUser({ email: 'nobody@test.com', password: 'pass' }))
      .rejects.toThrow('User not found or account deactivated');
  });

  it('does not expose password in returned user', async () => {
    const { User } = require('../src/models/index');
    const fakeUser = makeUser({ name: 'Carol', email: 'carol@test.com', password: 'secret', roleId: 2 });
    User.findOne.mockResolvedValueOnce(fakeUser);

    const result = await userStore.loginUser({ email: 'carol@test.com', password: 'secret' });
    expect(result.password).toBeUndefined();
  });
});

// ── getUsers ──────────────────────────────────────────────────────────────────

describe('getUsers', () => {
  it('returns list of users', async () => {
    const { User } = require('../src/models/index');
    User.findAll.mockResolvedValueOnce([
      makeUser({ name: 'Dan', email: 'dan@test.com', password: 'p', roleId: 1 }),
    ]);
    const users = await userStore.getUsers();
    expect(Array.isArray(users)).toBe(true);
  });
});

// ── getUserById ───────────────────────────────────────────────────────────────

describe('getUserById', () => {
  it('returns null for unknown id', async () => {
    const { User } = require('../src/models/index');
    User.findByPk.mockResolvedValueOnce(null);
    expect(await userStore.getUserById('bad-id')).toBeNull();
  });
});

// ── updateUserRole ────────────────────────────────────────────────────────────

describe('updateUserRole', () => {
  it('throws if user not found', async () => {
    const { User } = require('../src/models/index');
    User.findByPk.mockResolvedValueOnce(null);
    await expect(userStore.updateUserRole('bad-id', 'admin')).rejects.toThrow('User not found');
  });

  it('throws if role not found', async () => {
    const { User, Role } = require('../src/models/index');
    const fakeUser = makeUser({ name: 'Eve', email: 'eve@test.com', password: 'p', roleId: 2 });
    fakeUser.update = jest.fn();
    User.findByPk.mockResolvedValueOnce(fakeUser);
    Role.findOne.mockResolvedValueOnce(null);
    await expect(userStore.updateUserRole(fakeUser.id, 'ghost')).rejects.toThrow('Role "ghost" not found');
  });
});

// ── deactivateUser ────────────────────────────────────────────────────────────

describe('deactivateUser', () => {
  it('throws if user not found', async () => {
    const { User } = require('../src/models/index');
    User.findByPk.mockResolvedValueOnce(null);
    await expect(userStore.deactivateUser('bad-id')).rejects.toThrow('User not found');
  });
});

// ── getRoles / getPermissions / getUserPermissions ────────────────────────────

describe('getRoles', () => {
  it('returns all roles', async () => {
    expect(Array.isArray(await userStore.getRoles())).toBe(true);
  });
});

describe('getPermissions', () => {
  it('returns all permissions', async () => {
    expect(Array.isArray(await userStore.getPermissions())).toBe(true);
  });
});

describe('getUserPermissions', () => {
  it('returns empty array for unknown user', async () => {
    const { User } = require('../src/models/index');
    User.findByPk.mockResolvedValueOnce(null);
    expect(await userStore.getUserPermissions('bad-id')).toEqual([]);
  });
});
