# Supabase Edge Functions

These Edge Functions handle Stripe webhooks and checkout sessions for FreeAuctionSite premium features.

## Setup

### 1. Install Supabase CLI

```bash
brew install supabase/tap/supabase
# or
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to your project

```bash
supabase link --project-ref your-project-ref
```

### 4. Set secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 5. Deploy functions

```bash
# Deploy all functions
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session

# Or deploy individually
supabase functions deploy stripe-webhook
```

## Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the webhook signing secret and set it as `STRIPE_WEBHOOK_SECRET`

## Testing Locally

### 1. Start Supabase locally

```bash
supabase start
```

### 2. Serve functions locally

```bash
supabase functions serve stripe-webhook --env-file .env.local
```

### 3. Test with Stripe CLI

```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

## Function Endpoints

- **stripe-webhook**: `POST /functions/v1/stripe-webhook`
  - Handles Stripe webhook events
  - Updates user subscription status in database

- **create-checkout-session**: `POST /functions/v1/create-checkout-session`
  - Creates Stripe Checkout session for Pro/Event plans
  - Returns session ID for redirect

- **create-portal-session**: `POST /functions/v1/create-portal-session`
  - Creates Stripe Customer Portal session
  - Allows users to manage their subscriptions

## Environment Variables Required

- `STRIPE_SECRET_KEY`: Your Stripe secret key (sk_test_... or sk_live_...)
- `STRIPE_WEBHOOK_SECRET`: Webhook signing secret from Stripe
- `SUPABASE_URL`: Your Supabase project URL (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (auto-provided)

## Security Notes

- Edge Functions use Supabase service role key to bypass RLS for webhook processing
- All webhook requests are verified using Stripe signature
- User authentication is handled by Supabase Auth
- Never expose secret keys in client-side code
