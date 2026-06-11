-- One-time meetings: new cadence value.
--
-- Lives in its own migration: a new enum value can't be *used* in the same
-- transaction that adds it, so the columns/constraints that reference 'once'
-- follow in 20260611110000_meetings_v2.sql.

alter type public.meeting_cadence add value if not exists 'once';
