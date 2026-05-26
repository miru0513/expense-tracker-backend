const sequelize = require('./connection');

const runMigrations = async () => {
  const qi = sequelize.getQueryInterface();

  try {
    const columns = await qi.describeTable('users');

    if (!columns.securityQuestion) {
      await qi.addColumn('users', 'securityQuestion', {
        type: require('sequelize').DataTypes.STRING(500),
        allowNull: true,
      });
      console.log('[Migrate] Added column: users.securityQuestion');
    }

    if (!columns.securityAnswerHash) {
      await qi.addColumn('users', 'securityAnswerHash', {
        type: require('sequelize').DataTypes.STRING(255),
        allowNull: true,
      });
      console.log('[Migrate] Added column: users.securityAnswerHash');
    }
  } catch (err) {
    console.error('[Migrate] Error migrating users table:', err.message);
  }

  console.log('[Migrate] Migrations complete');
};

module.exports = runMigrations;
