const sequelize = require('../config/database');
const User = require('./User');
const Photo = require('./Photo');
const Like = require('./Like');
const Match = require('./Match');
const Message = require('./Message');
const Report = require('./Report');
const Block = require('./Block');

// User → Photos
User.hasMany(Photo, { foreignKey: 'user_id', as: 'photos', onDelete: 'CASCADE' });
Photo.belongsTo(User, { foreignKey: 'user_id' });

// Like associations
Like.belongsTo(User, { foreignKey: 'from_user_id', as: 'fromUser' });
Like.belongsTo(User, { foreignKey: 'to_user_id', as: 'toUser' });

// Match associations
Match.belongsTo(User, { foreignKey: 'user1_id', as: 'user1' });
Match.belongsTo(User, { foreignKey: 'user2_id', as: 'user2' });
Match.hasMany(Message, { foreignKey: 'match_id', as: 'messages', onDelete: 'CASCADE' });

// Message associations
Message.belongsTo(Match, { foreignKey: 'match_id' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// Block / Report
Block.belongsTo(User, { foreignKey: 'blocker_id', as: 'blocker' });
Block.belongsTo(User, { foreignKey: 'blocked_id', as: 'blocked' });
Report.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' });
Report.belongsTo(User, { foreignKey: 'reported_id', as: 'reported' });

const syncDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connection established');
    await sequelize.sync({ alter: true });
    console.log('✅ All tables synced');
    return true;
  } catch (err) {
    console.error('❌ DB sync error:', err.message);
    return false;
  }
};

module.exports = { sequelize, syncDB, User, Photo, Like, Match, Message, Report, Block };
