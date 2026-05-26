const { Sequelize } = require('sequelize');

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    })
  : new Sequelize(
      process.env.DB_NAME     || 'expense_tracker',
      process.env.DB_USER     || 'sa',
      process.env.DB_PASSWORD || 'miru1234',
      {
        host:    process.env.DB_HOST || 'localhost',
        port:    parseInt(process.env.DB_PORT) || 5432,
        dialect: 'postgres',
        logging: false,
        pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
      }
    );

module.exports = sequelize;