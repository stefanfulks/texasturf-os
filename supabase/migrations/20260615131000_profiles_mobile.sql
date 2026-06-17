-- Per-rep click-to-call: a rep's own mobile is the bridge target for Twilio
-- calls (Twilio rings this number first, then connects the lead). Additive.
alter table public.profiles add column if not exists mobile text;
