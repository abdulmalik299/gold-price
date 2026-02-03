-- Schedule the Edge Function gold-poller with pg_cron + pg_net
-- Docs: https://supabase.com/docs/guides/functions/schedule-functions

-- Enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- IMPORTANT:
-- Replace <PROJECT_REF> with your Supabase project ref (here: ypdpopphenmbtivdtlip)
-- Replace <SERVICE_ROLE_JWT> with a Vault secret or function secret approach.
-- Supabase docs recommend using Vault; simplest is to store as Vault secret then read it.

-- If you want the simplest working version (less secure), paste your service role JWT directly.
-- Better: store it in Vault and use vault.get_secret().
-- See docs above for recommended setup.

-- Example using a placeholder token:
-- select net.http_post(
--   url := 'https://ypdpopphenmbtivdtlip.supabase.co/functions/v1/gold-poller',
--   headers := jsonb_build_object('Authorization', 'Bearer ' || '<SERVICE_ROLE_JWT>'),
--   body := jsonb_build_object()
-- );

-- Schedule every minute
select
  cron.schedule(
    'gold-poller-every-minute',
    '* * * * *',
    $$
    select net.http_post(
      url := 'https://ypdpopphenmbtivdtlip.supabase.co/functions/v1/gold-poller',
      headers := jsonb_build_object('Authorization', 'Bearer ' || '<SERVICE_ROLE_JWT>'),
      body := jsonb_build_object()
    );
    $$
  );
