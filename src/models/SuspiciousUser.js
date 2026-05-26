const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const SuspiciousUser = sequelize.define('SuspiciousUser', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: false,
  },
  userEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  userRole: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  actionCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  detectedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'suspicious_users',
  timestamps: false,
});

module.exports = SuspiciousUser;
