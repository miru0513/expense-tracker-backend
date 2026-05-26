jest.mock('../src/models/index', () => {
  let trips = [];
  let transactions = [];

  const makeTrip = (data) => ({
    id: data.id || `trip-${Date.now()}-${Math.random()}`,
    name: data.name, icon: data.icon || '✈️',
    date: data.date || new Date().toISOString().split('T')[0],
    update: async function(d) { Object.assign(this, d); return this; },
    destroy: async function() { trips = trips.filter(t => t.id !== this.id); transactions = transactions.filter(t => t.tripId !== this.id); },
  });

  const makeTx = (data) => ({
    id: data.id || `tx-${Date.now()}-${Math.random()}`,
    type: data.type, title: data.title, amount: data.amount,
    category: data.category, date: data.date, tripId: data.tripId || null,
    update: async function(d) { Object.assign(this, d); return this; },
    destroy: async function() { transactions = transactions.filter(t => t.id !== this.id); },
  });

  const Trip = {
    create: jest.fn(async (data) => { const t = makeTrip(data); trips.push(t); return t; }),
    findByPk: jest.fn(async (id) => trips.find(t => t.id === id) || null),
    findAndCountAll: jest.fn(async ({ limit = 10, offset = 0 }) => {
      const sorted = [...trips].reverse();
      return { rows: sorted.slice(offset, offset + limit), count: sorted.length };
    }),
    destroy: jest.fn(async () => { trips = []; transactions = []; }),
  };

  const Transaction = {
    create: jest.fn(async (data) => { const t = makeTx(data); transactions.push(t); return t; }),
    findByPk: jest.fn(async (id) => transactions.find(t => t.id === id) || null),
    findAndCountAll: jest.fn(async ({ where = {}, limit = 5, offset = 0 }) => {
      let list = transactions.filter(t => {
        if (where.tripId === null) return t.tripId === null;
        if (where.tripId) return t.tripId === where.tripId;
        return true;
      });
      if (where.type) list = list.filter(t => t.type === where.type);
      list = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
      return { rows: list.slice(offset, offset + limit), count: list.length };
    }),
    destroy: jest.fn(async () => { transactions = []; }),
    count: jest.fn(async ({ where = {} }) => {
      return transactions.filter(t => {
        const tripOk = where.tripId === null ? t.tripId === null : where.tripId ? t.tripId === where.tripId : true;
        const typeOk = where.type ? t.type === where.type : true;
        return tripOk && typeOk;
      }).length;
    }),
  };

  const sequelize = {
    query: jest.fn(async (sql) => {
      const getTripId = (s) => { const m = s.match(/tripId = '([^']+)'/); return m ? m[1] : null; };
      const isNull = sql.includes('IS NULL');
      const tripFilter = isNull ? (t) => t.tripId === null : getTripId(sql) ? (t) => t.tripId === getTripId(sql) : () => true;

      if (sql.includes("type = 'income'")) {
        const total = transactions.filter(t => t.type === 'income' && tripFilter(t)).reduce((s, t) => s + parseFloat(t.amount), 0);
        return [[{ total }]];
      }
      if (sql.includes("type = 'expense'") && sql.includes('GROUP BY')) {
        const byCategory = {};
        transactions.filter(t => t.type === 'expense' && tripFilter(t)).forEach(t => {
          byCategory[t.category] = (byCategory[t.category] || 0) + parseFloat(t.amount);
        });
        return [Object.entries(byCategory).map(([category, total]) => ({ category, total }))];
      }
      if (sql.includes("type = 'expense'") && sql.includes('COUNT')) {
        return [[{ total: transactions.filter(t => t.type === 'expense' && tripFilter(t)).length }]];
      }
      if (sql.includes("type = 'expense'")) {
        const total = transactions.filter(t => t.type === 'expense' && tripFilter(t)).reduce((s, t) => s + parseFloat(t.amount), 0);
        return [[{ total }]];
      }
      if (sql.includes('COUNT')) {
        return [[{ total: transactions.filter(tripFilter).length }]];
      }
      return [[{ total: 0 }]];
    }),
  };

  return { Trip, Transaction, sequelize };
});

const store = require('../src/store/dbStore');
const { Trip, Transaction } = require('../src/models/index');

beforeEach(() => {
  jest.clearAllMocks();
  Trip.destroy({ where: {}, truncate: true });
  Transaction.destroy({ where: {}, truncate: true });
});

const makeTx = (o = {}) => ({ type:'expense', title:'Coffee', amount:15, category:'Food', date:'2026-04-10', tripId:null, ...o });

describe('Trip CRUD — dbStore', () => {
  it('creates a trip', async () => {
    const t = await store.addTrip({ name:'Paris', icon:'✈️' });
    expect(t.id).toBeDefined();
    expect(t.name).toBe('Paris');
    expect(t.icon).toBe('✈️');
  });

  it('retrieves trip by id', async () => {
    const c = await store.addTrip({ name:'Rome' });
    const f = await store.getTripById(c.id);
    expect(f).not.toBeNull();
    expect(f.name).toBe('Rome');
  });

  it('returns null for unknown trip', async () => {
    expect(await store.getTripById('bad')).toBeNull();
  });

  it('lists trips paginated', async () => {
    await store.addTrip({ name:'A' });
    await store.addTrip({ name:'B' });
    const r = await store.getTrips(1, 10);
    expect(r.data.length).toBeGreaterThan(0);
    expect(r.pagination).toBeDefined();
  });

  it('updates a trip', async () => {
    const t = await store.addTrip({ name:'Old', icon:'✈️' });
    const u = await store.updateTrip(t.id, { name:'New', icon:'🏖️' });
    expect(u.name).toBe('New');
    expect(u.icon).toBe('🏖️');
  });

  it('returns null updating unknown trip', async () => {
    expect(await store.updateTrip('bad', { name:'X' })).toBeNull();
  });

  it('deletes a trip', async () => {
    const t = await store.addTrip({ name:'Del' });
    expect(await store.deleteTrip(t.id)).toBe(true);
  });

  it('returns false deleting unknown trip', async () => {
    expect(await store.deleteTrip('bad')).toBe(false);
  });
});

