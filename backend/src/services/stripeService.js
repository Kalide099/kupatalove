const Stripe = require('stripe');

let stripe = null;

const getStripe = () => {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.startsWith('sk_test_placeholder')) return null;
    stripe = new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return stripe;
};

const PLANS = {
  gold: {
    name: 'KupataLove Gold',
    price: 999, // cents = $9.99
    currency: 'usd',
    interval: 'month',
    features: ['Unlimited likes', 'See who liked you', 'Read receipts', 'Rewind last swipe'],
    priceId: process.env.STRIPE_GOLD_PRICE_ID,
  },
  platinum: {
    name: 'KupataLove Platinum',
    price: 1999, // cents = $19.99
    currency: 'usd',
    interval: 'month',
    features: ['All Gold features', 'AI boost', 'Priority placement', '5 Super Likes/day', 'Travel mode'],
    priceId: process.env.STRIPE_PLATINUM_PRICE_ID,
  },
};

/**
 * Create Stripe checkout session
 */
const createCheckoutSession = async (user, plan, successUrl, cancelUrl) => {
  const client = getStripe();
  if (!client) {
    return {
      mock: true,
      url: `${process.env.FRONTEND_URL}/subscription-success?plan=${plan}&mock=true`,
    };
  }

  const planDetails = PLANS[plan];
  if (!planDetails) throw new Error('Invalid plan');

  // Create or retrieve customer
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await client.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user.id) },
    });
    customerId = customer.id;
    await user.update({ stripe_customer_id: customerId });
  }

  const session = await client.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price: planDetails.priceId,
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: String(user.id), plan },
  });

  return { url: session.url, sessionId: session.id };
};

/**
 * Handle Stripe webhook
 */
const handleWebhook = async (payload, signature) => {
  const client = getStripe();
  if (!client) return { mock: true };

  const event = client.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  return event;
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (subscriptionId) => {
  const client = getStripe();
  if (!client) return { mock: true };
  return client.subscriptions.cancel(subscriptionId);
};

module.exports = { createCheckoutSession, handleWebhook, cancelSubscription, PLANS };
