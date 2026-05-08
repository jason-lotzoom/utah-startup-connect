ALTER TABLE public.companies REPLICA IDENTITY FULL;
ALTER TABLE public.job_postings REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='companies') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.companies';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='job_postings') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.job_postings';
  END IF;
END $$;