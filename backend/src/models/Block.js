const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Block = sequelize.define('Block', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  blocker_id: { type: DataTypes.INTEGER, allowNull: false },
  blocked_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'blocks',
  indexes: [{ fields: ['blocker_id', 'blocked_id'], unique: true }],
});

module.exports = Block;
