const { User, Photo, Like, Match, Block } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { generateCompatibility } = require('../services/aiService');

const getDiscover = async (req, res) => {
  try {
    const me = req.user;
    const { page = 0, limit = 10 } = req.query;

    // Get IDs already seen (liked or disliked)
    const seenLikes = await Like.findAll({
      where: { from_user_id: me.id },
      attributes: ['to_user_id'],
    });
    const seenIds = seenLikes.map(l => l.to_user_id);
    seenIds.push(me.id);

    // Get blocked users
    const blocks = await Block.findAll({
      where: {
        [Op.or]: [{ blocker_id: me.id }, { blocked_id: me.id }],
      },
      attributes: ['blocker_id', 'blocked_id'],
    });
    const blockedIds = blocks.map(b => b.blocker_id === me.id ? b.blocked_id : b.blocker_id);
    const excludeIds = [...new Set([...seenIds, ...blockedIds])];

    // Gender filter
    const genderFilter = {};
    if (me.interested_in === 'male') genderFilter.gender = 'male';
    else if (me.interested_in === 'female') genderFilter.gender = 'female';

    const candidates = await User.findAll({
      where: {
        id: { [Op.notIn]: excludeIds },
        is_active: true,
        ...genderFilter,
      },
      include: [{ model: Photo, as: 'photos', order: [['position', 'ASC']] }],
      attributes: { exclude: ['password_hash', 'refresh_token', 'stripe_customer_id', 'stripe_subscription_id'] },
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      order: [['last_active', 'DESC']],
    });

    // Attach AI scores (async, do not block response for large sets)
    const enriched = await Promise.all(candidates.map(async (candidate) => {
      try {
        const compat = await generateCompatibility(me, candidate);
        return {
          ...candidate.toJSON(),
          ai_score: compat.score,
          ai_icebreaker: compat.icebreaker,
        };
      } catch {
        return { ...candidate.toJSON(), ai_score: 70, ai_icebreaker: null };
      }
    }));

    // Sort by AI score descending
    enriched.sort((a, b) => b.ai_score - a.ai_score);

    res.json({ profiles: enriched, hasMore: candidates.length === parseInt(limit) });
  } catch (err) {
    console.error('Discover error:', err);
    res.status(500).json({ error: 'Failed to load discover' });
  }
};

module.exports = { getDiscover };
