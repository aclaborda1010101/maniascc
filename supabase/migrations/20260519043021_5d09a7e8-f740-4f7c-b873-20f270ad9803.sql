
SELECT cron.unschedule('halfvec-copy');
SELECT pg_cancel_backend(10032);
