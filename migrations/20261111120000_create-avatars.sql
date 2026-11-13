CREATE TABLE public.avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('default', 'upload', 'ai')),
  style TEXT,
  prompt TEXT,
  source_image_url TEXT,
  source_image_key TEXT,
  image_16_9_url TEXT,
  image_16_9_key TEXT,
  image_9_16_url TEXT,
  image_9_16_key TEXT,
  trigger_run_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ready', 'queued', 'generating', 'completed', 'failed')) DEFAULT 'ready',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX avatars_user_created_idx ON public.avatars (user_id, created_at DESC, id DESC);
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avatars_select_own" ON public.avatars
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "avatars_insert_own" ON public.avatars
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "avatars_update_own" ON public.avatars
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "avatars_delete_own" ON public.avatars
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avatars TO authenticated;

CREATE TRIGGER avatars_updated_at
  BEFORE UPDATE ON public.avatars
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

DROP POLICY IF EXISTS avatars_objects_owner_select ON storage.objects;
DROP POLICY IF EXISTS avatars_objects_owner_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_objects_owner_update ON storage.objects;
DROP POLICY IF EXISTS avatars_objects_owner_delete ON storage.objects;

CREATE POLICY avatars_objects_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket = 'avatars' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));
CREATE POLICY avatars_objects_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'avatars'
    AND uploaded_by = (SELECT auth.jwt() ->> 'sub')
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );
CREATE POLICY avatars_objects_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket = 'avatars' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'))
  WITH CHECK (bucket = 'avatars' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));
CREATE POLICY avatars_objects_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket = 'avatars' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));
