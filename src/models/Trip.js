const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Trip = sequelize.define('Trip', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Trip name must not be empty' },
      len: { args: [1, 255], msg: 'Trip name must be between 1 and 255 characters' },
    },
  },
  icon: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '✈️',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: () => new Date().toISOString().split('T')[0],
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'trips',
  timestamps: true,
});

module.exports = Trip;