-- 004_bidding_sessions.sql
-- Persistent auction state for public bidding — works without the display being open
-- Run after 003_public_bidding.sql

-- ============================================================================
-- BIDDING_SESSIONS TABLE
-- Stores auction items in Supabase so the bid page can load them on any device
-- without needing the display screen to be open.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bidding_sessions (
    display_id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL DEFAULT '',
    event_subtitle TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bidding_sessions_active ON public.bidding_sessions(is_active);

ALTER TABLE public.bidding_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read (bid page needs this without auth)
CREATE POLICY "Anyone can read bidding sessions"
    ON public.bidding_sessions FOR SELECT
    USING (true);

-- Only authenticated users (organizers) can create/update/delete sessions
CREATE POLICY "Authenticated users can manage bidding sessions"
    ON public.bidding_sessions FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Enable Realtime so bid pages see live updates when bids are placed
ALTER PUBLICATION supabase_realtime ADD TABLE public.bidding_sessions;

GRANT SELECT ON public.bidding_sessions TO anon;
GRANT ALL ON public.bidding_sessions TO authenticated;

-- ============================================================================
-- PLACE_PUBLIC_BID FUNCTION
-- Validates bid amount, records the bid, and updates the session's items JSONB
-- atomically. Runs as SECURITY DEFINER so anon callers can update the session.
-- ============================================================================

CREATE OR REPLACE FUNCTION place_public_bid(
    p_display_id  TEXT,
    p_item_id     TEXT,
    p_item_name   TEXT,
    p_bidder_id   UUID,
    p_bidder_name TEXT,
    p_amount      NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_bid NUMERIC := 0;
    v_item_found  BOOLEAN := false;
    v_bid_id      BIGINT;
BEGIN
    -- Validate session exists
    IF NOT EXISTS (SELECT 1 FROM public.bidding_sessions WHERE display_id = p_display_id AND is_active = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction session not found or not active');
    END IF;

    -- Find item and its current bid
    SELECT
        (item->>'currentBid')::NUMERIC,
        true
    INTO v_current_bid, v_item_found
    FROM public.bidding_sessions,
         jsonb_array_elements(items) AS item
    WHERE display_id = p_display_id
      AND item->>'id' = p_item_id
    LIMIT 1;

    IF NOT v_item_found THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item not found in this auction');
    END IF;

    -- Bid must be higher than current bid
    IF p_amount <= COALESCE(v_current_bid, 0) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Bid must be higher than the current bid of $%s', COALESCE(v_current_bid, 0)::TEXT)
        );
    END IF;

    -- Record the bid
    INSERT INTO public.public_bids (display_id, item_id, item_name, bidder_id, bidder_name, amount)
    VALUES (p_display_id, p_item_id, p_item_name, p_bidder_id, p_bidder_name, p_amount)
    RETURNING id INTO v_bid_id;

    -- Update this item's currentBid in the session JSONB
    UPDATE public.bidding_sessions
    SET
        items = (
            SELECT jsonb_agg(
                CASE
                    WHEN item->>'id' = p_item_id
                    THEN jsonb_set(item, '{currentBid}', to_jsonb(p_amount))
                    ELSE item
                END
                ORDER BY (item->>'currentBid')::NUMERIC DESC
            )
            FROM jsonb_array_elements(items) AS item
        ),
        updated_at = NOW()
    WHERE display_id = p_display_id;

    RETURN jsonb_build_object('success', true, 'bid_id', v_bid_id, 'new_bid', p_amount);
END;
$$;

-- Allow anyone to call this function (anon bidders)
GRANT EXECUTE ON FUNCTION place_public_bid(TEXT, TEXT, TEXT, UUID, TEXT, NUMERIC) TO anon, authenticated;

COMMENT ON TABLE public.bidding_sessions IS 'Live auction state for public bidding — readable without auth, updated via RPC';
COMMENT ON FUNCTION place_public_bid IS 'Validates and places a public bid, updating the session state atomically';
