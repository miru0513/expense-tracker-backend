// Mock the entire dbStore so tests run without a real database
jest.mock('../src/store/dbStore', () => {
  let trips = [];
  let transactions = [];

  const fmtTx = (t) => ({ ...t, amount: parseFloat(t.amount) });
  const fmtTrip = (t) => ({ ...t });

  return {
    getTransactions: jest.fn(async (tripId = null, page = 1, limit = 5, type = null, userId = null) => {
      let list = transactions.filter(t => tripId === null ? t.tripId === null : t.tripId === tripId);
      if (type) list = list.filter(t => t.type === type);
      if (userId) list = list.filter(t => t.userId === userId);
      list = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
      const total = list.length;
      const data = list.slice((page - 1) * limit, page * limit);
      return { data: data.map(fmtTx), pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
    }),
    getTransactionById: jest.fn(async (id) => {
      const t = transactions.find(t => t.id === id);
      return t ? fmtTx(t) : null;
    }),
    addTransaction: jest.fn(async (data) => {
      const t = { id: `tx-${Date.now()}-${Math.random()}`, type: data.type, title: data.title.trim(), amount: parseFloat(data.amount), category: data.category, date: data.date, tripId: data.tripId || null, userId: data.userId || null };
      transactions.push(t);
      return fmtTx(t);
    }),
    updateTransaction: jest.fn(async (id, data) => {
      const idx = transactions.findIndex(t => t.id === id);
      if (idx === -1) return null;
      transactions[idx] = { ...transactions[idx], ...data, amount: parseFloat(data.amount), title: data.title.trim() };
      return fmtTx(transactions[idx]);
    }),
    deleteTransaction: jest.fn(async (id) => {
      const idx = transactions.findIndex(t => t.id === id);
      if (idx === -1) return false;
      transactions.splice(idx, 1);
      return true;
    }),
    getTrips: jest.fn(async (page = 1, limit = 10, userId = null) => {
      let list = userId ? trips.filter(t => t.userId === userId) : trips;
      const total = list.length;
      const data = list.slice((page - 1) * limit, page * limit);
      return { data: data.map(fmtTrip), pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
    }),
    getTripById: jest.fn(async (id) => {
      const t = trips.find(t => t.id === id);
      return t ? fmtTrip(t) : null;
    }),
    addTrip: jest.fn(async (data) => {
      const t = { id: `trip-${Date.now()}-${Math.random()}`, name: data.name.trim(), icon: data.icon || '✈️', date: new Date().toISOString().split('T')[0], userId: data.userId || null };
      trips.push(t);
      return fmtTrip(t);
    }),
    updateTrip: jest.fn(async (id, data) => {
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) return null;
      trips[idx] = { ...trips[idx], ...data };
      return fmtTrip(trips[idx]);
    }),
    deleteTrip: jest.fn(async (id) => {
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) return false;
      trips.splice(idx, 1);
      transactions = transactions.filter(t => t.tripId !== id);
      return true;
    }),
    getStatistics: jest.fn(async (tripId = null, userId = null) => {
      const list = transactions.filter(t => tripId === null ? t.tripId === null : t.tripId === tripId);
      const expenses = list.filter(t => t.type === 'expense');
      const income   = list.filter(t => t.type === 'income');
      const totalExpense = expenses.reduce((s, t) => s + parseFloat(t.amount), 0);
      const totalIncome  = income.reduce((s, t) => s + parseFloat(t.amount), 0);
      const byCategory = {};
      expenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + parseFloat(t.amount); });
      return { totalIncome: parseFloat(totalIncome.toFixed(2)), totalExpense: parseFloat(totalExpense.toFixed(2)), balance: parseFloat((totalIncome - totalExpense).toFixed(2)), avgExpense: expenses.length > 0 ? parseFloat((totalExpense / expenses.length).toFixed(2)) : 0, transactionCount: list.length, byCategory };
    }),
    _reset: jest.fn(async () => { trips = []; transactions = []; }),
  };
});

