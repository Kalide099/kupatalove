const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Match = sequelize.define('Match', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user1_id: { type: DataTypes.INTEGER, allowNull: false },
  user2_id: { type: DataTypes.INTEGER, allowNull: false },
  ai_icebreaker: { type: DataTypes.TEXT },
  ai_compatibility_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'matches',
  indexes: [
    { fields: ['user1_id', 'user2_id'], unique: true },
  ],
});

module.exports = Match;
