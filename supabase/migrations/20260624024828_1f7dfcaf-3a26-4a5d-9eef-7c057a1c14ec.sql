-- Tighten realtime.messages: only admins may subscribe.
-- All current realtime usage is the admin dashboard invalidation hook.
DROP POLICY IF EXISTS "Realtime: authenticated subscribe to app topics" ON realtime.messages;
DROP POLICY IF EXISTS "Realtime: admin subscribe" ON realtime.messages;

CREATE POLICY "Realtime: admin subscribe"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));