const { Message, Match, User } = require('../models');
const { Op } = require('sequelize');
const { translateText } = require('../services/translationService');

const getMessages = async (req, res) => {
  try {
    const { matchId } = req.params;
    const me = req.user;

    // Verify user is part of this match
    const match = await Match.findOne({
      where: {
        id: matchId,
        [Op.or]: [{ user1_id: me.id }, { user2_id: me.id }],
      },
    });
    if (!match) return res.status(403).json({ error: 'Not authorized for this match' });

    const messages = await Message.findAll({
      where: { match_id: matchId },
      order: [['created_at', 'ASC']],
      limit: 100,
    });

    // Mark messages from other user as read
    await Message.update(
      { is_read: true },
      { where: { match_id: matchId, sender_id: { [Op.ne]: me.id }, is_read: false } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { matchId } = req.params;
    const me = req.user;
    const { text, message_type = 'text' } = req.body;

    if (!text || text.trim() === '') return res.status(400).json({ error: 'Message cannot be empty' });

    const match = await Match.findOne({
      where: {
        id: matchId,
        [Op.or]: [{ user1_id: me.id }, { user2_id: me.id }],
      },
    });
    if (!match) return res.status(403).json({ error: 'Not authorized for this match' });

    const recipientId = match.user1_id === me.id ? match.user2_id : match.user1_id;
    const recipient = await User.findByPk(recipientId, { attributes: ['id', 'language'] });

    const senderLang = me.language || 'en';
    const recipientLang = recipient.language || 'en';

    let translatedText = text;
    let isTranslated = false;

    if (senderLang !== recipientLang) {
      translatedText = await translateText(text, senderLang, recipientLang);
      isTranslated = translatedText !== text;
    }

    const message = await Message.create({
      match_id: parseInt(matchId),
      sender_id: me.id,
      original_text: text,
      translated_text: isTranslated ? translatedText : null,
      sender_lang: senderLang,
      recipient_lang: recipientLang,
      message_type,
      is_translated: isTranslated,
    });

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

module.exports = { getMessages, sendMessage };
