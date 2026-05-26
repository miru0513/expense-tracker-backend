const { v4: uuidv4 } = require('uuid');
const store = require('../store/inMemoryStore');

// GET /api/trips
const getAll = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const trips = store.getTrips();
  const total = trips.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const data = trips.slice((page - 1) * limit, page * limit);

  res.json({
    data,
    pagination: { total, page, limit, totalPages },
  });
};

// GET /api/trips/:id
const getById = (req, res) => {
  const trip = store.getTripById(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(trip);
};

// POST /api/trips
const create = (req, res) => {
  const { name, icon } = req.body;

  const trip = {
    id: uuidv4(),
    name: name.trim(),
    icon: icon || '✈️',
    date: new Date().toLocaleDateString('en-US'),
  };

  const created = store.addTrip(trip);
  res.status(201).json(created);
};

// PUT /api/trips/:id
const update = (req, res) => {
  const existing = store.getTripById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trip not found' });

  const { name, icon } = req.body;
  const updated = store.updateTrip(req.params.id, {
    name: name ? name.trim() : existing.name,
    icon: icon || existing.icon,
  });

  res.json(updated);
};

// DELETE /api/trips/:id  (also deletes all transactions for that trip)
const remove = (req, res) => {
  const deleted = store.deleteTrip(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Trip not found' });
  res.status(204).send();
};

// GET /api/trips/:id/statistics
const getStatistics = (req, res) => {
  const trip = store.getTripById(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const stats = store.getStatistics(req.params.id);
  res.json({ trip, stats });
};

module.exports = { getAll, getById, create, update, remove, getStatistics };