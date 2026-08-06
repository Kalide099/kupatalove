const express = require('express');
const router = express.Router();
const { getPlans, createCheckout, stripeWebhook, getStatus } = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/auth');

router.get('/plans', getPlans);
router.post('/checkout', authenticate, createCheckout);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
router.get('/status', authenticate, getStatus);

module.exports = router;
