const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Report = sequelize.define('Report', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  reporter_id: { type: DataTypes.INTEGER, allowNull: false },
  reported_id: { type: DataTypes.INTEGER, allowNull: false },
  reason: {
    type: DataTypes.ENUM('inappropriate', 'spam', 'fake', 'harassment', 'other'),
    allowNull: false,
  },
  details: { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'resolved'),
    defaultValue: 'pending',
  },
}, { tableName: 'reports' });

module.exports = Report;
