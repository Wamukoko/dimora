-- ==============================================
-- PROJECT DIMORA: RLS REGRESSION SUITE
-- ==============================================
-- Each scenario below is an independent, self-asserting transaction.
-- The runner (scripts/run-rls-tests.mjs) splits this file on the
-- `---- SCENARIO:` banner, executes each chunk against Supabase-local
-- Postgres, and reports pass/fail. Chunks roll back, so fixtures never
-- persist. A chunk PASSES when it completes without a raised exception
-- that does not start with 'ASSERT_FAIL:'.

-- Fixed test identities (never created in a real environment).
--   H1  = hunter user
--   H2  = second hunter (for cross-user checks)
--   A   = listing agent
--   B   = another agent (isolation target)
--   ADM = admin (elevated only via fixtures, never via a client PATCH)
--   P1  = A's raw listing (unpublished guard fixtures for the first block)
--   P2  = B's published listing
--   K1  = A's property_verifications evidence row
--   BK1 = H1's confirmed booking on P2

-- ---- SCENARIO: 01 - signup metadata never elevates role -----------------
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated',
        'rls01@dimora.test', '$2a$10$0000000000000000000', '{"role":"admin"}'::jsonb);
DO $$
DECLARE
  actual public.user_role;
BEGIN
  SELECT role INTO actual FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000101';
  IF actual IS DISTINCT FROM 'hunter' THEN
    RAISE EXCEPTION 'ASSERT_FAIL: signup with admin metadata became role=% instead of hunter', actual;
  END IF;
END $$;
ROLLBACK;

-- ---- SCENARIO: 02 - client cannot elevate their own role ----------------
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated',
        'rls02@dimora.test', '$2a$10$0000000000000000000');
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = '00000000-0000-0000-0000-000000000201';
    RAISE EXCEPTION 'ASSERT_FAIL: role self-elevation was permitted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Role changes are not permitted%' THEN
        NULL;
      ELSIF SQLERRM LIKE 'ASSERT_FAIL:%' THEN
        RAISE;
      ELSE
        RAISE EXCEPTION 'ASSERT_FAIL: expected role-guard error, got %', SQLERRM;
      END IF;
  END;
END $$;
ROLLBACK;

-- ---- SCENARIO: 03 - anonymous users cannot log listing events -----------
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated',
        'rls03a@dimora.test', '$2a$10$0000000000000000000');
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated',
        'rls03b@dimora.test', '$2a$10$0000000000000000000');
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000301';
INSERT INTO public.properties (id, agent_id, title, price, type, county, sub_county, neighborhood, is_published)
VALUES ('30000000-0000-0000-0000-0000000000p1', '00000000-0000-0000-0000-000000000301',
        'RLS03 property', 10000, 'apartment', 'Nairobi', 'Westlands', 'Kilimani', true);
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.listing_events (property_id, event_type)
    VALUES ('30000000-0000-0000-0000-0000000000p1', 'view_open');
    RAISE EXCEPTION 'ASSERT_FAIL: anonymous listing_events insert was permitted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'ASSERT_FAIL:%' THEN
        RAISE;
      ELSIF SQLERRM LIKE '%violates row-level security%' OR SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%is not permitted%' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'ASSERT_FAIL: unexpected blocking error: %', SQLERRM;
      END IF;
  END;
END $$;
ROLLBACK;

-- ---- SCENARIO: 04 - anonymous users cannot submit neighborhood signals --
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000401', 'authenticated', 'authenticated',
        'rls04@dimora.test', '$2a$10$0000000000000000000');
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000401';
INSERT INTO public.properties (id, agent_id, title, price, type, county, sub_county, neighborhood, is_published)
VALUES ('40000000-0000-0000-0000-0000000000p1', '00000000-0000-0000-0000-000000000401',
        'RLS04 property', 10000, 'apartment', 'Nairobi', 'Westlands', 'Lavington', true);
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.neighborhood_signals (county, sub_county, neighborhood, signal_type, rating, comment)
    VALUES ('Nairobi', 'Westlands', 'Lavington', 'safety', 4, 'quiet');
    RAISE EXCEPTION 'ASSERT_FAIL: anonymous neighborhood signal was permitted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'ASSERT_FAIL:%' THEN
        RAISE;
      ELSIF SQLERRM LIKE '%violates row-level security%' OR SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%is not permitted%' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'ASSERT_FAIL: unexpected blocking error: %', SQLERRM;
      END IF;
  END;
