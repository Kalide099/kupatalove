const express = require('express');
const router = express.Router();
const { getMessages, sendMessage, sendAudioMessage } = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/:matchId/messages', authenticate, getMessages);
router.post('/:matchId/messages', authenticate, sendMessage);
router.post('/:matchId/audio', authenticate, upload.single('audio'), sendAudioMessage);

module.exports = router;
