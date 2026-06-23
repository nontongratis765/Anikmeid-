
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until timestamptz;

CREATE OR REPLACE FUNCTION public.increment_watch_minutes(_minutes int)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
  SET watch_minutes = watch_minutes + GREATEST(_minutes, 0),
      xp = xp + GREATEST(_minutes, 0)
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.grant_premium(_target_user uuid, _days int)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_until timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.profiles
  SET premium_until = GREATEST(COALESCE(premium_until, now()), now()) + (_days || ' days')::interval
  WHERE id = _target_user
  RETURNING premium_until INTO new_until;
  RETURN new_until;
END; $$;

GRANT EXECUTE ON FUNCTION public.increment_watch_minutes(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_premium(uuid, int) TO authenticated;
