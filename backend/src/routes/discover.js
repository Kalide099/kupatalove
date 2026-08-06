const express = require('express');
const router = express.Router();
const { getDiscover } = require('../controllers/discoverController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getDiscover);

module.exports = router;
