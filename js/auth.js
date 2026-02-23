// Authentication Manager - User Sign Up, Sign In, and Magic Links
// Part of FreeAuctionSite Premium Features

class AuthManager {
    constructor() {
        this.user = null;
        this.profile = null;
    }

    // Sign up with email and password
    async signUpWithEmail(email, password, fullName) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            // Sign up user
            const { data, error } = await sb.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                // Create profile in profiles table
                const { error: profileError } = await sb
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        email: data.user.email,
                        full_name: fullName,
                        subscription_tier: 'free',
                        subscription_status: 'active',
                        created_at: new Date().toISOString()
                    });

                if (profileError) {
                    console.error('Error creating profile:', profileError);
                    // Continue anyway as the user is created
                }

                this.user = data.user;
                return {
                    success: true,
                    user: data.user,
                    message: 'Account created successfully! Check your email to verify your account.'
                };
            }

            return {
                success: false,
                message: 'Failed to create account'
            };
        } catch (error) {
            console.error('Sign up error:', error);
            return {
                success: false,
                message: error.message || 'Failed to create account'
            };
        }
    }

    // Sign in with email and password
    async signInWithEmail(email, password) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const { data, error } = await sb.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.user = data.user;
            await this.loadProfile();

            return {
                success: true,
                user: data.user,
                message: 'Signed in successfully!'
            };
        } catch (error) {
            console.error('Sign in error:', error);
            return {
                success: false,
                message: error.message || 'Failed to sign in'
            };
        }
    }

    // Sign in with magic link (passwordless)
    async signInWithMagicLink(email, redirectTo = null) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const options = {};
            if (redirectTo) {
                options.emailRedirectTo = redirectTo;
            }

            const { error } = await sb.auth.signInWithOtp({
                email,
                options
            });

            if (error) throw error;

            return {
                success: true,
                message: 'Check your email for the magic link!'
            };
        } catch (error) {
            console.error('Magic link error:', error);
            return {
                success: false,
                message: error.message || 'Failed to send magic link'
            };
        }
    }

    // Generate magic link for bidders to access an event
    async generateBidderMagicLink(email, eventId) {
        try {
            const redirectUrl = `${ENV_CONFIG.APP_URL}/pages/bid.html?event=${eventId}`;
            return await this.signInWithMagicLink(email, redirectUrl);
        } catch (error) {
            console.error('Error generating bidder link:', error);
            return {
                success: false,
                message: 'Failed to generate bidder link'
            };
        }
    }

    // Sign out
    async signOut() {
        try {
            await SupabaseClient.signOut();
            this.user = null;
            this.profile = null;

            return {
                success: true,
                message: 'Signed out successfully'
            };
        } catch (error) {
            console.error('Sign out error:', error);
            return {
                success: false,
                message: 'Failed to sign out'
            };
        }
    }

    // Load user profile
    async loadProfile() {
        try {
            this.profile = await SupabaseClient.getUserProfile();
            return this.profile;
        } catch (error) {
            console.error('Error loading profile:', error);
            return null;
        }
    }

    // Get current user
    async getCurrentUser() {
        if (!this.user) {
            this.user = await SupabaseClient.getCurrentUser();
        }
        return this.user;
    }

    // Get current profile
    async getProfile() {
        if (!this.profile) {
            await this.loadProfile();
        }
        return this.profile;
    }

    // Check if user is authenticated
    async isAuthenticated() {
        const user = await this.getCurrentUser();
        return !!user;
    }

    // Check if user is premium
    async isPremium() {
        return await SupabaseClient.isPremium();
    }

    // Update profile
    async updateProfile(updates) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const user = await this.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await sb
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            // Reload profile
            await this.loadProfile();

            return {
                success: true,
                message: 'Profile updated successfully'
            };
        } catch (error) {
            console.error('Error updating profile:', error);
            return {
                success: false,
                message: error.message || 'Failed to update profile'
            };
        }
    }

    // Reset password
    async resetPassword(email) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const { error } = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: `${ENV_CONFIG.APP_URL}/pages/reset-password.html`
            });

            if (error) throw error;

            return {
                success: true,
                message: 'Password reset email sent! Check your inbox.'
            };
        } catch (error) {
            console.error('Password reset error:', error);
            return {
                success: false,
                message: error.message || 'Failed to send reset email'
            };
        }
    }

    // Update password
    async updatePassword(newPassword) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const { error } = await sb.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            return {
                success: true,
                message: 'Password updated successfully'
            };
        } catch (error) {
            console.error('Password update error:', error);
            return {
                success: false,
                message: error.message || 'Failed to update password'
            };
        }
    }
}

// Create singleton instance
const auth = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, auth };
}
