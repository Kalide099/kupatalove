const { createCheckoutSession, handleWebhook, PLANS } = require('../services/stripeService');
const { User } = require('../models');

const getPlans = (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'usd',
        features: ['10 likes/day', 'Basic matching', 'Chat with matches'],
      },
      {
        id: 'gold',
        name: 'Gold',
        price: 9.99,
        currency: 'usd',
        features: ['Unlimited likes', 'See who liked you', 'Read receipts', 'Rewind last swipe'],
        popular: true,
      },
      {
        id: 'platinum',
        name: 'Platinum',
        price: 19.99,
        currency: 'usd',
        features: ['All Gold features', 'AI boost priority', '5 Super Likes/day', 'Travel mode', 'AI icebreaker per match'],
      },
    ],
  });
};

const createCheckout = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['gold', 'platinum'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await createCheckoutSession(
      req.user,
      plan,
      `${frontendUrl}/app.html?tab=subscription&status=success&plan=${plan}`,
      `${frontendUrl}/app.html?tab=subscription&status=cancelled`
    );

    if (result.mock) {
      // Mock mode: update subscription directly
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await req.user.update({
        subscription_plan: plan,
        subscription_expires_at: expiresAt,
      });
      return res.json({ url: result.url, mock: true });
    }

    res.json({ url: result.url, sessionId: result.sessionId });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

const stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = await handleWebhook(req.body, sig);

    if (event.mock) return res.json({ received: true });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, plan } = session.metadata;
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
        await User.update(
          {
            subscription_plan: plan,
            subscription_expires_at: expiresAt,
            stripe_subscription_id: session.subscription,
          },
          { where: { id: userId } }
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await User.update(
          { subscription_plan: 'free', subscription_expires_at: null },
          { where: { stripe_subscription_id: subscription.id } }
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: err.message });
  }
};

const getStatus = async (req, res) => {
  res.json({
    plan: req.user.subscription_plan,
    expiresAt: req.user.subscription_expires_at,
    isActive: req.user.subscription_plan !== 'free' &&
      (!req.user.subscription_expires_at || new Date(req.user.subscription_expires_at) > new Date()),
  });
};

module.exports = { getPlans, createCheckout, stripeWebhook, getStatus };
