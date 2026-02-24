// Stripe Checkout - Payment Processing for Premium Plans
// Handles Pro ($19.99/mo) and Event ($299 one-time) subscriptions
// Part of FreeAuctionSite Premium Features

class StripeCheckout {
    constructor() {
        this.stripe = null;
        this.isInitialized = false;
    }

    // Initialize Stripe
    async initialize() {
        if (this.isInitialized) return;

        if (!window.Stripe) {
            console.error('Stripe.js not loaded');
            return;
        }

        if (!ENV_CONFIG.STRIPE_PUBLISHABLE_KEY || ENV_CONFIG.STRIPE_PUBLISHABLE_KEY.includes('your-')) {
            console.error('Stripe publishable key not configured');
            return;
        }

        try {
            this.stripe = Stripe(ENV_CONFIG.STRIPE_PUBLISHABLE_KEY);
            this.isInitialized = true;
            console.log('Stripe initialized');
        } catch (error) {
            console.error('Failed to initialize Stripe:', error);
        }
    }

    // Subscribe to Pro plan ($19.99/month)
    async subscribeProPlan() {
        await this.initialize();

        if (!this.stripe) {
            alert('Payment system not available. Please contact support.');
            return;
        }

        // Check if user is authenticated
        const user = await auth.getCurrentUser();
        if (!user) {
            alert('Please sign in first');
            window.location.href = '/pages/login.html';
            return;
        }

        try {
            // Create checkout session via Supabase Edge Function
            const response = await this._createCheckoutSession({
                priceId: ENV_CONFIG.STRIPE_PRICE_ID_PRO_MONTHLY,
                plan: 'pro',
                mode: 'subscription',
                userId: user.id,
                userEmail: user.email
            });

            if (!response.sessionId) {
                throw new Error('Failed to create checkout session');
            }

            // Redirect to Stripe Checkout
            const { error } = await this.stripe.redirectToCheckout({
                sessionId: response.sessionId
            });

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error starting Pro subscription:', error);
            alert('Failed to start checkout. Please try again.');
        }
    }

    // Purchase Event plan ($299 one-time)
    async purchaseEventPlan() {
        await this.initialize();

        if (!this.stripe) {
            alert('Payment system not available. Please contact support.');
            return;
        }

        // Check if user is authenticated
        const user = await auth.getCurrentUser();
        if (!user) {
            alert('Please sign in first');
            window.location.href = '/pages/login.html';
            return;
        }

        try {
            // Create checkout session via Supabase Edge Function
            const response = await this._createCheckoutSession({
                priceId: ENV_CONFIG.STRIPE_PRICE_ID_EVENT_ONETIME,
                plan: 'event',
                mode: 'payment',
                userId: user.id,
                userEmail: user.email
            });

            if (!response.sessionId) {
                throw new Error('Failed to create checkout session');
            }

            // Redirect to Stripe Checkout
            const { error } = await this.stripe.redirectToCheckout({
                sessionId: response.sessionId
            });

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error purchasing Event plan:', error);
            alert('Failed to start checkout. Please try again.');
        }
    }

    // Create checkout session
    async _createCheckoutSession(params) {
        const sb = SupabaseClient.get();
        if (!sb) {
            throw new Error('Supabase not initialized');
        }

        try {
            const { data: { session } } = await sb.auth.getSession();
            const { data, error } = await sb.functions.invoke('create-checkout-session', {
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: {
                    ...params,
                    successUrl: `${ENV_CONFIG.APP_URL}/pages/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
                    cancelUrl: `${ENV_CONFIG.APP_URL}/index.html#pricing`
                }
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating checkout session:', error);
            throw error;
        }
    }

    // Open customer portal to manage subscription
    async openCustomerPortal() {
        await this.initialize();

        const user = await auth.getCurrentUser();
        if (!user) {
            alert('Please sign in first');
            window.location.href = '/pages/login.html';
            return;
        }

        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const { data: { session } } = await sb.auth.getSession();
            const { data, error } = await sb.functions.invoke('create-portal-session', {
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: {
                    userId: user.id,
                    returnUrl: `${ENV_CONFIG.APP_URL}/index.html#tool`
                }
            });

            if (error) throw error;

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Error opening customer portal:', error);
            alert('Failed to open subscription management. Please try again.');
        }
    }

    // Verify checkout session
    async verifyCheckoutSession(sessionId) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const { data: { session } } = await sb.auth.getSession();
            const { data, error } = await sb.functions.invoke('verify-checkout-session', {
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                },
                body: { sessionId }
            });

            if (error) throw error;

            return {
                success: true,
                data
            };
        } catch (error) {
            console.error('Error verifying checkout session:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const stripeCheckout = new StripeCheckout();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StripeCheckout, stripeCheckout };
}
