-- Triggers and Functions for FreeAuctionSite Premium Features
-- Run this migration after 001_initial_schema.sql
-- Part of Phase 1 Premium Features Implementation

-- ============================================================================
-- AUTO-UPDATE CURRENT BID WHEN BID IS ACCEPTED
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_update_current_bid()
RETURNS TRIGGER AS $$
BEGIN
    -- If bid is accepted, update the auction item's current_bid
    IF NEW.status = 'accepted' AND (OLD IS NULL OR OLD.status != 'accepted') THEN
        UPDATE public.auction_items
        SET
            current_bid = NEW.amount,
            winner_bid_id = NEW.id,
            updated_at = NOW()
        WHERE id = NEW.item_id;

        -- Mark other bids for this item as 'outbid'
        UPDATE public.bids
        SET status = 'outbid'
        WHERE item_id = NEW.item_id
        AND id != NEW.id
        AND status IN ('pending', 'accepted');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_update_current_bid
    AFTER INSERT OR UPDATE ON public.bids
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_current_bid();

-- ============================================================================
-- VALIDATE BID AMOUNT
-- Ensure bid is greater than current bid
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_bid_amount()
RETURNS TRIGGER AS $$
DECLARE
    current_highest_bid NUMERIC(10, 2);
BEGIN
    -- Get current highest bid for the item
    SELECT current_bid INTO current_highest_bid
    FROM public.auction_items
    WHERE id = NEW.item_id;

    -- Check if new bid is higher than current bid
    IF NEW.amount <= current_highest_bid THEN
        RAISE EXCEPTION 'Bid amount must be greater than current bid of $%', current_highest_bid;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_bid_amount
    BEFORE INSERT ON public.bids
    FOR EACH ROW
    EXECUTE FUNCTION validate_bid_amount();

-- ============================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, subscription_tier, subscription_status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'free',
        'active'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if you have permission)
-- Note: This may require superuser access. If it fails, profiles will be created manually in the signup function
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_create_profile'
    ) THEN
        CREATE TRIGGER trigger_auto_create_profile
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION auto_create_profile();
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Insufficient privileges to create trigger on auth.users. Profiles will be created manually.';
END $$;

-- ============================================================================
-- CLEAN UP EXPIRED ACCESS TOKENS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.event_access_tokens
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a cron job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-tokens', '0 * * * *', 'SELECT cleanup_expired_tokens()');

-- ============================================================================
-- CHECK SUBSCRIPTION EXPIRATION
-- For Event plan (30 days), automatically expire after period
-- ============================================================================

CREATE OR REPLACE FUNCTION check_subscription_expiration()
RETURNS void AS $$
BEGIN
    UPDATE public.profiles
    SET
        subscription_status = 'expired',
        subscription_tier = 'free'
    WHERE subscription_tier = 'event'
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < NOW()
    AND subscription_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a cron job to check subscriptions daily
-- SELECT cron.schedule('check-subscription-expiration', '0 0 * * *', 'SELECT check_subscription_expiration()');

-- ============================================================================
-- GET EVENT STATISTICS
-- Helper function to get event statistics (for dashboard)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_event_statistics(event_uuid UUID)
RETURNS TABLE (
    total_items BIGINT,
    total_raised NUMERIC,
    highest_bid NUMERIC,
    total_bids BIGINT,
    unique_bidders BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT ai.id) AS total_items,
        COALESCE(SUM(ai.current_bid), 0) AS total_raised,
        COALESCE(MAX(ai.current_bid), 0) AS highest_bid,
        COUNT(b.id) AS total_bids,
        COUNT(DISTINCT b.bidder_email) AS unique_bidders
    FROM public.auction_items ai
    LEFT JOIN public.bids b ON b.item_id = ai.id
    WHERE ai.event_id = event_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GENERATE ACCESS TOKEN
-- Helper function to generate secure access tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_access_token(
    event_uuid UUID,
    token_role TEXT,
    valid_for_hours INTEGER DEFAULT 720
)
RETURNS TEXT AS $$
DECLARE
    new_token TEXT;
BEGIN
    -- Generate random token
    new_token := encode(gen_random_bytes(32), 'base64');

    -- Insert token
    INSERT INTO public.event_access_tokens (event_id, token, role, expires_at)
    VALUES (
        event_uuid,
        new_token,
        token_role,
        NOW() + (valid_for_hours || ' hours')::INTERVAL
    );

    RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFY ACCESS TOKEN
-- Check if token is valid and not expired
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_access_token(token_value TEXT)
RETURNS TABLE (
    event_id UUID,
    role TEXT,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        eat.event_id,
        eat.role,
        (eat.expires_at > NOW()) AS is_valid
    FROM public.event_access_tokens eat
    WHERE eat.token = token_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION auto_update_current_bid() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_bid_amount() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auto_create_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION check_subscription_expiration() TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_statistics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_access_token(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_access_token(TEXT) TO authenticated, anon;

-- Add comments
COMMENT ON FUNCTION auto_update_current_bid() IS 'Automatically updates current_bid when a bid is accepted';
COMMENT ON FUNCTION validate_bid_amount() IS 'Validates that new bids are higher than current bid';
COMMENT ON FUNCTION auto_create_profile() IS 'Automatically creates a profile when a user signs up';
COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Removes expired access tokens';
COMMENT ON FUNCTION check_subscription_expiration() IS 'Expires Event subscriptions after 30 days';
COMMENT ON FUNCTION get_event_statistics(UUID) IS 'Returns statistics for an event';
COMMENT ON FUNCTION generate_access_token(UUID, TEXT, INTEGER) IS 'Generates a secure access token';
COMMENT ON FUNCTION verify_access_token(TEXT) IS 'Verifies if an access token is valid';
