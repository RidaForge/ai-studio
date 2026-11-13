ALTER TABLE public.avatars
  ADD COLUMN generation_attempt INTEGER NOT NULL DEFAULT 1
  CONSTRAINT avatars_generation_attempt_positive CHECK (generation_attempt > 0);
