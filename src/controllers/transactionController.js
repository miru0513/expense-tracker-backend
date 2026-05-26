const { v4: uuidv4 } = require('uuid');
const store = require('../store/inMemoryStore');

// GET /api/transactions?page=1&limit=5&tripId=xxx&type=expense
const getAll = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const { tripId, type } = req.query;

  let transactions = store.getTransactions(tripId || null);

  // Optional filter by type
  if (type) {
    transactions = transactions.filter((t) => t.type === type);
  }

  // Sort by date descending (matches frontend useTransactions sort)
  transactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const total = transactions.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const data = transactions.slice(startIndex, startIndex + limit);

  res.json({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  });
};

// GET /api/transactions/:id
const getById = (req, res) => {
  const transaction = store.getTransactionById(req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(transaction);
};

// POST /api/transactions
const create = (req, res) => {
  const { type, title, amount, category, date, tripId } = req.body;

  const transaction = {
    id: uuidv4(),
    type,
    title: title.trim(),
    amount: parseFloat(amount),
    category,
    date,
    tripId: tripId || null,
  };

  const created = store.addTransaction(transaction);
  res.status(201).json(created);
};

// PUT /api/transactions/:id
const update = (req, res) => {
  const { type, title, amount, category, date, tripId } = req.body;

  const existing = store.getTransactionById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const updated = store.updateTransaction(req.params.id, {
    type,
    title: title.trim(),
    amount: parseFloat(amount),
    category,
    date,
    tripId: tripId !== undefined ? tripId : existing.tripId,
  });

  res.json(updated);
};

// DELETE /api/transactions/:id
const remove = (req, res) => {
  const deleted = store.deleteTransaction(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.status(204).send();
};

// GET /api/transactions/statistics?tripId=xxx
const getStatistics = (req, res) => {
  const { tripId } = req.query;
  const stats = store.getStatistics(tripId || null);
  res.json(stats);
};

module.exports = { getAll, getById, create, update, remove, getStatistics };