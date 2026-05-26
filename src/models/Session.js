const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tokenId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(255),
    defaultValue: 'Session',
  },
  permissions: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const raw = this.getDataValue('permissions');
      try { return JSON.parse(raw || '[]'); } catch { return []; }
    },
    set(val) {
      this.setDataValue('permissions', JSON.stringify(Array.isArray(val) ? val : []));
    },
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
}, {
  tableName: 'sessions',
  timestamps: true,
});

module.exports = Session;
