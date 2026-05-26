const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Log = sequelize.define('Log', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true, // null for failed login attempts (user not found)
  },
  userEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  userRole: {
    type: DataTypes.STRING(50),
    allowNull: true, // ADMIN or normal_user
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    // e.g. LOGIN, LOGOUT, CREATE_TRANSACTION, DELETE_TRANSACTION, etc.
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    // JSON string with extra info e.g. { transactionId, amount }
  },
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'logs',
  timestamps: false, // we use our own timestamp field
  indexes: [
    { fields: ['userId'] },
    { fields: ['action'] },
    { fields: ['timestamp'] },
  ],
});

module.exports = Log;