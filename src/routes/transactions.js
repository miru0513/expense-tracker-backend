const express = require('express');
const router = express.Router();
const controller = require('../controllers/transactionController');
const {
  transactionRules,
  paginationRules,
  handleValidationErrors,
} = require('../middleware/validation');

router.get('/statistics', controller.getStatistics);

router.get('/', ...paginationRules, handleValidationErrors, controller.getAll);

router.get('/:id', controller.getById);

router.post('/', ...transactionRules, handleValidationErrors, controller.create);

router.put('/:id', ...transactionRules, handleValidationErrors, controller.update);

router.delete('/:id', controller.remove);

module.exports = router;