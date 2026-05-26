const express = require('express');
const router = express.Router();
const controller = require('../controllers/tripController');
const {
  tripRules,
  paginationRules,
  handleValidationErrors,
} = require('../middleware/validation');

router.get('/', ...paginationRules, handleValidationErrors, controller.getAll);

router.get('/:id/statistics', controller.getStatistics);

router.get('/:id', controller.getById);

router.post('/', ...tripRules, handleValidationErrors, controller.create);

router.put('/:id', ...tripRules, handleValidationErrors, controller.update);

router.delete('/:id', controller.remove);

module.exports = router;