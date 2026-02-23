// Storage Adapter - Hybrid localStorage/Supabase Storage
// Provides backward compatibility for free users while enabling cloud sync for premium users
// Part of FreeAuctionSite Premium Features

class StorageAdapter {
    constructor() {
        this.mode = 'localStorage'; // Default mode
        this.isInitialized = false;
        this.offlineQueue = [];
        this.isOnline = navigator.onLine;
        this._setupOfflineHandlers();
    }

    // Setup online/offline event handlers
    _setupOfflineHandlers() {
        window.addEventListener('online', () => {
            console.log('Connection restored - syncing offline queue');
            this.isOnline = true;
            this._showConnectionStatus('online');
            this._syncOfflineQueue();
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost - entering offline mode');
            this.isOnline = false;
            this._showConnectionStatus('offline');
        });
    }

    // Show connection status notification
    _showConnectionStatus(status) {
        // Remove existing notification
        const existing = document.getElementById('offlineNotification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.id = 'offlineNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${status === 'online' ? '#10b981' : '#f59e0b'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideDown 0.3s ease-out;
        `;

        notification.textContent = status === 'online'
            ? '✓ Back online - Changes synced'
            : '⚠️ Offline - Changes will sync when reconnected';

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { transform: translate(-50%, -100%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Auto-hide after 3 seconds for online, keep for offline
        if (status === 'online') {
            setTimeout(() => {
                notification.style.animation = 'slideDown 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    // Sync offline queue
    async _syncOfflineQueue() {
        if (this.offlineQueue.length === 0) return;

        console.log(`Syncing ${this.offlineQueue.length} offline changes...`);

        const queue = [...this.offlineQueue];
        this.offlineQueue = [];

        for (const change of queue) {
            try {
                if (change.action === 'save') {
                    await this._saveToSupabase(change.displayId, change.data);
                } else if (change.action === 'delete') {
                    await this._deleteFromSupabase(change.displayId);
                }
            } catch (error) {
                console.error('Error syncing offline change:', error);
                // Re-add to queue if sync fails
                this.offlineQueue.push(change);
            }
        }

        if (this.offlineQueue.length === 0) {
            console.log('All offline changes synced successfully');
        } else {
            console.log(`${this.offlineQueue.length} changes failed to sync - will retry`);
        }
    }

    // Initialize the adapter and determine storage mode
    async initialize() {
        if (this.isInitialized) {
            return this.mode;
        }

        try {
            // Check if premium features are enabled and user is premium
            if (ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
                const isPremium = await SupabaseClient.isPremium();
                this.mode = isPremium ? 'supabase' : 'localStorage';
            } else {
                this.mode = 'localStorage';
            }

            this.isInitialized = true;
            console.log(`Storage adapter initialized in ${this.mode} mode`);
            return this.mode;
        } catch (error) {
            console.error('Error initializing storage adapter:', error);
            this.mode = 'localStorage';
            this.isInitialized = true;
            return this.mode;
        }
    }

    // Save event data
    async saveEvent(displayId, data) {
        await this.initialize();

        if (this.mode === 'localStorage') {
            return this._saveToLocalStorage(displayId, data);
        } else {
            return this._saveToSupabase(displayId, data);
        }
    }

    // Load event data
    async loadEvent(displayId) {
        await this.initialize();

        if (this.mode === 'localStorage') {
            return this._loadFromLocalStorage(displayId);
        } else {
            return this._loadFromSupabase(displayId);
        }
    }

    // Delete event data
    async deleteEvent(displayId) {
        await this.initialize();

        if (this.mode === 'localStorage') {
            return this._deleteFromLocalStorage(displayId);
        } else {
            return this._deleteFromSupabase(displayId);
        }
    }

    // localStorage implementation
    _saveToLocalStorage(displayId, data) {
        try {
            localStorage.setItem(`bidscreen_display_${displayId}`, JSON.stringify(data));
            return { success: true, mode: 'localStorage' };
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            throw error;
        }
    }

    _loadFromLocalStorage(displayId) {
        try {
            const data = localStorage.getItem(`bidscreen_display_${displayId}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }

    _deleteFromLocalStorage(displayId) {
        try {
            localStorage.removeItem(`bidscreen_display_${displayId}`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting from localStorage:', error);
            throw error;
        }
    }

    // Supabase implementation
    async _saveToSupabase(displayId, data) {
        // If offline, queue the change
        if (!this.isOnline) {
            console.log('Offline - queuing save for later');
            this.offlineQueue.push({
                action: 'save',
                displayId,
                data,
                timestamp: new Date().toISOString()
            });
            // Still save to localStorage as backup
            this._saveToLocalStorage(displayId, data);
            return { success: true, mode: 'offline-queued' };
        }

        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const user = await SupabaseClient.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Upsert event
            const eventData = {
                id: displayId,
                owner_id: user.id,
                name: data.event?.name || 'Auction',
                subtitle: data.event?.subtitle || null,
                status: 'active',
                custom_colors: data.event?.branding || null,
                logo_url: data.event?.branding?.logoUrl || null,
                hide_watermark: data.event?.hideWatermark || false,
                allow_public_bidding: data.event?.allowPublicBidding || false,
                silent_mode: data.event?.silentMode || false,
                updated_at: new Date().toISOString()
            };

            const { error: eventError } = await sb
                .from('events')
                .upsert(eventData);

            if (eventError) throw eventError;

            // Upsert auction items
            if (data.items && data.items.length > 0) {
                const itemsData = data.items.map(item => ({
                    id: item.id,
                    event_id: displayId,
                    name: item.name,
                    description: item.description || null,
                    starting_bid: item.startingBid || 0,
                    current_bid: item.currentBid || 0,
                    is_hidden: item.isHidden || false,
                    created_at: item.createdAt || new Date().toISOString()
                }));

                const { error: itemsError } = await sb
                    .from('auction_items')
                    .upsert(itemsData);

                if (itemsError) throw itemsError;
            }

            // Also save to localStorage as backup
            this._saveToLocalStorage(displayId, data);

            return { success: true, mode: 'supabase' };
        } catch (error) {
            console.error('Error saving to Supabase:', error);
            // Fallback to localStorage
            console.log('Falling back to localStorage');
            return this._saveToLocalStorage(displayId, data);
        }
    }

    async _loadFromSupabase(displayId) {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            // Load event with items
            const { data: event, error: eventError } = await sb
                .from('events')
                .select(`
                    *,
                    auction_items (*)
                `)
                .eq('id', displayId)
                .single();

            if (eventError) throw eventError;
            if (!event) return null;

            // Transform to localStorage format for compatibility
            const transformedData = {
                event: {
                    name: event.name,
                    subtitle: event.subtitle,
                    hideWatermark: event.hide_watermark,
                    allowPublicBidding: event.allow_public_bidding,
                    silentMode: event.silent_mode,
                    branding: event.custom_colors
                },
                items: (event.auction_items || [])
                    .map(item => ({
                        id: item.id,
                        name: item.name,
                        description: item.description,
                        startingBid: item.starting_bid,
                        currentBid: item.current_bid,
                        isHidden: item.is_hidden,
                        createdAt: item.created_at
                    }))
                    .sort((a, b) => b.currentBid - a.currentBid),
                updatedAt: event.updated_at
            };

            // Also save to localStorage for offline access
            this._saveToLocalStorage(displayId, transformedData);

            return transformedData;
        } catch (error) {
            console.error('Error loading from Supabase:', error);
            // Fallback to localStorage
            console.log('Falling back to localStorage');
            return this._loadFromLocalStorage(displayId);
        }
    }

    async _deleteFromSupabase(displayId) {
        // If offline, queue the change
        if (!this.isOnline) {
            console.log('Offline - queuing delete for later');
            this.offlineQueue.push({
                action: 'delete',
                displayId,
                timestamp: new Date().toISOString()
            });
            // Still delete from localStorage
            this._deleteFromLocalStorage(displayId);
            return { success: true, mode: 'offline-queued' };
        }

        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            // Delete items first (foreign key constraint)
            const { error: itemsError } = await sb
                .from('auction_items')
                .delete()
                .eq('event_id', displayId);

            if (itemsError) throw itemsError;

            // Delete event
            const { error: eventError } = await sb
                .from('events')
                .delete()
                .eq('id', displayId);

            if (eventError) throw eventError;

            // Also delete from localStorage
            this._deleteFromLocalStorage(displayId);

            return { success: true };
        } catch (error) {
            console.error('Error deleting from Supabase:', error);
            throw error;
        }
    }

