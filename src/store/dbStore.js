const { Op, fn, col } = require('sequelize');
const { Trip, Transaction, sequelize } = require('../models/index');

// ── Transactions ──────────────────────────────────────────────────────────────

const getTransactions = async (tripId = null, page = 1, limit = 5, type = null, userId = null) => {
  const where = {};
  if (tripId !== null) where.tripId = tripId;
  else where.tripId = null;
  if (type) where.type = type;
  if (userId) where.userId = userId;

  const offset = (page - 1) * limit;
  const { rows, count } = await Transaction.findAndCountAll({
    where,
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
    limit,
    offset,
  });

  return {
    data: rows.map(formatTransaction),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 },
  };
};

const getTransactionById = async (id) => {
  const t = await Transaction.findByPk(id);
  return t ? formatTransaction(t) : null;
};

const addTransaction = async (data) => {
  const t = await Transaction.create({
    type:     data.type,
    title:    data.title.trim(),
    amount:   parseFloat(data.amount),
    category: data.category,
    date:     data.date,
    tripId:   data.tripId || null,
    userId:   data.userId || null,
  });
  return formatTransaction(t);
};

const updateTransaction = async (id, data) => {
  const t = await Transaction.findByPk(id);
  if (!t) return null;
  await t.update({
    type:     data.type,
    title:    data.title.trim(),
    amount:   parseFloat(data.amount),
    category: data.category,
    date:     data.date,
    tripId:   data.tripId !== undefined ? data.tripId : t.tripId,
    userId:   data.userId !== undefined ? data.userId : t.userId,
  });
  return formatTransaction(t);
};

const deleteTransaction = async (id) => {
  const t = await Transaction.findByPk(id);
  if (!t) return false;
  await t.destroy();
  return true;
};

// ── Trips ─────────────────────────────────────────────────────────────────────

const getTrips = async (page = 1, limit = 10, userId = null) => {
  const where = {};
  if (userId) where.userId = userId;

  const offset = (page - 1) * limit;
  const { rows, count } = await Trip.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return {
    data: rows.map(formatTrip),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 },
  };
};

const getTripById = async (id) => {
  const t = await Trip.findByPk(id);
  return t ? formatTrip(t) : null;
};

const addTrip = async (data) => {
  const t = await Trip.create({
    name:   data.name.trim(),
    icon:   data.icon || '✈️',
    date:   new Date().toISOString().split('T')[0],
    userId: data.userId || null,
  });
  return formatTrip(t);
};

const updateTrip = async (id, data) => {
  const t = await Trip.findByPk(id);
  if (!t) return null;
  await t.update({
    name: data.name ? data.name.trim() : t.name,
    icon: data.icon || t.icon,
  });
  return formatTrip(t);
};

const deleteTrip = async (id) => {
  const t = await Trip.findByPk(id);
  if (!t) return false;
  await t.destroy();
  return true;
};

// ── Statistics ────────────────────────────────────────────────────────────────

const getStatistics = async (tripId = null, userId = null) => {
  let tripCondition = tripId !== null ? `"tripId" = '${tripId}'` : `"tripId" IS NULL`;
  if (userId) tripCondition += ` AND "userId" = '${userId}'`;

  const [incomeRows]       = await sequelize.query(`SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total FROM transactions WHERE type = 'income' AND ${tripCondition}`);
  const [expenseRows]      = await sequelize.query(`SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total FROM transactions WHERE type = 'expense' AND ${tripCondition}`);
  const [categoryRows]     = await sequelize.query(`SELECT category, COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total FROM transactions WHERE type = 'expense' AND ${tripCondition} GROUP BY category`);
  const [countRows]        = await sequelize.query(`SELECT COUNT(*) AS total FROM transactions WHERE ${tripCondition}`);
  const [expenseCountRows] = await sequelize.query(`SELECT COUNT(*) AS total FROM transactions WHERE type = 'expense' AND ${tripCondition}`);

  const totalIncome  = parseFloat(incomeRows[0]?.total  || 0);
  const totalExpense = parseFloat(expenseRows[0]?.total || 0);
  const expenseCount = parseInt(expenseCountRows[0]?.total || 0);
  const totalCount   = parseInt(countRows[0]?.total || 0);
  const avgExpense   = expenseCount > 0 ? totalExpense / expenseCount : 0;

  const byCategory = {};
  categoryRows.forEach(row => { byCategory[row.category] = parseFloat(row.total); });

  return {
    totalIncome:      parseFloat(totalIncome.toFixed(2)),
    totalExpense:     parseFloat(totalExpense.toFixed(2)),
    balance:          parseFloat((totalIncome - totalExpense).toFixed(2)),
    avgExpense:       parseFloat(avgExpense.toFixed(2)),
    transactionCount: totalCount,
    byCategory,
  };
};

// ── Formatters ────────────────────────────────────────────────────────────────

const formatTransaction = (t) => ({
  id:       t.id,
  type:     t.type,
  title:    t.title,
  amount:   parseFloat(t.amount),
  category: t.category,
  date:     t.date,
  tripId:   t.tripId || null,
  userId:   t.userId || null,
});

const formatTrip = (t) => ({
  id:     t.id,
  name:   t.name,
  icon:   t.icon,
  date:   t.date,
  userId: t.userId || null,
});

const _reset = async () => {
  await Transaction.destroy({ where: {}, truncate: true });
  await Trip.destroy({ where: {}, truncate: true });
};

module.exports = {
  getTransactions, getTransactionById, addTransaction, updateTransaction, deleteTransaction,
  getTrips, getTripById, addTrip, updateTrip, deleteTrip,
  getStatistics, _reset,
};