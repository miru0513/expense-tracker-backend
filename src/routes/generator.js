const express = require('express');
const router = express.Router();
const controller = require('../controllers/generatorController');

// POST /api/generator/start  — start the fake data loop
// POST /api/generator/stop   — stop the fake data loop
// GET  /api/generator/status — check if running

router.post('/start', controller.start);
router.post('/stop', controller.stop);
router.get('/status', controller.status);

module.exports = router;