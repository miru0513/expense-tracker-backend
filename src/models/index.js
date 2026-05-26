const sequelize = require('../database/connection');
const Trip = require('./Trip');
const Transaction = require('./Transaction');
const Role = require('./Role');
const Permission = require('./Permission');
const User = require('./User');
const Log = require('./Log');
const SuspiciousUser = require('./SuspiciousUser');
const Session = require('./Session');
const PasswordResetToken = require('./PasswordResetToken');
const LoginOtp = require('./LoginOtp');

// Trip → Transactions (1-to-many)
Trip.hasMany(Transaction, { foreignKey: 'tripId', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });

// Role → Users (1-to-many)
Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

// Role ↔ Permissions (many-to-many)
Role.belongsToMany(Permission, { through: 'role_permissions', foreignKey: 'roleId', otherKey: 'permissionId', as: 'permissions' });
Permission.belongsToMany(Role, { through: 'role_permissions', foreignKey: 'permissionId', otherKey: 'roleId', as: 'roles' });

// User → Transactions (1-to-many)
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User → Trips (1-to-many)
User.hasMany(Trip, { foreignKey: 'userId', as: 'trips', onDelete: 'CASCADE' });
Trip.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = { sequelize, Trip, Transaction, Role, Permission, User, Log, SuspiciousUser, Session, PasswordResetToken, LoginOtp };