END $$;
ROLLBACK;

-- ---- SCENARIO: 05 - agents cannot see or touch each other's drafts ------
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000511', 'authenticated', 'authenticated',
        'rls05a@dimora.test', '$2a$10$0000000000000000000');
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000521', 'authenticated', 'authenticated',
        'rls05b@dimora.test', '$2a$10$0000000000000000000');
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000511';
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000521';
INSERT INTO public.properties (id, agent_id, title, price, type, county, sub_county, neighborhood, is_published)
VALUES ('50000000-0000-0000-0000-0000000000p1', '00000000-0000-0000-0000-000000000511',
        'Agent A draft', 10000, 'apartment', 'Nairobi', 'Westlands', 'Kilimani', false);
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000521","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  visible_count INT;
BEGIN
  SELECT COUNT(*) INTO visible_count
  FROM public.properties
  WHERE id = '50000000-0000-0000-0000-0000000000p1';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'ASSERT_FAIL: agent B could read agent A draft';
  END IF;

  UPDATE public.properties SET title = 'Agent B tampered'
  WHERE id = '50000000-0000-0000-0000-0000000000p1';
  SELECT COUNT(*) INTO visible_count
  FROM public.properties
  WHERE id = '50000000-0000-0000-0000-0000000000p1' AND title = 'Agent B tampered';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'ASSERT_FAIL: agent B mutated agent A draft';
  END IF;
END $$;
ROLLBACK;

-- ---- SCENARIO: 06 - verification evidence is private until approved ----
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated',
        'rls06a@dimora.test', '$2a$10$0000000000000000000');
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000602', 'authenticated', 'authenticated',
        'rls06h@dimora.test', '$2a$10$0000000000000000000');
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000601';
INSERT INTO public.properties (id, agent_id, title, price, type, county, sub_county, neighborhood, is_published)
VALUES ('60000000-0000-0000-0000-0000000000p1', '00000000-0000-0000-0000-000000000601',
        'RLS06 property', 10000, 'apartment', 'Nairobi', 'Westlands', 'Kilimani', true);
INSERT INTO public.property_verifications (id, property_id, kind, evidence_url, evidence_hash, notes)
VALUES ('60000000-0000-0000-0000-0000000000k1', '60000000-0000-0000-0000-0000000000p1',
        'title_deed', 'https://cdn.example.test/deed.pdf', 'sha256:deadbeef', 'sealed copy');

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  visible_count INT;
BEGIN
  SELECT COUNT(*) INTO visible_count
  FROM public.property_verifications
  WHERE id = '60000000-0000-0000-0000-0000000000k1';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'ASSERT_FAIL: hunter read raw verification evidence';
  END IF;

  SELECT COUNT(*) INTO visible_count
  FROM public.public_property_verifications
  WHERE property_id = '60000000-0000-0000-0000-0000000000p1';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'ASSERT_FAIL: unapproved evidence leaked via public view';
  END IF;
END $$;
ROLLBACK;

-- ---- SCENARIO: 07 - booking must match the property's real agent --------
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000711', 'authenticated', 'authenticated',
        'rls07a@dimora.test', '$2a$10$0000000000000000000');
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000712', 'authenticated', 'authenticated',
        'rls07b@dimora.test', '$2a$10$0000000000000000000');
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000713', 'authenticated', 'authenticated',
        'rls07h@dimora.test', '$2a$10$0000000000000000000');
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000711';
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000712';
INSERT INTO public.properties (id, agent_id, title, price, type, county, sub_county, neighborhood, is_published)
VALUES ('70000000-0000-0000-0000-0000000000p1', '00000000-0000-0000-0000-000000000711',
        'RLS07 property', 10000, 'apartment', 'Nairobi', 'Westlands', 'Kilimani', true);

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000713","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.bookings (property_id, hunter_id, agent_id, scheduled_at)
    VALUES ('70000000-0000-0000-0000-0000000000p1',
            '00000000-0000-0000-0000-000000000713',
            '00000000-0000-0000-0000-000000000712',
            now() + interval '1 day');
    RAISE EXCEPTION 'ASSERT_FAIL: booking with mismatched agent was accepted';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'ASSERT_FAIL:%' THEN
        RAISE;
      ELSIF SQLERRM LIKE '%violates row-level security%' OR SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%is not permitted%' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'ASSERT_FAIL: unexpected blocking error: %', SQLERRM;
      END IF;
  END;
