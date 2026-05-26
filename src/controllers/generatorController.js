const generator = require('../services/generatorService');

// POST /api/generator/start
// Body: { batchSize?: number, intervalMs?: number, tripId?: string }
const start = (req, res) => {
  const batchSize = req.body.batchSize !== undefined ? parseInt(req.body.batchSize) : 3;
  const intervalMs = parseInt(req.body.intervalMs) || 2000;
  const tripId = req.body.tripId || null;

  if (batchSize < 1 || batchSize > 20) {
    return res.status(400).json({ error: 'batchSize must be between 1 and 20' });
  }
  if (intervalMs < 500 || intervalMs > 30000) {
    return res.status(400).json({ error: 'intervalMs must be between 500 and 30000' });
  }

  const result = generator.startGenerator(batchSize, intervalMs, tripId);
  res.json(result);
};

// POST /api/generator/stop
const stop = (req, res) => {
  const result = generator.stopGenerator();
  res.json(result);
};

// GET /api/generator/status
const status = (req, res) => {
  res.json({ running: generator.isRunning() });
};

module.exports = { start, stop, status };