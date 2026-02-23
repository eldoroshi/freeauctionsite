// Environment Configuration for FreeAuctionSite
//
// INSTRUCTIONS:
// 1. Create a Supabase project at https://supabase.com
// 2. Get your project URL and anon key from Settings > API
// 3. Create a Stripe account at https://stripe.com
// 4. Get your publishable key from Developers > API keys
// 5. Replace the placeholder values below with your actual keys
//
// For production, consider using environment-specific files:
// - config/env.development.js
// - config/env.production.js

const ENV_CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here',

    // Stripe Configuration
    STRIPE_PUBLISHABLE_KEY: 'pk_test_your-stripe-key-here',

    // Feature Flags
    PREMIUM_FEATURES_ENABLED: true,  // Set to false to disable all premium features

    // App Configuration
    APP_URL: window.location.origin,

    // Pricing (Price IDs from Stripe)
    STRIPE_PRICE_ID_PRO_MONTHLY: 'price_pro_monthly_9',
    STRIPE_PRICE_ID_EVENT_ONETIME: 'price_event_29',

    // Development mode detection
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',

    // Get base URL for API calls
    getApiUrl() {
        return this.isDevelopment
            ? 'http://localhost:54321/functions/v1'
            : `${this.SUPABASE_URL}/functions/v1`;
    }
};

// Validate configuration on load
function validateConfig() {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missing = required.filter(key =>
        !ENV_CONFIG[key] || ENV_CONFIG[key].includes('your-')
    );

    if (missing.length > 0 && ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
        console.warn('⚠️ Premium features enabled but configuration incomplete:', missing);
        console.warn('Premium features will be disabled until configuration is complete.');
        ENV_CONFIG.PREMIUM_FEATURES_ENABLED = false;
    }
}

validateConfig();

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ENV_CONFIG;
}
