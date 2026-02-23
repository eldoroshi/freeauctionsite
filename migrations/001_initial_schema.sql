-- Initial Schema for FreeAuctionSite Premium Features
-- Run this migration in your Supabase SQL editor
-- Part of Phase 1 Premium Features Implementation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Extends auth.users with subscription and user metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'event')),
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'expired', 'past_due')),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    subscription_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on subscription_tier for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Users can insert their own profile (for signup)
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- EVENTS TABLE
-- Stores auction events created by users
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subtitle TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    custom_colors JSONB,
    logo_url TEXT,
    hide_watermark BOOLEAN NOT NULL DEFAULT false,
    allow_public_bidding BOOLEAN NOT NULL DEFAULT false,
    silent_mode BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_owner_id ON public.events(owner_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_updated_at ON public.events(updated_at DESC);

-- RLS Policies for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Owners can view their own events
CREATE POLICY "Owners can view own events"
    ON public.events
    FOR SELECT
    USING (auth.uid() = owner_id);

-- Public can view active events with public bidding enabled
CREATE POLICY "Public can view public bidding events"
    ON public.events
    FOR SELECT
    USING (status = 'active' AND allow_public_bidding = true);

-- Owners can insert events
CREATE POLICY "Owners can create events"
    ON public.events
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Owners can update their own events
CREATE POLICY "Owners can update own events"
    ON public.events
    FOR UPDATE
    USING (auth.uid() = owner_id);

-- Owners can delete their own events
CREATE POLICY "Owners can delete own events"
    ON public.events
    FOR DELETE
    USING (auth.uid() = owner_id);

-- ============================================================================
-- AUCTION_ITEMS TABLE
-- Stores items within each auction event
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_items (
    id BIGINT PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    starting_bid NUMERIC(10, 2) NOT NULL DEFAULT 0,
    current_bid NUMERIC(10, 2) NOT NULL DEFAULT 0,
    winner_bid_id BIGINT,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    is_revealed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_auction_items_event_id ON public.auction_items(event_id);
CREATE INDEX IF NOT EXISTS idx_auction_items_current_bid ON public.auction_items(current_bid DESC);

-- RLS Policies for auction_items
ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;

-- Owners can view items in their events
CREATE POLICY "Owners can view items in own events"
    ON public.auction_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = auction_items.event_id
            AND events.owner_id = auth.uid()
        )
    );

-- Public can view items in public events
CREATE POLICY "Public can view items in public events"
    ON public.auction_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = auction_items.event_id
            AND events.status = 'active'
            AND events.allow_public_bidding = true
        )
    );

-- Owners can insert items in their events
CREATE POLICY "Owners can create items in own events"
    ON public.auction_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = auction_items.event_id
            AND events.owner_id = auth.uid()
        )
    );

-- Owners can update items in their events
CREATE POLICY "Owners can update items in own events"
    ON public.auction_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = auction_items.event_id
            AND events.owner_id = auth.uid()
        )
    );

-- Owners can delete items in their events
CREATE POLICY "Owners can delete items in own events"
    ON public.auction_items
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = auction_items.event_id
            AND events.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- BIDS TABLE
-- Stores bids placed by public bidders (for public bidding feature)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bids (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES public.auction_items(id) ON DELETE CASCADE,
    bidder_name TEXT NOT NULL,
    bidder_email TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'outbid', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bids_item_id ON public.bids(item_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON public.bids(status);
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON public.bids(created_at DESC);

-- Check constraint: bid must be greater than current bid
ALTER TABLE public.bids
ADD CONSTRAINT bids_amount_check
CHECK (amount > 0);

-- RLS Policies for bids
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Anyone can insert bids for public events
CREATE POLICY "Anyone can place bids in public events"
    ON public.bids
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.auction_items
            JOIN public.events ON events.id = auction_items.event_id
            WHERE auction_items.id = bids.item_id
            AND events.status = 'active'
            AND events.allow_public_bidding = true
        )
    );

-- Event owners can view all bids for their items
CREATE POLICY "Owners can view bids in own events"
    ON public.bids
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.auction_items
            JOIN public.events ON events.id = auction_items.event_id
            WHERE auction_items.id = bids.item_id
            AND events.owner_id = auth.uid()
        )
    );

-- Event owners can update bid status
CREATE POLICY "Owners can update bid status in own events"
    ON public.bids
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.auction_items
            JOIN public.events ON events.id = auction_items.event_id
            WHERE auction_items.id = bids.item_id
            AND events.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- EVENT_ACCESS_TOKENS TABLE
-- Stores magic links and access tokens for displays, controls, and bidders
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('display', 'control', 'bidder')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_event_access_tokens_event_id ON public.event_access_tokens(event_id);
CREATE INDEX IF NOT EXISTS idx_event_access_tokens_token ON public.event_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_event_access_tokens_expires_at ON public.event_access_tokens(expires_at);

-- RLS Policies
ALTER TABLE public.event_access_tokens ENABLE ROW LEVEL SECURITY;

-- Owners can manage tokens for their events
CREATE POLICY "Owners can manage tokens for own events"
    ON public.event_access_tokens
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = event_access_tokens.event_id
            AND events.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_items_updated_at
    BEFORE UPDATE ON public.auction_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Enable Realtime for auction_items and events
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;

COMMENT ON TABLE public.profiles IS 'User profiles with subscription information';
COMMENT ON TABLE public.events IS 'Auction events created by users';
COMMENT ON TABLE public.auction_items IS 'Items within auction events';
COMMENT ON TABLE public.bids IS 'Bids placed by public bidders';
COMMENT ON TABLE public.event_access_tokens IS 'Access tokens for displays, controls, and bidders';
