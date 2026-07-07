
ALTER TABLE public.golden_runs DROP CONSTRAINT IF EXISTS golden_runs_run_type_check;
ALTER TABLE public.golden_runs ADD CONSTRAINT golden_runs_run_type_check
  CHECK (run_type IN ('parcial','oficial','parcial_no_fiable'));

UPDATE public.golden_runs
   SET run_type='parcial_no_fiable',
       notes=COALESCE(notes,'')||' | invalidado por auditoría (evaluador defectuoso)'
 WHERE run_name='baseline_partial_pre_dedup_v1';
