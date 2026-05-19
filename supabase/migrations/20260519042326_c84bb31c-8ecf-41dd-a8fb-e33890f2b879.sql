
-- Reschedule halfvec-copy with safer settings
SELECT cron.unschedule('halfvec-copy');

SELECT cron.schedule(
  'halfvec-copy',
  '* * * * *',
  $$
  DO $body$
  DECLARE
    v_lock_acquired boolean;
    v_updated int := 0;
    v_total int := 0;
  BEGIN
    SET LOCAL statement_timeout = 0;
    SET LOCAL lock_timeout = '5s';

    SELECT pg_try_advisory_lock(74726001) INTO v_lock_acquired;
    IF NOT v_lock_acquired THEN
      RAISE NOTICE 'halfvec-copy: another run in progress, skipping';
      RETURN;
    END IF;

    BEGIN
      FOR i IN 1..20 LOOP
        WITH cte AS (
          SELECT id FROM public.document_chunks
           WHERE embedding IS NOT NULL AND embedding_h IS NULL
           LIMIT 2000 FOR UPDATE SKIP LOCKED
        )
        UPDATE public.document_chunks c
           SET embedding_h = c.embedding::halfvec(768)
          FROM cte WHERE c.id = cte.id;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        v_total := v_total + v_updated;
        EXIT WHEN v_updated = 0;
      END LOOP;
      RAISE NOTICE 'halfvec-copy: copied % rows this run', v_total;
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(74726001);
      RAISE;
    END;

    PERFORM pg_advisory_unlock(74726001);
  END
  $body$;
  $$
);
