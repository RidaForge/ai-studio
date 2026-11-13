ALTER TABLE public.avatars
  ADD COLUMN error_service TEXT,
  ADD COLUMN error_phase TEXT,
  ADD COLUMN error_status INTEGER CHECK (error_status IS NULL OR error_status BETWEEN 100 AND 599),
  ADD COLUMN error_code TEXT;