// Mock userStore
jest.mock('../src/store/userStore', () => {
  const users = [];
  const roles = [
    { id: '1', name: 'admin', description: 'Full access', permissions: [{ id: '1', name: 'transaction:create', description: '' }] },
    { id: '2', name: 'normal_user', description: 'Restricted', permissions: [] },
  ];

  return {
    getUsers: jest.fn(async () => users.map(u => ({ ...u, role: roles.find(r => r.id === u.roleId) || roles[1] }))),
    getUserById: jest.fn(async (id) => {
      const u = users.find(u => u.id === id);
      return u ? { ...u, role: roles.find(r => r.id === u.roleId) || roles[1] } : null;
    }),
    registerUser: jest.fn(async ({ name, email, password, roleName }) => {
      const role = roles.find(r => r.name === (roleName || 'normal_user')) || roles[1];
      const user = { id: `user-${Date.now()}`, name, email, isActive: true, createdAt: new Date().toISOString(), role };
      users.push({ ...user, roleId: role.id });
      return user;
    }),
    loginUser: jest.fn(async ({ email, password }) => {
      if (password !== 'pass123') throw new Error('Invalid password');
      // Return a mock user for any email (simulates existing user)
      return { id: 'user-mock', name: 'Mock User', email, isActive: true, createdAt: new Date().toISOString(), role: roles[1] };
    }),
    updateUserRole: jest.fn(async (userId, roleName) => {
      const u = users.find(u => u.id === userId);
      if (!u) throw new Error('User not found');
      const role = roles.find(r => r.name === roleName);
      if (!role) throw new Error(`Role "${roleName}" not found`);
      return { ...u, role };
    }),
    deactivateUser: jest.fn(async (userId) => {
      const u = users.find(u => u.id === userId);
      if (!u) throw new Error('User not found');
      return { ...u, isActive: false, role: roles[1] };
    }),
    getRoles: jest.fn(async () => roles),
    getRoleById: jest.fn(async (id) => roles.find(r => r.id === id) || null),
    getPermissions: jest.fn(async () => [{ id: '1', name: 'transaction:create', description: '' }]),
    getUserPermissions: jest.fn(async (userId) => ['transaction:create', 'transaction:read']),
  };
});

// Mock loggerService
jest.mock('../src/services/loggerService', () => ({
  logAction: jest.fn(async () => {}),
  getLogs: jest.fn(async () => [
    { id: 'log-1', userId: 'u1', userEmail: 'a@b.com', userRole: 'admin', action: 'LOGIN', details: null, ipAddress: null, success: true, timestamp: new Date() },
  ]),
  getSuspiciousUsers: jest.fn(async () => []),
  resolveFlag: jest.fn(async (id) => id === 'bad-id' ? null : { id, resolved: true, userId: 'u1', userEmail: 'a@b.com', userRole: 'admin', reason: 'test', actionCount: 3, detectedAt: new Date() }),
}));


// Mock generatorService so faker is never imported
jest.mock('../src/services/generatorService', () => {
  let running = false;
  let interval = null;
  const clients = new Set();
  return {
    startGenerator: jest.fn((batchSize, intervalMs, tripId, userId) => {
      if (batchSize < 1 || batchSize > 20) throw new Error('batchSize must be between 1 and 20');
      if (intervalMs < 500 || intervalMs > 30000) throw new Error('intervalMs must be between 500 and 30000');
      running = true;
      return { started: true, message: `Generator started` };
    }),
    stopGenerator: jest.fn(() => {
      running = false;
      return { stopped: true, message: 'Generator stopped' };
    }),
    isRunning: jest.fn(() => running),
    registerClient: jest.fn(),
    broadcast: jest.fn(),
  };
});

