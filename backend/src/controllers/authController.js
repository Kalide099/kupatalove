const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Photo } = require('../models');
const { analyzePersonality } = require('../services/aiService');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    const {
      name, email, password, language = 'en',
      gender, interested_in = 'everyone', birthdate, city,
      bio, latitude, longitude,
    } = req.body;

    if (!name || !email || !password || !gender || !birthdate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name, email, password_hash, language,
      gender, interested_in, birthdate, city,
      bio, latitude, longitude,
    });

    // Analyze bio for AI personality weights in background
    if (bio) {
      analyzePersonality(bio).then(weights => {
        user.update({ ai_score_weights: weights }).catch(() => {});
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await user.update({ refresh_token: refreshToken });

    const userJson = user.toJSON();
    delete userJson.password_hash;
    delete userJson.refresh_token;

    res.status(201).json({ user: userJson, accessToken, refreshToken });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({
      where: { email },
      include: [{ model: Photo, as: 'photos' }],
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Reset daily likes if needed
    const now = new Date();
    const resetAt = new Date(user.likes_reset_at);
    if (now.toDateString() !== resetAt.toDateString()) {
      const maxLikes = user.subscription_plan === 'free' ? 10 : 999;
      await user.update({ likes_left_today: maxLikes, likes_reset_at: now });
    }

    await user.update({ last_active: new Date() });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await user.update({ refresh_token: refreshToken });

    const userJson = user.toJSON();
    delete userJson.password_hash;
    delete userJson.refresh_token;

    res.json({ user: userJson, accessToken, refreshToken });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user || user.refresh_token !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user.id);
    await user.update({ refresh_token: tokens.refreshToken });
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
};

const logout = async (req, res) => {
  try {
    await req.user.update({ refresh_token: null });
    res.json({ message: 'Logged out successfully' });
  } catch {
    res.status(500).json({ error: 'Logout failed' });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Photo, as: 'photos', order: [['position', 'ASC']] }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

module.exports = { register, login, refresh, logout, me };
