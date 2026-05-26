const bcrypt = require('bcrypt');
const { Role, Permission, User } = require('../models/index');

const SALT_ROUNDS = 10;

const ALL_PERMISSIONS = [
  { name: 'transaction:create',  description: 'Create transactions' },
  { name: 'transaction:read',    description: 'View transactions' },
  { name: 'transaction:update',  description: 'Edit transactions' },
  { name: 'transaction:delete',  description: 'Delete transactions' },
  { name: 'trip:create',         description: 'Create trips' },
  { name: 'trip:read',           description: 'View trips' },
  { name: 'trip:update',         description: 'Edit trips' },
  { name: 'trip:delete',         description: 'Delete trips' },
  { name: 'stats:view',          description: 'View statistics' },
  { name: 'generator:start',     description: 'Start data generator' },
  { name: 'generator:stop',      description: 'Stop data generator' },
  { name: 'user:manage',         description: 'Manage users (admin only)' },
];

const NORMAL_USER_PERMISSIONS = [
  'transaction:create',
  'transaction:read',
  'transaction:update',
  'trip:create',
  'trip:read',
  'trip:update',
  'stats:view',
];

const ADMIN_PERMISSIONS = ALL_PERMISSIONS.map(p => p.name);

const migratePasswordIfPlainText = async (user, plainPassword) => {
  // Bcrypt hashes always start with '$2' — migrate plain-text passwords from prior runs
  if (user.password && !user.password.startsWith('$2')) {
    await user.update({ password: await bcrypt.hash(plainPassword, SALT_ROUNDS) });
  }
};

const seedDatabase = async () => {
  try {
    for (const perm of ALL_PERMISSIONS) {
      await Permission.findOrCreate({
        where: { name: perm.name },
        defaults: { description: perm.description },
      });
    }
    console.log('[Seed] Permissions created');

    const [adminRole] = await Role.findOrCreate({
      where: { name: 'admin' },
      defaults: { description: 'Full access to all features' },
    });

    const [normalRole] = await Role.findOrCreate({
      where: { name: 'normal_user' },
      defaults: { description: 'Restricted access — cannot delete or manage users' },
    });

    const adminPerms = await Permission.findAll({ where: { name: ADMIN_PERMISSIONS } });
    await adminRole.setPermissions(adminPerms);

    const normalPerms = await Permission.findAll({ where: { name: NORMAL_USER_PERMISSIONS } });
    await normalRole.setPermissions(normalPerms);

    console.log('[Seed] Roles and permissions assigned');

    const [adminUser, adminCreated] = await User.findOrCreate({
      where: { email: 'admin@smartspend.com' },
      defaults: {
        name: 'Admin',
        email: 'admin@smartspend.com',
        password: await bcrypt.hash('admin123', SALT_ROUNDS),
        roleId: adminRole.id,
        isActive: true,
      },
    });
    if (!adminCreated) await migratePasswordIfPlainText(adminUser, 'admin123');

    const [normalUser, normalCreated] = await User.findOrCreate({
      where: { email: 'user@smartspend.com' },
      defaults: {
        name: 'Normal User',
        email: 'user@smartspend.com',
        password: await bcrypt.hash('user123', SALT_ROUNDS),
        roleId: normalRole.id,
        isActive: true,
      },
    });
    if (!normalCreated) await migratePasswordIfPlainText(normalUser, 'user123');

    console.log('[Seed] Default users created');
    console.log('[Seed]   Admin:  admin@smartspend.com / admin123');
    console.log('[Seed]   User:   user@smartspend.com  / user123');

  } catch (err) {
    console.error('[Seed] Error:', err.message);
  }
};

module.exports = seedDatabase;
