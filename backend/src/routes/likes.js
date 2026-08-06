const express = require('express');
const router = express.Router();
const { sendLike, getMatches, getLikedMe } = require('../controllers/likeController');
const { authenticate } = require('../middleware/auth');

router.post('/:userId', authenticate, sendLike);
router.get('/matches', authenticate, getMatches);
router.get('/liked-me', authenticate, getLikedMe);

module.exports = router;
