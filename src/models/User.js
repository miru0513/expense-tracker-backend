const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Name must not be empty' },
      len: { args: [2, 255], msg: 'Name must be at least 2 characters' },
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: { msg: 'Must be a valid email address' },
    },
  },
  // Plain text password — no encryption yet (next assignment)
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: { args: [4, 255], msg: 'Password must be at least 4 characters' },
    },
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'roles',
      key: 'id',
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  securityQuestion: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  securityAnswerHash: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;