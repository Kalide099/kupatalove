const jwt = require('jsonwebtoken');
const { User, Match, Message } = require('../models');
const { Op } = require('sequelize');
const { translateText } = require('../services/translationService');

// Track online users: userId -> socketId
const onlineUsers = new Map();

const initSocket = (io) => {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password_hash', 'refresh_token'] },
      });
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    onlineUsers.set(userId, socket.id);
    console.log(`🟢 User ${socket.user.name} (${userId}) connected`);

    // Notify others this user is online
    socket.broadcast.emit('user_online', { userId });

    // Join user's own room for direct notifications
    socket.join(`user:${userId}`);

    // ─── Join a match chat room ─────────────────────────────
    socket.on('join_match', async ({ matchId }) => {
      try {
        const match = await Match.findOne({
          where: {
            id: matchId,
            [Op.or]: [{ user1_id: userId }, { user2_id: userId }],
          },
        });
        if (!match) return socket.emit('error', { message: 'Match not found' });
        socket.join(`match:${matchId}`);
        socket.emit('joined_match', { matchId });
      } catch (err) {
        socket.emit('error', { message: 'Failed to join match' });
      }
    });

    // ─── Send a message (real-time + translation) ───────────
    socket.on('send_message', async ({ matchId, text, messageType = 'text' }) => {
      try {
        if (!text || text.trim() === '') return;

        const match = await Match.findOne({
          where: {
            id: matchId,
            [Op.or]: [{ user1_id: userId }, { user2_id: userId }],
          },
        });
        if (!match) return socket.emit('error', { message: 'Not authorized' });

        const recipientId = match.user1_id === userId ? match.user2_id : match.user1_id;
        const recipient = await User.findByPk(recipientId, { attributes: ['id', 'language', 'name'] });

        const senderLang = socket.user.language || 'en';
        const recipientLang = recipient?.language || 'en';

        let translatedText = null;
        let isTranslated = false;

        if (senderLang !== recipientLang) {
          translatedText = await translateText(text, senderLang, recipientLang);
          isTranslated = translatedText !== text;
        }

        const message = await Message.create({
          match_id: parseInt(matchId),
          sender_id: userId,
          original_text: text,
          translated_text: isTranslated ? translatedText : null,
          sender_lang: senderLang,
          recipient_lang: recipientLang,
          message_type: messageType,
          is_translated: isTranslated,
        });

        const messageData = message.toJSON();

        // Emit to room: sender sees original, recipient sees translated
        io.to(`match:${matchId}`).emit('new_message', {
          ...messageData,
          senderName: socket.user.name,
        });

        // Push notification to recipient if offline/in different room
        if (recipient) {
          io.to(`user:${recipientId}`).emit('notification', {
            type: 'new_message',
            matchId,
            senderName: socket.user.name,
            preview: isTranslated ? translatedText : text,
          });
        }
      } catch (err) {
        console.error('Socket send_message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ─── Typing indicator ────────────────────────────────────
    socket.on('typing', ({ matchId, isTyping }) => {
      socket.to(`match:${matchId}`).emit('user_typing', {
        userId,
        matchId,
        isTyping,
      });
    });

    // ─── Read receipt ────────────────────────────────────────
    socket.on('mark_read', async ({ matchId }) => {
      try {
        await Message.update(
          { is_read: true },
          {
            where: {
              match_id: matchId,
              sender_id: { [Op.ne]: userId },
              is_read: false,
            },
          }
        );
        socket.to(`match:${matchId}`).emit('messages_read', { matchId, readBy: userId });
      } catch (err) {
        console.error('Mark read error:', err);
      }
    });

    // ─── New match notification ──────────────────────────────
    socket.on('match_made', ({ matchId, otherUserId }) => {
      io.to(`user:${otherUserId}`).emit('new_match', {
        matchId,
        fromUserId: userId,
        fromUserName: socket.user.name,
        fromUserAvatar: socket.user.avatar,
      });
    });

    // ─── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      socket.broadcast.emit('user_offline', { userId });
      console.log(`🔴 User ${socket.user.name} disconnected`);
    });
  });
};

const isUserOnline = (userId) => onlineUsers.has(userId);
const getOnlineUsers = () => Array.from(onlineUsers.keys());

module.exports = { initSocket, isUserOnline, getOnlineUsers };