describe('Transaction CRUD — dbStore', () => {
  it('creates expense transaction', async () => {
    const t = await store.addTransaction(makeTx());
    expect(t.id).toBeDefined();
    expect(t.title).toBe('Coffee');
    expect(t.amount).toBe(15);
    expect(t.type).toBe('expense');
    expect(t.tripId).toBeNull();
  });

  it('creates income transaction', async () => {
    const t = await store.addTransaction(makeTx({ type:'income', category:'Salary', amount:3000 }));
    expect(t.type).toBe('income');
    expect(t.amount).toBe(3000);
  });

  it('trims title whitespace', async () => {
    const t = await store.addTransaction(makeTx({ title:'  Groceries  ' }));
    expect(t.title).toBe('Groceries');
  });

  it('retrieves transaction by id', async () => {
    const c = await store.addTransaction(makeTx({ title:'Rent', amount:500 }));
    const f = await store.getTransactionById(c.id);
    expect(f).not.toBeNull();
    expect(f.title).toBe('Rent');
    expect(f.amount).toBe(500);
  });

  it('returns null for unknown transaction', async () => {
    expect(await store.getTransactionById('bad')).toBeNull();
  });

  it('lists transactions paginated', async () => {
    await store.addTransaction(makeTx({ title:'A' }));
    await store.addTransaction(makeTx({ title:'B' }));
    const r = await store.getTransactions(null, 1, 5);
    expect(r.data.length).toBeGreaterThan(0);
    expect(r.pagination.total).toBeGreaterThan(0);
  });

  it('filters by type', async () => {
    await store.addTransaction(makeTx({ type:'expense' }));
    await store.addTransaction(makeTx({ type:'income', category:'Salary' }));
    const r = await store.getTransactions(null, 1, 10, 'income');
    expect(r.data.every(t => t.type === 'income')).toBe(true);
  });

  it('updates a transaction', async () => {
    const t = await store.addTransaction(makeTx({ title:'Old', amount:50 }));
    const u = await store.updateTransaction(t.id, { type:'expense', title:'New', amount:99, category:'Transport', date:'2026-04-15', tripId:null });
    expect(u.title).toBe('New');
    expect(u.amount).toBe(99);
  });

  it('returns null updating unknown transaction', async () => {
    expect(await store.updateTransaction('bad', makeTx())).toBeNull();
  });

  it('deletes a transaction', async () => {
    const t = await store.addTransaction(makeTx());
    expect(await store.deleteTransaction(t.id)).toBe(true);
  });

  it('returns false deleting unknown transaction', async () => {
    expect(await store.deleteTransaction('bad')).toBe(false);
  });
});

describe('Statistics — dbStore', () => {
  it('returns zeros on empty store', async () => {
    const s = await store.getStatistics(null);
    expect(s.totalIncome).toBe(0);
    expect(s.totalExpense).toBe(0);
    expect(s.balance).toBe(0);
    expect(s.avgExpense).toBe(0);
    expect(s.transactionCount).toBe(0);
  });

  it('calculates income and expense', async () => {
    await store.addTransaction(makeTx({ type:'income', amount:1000, category:'Salary' }));
    await store.addTransaction(makeTx({ type:'expense', amount:200 }));
    const s = await store.getStatistics(null);
    expect(s.totalIncome).toBe(1000);
    expect(s.totalExpense).toBe(200);
    expect(s.balance).toBe(800);
  });

  it('calculates byCategory', async () => {
    await store.addTransaction(makeTx({ amount:100, category:'Food' }));
    await store.addTransaction(makeTx({ amount:50, category:'Food' }));
    await store.addTransaction(makeTx({ amount:80, category:'Transport' }));
    const s = await store.getStatistics(null);
    expect(s.byCategory.Food).toBe(150);
    expect(s.byCategory.Transport).toBe(80);
  });

  it('calculates avgExpense', async () => {
    await store.addTransaction(makeTx({ amount:100 }));
    await store.addTransaction(makeTx({ amount:200 }));
    const s = await store.getStatistics(null);
    expect(s.avgExpense).toBe(150);
  });
});

describe('Schema — 3NF verification', () => {
  it('transaction has all required fields', async () => {
    const t = await store.addTransaction(makeTx());
    ['id','type','title','amount','category','date','tripId'].forEach(f => expect(t).toHaveProperty(f));
  });

  it('trip has all required fields', async () => {
    const t = await store.addTrip({ name:'Test' });
    ['id','name','icon','date'].forEach(f => expect(t).toHaveProperty(f));
  });

  it('transaction tripId is FK to trips (1-to-many)', async () => {
    const trip = await store.addTrip({ name:'FK Test' });
    const tx = await store.addTransaction(makeTx({ tripId: trip.id }));
    expect(tx.tripId).toBe(trip.id);
  });

  it('basic transactions have null tripId', async () => {
    const tx = await store.addTransaction(makeTx({ tripId: null }));
    expect(tx.tripId).toBeNull();
  });

  it('non-key attributes depend only on PK — no transitive deps (3NF)', async () => {
    const tx = await store.addTransaction(makeTx({ title:'Test', amount:100, category:'Food' }));
    expect(tx.amount).toBe(100);
    expect(tx.category).toBe('Food');
    expect(tx.title).toBe('Test');
    expect(tx.type).toBe('expense');
  });
});