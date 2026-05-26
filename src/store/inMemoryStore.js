// Pure RAM storage — no database, no file system, no persistence of any kind.
// Data lives only as long as the server process is running.

const store = {
  transactions: [], // { id, type, title, amount, category, date, tripId? }
  trips: [],        // { id, name, icon, date }
};

// ── Transactions ────────────────────────────────────────────────────────────

const getTransactions = (tripId = null) => {
  if (tripId) return store.transactions.filter((t) => t.tripId === tripId);
  return store.transactions.filter((t) => !t.tripId);
};

const getTransactionById = (id) =>
  store.transactions.find((t) => t.id === id) || null;

const addTransaction = (transaction) => {
  store.transactions.push(transaction);
  return transaction;
};

const updateTransaction = (id, updates) => {
  const index = store.transactions.findIndex((t) => t.id === id);
  if (index === -1) return null;
  store.transactions[index] = { ...store.transactions[index], ...updates, id };
  return store.transactions[index];
};

const deleteTransaction = (id) => {
  const index = store.transactions.findIndex((t) => t.id === id);
  if (index === -1) return false;
  store.transactions.splice(index, 1);
  return true;
};

// ── Trips ────────────────────────────────────────────────────────────────────

const getTrips = () => store.trips;

const getTripById = (id) => store.trips.find((t) => t.id === id) || null;

const addTrip = (trip) => {
  store.trips.push(trip);
  return trip;
};

const updateTrip = (id, updates) => {
  const index = store.trips.findIndex((t) => t.id === id);
  if (index === -1) return null;
  store.trips[index] = { ...store.trips[index], ...updates, id };
  return store.trips[index];
};

const deleteTrip = (id) => {
  const index = store.trips.findIndex((t) => t.id === id);
  if (index === -1) return false;
  store.trips.splice(index, 1);
  // Also delete all transactions belonging to this trip
  store.transactions = store.transactions.filter((t) => t.tripId !== id);
  return true;
};

// ── Statistics helpers ───────────────────────────────────────────────────────

const getStatistics = (tripId = null) => {
  const transactions = getTransactions(tripId);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const byCategory = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });

  const avgExpense =
    transactions.filter((t) => t.type === 'expense').length > 0
      ? totalExpense / transactions.filter((t) => t.type === 'expense').length
      : 0;

  return {
    totalIncome: parseFloat(totalIncome.toFixed(2)),
    totalExpense: parseFloat(totalExpense.toFixed(2)),
    balance: parseFloat((totalIncome - totalExpense).toFixed(2)),
    avgExpense: parseFloat(avgExpense.toFixed(2)),
    transactionCount: transactions.length,
    byCategory,
  };
};

// Exposed only for test resets — never called in production routes
const _reset = () => {
  store.transactions = [];
  store.trips = [];
};

module.exports = {
  getTransactions,
  getTransactionById,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTrips,
  getTripById,
  addTrip,
  updateTrip,
  deleteTrip,
  getStatistics,
  _reset,
};