const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Other'];
const INCOME_CATEGORIES  = ['Salary', 'Freelance', 'Gifts', 'Investments', 'Refund', 'Other'];
const ALL_CATEGORIES     = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: { args: [['expense', 'income']], msg: 'type must be expense or income' },
    },
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'title must not be empty' },
      len: { args: [3, 255], msg: 'title must be at least 3 characters' },
    },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0.01], msg: 'amount must be greater than 0' },
    },
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: { args: [ALL_CATEGORIES], msg: `category must be one of: ${ALL_CATEGORIES.join(', ')}` },
    },
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: { msg: 'date must be a valid date' },
    },
  },
  tripId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'trips', key: 'id' },
    onDelete: 'CASCADE',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true, // nullable so existing data doesn't break
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'transactions',
  timestamps: true,
});

module.exports = Transaction;
module.exports.ALL_CATEGORIES = ALL_CATEGORIES;