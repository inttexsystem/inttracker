-- ============================================================
-- Fase: RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-POLICY-CAST-55
-- Correcao emergencial staging-only para a migration 53 ja aplicada.
-- Corrige somente a tipagem polimorfica de to_jsonb(text) nas duas
-- diagnosticas publicas; nao altera regras, grants ou cascatas.
-- ============================================================
DO $repair$
DECLARE
  v_definition TEXT;
  v_old TEXT := 'to_jsonb(''Guarda documental: bloqueia exclusao fisica quando existe historico canonico de vinculos documentais. Correcao somente pelo fluxo documental humano; nao ha desvinculo automatico.'')';
  v_new TEXT := 'to_jsonb(''Guarda documental: bloqueia exclusao fisica quando existe historico canonico de vinculos documentais. Correcao somente pelo fluxo documental humano; nao ha desvinculo automatico.''::TEXT)';
BEGIN
  SELECT pg_get_functiondef('public.diagnosticar_impacto_op(bigint)'::regprocedure)
    INTO v_definition;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'SQL55 precondition failed: diagnosticar_impacto_op does not contain the expected untyped policy literal';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);

  SELECT pg_get_functiondef('public.diagnosticar_impacto_pedido(uuid)'::regprocedure)
    INTO v_definition;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'SQL55 precondition failed: diagnosticar_impacto_pedido does not contain the expected untyped policy literal';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);
END;
$repair$;

NOTIFY pgrst, 'reload schema';
