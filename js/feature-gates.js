// Feature Gating System - Upgrade Prompts for Premium Features
// Shows upgrade modals when free users try to access premium features
// Part of FreeAuctionSite Premium Features

class FeatureGate {
    constructor() {
        this.featureMatrix = {
            'hide_watermark': {
                name: 'Remove Watermark',
                description: 'Remove the "Powered by FreeAuctionSite" branding from your display',
                tiers: ['pro', 'event']
            },
            'custom_branding': {
                name: 'Custom Branding',
                description: 'Customize colors, backgrounds, and add your logo',
                tiers: ['pro', 'event']
            },
            'remote_control': {
                name: 'Remote Control',
                description: 'Control your auction from any device - phone, tablet, or computer',
                tiers: ['pro', 'event']
            },
            'public_bidding': {
                name: 'Public Bidding',
                description: 'Let guests place bids from their mobile phones',
                tiers: ['pro', 'event']
            },
            'silent_mode': {
                name: 'Silent Bidding Mode',
                description: 'Hide bids until you reveal them for dramatic effect',
                tiers: ['pro', 'event']
            },
            'unlimited_items': {
                name: 'Unlimited Items',
                description: 'Add as many auction items as you need',
                tiers: ['pro', 'event']
            },
            'analytics': {
                name: 'Analytics Dashboard',
                description: 'Track bids, bidders, and revenue in real-time',
                tiers: ['pro']
            }
        };
    }

    // Check if user has access to a feature
    async hasAccess(featureName) {
        if (!ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
            return false;
        }

        try {
            const user = await auth.getCurrentUser();
            if (!user) return false;

            const profile = await auth.getProfile();
            if (!profile) return false;

            const feature = this.featureMatrix[featureName];
            if (!feature) return true; // Unknown feature, allow by default

            return feature.tiers.includes(profile.subscription_tier) &&
                   profile.subscription_status === 'active';
        } catch (error) {
            console.error('Error checking feature access:', error);
            return false;
        }
    }

    // Show upgrade prompt for a feature
    async showUpgradePrompt(featureName, options = {}) {
        const feature = this.featureMatrix[featureName];
        if (!feature) {
            console.error('Unknown feature:', featureName);
            return;
        }

        // Check if user is logged in
        const user = await auth.getCurrentUser();

        const modal = document.createElement('div');
        modal.className = 'feature-gate-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
            animation: fadeIn 0.2s ease-out;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 48px;
                max-width: 520px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease-out;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-size: 2.5rem;
                ">
                    🔒
                </div>

                <h2 style="
                    font-size: 1.75rem;
                    margin-bottom: 12px;
                    color: #1e293b;
                ">${feature.name}</h2>

                <p style="
                    color: #64748b;
                    line-height: 1.6;
                    margin-bottom: 32px;
                    font-size: 1.125rem;
                ">${feature.description}</p>

                <div style="
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 32px;
                    text-align: left;
                ">
                    <h3 style="
                        font-size: 0.875rem;
                        color: #1e293b;
                        font-weight: 700;
                        text-transform: uppercase;
                        margin-bottom: 16px;
                    ">Included in Premium Plans:</h3>
                    <ul style="
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    ">
                        ${this._getPremiumFeatures().map(f => `
                            <li style="
                                padding: 8px 0;
                                color: #475569;
                                display: flex;
                                align-items: center;
                            ">
                                <span style="
                                    color: #10b981;
                                    font-weight: bold;
                                    margin-right: 12px;
                                    font-size: 1.125rem;
                                ">✓</span>
                                ${f}
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="this.closest('.feature-gate-modal').remove()" style="
                        padding: 14px 28px;
                        background: #f1f5f9;
                        color: #1e293b;
                        border: none;
                        border-radius: 10px;
                        font-weight: 600;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">Maybe Later</button>

                    ${user ? `
                        <button onclick="window.location.href='pages/dashboard.html#pricing'" style="
                            padding: 14px 28px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            border-radius: 10px;
                            font-weight: 600;
                            font-size: 1rem;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">Upgrade Now</button>
                    ` : `
                        <button onclick="window.location.href='pages/signup.html?feature=${featureName}'" style="
                            padding: 14px 28px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            border-radius: 10px;
                            font-weight: 600;
                            font-size: 1rem;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">Sign Up Free</button>
                    `}
                </div>

                <p style="
                    margin-top: 24px;
                    font-size: 0.875rem;
                    color: #94a3b8;
                ">
                    Starting at <strong style="color: #6366f1;">$19.99/month</strong> • Cancel anytime
                </p>
            </div>

            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .feature-gate-modal button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
            </style>
        `;

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);

        // Track event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'feature_gate_shown', {
                feature: featureName
            });
        }
    }

    // Get list of premium features for display
    _getPremiumFeatures() {
        return [
            'Remote control from any device',
            'Real-time sync across all screens',
            'Unlimited auction items',
            'Custom colors & branding',
            'Remove watermark',
            'Silent bidding mode',
            'Public mobile bidding',
            'Priority support'
        ];
    }

    // Check access and show prompt if needed
    async requireFeature(featureName, onGranted = null) {
        const hasAccess = await this.hasAccess(featureName);

        if (hasAccess) {
            if (onGranted) onGranted();
            return true;
        } else {
            await this.showUpgradePrompt(featureName);
            return false;
        }
    }

    // Show feature limit reached
    showLimitReached(limitType, currentCount, maxCount) {
        const modal = document.createElement('div');
        modal.className = 'feature-gate-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 48px;
                max-width: 480px;
                width: 100%;
                text-align: center;
            ">
                <div style="font-size: 4rem; margin-bottom: 16px;">⚠️</div>
                <h2 style="font-size: 1.75rem; margin-bottom: 12px; color: #1e293b;">
                    Limit Reached
                </h2>
                <p style="color: #64748b; line-height: 1.6; margin-bottom: 32px; font-size: 1.125rem;">
                    You've reached the limit of <strong>${maxCount} ${limitType}</strong> on the free plan.
                    Upgrade to Pro for unlimited ${limitType}!
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="this.closest('.feature-gate-modal').remove()" style="
                        padding: 14px 28px;
                        background: #f1f5f9;
                        color: #1e293b;
                        border: none;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                    ">Close</button>
                    <button onclick="window.location.href='#pricing'; this.closest('.feature-gate-modal').remove();" style="
                        padding: 14px 28px;
                        background: #6366f1;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                    ">View Pricing</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);
    }
}

// Create singleton instance
const featureGate = new FeatureGate();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FeatureGate, featureGate };
}
