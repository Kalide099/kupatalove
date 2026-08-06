const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Like = sequelize.define('Like', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  from_user_id: { type: DataTypes.INTEGER, allowNull: false },
  to_user_id: { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.ENUM('like', 'superlike', 'dislike'),
    defaultValue: 'like',
  },
}, {
  tableName: 'likes',
  indexes: [
    { fields: ['from_user_id', 'to_user_id'], unique: true },
  ],
});

module.exports = Like;
