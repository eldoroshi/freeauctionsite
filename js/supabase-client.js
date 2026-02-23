// Supabase Client - Backend Integration for Premium Features
// Part of FreeAuctionSite Premium Features

// Import Supabase from CDN
// This file expects the Supabase library to be loaded via:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

let supabaseClient = null;
let currentUser = null;

// Initialize Supabase client
function initSupabase() {
    if (!ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
        console.log('Premium features disabled - Supabase not initialized');
        return null;
    }

    if (supabaseClient) {
        return supabaseClient;
    }

    try {
        const { createClient } = supabase;

        supabaseClient = createClient(
            ENV_CONFIG.SUPABASE_URL,
            ENV_CONFIG.SUPABASE_ANON_KEY,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10
                    }
                }
            }
        );

        // Set up auth state listener
        supabaseClient.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;
            console.log('Auth state changed:', event, currentUser ? currentUser.email : 'logged out');

            // Dispatch custom event for auth changes
            window.dispatchEvent(new CustomEvent('authStateChange', {
                detail: { event, session, user: currentUser }
            }));
        });

        return supabaseClient;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        ENV_CONFIG.PREMIUM_FEATURES_ENABLED = false;
        return null;
    }
}

// Get the Supabase client
function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

// Check if user is premium
async function isPremiumUser() {
    if (!ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
        return false;
    }

    const sb = getSupabase();
    if (!sb) return false;

    try {
        // Get current session
        const { data: { user }, error: userError } = await sb.auth.getUser();

        if (userError || !user) {
            return false;
        }

        // Check profile subscription
        const { data: profile, error: profileError } = await sb
            .from('profiles')
            .select('subscription_tier, subscription_status')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            return false;
        }

        // User is premium if they have pro or event tier with active status
        const isPremium = profile &&
            ['pro', 'event'].includes(profile.subscription_tier) &&
            profile.subscription_status === 'active';

        return isPremium;
    } catch (error) {
        console.error('Error checking premium status:', error);
        return false;
    }
}

// Get current user
async function getCurrentUser() {
    if (!ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
        return null;
    }

    const sb = getSupabase();
    if (!sb) return null;

    try {
        const { data: { user }, error } = await sb.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Get user profile with subscription details
async function getUserProfile() {
    if (!ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
        return null;
    }

    const user = await getCurrentUser();
    if (!user) return null;

    const sb = getSupabase();
    if (!sb) return null;

    try {
        const { data: profile, error } = await sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;
        return profile;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// Check if feature is available for current user
async function hasFeatureAccess(featureName) {
    const featureMatrix = {
        'hide_watermark': ['pro', 'event'],
        'custom_branding': ['pro', 'event'],
        'remote_control': ['pro', 'event'],
        'public_bidding': ['pro', 'event'],
        'silent_mode': ['pro', 'event'],
        'unlimited_items': ['pro', 'event'],
        'analytics': ['pro']
    };

    const requiredTiers = featureMatrix[featureName] || [];

    if (requiredTiers.length === 0) {
        // Feature available to all users
        return true;
    }

    const profile = await getUserProfile();
    if (!profile) {
        return false;
    }

    return requiredTiers.includes(profile.subscription_tier) &&
        profile.subscription_status === 'active';
}

// Sign out
async function signOut() {
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { error } = await sb.auth.signOut();
        if (error) throw error;
        currentUser = null;
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Export functions
const SupabaseClient = {
    init: initSupabase,
    get: getSupabase,
    isPremium: isPremiumUser,
    getCurrentUser,
    getUserProfile,
    hasFeatureAccess,
    signOut
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}
