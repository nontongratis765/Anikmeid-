
-- 1) Lompat ID member baru ke #90
ALTER SEQUENCE public.profiles_user_number_seq RESTART WITH 90;

-- 2) Kolom edit untuk chat
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Izinkan user edit pesannya sendiri
DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) Tabel gift premium (klaim sekali, first-come-first-served)
CREATE TABLE IF NOT EXISTS public.premium_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  days integer NOT NULL CHECK (days > 0),
  message text NOT NULL DEFAULT '',
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.premium_gifts TO authenticated;
GRANT ALL ON public.premium_gifts TO service_role;

ALTER TABLE public.premium_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view gifts"
ON public.premium_gifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "No direct inserts"
ON public.premium_gifts FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "No direct updates"
ON public.premium_gifts FOR UPDATE TO authenticated USING (false);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.premium_gifts;

-- 4) RPC: kirim gift premium (kurangi premium pengirim, validasi punya sisa cukup)
CREATE OR REPLACE FUNCTION public.send_premium_gift(_days integer, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_dev boolean;
  cur_until timestamptz;
  remaining_days numeric;
  gift_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _days <= 0 THEN RAISE EXCEPTION 'Hari harus > 0'; END IF;
  IF length(coalesce(_message,'')) > 200 THEN RAISE EXCEPTION 'Pesan terlalu panjang'; END IF;

  is_dev := public.has_role(uid, 'owner');

  SELECT premium_until INTO cur_until FROM public.profiles WHERE id = uid;

  IF NOT is_dev THEN
    IF cur_until IS NULL OR cur_until <= now() THEN
      RAISE EXCEPTION 'Kamu belum premium, tidak bisa gift';
    END IF;
    remaining_days := EXTRACT(EPOCH FROM (cur_until - now())) / 86400.0;
    IF remaining_days < _days THEN
      RAISE EXCEPTION 'Sisa premium tidak cukup (sisa %.1f hari)', remaining_days;
    END IF;
    -- Kurangi
    UPDATE public.profiles
      SET premium_until = cur_until - (_days || ' days')::interval
      WHERE id = uid;
  END IF;

  INSERT INTO public.premium_gifts(sender_id, days, message)
    VALUES (uid, _days, coalesce(_message,''))
    RETURNING id INTO gift_id;

  RETURN gift_id;
END; $$;

-- 5) RPC: klaim gift premium
CREATE OR REPLACE FUNCTION public.claim_premium_gift(_gift_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g RECORD;
  new_until timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO g FROM public.premium_gifts WHERE id = _gift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift tidak ditemukan'; END IF;
  IF g.claimed_by IS NOT NULL THEN RAISE EXCEPTION 'Gift sudah diklaim'; END IF;
  IF g.sender_id = uid THEN RAISE EXCEPTION 'Tidak bisa klaim gift sendiri'; END IF;

  UPDATE public.profiles
    SET premium_until = GREATEST(COALESCE(premium_until, now()), now()) + (g.days || ' days')::interval
    WHERE id = uid
    RETURNING premium_until INTO new_until;

  UPDATE public.premium_gifts
    SET claimed_by = uid, claimed_at = now()
    WHERE id = _gift_id;

  RETURN new_until;
END; $$;

-- 6) RPC: edit pesan (tambah edited_at)
CREATE OR REPLACE FUNCTION public.edit_chat_message(_msg_id uuid, _new_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(coalesce(_new_content,'')) = 0 THEN RAISE EXCEPTION 'Pesan kosong'; END IF;
  UPDATE public.chat_messages
    SET content = _new_content, edited_at = now()
    WHERE id = _msg_id AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesan tidak ditemukan / bukan milikmu'; END IF;
END; $$;

-- 7) Reset chat global tiap 24 jam (pakai pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('reset-global-chat-24h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reset-global-chat-24h',
  '0 0 * * *',
  $$ DELETE FROM public.chat_messages WHERE created_at < now() - interval '24 hours'; $$
);
