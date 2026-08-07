const path = require('path');
const envPath = path.join(__dirname, '../../.env');
require('dotenv').config({ path: envPath });
const { Sequelize } = require('sequelize');

// XAMPP MySQL connection options
const dialectOptions = {};
// On Windows XAMPP, MySQL may use named pipes; TCP is standard
// If you get socket errors, uncomment:
// dialectOptions.socketPath = 'MySQL';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'u633695266_kupatalove',
  process.env.DB_USER || 'u633695266_kupata',
  process.env.DB_PASS || 'KupataLove1234',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    dialectOptions,
    logging: process.env.NODE_ENV === 'development' ? false : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

module.exports = sequelize;