const request = require('supertest');
const app = require('../src/app');
const store = require('../src/store/dbStore');
const generator = require('../src/services/generatorService');
const { signToken } = require('../src/services/jwtService');

// Admin token used for all authenticated requests in this test suite
const adminToken = signToken({ id: 'admin-test-id', email: 'admin@test.com', role: 'admin' });
// Normal user token for authorization tests
const userToken = signToken({ id: 'user-test-id', email: 'user@test.com', role: 'normal_user' });

beforeEach(async () => {
  await store._reset();
  generator.stopGenerator();
});

afterEach(() => generator.stopGenerator());

// Default to admin token so all existing tests continue to work
const gql = (query, variables = {}, token = adminToken) =>
  request(app)
    .post('/graphql')
    .set('Authorization', token ? `Bearer ${token}` : '')
    .send({ query, variables });

const createTx = (overrides = {}) =>
  gql(`
    mutation($type:String!,$title:String!,$amount:Float!,$category:String!,$date:String!,$tripId:String,$userId:String){
      createTransaction(type:$type,title:$title,amount:$amount,category:$category,date:$date,tripId:$tripId,userId:$userId){
        id type title amount category date tripId userId
      }
    }
  `, { type:'expense', title:'Coffee', amount:15, category:'Food', date:'2026-04-10', ...overrides });

const createTrip = (name = 'Barcelona', icon = '🏖️') =>
  gql(`
    mutation($name:String!,$icon:String){ createTrip(name:$name,icon:$icon){ id name icon date } }
  `, { name, icon });

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════
describe('Query: transactions', () => {
  it('returns empty list', async () => {
    const res = await gql(`{ transactions { data { id } pagination { total } } }`);
    expect(res.body.data.transactions.data).toHaveLength(0);
  });

  it('returns paginated results', async () => {
    for (let i = 1; i <= 7; i++) await createTx({ title: `Item ${i}` });
    const res = await gql(`{ transactions(page:1,limit:5){ data{id} pagination{totalPages total} } }`);
    expect(res.body.data.transactions.data).toHaveLength(5);
    expect(res.body.data.transactions.pagination.totalPages).toBe(2);
  });

  it('filters by type', async () => {
    await createTx({ type: 'expense' });
    await createTx({ type: 'income', category: 'Salary' });
    const res = await gql(`{ transactions(type:"income"){ data{ type } } }`);
    expect(res.body.data.transactions.data).toHaveLength(1);
  });

  it('filters by tripId', async () => {
    await createTx({ tripId: 'trip-1' });
    await createTx({});
    const res = await gql(`{ transactions(tripId:"trip-1"){ data{ tripId } } }`);
    expect(res.body.data.transactions.data).toHaveLength(1);
  });

  it('sorts by date descending', async () => {
    await createTx({ title: 'Older', date: '2026-01-01' });
    await createTx({ title: 'Newer', date: '2026-04-10' });
    const res = await gql(`{ transactions{ data{ title } } }`);
    expect(res.body.data.transactions.data[0].title).toBe('Newer');
  });
});

describe('Query: transaction (single)', () => {
  it('returns a transaction by id', async () => {
    const c = await createTx({ title: 'Rent', amount: 500 });
    const id = c.body.data.createTransaction.id;
    const res = await gql(`query($id:ID!){ transaction(id:$id){ title amount } }`, { id });
    expect(res.body.data.transaction.title).toBe('Rent');
  });

  it('returns error for unknown id', async () => {
    const res = await gql(`{ transaction(id:"bad"){ id } }`);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/not found/i);
  });
});

