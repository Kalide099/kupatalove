const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  match_id: { type: DataTypes.INTEGER, allowNull: false },
  sender_id: { type: DataTypes.INTEGER, allowNull: false },
  original_text: { type: DataTypes.TEXT, allowNull: false },
  translated_text: { type: DataTypes.TEXT },
  sender_lang: { type: DataTypes.STRING(10) },
  recipient_lang: { type: DataTypes.STRING(10) },
  message_type: {
    type: DataTypes.ENUM('text', 'image', 'emoji'),
    defaultValue: 'text',
  },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_translated: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'messages',
  indexes: [{ fields: ['match_id'] }],
});

module.exports = Message;
