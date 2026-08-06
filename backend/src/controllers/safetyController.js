const { Block, Report, User } = require('../models');

const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (parseInt(userId) === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });
    await Block.findOrCreate({
      where: { blocker_id: req.user.id, blocked_id: parseInt(userId) },
    });
    res.json({ message: 'User blocked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block user' });
  }
};

const unblockUser = async (req, res) => {
  try {
    await Block.destroy({ where: { blocker_id: req.user.id, blocked_id: req.params.userId } });
    res.json({ message: 'User unblocked' });
  } catch {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
};

const reportUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, details } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    await Report.create({
      reporter_id: req.user.id,
      reported_id: parseInt(userId),
      reason,
      details,
    });
    // Also auto-block
    await Block.findOrCreate({
      where: { blocker_id: req.user.id, blocked_id: parseInt(userId) },
    });
    res.json({ message: 'Report submitted' });
  } catch {
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

module.exports = { blockUser, unblockUser, reportUser };
