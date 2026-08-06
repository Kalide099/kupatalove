const express = require('express');
const router = express.Router();
const { blockUser, unblockUser, reportUser } = require('../controllers/safetyController');
const { authenticate } = require('../middleware/auth');

router.post('/block/:userId', authenticate, blockUser);
router.delete('/block/:userId', authenticate, unblockUser);
router.post('/report/:userId', authenticate, reportUser);

module.exports = router;
