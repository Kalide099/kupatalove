const { User, Photo, Like, Match } = require('../models');
const { Op } = require('sequelize');
const { generateCompatibility } = require('../services/aiService');

const sendLike = async (req, res) => {
  try {
    const me = req.user;
    const { userId } = req.params;
    const { type = 'like' } = req.body;

    if (parseInt(userId) === me.id) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }

    // Check daily like limit for free users
    if (me.subscription_plan === 'free') {
      const now = new Date();
      const resetAt = new Date(me.likes_reset_at);
      if (now.toDateString() !== resetAt.toDateString()) {
        await me.update({ likes_left_today: 10, likes_reset_at: now });
        me.likes_left_today = 10;
      }
      if (me.likes_left_today <= 0 && type !== 'dislike') {
        return res.status(429).json({
          error: 'Daily like limit reached. Upgrade to Gold for unlimited likes.',
          code: 'LIKE_LIMIT_REACHED',
        });
      }
    }

    // Check super like limit (5/day for platinum)
    if (type === 'superlike' && me.subscription_plan !== 'platinum') {
      return res.status(403).json({
        error: 'Super likes require Platinum subscription',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    const target = await User.findByPk(userId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Upsert the like
    const [like, created] = await Like.findOrCreate({
      where: { from_user_id: me.id, to_user_id: parseInt(userId) },
      defaults: { type },
    });
    if (!created) await like.update({ type });

    // Decrement likes count
    if (type !== 'dislike' && me.subscription_plan === 'free') {
      await me.update({ likes_left_today: Math.max(0, me.likes_left_today - 1) });
    }

    // Check for mutual like = MATCH
    let match = null;
    let isMatch = false;

    if (type === 'like' || type === 'superlike') {
      const reciprocalLike = await Like.findOne({
        where: {
          from_user_id: parseInt(userId),
          to_user_id: me.id,
          type: { [Op.in]: ['like', 'superlike'] },
        },
      });

      if (reciprocalLike) {
        const [minId, maxId] = [me.id, parseInt(userId)].sort((a, b) => a - b);
        const [m, matchCreated] = await Match.findOrCreate({
          where: { user1_id: minId, user2_id: maxId },
          defaults: {
            user1_id: minId,
            user2_id: maxId,
            ai_compatibility_score: 75,
          },
        });

        if (matchCreated) {
          isMatch = true;
          match = m;
          // Generate icebreaker async
          generateCompatibility(me, target).then(compat => {
            m.update({
              ai_icebreaker: compat.icebreaker,
              ai_compatibility_score: compat.score,
            }).catch(() => {});
          });
        } else {
          match = m;
        }
      }
    }

    res.json({
      success: true,
      isMatch,
      match: match ? {
        id: match.id,
        userId: parseInt(userId),
        userName: target.name,
        userAvatar: target.avatar,
        icebreaker: match.ai_icebreaker,
      } : null,
      likesLeft: me.subscription_plan === 'free' ? me.likes_left_today - 1 : 999,
    });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to process like' });
  }
};

const getMatches = async (req, res) => {
  try {
    const me = req.user;

    const matches = await Match.findAll({
      where: {
        [Op.or]: [{ user1_id: me.id }, { user2_id: me.id }],
        is_active: true,
      },
      include: [
        {
          model: User,
          as: 'user1',
          include: [{ model: Photo, as: 'photos', limit: 1, order: [['position', 'ASC']] }],
          attributes: { exclude: ['password_hash', 'refresh_token'] },
        },
        {
          model: User,
          as: 'user2',
          include: [{ model: Photo, as: 'photos', limit: 1, order: [['position', 'ASC']] }],
          attributes: { exclude: ['password_hash', 'refresh_token'] },
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const formatted = matches.map(match => {
      const other = match.user1_id === me.id ? match.user2 : match.user1;
      return {
        matchId: match.id,
        userId: other.id,
        name: other.name,
        avatar: other.avatar || (other.photos[0]?.url),
        ai_icebreaker: match.ai_icebreaker,
        ai_compatibility_score: match.ai_compatibility_score,
        createdAt: match.created_at,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
};

const getLikedMe = async (req, res) => {
  try {
    if (req.user.subscription_plan === 'free') {
      return res.status(403).json({
        error: 'Upgrade to Gold to see who liked you',
        code: 'SUBSCRIPTION_REQUIRED',
        plan: 'gold',
      });
    }

    const likedMe = await Like.findAll({
      where: { to_user_id: req.user.id, type: { [Op.in]: ['like', 'superlike'] } },
      include: [{
        model: User,
        as: 'fromUser',
        include: [{ model: Photo, as: 'photos', limit: 1 }],
        attributes: { exclude: ['password_hash', 'refresh_token'] },
      }],
      order: [['created_at', 'DESC']],
    });

    res.json(likedMe.map(l => ({
      userId: l.fromUser.id,
      name: l.fromUser.name,
      avatar: l.fromUser.avatar,
      type: l.type,
      likedAt: l.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get likes' });
  }
};

module.exports = { sendLike, getMatches, getLikedMe };
