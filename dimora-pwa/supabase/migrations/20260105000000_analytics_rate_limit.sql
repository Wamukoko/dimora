-- Dimora: listing-events rate limiting (P5 exit — "analytics events require auth + rate limits hold").

-- Every event must be attributable to the authenticated actor who raised it.
ALTER TABLE public.listing_events
    ADD COLUMN actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid();

CREATE INDEX idx_listing_events_actor ON public.listing_events(actor_id, created_at);

CREATE OR REPLACE FUNCTION public.listing_events_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_recent INT;
BEGIN
    SELECT count(*) INTO v_recent
    FROM public.listing_events
    WHERE actor_id IS NOT DISTINCT FROM NEW.actor_id
      AND created_at > timezone('utc'::text, now()) - interval '60 seconds';

    IF v_recent >= 60 THEN
        RAISE EXCEPTION 'analytics rate limit exceeded (% events in the last 60 seconds)', v_recent
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_listing_events_rate_limit
BEFORE INSERT ON public.listing_events
FOR EACH ROW EXECUTE FUNCTION public.listing_events_rate_limit();

-- Tighten the insert gate: only anonymous-free rows where the actor is the caller.
-- The DEFAULT auth.uid() makes intent explicit and keeps the client payload honest.
DROP POLICY "Authenticated users can log a listing event" ON public.listing_events;
CREATE POLICY "Users log their own listing events"
    ON public.listing_events FOR INSERT
    WITH CHECK (auth.uid() = actor_id);