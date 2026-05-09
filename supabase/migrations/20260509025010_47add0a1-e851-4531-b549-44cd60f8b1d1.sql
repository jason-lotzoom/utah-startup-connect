
ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS posted_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS job_postings_active_posted_idx ON public.job_postings (is_active, posted_at DESC);

ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS stages text[] NOT NULL DEFAULT '{}';
