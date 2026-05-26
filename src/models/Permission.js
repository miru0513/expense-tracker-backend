const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    // e.g. 'transaction:create', 'transaction:delete', 'trip:create', 'stats:view', 'generator:start'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'permissions',
  timestamps: true,
});

module.exports = Permission;