-- 003_public_bidding.sql
-- Public Bidding Feature: Bidder registration with access codes
-- Run this migration after 002_triggers.sql

-- ============================================================================
-- BIDDERS TABLE
-- Registered bidders with 6-character access codes per event
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bidders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_id TEXT NOT NULL,          -- event/display ID (matches localStorage ID)
    name TEXT NOT NULL,
    email TEXT,
    access_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(display_id, access_code)    -- codes must be unique per event
);

CREATE INDEX IF NOT EXISTS idx_bidders_display_id ON public.bidders(display_id);
CREATE INDEX IF NOT EXISTS idx_bidders_lookup ON public.bidders(display_id, access_code);

ALTER TABLE public.bidders ENABLE ROW LEVEL SECURITY;

-- Anyone can look up a bidder by code (needed for bid page validation — anon users)
CREATE POLICY "Anyone can read bidders for code validation"
    ON public.bidders
    FOR SELECT
    USING (true);

-- Authenticated users can register new bidders
CREATE POLICY "Authenticated users can insert bidders"
    ON public.bidders
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can remove bidders
CREATE POLICY "Authenticated users can delete bidders"
    ON public.bidders
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- PUBLIC_BIDS TABLE
-- Bids placed by registered bidders via their access codes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.public_bids (
    id BIGSERIAL PRIMARY KEY,
    display_id TEXT NOT NULL,          -- event/display ID
    item_id TEXT NOT NULL,             -- item ID (from localStorage item.id)
    item_name TEXT NOT NULL,           -- item name (denormalized for easy querying)
    bidder_id UUID REFERENCES public.bidders(id) ON DELETE SET NULL,
    bidder_name TEXT NOT NULL,         -- denormalized for easy display
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_bids_display_id ON public.public_bids(display_id);
CREATE INDEX IF NOT EXISTS idx_public_bids_item ON public.public_bids(display_id, item_id);
CREATE INDEX IF NOT EXISTS idx_public_bids_placed_at ON public.public_bids(placed_at DESC);

ALTER TABLE public.public_bids ENABLE ROW LEVEL SECURITY;

-- Anyone (anon bidders) can place a bid
CREATE POLICY "Anyone can place public bids"
    ON public.public_bids
    FOR INSERT
    WITH CHECK (true);

-- Authenticated users (organizers) can view all bids
CREATE POLICY "Authenticated users can view bids"
    ON public.public_bids
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.bidders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_bids;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.bidders TO anon;
GRANT SELECT, INSERT, DELETE ON public.bidders TO authenticated;

GRANT INSERT ON public.public_bids TO anon;
GRANT SELECT, INSERT ON public.public_bids TO authenticated;

GRANT USAGE ON SEQUENCE public.public_bids_id_seq TO anon, authenticated;

COMMENT ON TABLE public.bidders IS 'Registered bidders with 6-char access codes for public bidding';
COMMENT ON TABLE public.public_bids IS 'Bids placed by registered bidders via their access codes';
