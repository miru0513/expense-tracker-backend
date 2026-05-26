const bcrypt = require('bcrypt');
const { User, Role, Permission } = require('../models/index');

const SALT_ROUNDS = 10;

// ── Auth ──────────────────────────────────────────────────────────────────────

const registerUser = async ({ name, email, password, roleName = 'normal_user', securityQuestion, securityAnswer }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('Email already registered');

  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) throw new Error(`Role "${roleName}" not found`);

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const securityAnswerHash = securityAnswer ? await bcrypt.hash(securityAnswer.trim().toLowerCase(), SALT_ROUNDS) : null;
  const user = await User.create({ name, email, password: hashedPassword, roleId: role.id, securityQuestion: securityQuestion || null, securityAnswerHash });
  return formatUser(await getUserById(user.id));
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({
    where: { email, isActive: true },
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });

  if (!user) throw new Error('User not found or account deactivated');

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new Error('Invalid password');

  return formatUser(user);
};

// Returns the raw Sequelize instance (includes securityQuestion, securityAnswerHash)
const getRawUserByEmail = async (email) => {
  return User.findOne({
    where: { email, isActive: true },
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });
};

const getRawUserById = async (id) => {
  return User.findByPk(id, {
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });
};

// ── Users ─────────────────────────────────────────────────────────────────────

const getUsers = async () => {
  const users = await User.findAll({
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
    order: [['createdAt', 'DESC']],
  });
  return users.map(formatUser);
};

const getUserById = async (id) => {
  const user = await User.findByPk(id, {
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });
  return user ? formatUser(user) : null;
};

const getUserByEmail = async (email) => {
  const user = await User.findOne({
    where: { email },
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });
  return user ? formatUser(user) : null;
};

const updateUserRole = async (userId, roleName) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) throw new Error(`Role "${roleName}" not found`);
  await user.update({ roleId: role.id });
  return getUserById(userId);
};

const deactivateUser = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  await user.update({ isActive: false });
  return getUserById(userId);
};

const getUserPermissions = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });
  if (!user) return [];
  return user.role.permissions.map(p => p.name);
};

// ── Roles & Permissions ───────────────────────────────────────────────────────

const getRoles = async () => {
  const roles = await Role.findAll({
    include: [{ model: Permission, as: 'permissions' }],
  });
  return roles.map(formatRole);
};

const getRoleById = async (id) => {
  const role = await Role.findByPk(id, {
    include: [{ model: Permission, as: 'permissions' }],
  });
  return role ? formatRole(role) : null;
};

const getPermissions = async () => {
  const perms = await Permission.findAll({ order: [['name', 'ASC']] });
  return perms.map(formatPermission);
};

// ── Formatters ────────────────────────────────────────────────────────────────

const formatPermission = (p) => ({
  id:          String(p.id),
  name:        p.name,
  description: p.description || '',
});

const formatRole = (r) => ({
  id:          String(r.id),
  name:        r.name,
  description: r.description || '',
  permissions: (r.permissions || []).map(formatPermission),
});

const formatUser = (u) => ({
  id:        u.id,
  name:      u.name,
  email:     u.email,
  isActive:  u.isActive,
  createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
  role:      u.role ? formatRole(u.role) : null,
});

module.exports = {
  registerUser,
  loginUser,
  getRawUserByEmail,
  getRawUserById,
  getUsers,
  getUserById,
  getUserByEmail,
  updateUserRole,
  deactivateUser,
  getUserPermissions,
  getRoles,
  getRoleById,
  getPermissions,
};
