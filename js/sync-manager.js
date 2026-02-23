// Sync Manager - Real-time WebSocket Sync for Premium Users
// Provides instant updates across all devices using Supabase Realtime
// Part of FreeAuctionSite Premium Features

class SyncManager {
    constructor(eventId) {
        this.eventId = eventId;
        this.channel = null;
        this.callbacks = [];
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // Subscribe to real-time updates
    subscribe(onUpdate) {
        if (!ENV_CONFIG.PREMIUM_FEATURES_ENABLED) {
            console.log('Premium features disabled - using localStorage polling');
            return;
        }

        const sb = SupabaseClient.get();
        if (!sb) {
            console.error('Supabase not initialized');
            return;
        }

        // Store callback
        this.callbacks.push(onUpdate);

        // Create channel for this event
        this.channel = sb.channel(`event:${this.eventId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'auction_items',
                filter: `event_id=eq.${this.eventId}`
            }, async (payload) => {
                console.log('Real-time update received:', payload);
                await this._handleUpdate(payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'events',
                filter: `id=eq.${this.eventId}`
            }, async (payload) => {
                console.log('Event update received:', payload);
                await this._handleUpdate(payload);
            })
            .subscribe((status) => {
                console.log('Subscription status:', status);
                this.isConnected = status === 'SUBSCRIBED';

                if (this.isConnected) {
                    this.reconnectAttempts = 0;
                    this._notifyConnectionStatus('connected');
                } else if (status === 'CLOSED') {
                    this._notifyConnectionStatus('disconnected');
                    this._attemptReconnect();
                }
            });

        console.log(`Subscribed to real-time updates for event ${this.eventId}`);
    }

    // Handle real-time update
    async _handleUpdate(payload) {
        try {
            // Fetch latest event data
            const sb = SupabaseClient.get();
            if (!sb) return;

            const { data: event, error } = await sb
                .from('events')
                .select(`
                    *,
                    auction_items (*)
                `)
                .eq('id', this.eventId)
                .single();

            if (error) throw error;

            // Transform to display format
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
                        isRevealed: item.is_revealed,
                        createdAt: item.created_at
                    }))
                    .sort((a, b) => b.currentBid - a.currentBid),
                updatedAt: event.updated_at
            };

            // Notify all callbacks
            this.callbacks.forEach(callback => {
                try {
                    callback(transformedData);
                } catch (error) {
                    console.error('Error in update callback:', error);
                }
            });
        } catch (error) {
            console.error('Error handling real-time update:', error);
        }
    }

    // Notify connection status change
    _notifyConnectionStatus(status) {
        window.dispatchEvent(new CustomEvent('syncStatusChange', {
            detail: { status, eventId: this.eventId }
        }));
    }

    // Attempt to reconnect
    _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this._notifyConnectionStatus('failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            if (this.channel) {
                this.channel.subscribe();
            }
        }, delay);
    }

    // Unsubscribe from updates
    unsubscribe() {
        if (this.channel) {
            const sb = SupabaseClient.get();
            if (sb) {
                sb.removeChannel(this.channel);
            }
            this.channel = null;
            this.isConnected = false;
            console.log(`Unsubscribed from event ${this.eventId}`);
        }
    }

    // Force refresh data
    async refresh() {
        try {
            const sb = SupabaseClient.get();
            if (!sb) throw new Error('Supabase not initialized');

            const { data: event, error } = await sb
                .from('events')
                .select(`
                    *,
                    auction_items (*)
                `)
                .eq('id', this.eventId)
                .single();

            if (error) throw error;

            // Transform and notify callbacks
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
                        isRevealed: item.is_revealed,
                        createdAt: item.created_at
                    }))
                    .sort((a, b) => b.currentBid - a.currentBid),
                updatedAt: event.updated_at
            };

            this.callbacks.forEach(callback => callback(transformedData));

            return transformedData;
        } catch (error) {
            console.error('Error refreshing data:', error);
            throw error;
        }
    }

    // Check connection status
    isConnectedToRealtime() {
        return this.isConnected;
    }

    // Get event ID
    getEventId() {
        return this.eventId;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncManager;
}
