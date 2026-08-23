-- Dimora: 72h auto-refund of stale viewing deposits (spec §6.5).
-- Deposits still 'held' more than 72h after the scheduled viewing, with no hunter
-- confirmation, are refunded on the ledger. Actual money movement is gated behind
-- ADR-005 (payout mechanism) and handled by ops settlement.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'dimora-auto-refund-stale-deposits',
  '0 * * * *',
  $$
  UPDATE public.payments p
  SET escrow_status = 'refunded_to_hunter'
  FROM public.bookings b
  WHERE b.id = p.booking_id
    AND p.purpose = 'viewing_deposit'
    AND p.escrow_status = 'held'
    AND b.hunter_confirmed_viewing = false
    AND b.scheduled_at < timezone('utc'::text, now()) - interval '72 hours'
  $$
);