    // Get all events for current user
    async getAllEvents() {
        await this.initialize();

        if (this.mode === 'localStorage') {
            return this._getAllFromLocalStorage();
        } else {
            return this._getAllFromSupabase();
        }
    }

    _getAllFromLocalStorage() {
        const events = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('bidscreen_display_')) {
                const displayId = key.replace('bidscreen_display_', '');
                const data = this._loadFromLocalStorage(displayId);
                if (data) {
                    events.push({
                        id: displayId,
                        ...data
                    });
                }
            }
        }
        return events;
    }

    async _getAllFromSupabase() {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const user = await SupabaseClient.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { data: events, error } = await sb
                .from('events')
                .select('id, name, subtitle, status, updated_at')
                .eq('owner_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            return events || [];
        } catch (error) {
            console.error('Error loading events from Supabase:', error);
            return this._getAllFromLocalStorage();
        }
    }

    // Get current storage mode
    getMode() {
        return this.mode;
    }

    // Force a specific mode (for testing)
    setMode(mode) {
        if (['localStorage', 'supabase'].includes(mode)) {
            this.mode = mode;
            console.log(`Storage mode set to ${mode}`);
        }
    }

    // Get offline queue status
    getOfflineQueueStatus() {
        return {
            isOnline: this.isOnline,
            queueLength: this.offlineQueue.length,
            queue: this.offlineQueue
        };
    }

    // Manually trigger sync (for debugging)
    async forceSyncOfflineQueue() {
        if (!this.isOnline) {
            console.warn('Cannot sync - still offline');
            return;
        }
        await this._syncOfflineQueue();
    }

    // Clear offline queue (for cleanup)
    clearOfflineQueue() {
        this.offlineQueue = [];
        console.log('Offline queue cleared');
    }
}

// Create singleton instance
const storage = new StorageAdapter();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageAdapter, storage };
}