END $$;
ROLLBACK;

-- ---- SCENARIO: 08 - reviews only for completed bookings you made --------
BEGIN;
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000801', 'authenticated', 'authenticated',
        'rls08a@dimora.test', '$2a$10$0000000000000000000');
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000802', 'authenticated', 'authenticated',
        'rls08h1@dimora.test', '$2a$10$0000000000000000000');
INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES ('00000000-0000-0000-0000-000000000803', 'authenticated', 'authenticated',
        'rls08h2@dimora.test', '$2a$10$0000000000000000000');
UPDATE public.profiles SET role = 'agent' WHERE id = '00000000-0000-0000-0000-000000000801';
INSERT INTO public.properties (id, agent_id, title, price, type, county, sub_county, neighborhood, is_published)
VALUES ('80000000-0000-0000-0000-0000000000p1', '00000000-0000-0000-0000-000000000801',
        'RLS08 property', 10000, 'apartment', 'Nairobi', 'Westlands', 'Kilimani', true);
INSERT INTO public.properties (id, agent_id, title, price, type, county, sub_county, neighborhood, is_published)
VALUES ('80000000-0000-0000-0000-0000000000p2', '00000000-0000-0000-0000-000000000801',
        'RLS08 property two', 9500, 'bedsitter', 'Nairobi', 'Eastlands', 'Umoja', true);
INSERT INTO public.bookings (id, property_id, hunter_id, agent_id, scheduled_at, status)
VALUES ('80000000-0000-0000-0000-0000000000b1', '80000000-0000-0000-0000-0000000000p1',
        '00000000-0000-0000-0000-000000000802',
        '00000000-0000-0000-0000-000000000801', now(), 'completed');
INSERT INTO public.bookings (id, property_id, hunter_id, agent_id, scheduled_at, status)
VALUES ('80000000-0000-0000-0000-0000000000b2', '80000000-0000-0000-0000-0000000000p2',
        '00000000-0000-0000-0000-000000000802',
        '00000000-0000-0000-0000-000000000801', now(), 'pending');

SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000803","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.reviews (booking_id, property_id, hunter_id, rating, comment)
    VALUES ('80000000-0000-0000-0000-0000000000b1',
            '80000000-0000-0000-0000-0000000000p1',
            '00000000-0000-0000-0000-000000000803', 5, 'not mine to rate');
    RAISE EXCEPTION 'ASSERT_FAIL: stranger reviewed another hunter completed booking';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'ASSERT_FAIL:%' THEN
        RAISE;
      ELSIF SQLERRM LIKE '%violates row-level security%' OR SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%is not permitted%' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'ASSERT_FAIL: unexpected blocking error: %', SQLERRM;
      END IF;
  END;
END $$;

-- Own completed booking IS reviewable.
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}';
DO $$
DECLARE
  review_count INT;
BEGIN
  INSERT INTO public.reviews (booking_id, property_id, hunter_id, rating, comment)
  VALUES ('80000000-0000-0000-0000-0000000000b1',
          '80000000-0000-0000-0000-0000000000p1',
          '00000000-0000-0000-0000-000000000802', 5, 'viewing was smooth');
  SELECT COUNT(*) INTO review_count FROM public.reviews
  WHERE booking_id = '80000000-0000-0000-0000-0000000000b1';
  IF review_count <> 1 THEN
    RAISE EXCEPTION 'ASSERT_FAIL: own completed booking review was not recorded';
  END IF;
END $$;

-- Pending booking still not reviewable, even by its own hunter.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.reviews (booking_id, property_id, hunter_id, rating, comment)
    VALUES ('80000000-0000-0000-0000-0000000000b2',
            '80000000-0000-0000-0000-0000000000p2',
            '00000000-0000-0000-0000-000000000802', 4, 'jumped the gun');
    RAISE EXCEPTION 'ASSERT_FAIL: review allowed for pending booking';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'ASSERT_FAIL:%' THEN
        RAISE;
      ELSIF SQLERRM LIKE '%violates row-level security%' OR SQLERRM LIKE '%permission denied%' OR SQLERRM LIKE '%is not permitted%' THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'ASSERT_FAIL: unexpected blocking error: %', SQLERRM;
      END IF;
  END;
END $$;
ROLLBACK;