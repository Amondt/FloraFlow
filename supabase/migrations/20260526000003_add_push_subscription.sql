-- Add push_subscription column to profiles for Web Push (Phase 2.7).
-- Stores the full browser PushSubscription JSON (endpoint + keys).
-- Nullable: users who have not granted push permission have no subscription.
-- No new RLS policy needed — existing FOR ALL on profiles already covers this column.
ALTER TABLE public.profiles
  ADD COLUMN push_subscription JSONB;
