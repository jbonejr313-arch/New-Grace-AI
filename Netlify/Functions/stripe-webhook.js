const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  var sig = event.headers['stripe-signature'];
  var endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return { statusCode: 400, body: 'Missing signature or webhook secret' };
  }

  var webhookEvent;
  try {
    webhookEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Invalid signature' };
  }

  var supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    switch (webhookEvent.type) {
      case 'checkout.session.completed': {
        var session = webhookEvent.data.object;
        var userId = session.metadata.supabase_user_id;
        if (userId && session.subscription) {
          await supabase.from('profiles').upsert({
            id: userId,
            plan: 'pro',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            updated_at: new Date().toISOString()
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        var sub = webhookEvent.data.object;
        var subUserId = sub.metadata.supabase_user_id;
        if (subUserId) {
          var isActive = sub.status === 'active' || sub.status === 'trialing';
          await supabase.from('profiles').update({
            plan: isActive ? 'pro' : 'free',
            updated_at: new Date().toISOString()
          }).eq('stripe_subscription_id', sub.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        var deletedSub = webhookEvent.data.object;
        await supabase.from('profiles').update({
          plan: 'free',
          stripe_subscription_id: null,
          updated_at: new Date().toISOString()
        }).eq('stripe_subscription_id', deletedSub.id);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: 'Webhook handler failed' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
