const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  language: {
    type: DataTypes.STRING(10),
    defaultValue: 'en',
  },
  bio: {
    type: DataTypes.TEXT,
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'non-binary', 'other'),
    allowNull: false,
  },
  interested_in: {
    type: DataTypes.ENUM('male', 'female', 'everyone'),
    defaultValue: 'everyone',
  },
  birthdate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING(100),
  },
  latitude: {
    type: DataTypes.FLOAT,
  },
  longitude: {
    type: DataTypes.FLOAT,
  },
  height: {
    type: DataTypes.INTEGER,
    comment: 'Height in cm',
  },
  education: {
    type: DataTypes.STRING(255),
  },
  job_title: {
    type: DataTypes.STRING(255),
  },
  avatar: {
    type: DataTypes.STRING(500),
    comment: 'Primary photo URL',
  },
  subscription_plan: {
    type: DataTypes.ENUM('free', 'gold', 'platinum'),
    defaultValue: 'free',
  },
  subscription_expires_at: {
    type: DataTypes.DATE,
  },
  stripe_customer_id: {
    type: DataTypes.STRING(255),
  },
  stripe_subscription_id: {
    type: DataTypes.STRING(255),
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_active: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  ai_score_weights: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'AI personality quiz weights',
  },
  likes_left_today: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  likes_reset_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  refresh_token: {
    type: DataTypes.TEXT,
  },
  prompts: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of { question, answer } objects',
  },
}, {
  tableName: 'users',
  indexes: [
    { fields: ['email'] },
    { fields: ['gender', 'interested_in'] },
  ],
});

module.exports = User;
