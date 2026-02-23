// Branding Manager - Custom Colors and Logo for Premium Users
// Part of FreeAuctionSite Premium Features

class BrandingManager {
    constructor(eventData) {
        this.branding = eventData?.branding || this.getDefaults();
    }

    getDefaults() {
        return {
            primaryColor: '#6366f1',
            accentColor: '#10b981',
            backgroundColor: '#1e293b',
            secondaryBackgroundColor: '#334155',
            logoUrl: null
        };
    }

    apply() {
        // Apply CSS variables to customize the display
        const root = document.documentElement;

        root.style.setProperty('--primary', this.branding.primaryColor);
        root.style.setProperty('--accent', this.branding.accentColor);

        // Create gradient background if both colors are provided
        if (this.branding.backgroundColor && this.branding.secondaryBackgroundColor) {
            const gradient = `linear-gradient(135deg, ${this.branding.backgroundColor} 0%, ${this.branding.secondaryBackgroundColor} 100%)`;
            root.style.setProperty('--bg', gradient);
            document.body.style.background = gradient;
        } else if (this.branding.backgroundColor) {
            document.body.style.background = this.branding.backgroundColor;
        }

        // Apply logo if exists
        if (this.branding.logoUrl) {
            this.applyLogo(this.branding.logoUrl);
        }
    }

    applyLogo(logoUrl) {
        // Check if there's a logo container in the header
        const header = document.querySelector('.header');
        if (!header) return;

        // Create or update logo element
        let logoEl = document.querySelector('.event-logo');
        if (!logoEl) {
            logoEl = document.createElement('img');
            logoEl.className = 'event-logo';
            logoEl.style.cssText = 'max-height: 80px; max-width: 200px; margin-bottom: 16px; object-fit: contain;';
            header.insertBefore(logoEl, header.firstChild);
        }

        logoEl.src = logoUrl;
        logoEl.alt = 'Event Logo';
    }

    // Static method to get branding from event data
    static fromEventData(eventData) {
        return new BrandingManager(eventData);
    }

    // Update branding settings
    updateBranding(newBranding) {
        this.branding = { ...this.branding, ...newBranding };
        this.apply();
    }

    // Export branding as JSON for storage
    toJSON() {
        return this.branding;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrandingManager;
}
