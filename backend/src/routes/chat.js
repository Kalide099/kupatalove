const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

router.get('/:matchId/messages', authenticate, getMessages);
router.post('/:matchId/messages', authenticate, sendMessage);

module.exports = router;
