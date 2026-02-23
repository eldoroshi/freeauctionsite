// Stripe Webhook Handler - Supabase Edge Function
// Handles Stripe events to update user subscriptions
// Deploy with: supabase functions deploy stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    )

    console.log('Received Stripe event:', event.type)

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object

        console.log('Checkout session completed:', session.id)

        // Get user ID from client_reference_id (set during checkout creation)
        const userId = session.client_reference_id || session.metadata?.user_id

        if (!userId) {
          console.error('No user ID found in checkout session')
          break
        }

        const plan = session.metadata?.plan || 'pro'
        const isSubscription = session.mode === 'subscription'

        // Calculate expiration for Event plan (30 days from now)
        const expiresAt = plan === 'event'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null

        // Update user profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_customer_id: session.customer,
            stripe_subscription_id: isSubscription ? session.subscription : null,
            subscription_tier: plan,
            subscription_status: 'active',
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Error updating profile:', updateError)
          throw updateError
        }

        console.log(`User ${userId} upgraded to ${plan} plan`)

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object

        console.log('Subscription updated:', subscription.id)

        // Find user by stripe_customer_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single()

        if (profileError || !profile) {
          console.error('Profile not found for customer:', subscription.customer)
          break
        }

        // Update subscription status
        let status = 'active'
        if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
          status = 'canceled'
        } else if (subscription.status === 'past_due') {
          status = 'past_due'
        } else if (subscription.status === 'unpaid') {
          status = 'expired'
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Error updating subscription status:', updateError)
          throw updateError
        }

        console.log(`Subscription ${subscription.id} status updated to ${status}`)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object

        console.log('Subscription deleted:', subscription.id)

        // Find user by stripe_customer_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single()

        if (profileError || !profile) {
          console.error('Profile not found for customer:', subscription.customer)
          break
        }

        // Downgrade to free tier
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Error downgrading subscription:', updateError)
          throw updateError
        }

        console.log(`User ${profile.id} downgraded to free tier`)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object

        console.log('Payment failed for invoice:', invoice.id)

        // Find user by stripe_customer_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .single()

        if (profileError || !profile) {
          console.error('Profile not found for customer:', invoice.customer)
          break
        }

        // Mark as past_due
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Error updating payment status:', updateError)
          throw updateError
        }

        console.log(`User ${profile.id} marked as past_due`)

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object

        console.log('Payment succeeded for invoice:', invoice.id)

        // Find user by stripe_customer_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .single()

        if (profileError || !profile) {
          console.error('Profile not found for customer:', invoice.customer)
          break
        }

        // Mark as active
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        if (updateError) {
          console.error('Error updating payment status:', updateError)
          throw updateError
        }

        console.log(`User ${profile.id} payment succeeded, marked as active`)

        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Webhook error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
