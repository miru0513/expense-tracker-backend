const { body, query, validationResult } = require('express-validator');

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gifts', 'Investments', 'Refund', 'Other'];
const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

// Middleware: send 400 if any validation rule failed
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Rules for creating/updating a transaction
const transactionRules = [
  body('type')
    .isIn(['expense', 'income'])
    .withMessage('type must be "expense" or "income"'),

  body('title')
    .isString()
    .trim()
    .isLength({ min: 3 })
    .withMessage('title must be at least 3 characters'),

  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('amount must be a positive number greater than 0'),

  body('category')
    .isIn(ALL_CATEGORIES)
    .withMessage(`category must be one of: ${ALL_CATEGORIES.join(', ')}`),

  body('date')
    .isISO8601()
    .withMessage('date must be a valid ISO 8601 date (YYYY-MM-DD)'),

  body('tripId')
    .optional({ nullable: true })
    .isString()
    .withMessage('tripId must be a string if provided'),
];

// Rules for creating/updating a trip
const tripRules = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('name must not be empty'),

  body('icon')
    .optional()
    .isString()
    .withMessage('icon must be a string'),
];

// Rules for pagination query params
const paginationRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
];

module.exports = {
  transactionRules,
  tripRules,
  paginationRules,
  handleValidationErrors,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ALL_CATEGORIES,
};