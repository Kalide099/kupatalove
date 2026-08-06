const path = require('path');
const fs = require('fs');
const { User, Photo, Like, Match, Block } = require('../models');
const { Op } = require('sequelize');
const { analyzePersonality } = require('../services/aiService');

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id || req.user.id, {
      include: [{ model: Photo, as: 'photos', order: [['position', 'ASC']] }],
      attributes: { exclude: ['password_hash', 'refresh_token', 'stripe_customer_id', 'stripe_subscription_id'] },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name, bio, city, height, education, job_title,
      interested_in, language, latitude, longitude,
    } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (city) updates.city = city;
    if (height) updates.height = parseInt(height);
    if (education) updates.education = education;
    if (job_title) updates.job_title = job_title;
    if (interested_in) updates.interested_in = interested_in;
    if (language) updates.language = language;
    if (latitude) updates.latitude = parseFloat(latitude);
    if (longitude) updates.longitude = parseFloat(longitude);

    await req.user.update(updates);

    if (bio) {
      analyzePersonality(bio).then(weights => {
        req.user.update({ ai_score_weights: weights }).catch(() => {});
      });
    }

    const updated = await User.findByPk(req.user.id, {
      include: [{ model: Photo, as: 'photos' }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const photoCount = await Photo.count({ where: { user_id: req.user.id } });
    if (photoCount >= 6) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Maximum 6 photos allowed' });
    }

    const url = `/uploads/${req.file.filename}`;
    const photo = await Photo.create({
      user_id: req.user.id,
      url,
      position: photoCount,
    });

    if (!req.user.avatar) {
      await req.user.update({ avatar: url });
    }

    res.status(201).json(photo);
  } catch (err) {
    res.status(500).json({ error: 'Photo upload failed' });
  }
};

const deletePhoto = async (req, res) => {
  try {
    const photo = await Photo.findOne({
      where: { id: req.params.photoId, user_id: req.user.id },
    });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const filepath = path.join(__dirname, '../../uploads', path.basename(photo.url));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    await photo.destroy();

    // Reorder positions
    const remaining = await Photo.findAll({
      where: { user_id: req.user.id },
      order: [['position', 'ASC']],
    });
    for (let i = 0; i < remaining.length; i++) {
      await remaining[i].update({ position: i });
    }

    // Update avatar
    const first = remaining[0];
    await req.user.update({ avatar: first ? first.url : null });

    res.json({ message: 'Photo deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
};

const reorderPhotos = async (req, res) => {
  try {
    const { order } = req.body; // array of photo IDs in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Order must be an array' });

    for (let i = 0; i < order.length; i++) {
      await Photo.update(
        { position: i },
        { where: { id: order[i], user_id: req.user.id } }
      );
    }

    const photos = await Photo.findAll({
      where: { user_id: req.user.id },
      order: [['position', 'ASC']],
    });
    const firstPhoto = photos[0];
    if (firstPhoto) await req.user.update({ avatar: firstPhoto.url });

    res.json(photos);
  } catch {
    res.status(500).json({ error: 'Failed to reorder photos' });
  }
};

module.exports = { getProfile, updateProfile, uploadPhoto, deletePhoto, reorderPhotos };
