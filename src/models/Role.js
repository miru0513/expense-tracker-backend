const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      isIn: {
        args: [['admin', 'normal_user']],
        msg: 'Role must be admin or normal_user',
      },
    },
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'roles',
  timestamps: true,
});

module.exports = Role;