describe('Query: statistics', () => {
  it('returns zeros on empty store', async () => {
    const res = await gql(`{ statistics{ totalIncome totalExpense balance avgExpense transactionCount byCategory{category total} } }`);
    const s = res.body.data.statistics;
    expect(s.totalIncome).toBe(0);
    expect(s.totalExpense).toBe(0);
    expect(s.balance).toBe(0);
  });

  it('calculates correctly', async () => {
    await createTx({ type: 'income', amount: 1000, category: 'Salary' });
    await createTx({ type: 'expense', amount: 200, category: 'Food' });
    const res = await gql(`{ statistics{ totalIncome totalExpense balance byCategory{category total} } }`);
    const s = res.body.data.statistics;
    expect(s.totalIncome).toBe(1000);
    expect(s.totalExpense).toBe(200);
    expect(s.balance).toBe(800);
  });

  it('filters by tripId', async () => {
    await createTx({ amount: 100, tripId: 'trip-A' });
    await createTx({ amount: 500 });
    const res = await gql(`{ statistics(tripId:"trip-A"){ totalExpense } }`);
    expect(res.body.data.statistics.totalExpense).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS MUTATIONS
// ══════════════════════════════════════════════════════════════════════════════
describe('Mutation: createTransaction', () => {
  it('creates a valid expense', async () => {
    const res = await createTx();
    const t = res.body.data.createTransaction;
    expect(t.id).toBeDefined();
    expect(t.title).toBe('Coffee');
    expect(t.amount).toBe(15);
  });

  it('trims title whitespace', async () => {
    const res = await createTx({ title: '  Groceries  ' });
    expect(res.body.data.createTransaction.title).toBe('Groceries');
  });

  it('rejects short title', async () => {
    const res = await createTx({ title: 'ab' });
    expect(res.body.errors[0].message).toMatch(/3 characters/i);
  });

  it('rejects invalid type', async () => {
    const res = await createTx({ type: 'savings' });
    expect(res.body.errors).toBeDefined();
  });

  it('rejects zero amount', async () => {
    const res = await createTx({ amount: 0 });
    expect(res.body.errors).toBeDefined();
  });

  it('rejects negative amount', async () => {
    const res = await createTx({ amount: -10 });
    expect(res.body.errors).toBeDefined();
  });

  it('rejects invalid category', async () => {
    const res = await createTx({ category: 'Gambling' });
    expect(res.body.errors).toBeDefined();
  });

  it('rejects invalid date', async () => {
    const res = await createTx({ date: 'not-a-date' });
    expect(res.body.errors).toBeDefined();
  });
});

describe('Mutation: updateTransaction', () => {
  it('updates a transaction', async () => {
    const c = await createTx({ title: 'Old', amount: 50 });
    const id = c.body.data.createTransaction.id;
    const res = await gql(`
      mutation($id:ID!){
        updateTransaction(id:$id,type:"expense",title:"New",amount:99,category:"Transport",date:"2026-04-15"){
          title amount category
        }
      }
    `, { id });
    expect(res.body.data.updateTransaction.title).toBe('New');
  });

  it('returns error for unknown id', async () => {
    const res = await gql(`
      mutation{ updateTransaction(id:"bad",type:"expense",title:"Test",amount:10,category:"Food",date:"2026-04-10"){id} }
    `);
    expect(res.body.errors).toBeDefined();
  });

  it('validates on update', async () => {
    const c = await createTx();
    const id = c.body.data.createTransaction.id;
    const res = await gql(`
      mutation($id:ID!){ updateTransaction(id:$id,type:"expense",title:"ab",amount:10,category:"Food",date:"2026-04-10"){id} }
    `, { id });
    expect(res.body.errors).toBeDefined();
  });
});

describe('Mutation: deleteTransaction', () => {
  it('deletes a transaction', async () => {
    const c = await createTx();
    const id = c.body.data.createTransaction.id;
    const res = await gql(`mutation($id:ID!){ deleteTransaction(id:$id) }`, { id });
    expect(res.body.data.deleteTransaction).toBe(true);
  });

  it('returns error for unknown id', async () => {
    const res = await gql(`mutation{ deleteTransaction(id:"ghost") }`);
    expect(res.body.errors).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRIPS
// ══════════════════════════════════════════════════════════════════════════════
describe('Query: trips', () => {
  it('returns empty list', async () => {
    const res = await gql(`{ trips{ data{ id } pagination{ total } } }`);
    expect(res.body.data.trips.data).toHaveLength(0);
  });

  it('returns paginated trips', async () => {
    for (let i = 1; i <= 12; i++) await createTrip(`Trip ${i}`);
    const res = await gql(`{ trips(page:1,limit:10){ data{id} pagination{totalPages} } }`);
    expect(res.body.data.trips.data).toHaveLength(10);
  });
});

describe('Query: trip (single)', () => {
  it('returns a trip by id', async () => {
    const c = await createTrip('Rome');
    const id = c.body.data.createTrip.id;
    const res = await gql(`query($id:ID!){ trip(id:$id){ name } }`, { id });
    expect(res.body.data.trip.name).toBe('Rome');
  });

  it('returns error for unknown id', async () => {
    const res = await gql(`{ trip(id:"bad"){ id } }`);
    expect(res.body.errors).toBeDefined();
  });
});

describe('Query: tripStatistics', () => {
  it('returns statistics for a trip', async () => {
    const c = await createTrip('Paris');
    const tripId = c.body.data.createTrip.id;
    await createTx({ amount: 200, tripId });
    const res = await gql(`query($id:ID!){ tripStatistics(id:$id){ trip{name} stats{totalExpense} } }`, { id: tripId });
    expect(res.body.data.tripStatistics.trip.name).toBe('Paris');
  });

  it('returns error for unknown trip', async () => {
    const res = await gql(`{ tripStatistics(id:"ghost"){ trip{name} } }`);
    expect(res.body.errors).toBeDefined();
  });
});

describe('Mutation: createTrip', () => {
  it('creates a trip', async () => {
    const res = await createTrip('Summer in Barcelona', '🏖️');
    const t = res.body.data.createTrip;
    expect(t.id).toBeDefined();
    expect(t.name).toBe('Summer in Barcelona');
  });

  it('defaults icon to ✈️', async () => {
    const res = await gql(`mutation{ createTrip(name:"Mystery"){ icon } }`);
    expect(res.body.data.createTrip.icon).toBe('✈️');
  });

  it('rejects empty name', async () => {
    const res = await gql(`mutation{ createTrip(name:""){ id } }`);
    expect(res.body.errors).toBeDefined();
  });
});

describe('Mutation: updateTrip', () => {
  it('updates a trip', async () => {
    const c = await createTrip('Old Name');
    const id = c.body.data.createTrip.id;
    const res = await gql(`mutation($id:ID!){ updateTrip(id:$id,name:"New Name",icon:"🏔️"){ name icon } }`, { id });
    expect(res.body.data.updateTrip.name).toBe('New Name');
  });

  it('returns error for unknown id', async () => {
    const res = await gql(`mutation{ updateTrip(id:"bad",name:"X"){ id } }`);
    expect(res.body.errors).toBeDefined();
  });
});

describe('Mutation: deleteTrip', () => {
  it('deletes a trip', async () => {
    const c = await createTrip('Delete Me');
    const tripId = c.body.data.createTrip.id;
    const res = await gql(`mutation($id:ID!){ deleteTrip(id:$id) }`, { id: tripId });
    expect(res.body.data.deleteTrip).toBe(true);
  });

  it('returns error for unknown id', async () => {
    const res = await gql(`mutation{ deleteTrip(id:"ghost") }`);
    expect(res.body.errors).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
describe('Query: generatorStatus', () => {
  it('returns running: false initially', async () => {
    const res = await gql(`{ generatorStatus{ running } }`);
    expect(res.body.data.generatorStatus.running).toBe(false);
  });
});

describe('Mutation: startGenerator / stopGenerator', () => {
  it('starts the generator', async () => {
    const res = await gql(`mutation{ startGenerator(batchSize:2,intervalMs:500){ started message } }`);
    expect(res.body.data.startGenerator.started).toBe(true);
  });

  it('stops the generator', async () => {
    await gql(`mutation{ startGenerator(batchSize:1,intervalMs:500){ started } }`);
    const res = await gql(`mutation{ stopGenerator{ stopped message } }`);
    expect(res.body.data.stopGenerator.stopped).toBe(true);
  });

  it('rejects invalid batchSize', async () => {
    const res = await gql(`mutation{ startGenerator(batchSize:99,intervalMs:1000){ started } }`);
    expect(res.body.errors).toBeDefined();
  });

  it('rejects invalid intervalMs', async () => {
    const res = await gql(`mutation{ startGenerator(batchSize:1,intervalMs:100){ started } }`);
    expect(res.body.errors).toBeDefined();
  });

  it('generator status changes to running after start', async () => {
    await gql(`mutation{ startGenerator(batchSize:2,intervalMs:2000){ started } }`);
    const res = await gql(`{ generatorStatus{ running } }`);
    expect(res.body.data.generatorStatus.running).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// USERS, ROLES, PERMISSIONS
// ══════════════════════════════════════════════════════════════════════════════
describe('Query: users, roles, permissions', () => {
  it('returns users list', async () => {
    const res = await gql(`{ users { id name email isActive createdAt role { name permissions { name } } } }`);
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it('returns roles list', async () => {
    const res = await gql(`{ roles { id name description permissions { name } } }`);
    expect(Array.isArray(res.body.data.roles)).toBe(true);
  });

  it('returns permissions list', async () => {
    const res = await gql(`{ permissions { id name description } }`);
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
  });

  it('returns myPermissions for a user', async () => {
    const res = await gql(`{ myPermissions(userId: "some-id") }`);
    expect(res.body.data.myPermissions).toBeDefined();
  });

  it('returns error for unknown user', async () => {
    const res = await gql(`{ user(id: "bad") { id name } }`);
    expect(res.body.errors).toBeDefined();
  });

  it('returns error for unknown role', async () => {
    const res = await gql(`{ role(id: "99") { id name } }`);
    expect(res.body.errors).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════
describe('Mutation: register', () => {
  it('registers successfully and returns a JWT token', async () => {
    const res = await gql(`
      mutation { register(name:"Test User", email:"test@test.com", password:"pass123") { success message token user { id name email role { name } } } }
    `);
    expect(res.body.data.register.success).toBe(true);
    expect(res.body.data.register.user.email).toBe('test@test.com');
    expect(typeof res.body.data.register.token).toBe('string');
    expect(res.body.data.register.token.split('.')).toHaveLength(3);
  });

  it('fails with short name', async () => {
    const res = await gql(`mutation { register(name:"A", email:"a@b.com", password:"pass123") { success message } }`);
    expect(res.body.data.register.success).toBe(false);
    expect(res.body.data.register.message).toMatch(/2 characters/i);
  });

  it('fails with invalid email', async () => {
    const res = await gql(`mutation { register(name:"Alice", email:"notanemail", password:"pass123") { success message } }`);
    expect(res.body.data.register.success).toBe(false);
  });

  it('fails with short password', async () => {
    const res = await gql(`mutation { register(name:"Alice", email:"a@b.com", password:"ab") { success message } }`);
    expect(res.body.data.register.success).toBe(false);
  });

  it('fails when email already registered', async () => {
    const userStore = require('../src/store/userStore');
    userStore.registerUser.mockRejectedValueOnce(new Error('Email already registered'));
    const res = await gql(`mutation { register(name:"Alice", email:"dupe@test.com", password:"pass123") { success message } }`);
    expect(res.body.data.register.success).toBe(false);
    expect(res.body.data.register.message).toMatch(/already registered/i);
  });
});

describe('Mutation: login', () => {
  it('logs in successfully and returns a JWT token', async () => {
    const res = await gql(`mutation { login(email:"login@test.com", password:"pass123") { success message token user { id name } } }`);
    expect(res.body.data.login.success).toBe(true);
    expect(typeof res.body.data.login.token).toBe('string');
    expect(res.body.data.login.token.split('.')).toHaveLength(3);
  });

  it('fails with wrong password', async () => {
    const res = await gql(`mutation { login(email:"wrong@test.com", password:"incorrect") { success message token } }`);
    expect(res.body.data.login.success).toBe(false);
    expect(res.body.data.login.token).toBeNull();
  });

  it('fails with unknown email', async () => {
    const userStore = require('../src/store/userStore');
    userStore.loginUser.mockRejectedValueOnce(new Error('User not found or account deactivated'));
    const res = await gql(`mutation { login(email:"nobody@test.com", password:"pass") { success message } }`);
    expect(res.body.data.login.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTHORIZATION (unauthenticated access)
// ══════════════════════════════════════════════════════════════════════════════
describe('Authorization: unauthenticated requests', () => {
  it('rejects unauthenticated access to transactions', async () => {
    const res = await gql(`{ transactions { data { id } } }`, {}, null);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/authentication required/i);
  });

  it('rejects unauthenticated access to trips', async () => {
    const res = await gql(`{ trips { data { id } } }`, {}, null);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/authentication required/i);
  });

  it('rejects unauthenticated mutation createTransaction', async () => {
    const res = await gql(`
      mutation { createTransaction(type:"expense",title:"Test",amount:10,category:"Food",date:"2026-01-01") { id } }
    `, {}, null);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/authentication required/i);
  });

  it('allows login without a token', async () => {
    const res = await gql(`mutation { login(email:"user@test.com", password:"pass123") { success } }`, {}, null);
    // login is public — should not throw authentication error
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.login).toBeDefined();
  });

  it('allows register without a token', async () => {
    const res = await gql(`mutation { register(name:"Alice", email:"alice@test.com", password:"pass123") { success } }`, {}, null);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.register).toBeDefined();
  });

  it('rejects normal_user access to admin-only users query', async () => {
    const res = await gql(`{ users { id name } }`, {}, userToken);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/admin access required/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGS & SECURITY
// ══════════════════════════════════════════════════════════════════════════════
describe('Query: logs and suspiciousUsers', () => {
  it('returns logs list', async () => {
    const res = await gql(`{ logs(limit: 10) { id action userEmail success timestamp } }`);
    expect(Array.isArray(res.body.data.logs)).toBe(true);
  });

  it('returns suspicious users list', async () => {
    const res = await gql(`{ suspiciousUsers { id userEmail reason resolved } }`);
    expect(Array.isArray(res.body.data.suspiciousUsers)).toBe(true);
  });
});

describe('Mutation: resolveFlag', () => {
  it('resolves a flag successfully', async () => {
    const res = await gql(`mutation { resolveFlag(id: "flag-1") { id resolved } }`);
    expect(res.body.data.resolveFlag.resolved).toBe(true);
  });

  it('returns error for unknown flag', async () => {
    const res = await gql(`mutation { resolveFlag(id: "bad-id") { id resolved } }`);
    expect(res.body.errors).toBeDefined();
  });
});

describe('Mutation: updateUserRole and deactivateUser', () => {
  it('returns error for unknown user in updateUserRole', async () => {
    const res = await gql(`mutation { updateUserRole(userId:"bad", roleName:"admin") { id } }`);
    expect(res.body.errors).toBeDefined();
  });

  it('returns error for unknown user in deactivateUser', async () => {
    const res = await gql(`mutation { deactivateUser(userId:"bad") { id } }`);
    expect(res.body.errors).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// UNKNOWN ROUTES
// ══════════════════════════════════════════════════════════════════════════════
describe('Unknown routes', () => {
  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });
});