const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireSubscription = (plans) => (req, res, next) => {
  const userPlan = req.user.subscription_plan;
  const expiresAt = req.user.subscription_expires_at;

  if (userPlan === 'free' && plans.includes('free')) return next();
  if (!plans.includes(userPlan)) {
    return res.status(403).json({
      error: 'Subscription required',
      required: plans,
      current: userPlan,
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return res.status(403).json({
      error: 'Subscription expired',
      code: 'SUBSCRIPTION_EXPIRED',
    });
  }
  next();
};

module.exports = { authenticate, requireSubscription };
