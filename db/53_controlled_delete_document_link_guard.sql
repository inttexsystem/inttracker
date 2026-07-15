-- ============================================================
-- Fase: RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-GUARD-B
-- Guarda documental de exclusao fisica temporaria via wrappers.
--
-- Politica:
-- - Nao copia a logica destrutiva de db/37.
-- - Renomeia as quatro funcoes legadas de db/37 para *_pre53 e revoga
--   EXECUTE para PUBLIC/anon/authenticated/service_role (anti-bypass).
-- - Recria as mesmas assinaturas publicas como SECURITY DEFINER wrappers.
-- - diagnosticar_* chamam a pre53 e enriquecem o JSON com contagens
--   documentais, bloqueando classification/blocked quando houver historico
--   canonico de vinculos documentais.
-- - remover_* chamam a diagnostica nova primeiro; se bloqueado, devolvem
--   ok=false SEM chamar a pre53; se elegivel, delegam a pre53 com os
--   mesmos argumentos (preserva cascata/EXCLUIR/EXCLUIR TUDO).
-- - Nunca DELETE/UPDATE/INSERT em document_link_revisions/revision_ops
--   nem em op_numeros.
-- - Somente um proposito: guarda documental. Sem triggers/tabelas auxiliares.
-- ============================================================

-- ============================================================
-- A. Renomear funcoes legadas de db/37 (preserva implementacao).
-- ============================================================
ALTER FUNCTION public.diagnosticar_impacto_pedido(UUID) RENAME TO diagnosticar_impacto_pedido_pre53;
ALTER FUNCTION public.diagnosticar_impacto_op(BIGINT) RENAME TO diagnosticar_impacto_op_pre53;
ALTER FUNCTION public.remover_pedido(UUID, TEXT) RENAME TO remover_pedido_pre53;
ALTER FUNCTION public.remover_op(BIGINT, TEXT) RENAME TO remover_op_pre53;

-- ============================================================
-- B. Revoke EXECUTE anti-bypass nas funcoes pre53.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido_pre53(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido_pre53(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido_pre53(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido_pre53(UUID) FROM service_role;

REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_op_pre53(BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_op_pre53(BIGINT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_op_pre53(BIGINT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.diagnosticar_impacto_op_pre53(BIGINT) FROM service_role;

REVOKE EXECUTE ON FUNCTION public.remover_pedido_pre53(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remover_pedido_pre53(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remover_pedido_pre53(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.remover_pedido_pre53(UUID, TEXT) FROM service_role;

REVOKE EXECUTE ON FUNCTION public.remover_op_pre53(BIGINT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remover_op_pre53(BIGINT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remover_op_pre53(BIGINT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.remover_op_pre53(BIGINT, TEXT) FROM service_role;

-- ============================================================
-- C. Wrapper publico diagnosticar_impacto_op.
-- ============================================================
CREATE OR REPLACE FUNCTION public.diagnosticar_impacto_op(p_op_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pre JSONB;
  v_target_ops BIGINT[] := '{}'::BIGINT[];
  v_doc_link_revision_ops BIGINT := 0;
  v_doc_link_revisions BIGINT := 0;
  v_documentos_vinculados BIGINT := 0;
  v_blocked BOOLEAN := FALSE;
  v_reason TEXT := NULL;
  v_impacto JSONB;
BEGIN
  v_pre := public.diagnosticar_impacto_op_pre53(p_op_id);

  IF NOT COALESCE((v_pre->>'ok')::BOOLEAN, FALSE) THEN
    RETURN v_pre;
  END IF;

  v_blocked := COALESCE((v_pre->>'blocked')::BOOLEAN, FALSE);
  v_reason := v_pre->>'reason';

  v_target_ops := ARRAY(
    SELECT jsonb_array_elements_text(v_pre->'impacto'->'ids'->'target_ops')::BIGINT
  );

  SELECT COUNT(*) INTO v_doc_link_revision_ops
    FROM public.document_link_revision_ops dlro
   WHERE dlro.op_id = ANY(v_target_ops);

  SELECT COUNT(DISTINCT dlro.revision_id) INTO v_doc_link_revisions
    FROM public.document_link_revision_ops dlro
   WHERE dlro.op_id = ANY(v_target_ops);

  SELECT COUNT(DISTINCT dlr.document_id) INTO v_documentos_vinculados
    FROM public.document_link_revision_ops dlro
    JOIN public.document_link_revisions dlr ON dlr.id = dlro.revision_id
   WHERE dlro.op_id = ANY(v_target_ops);

  v_impacto := v_pre->'impacto';

  v_impacto := jsonb_set(v_impacto, '{documentary_history_blocker}', to_jsonb(v_doc_link_revision_ops > 0), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,document_link_revision_ops}', to_jsonb(v_doc_link_revision_ops), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,document_link_revisions}', to_jsonb(v_doc_link_revisions), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,documentos_vinculados}', to_jsonb(v_documentos_vinculados), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,documentary_history_blocker}', to_jsonb(v_doc_link_revision_ops > 0), TRUE);

  IF v_doc_link_revision_ops > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Exclusao fisica bloqueada: existe historico canonico de vinculos documentais para OP(s) desta cadeia. A correcao deve ocorrer pelo fluxo documental humano; nao e possivel desvincular automaticamente nesta operacao.';

    v_impacto := jsonb_set(v_impacto, '{classification}', '"blocked"', TRUE);
    v_impacto := jsonb_set(v_impacto, '{blocked}', 'true', TRUE);
    v_impacto := jsonb_set(v_impacto, '{requires_confirmation}', 'false', TRUE);
    v_impacto := jsonb_set(v_impacto, '{cascade_required}', 'false', TRUE);
    v_impacto := jsonb_set(v_impacto, '{cascade_reason}', 'null', TRUE);
    v_impacto := jsonb_set(v_impacto, '{confirmation_required}', 'null', TRUE);
  END IF;

  v_impacto := jsonb_set(
    v_impacto,
    '{policy}',
    to_jsonb('Guarda documental: bloqueia exclusao fisica quando existe historico canonico de vinculos documentais. Correcao somente pelo fluxo documental humano; nao ha desvinculo automatico.'),
    TRUE
  );

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(v_pre, '{impacto}', v_impacto, TRUE),
      '{blocked}', to_jsonb(v_blocked), TRUE
    ),
    '{reason}', to_jsonb(v_reason), TRUE
  );
END;
$$;

-- ============================================================
-- D. Wrapper publico diagnosticar_impacto_pedido.
-- ============================================================
CREATE OR REPLACE FUNCTION public.diagnosticar_impacto_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pre JSONB;
  v_target_ops BIGINT[] := '{}'::BIGINT[];
  v_doc_link_revision_ops BIGINT := 0;
  v_doc_link_revisions BIGINT := 0;
  v_documentos_vinculados BIGINT := 0;
  v_blocked BOOLEAN := FALSE;
  v_reason TEXT := NULL;
  v_impacto JSONB;
BEGIN
  v_pre := public.diagnosticar_impacto_pedido_pre53(p_pedido_id);

  IF NOT COALESCE((v_pre->>'ok')::BOOLEAN, FALSE) THEN
    RETURN v_pre;
  END IF;

  v_blocked := COALESCE((v_pre->>'blocked')::BOOLEAN, FALSE);
  v_reason := v_pre->>'reason';

  v_target_ops := ARRAY(
    SELECT jsonb_array_elements_text(v_pre->'impacto'->'ids'->'target_ops')::BIGINT
  );

  SELECT COUNT(*) INTO v_doc_link_revision_ops
    FROM public.document_link_revision_ops dlro
   WHERE dlro.op_id = ANY(v_target_ops);

  SELECT COUNT(DISTINCT rev_id) INTO v_doc_link_revisions
    FROM (
      SELECT dlro.revision_id AS rev_id
        FROM public.document_link_revision_ops dlro
       WHERE dlro.op_id = ANY(v_target_ops)
      UNION
      SELECT dlr.id AS rev_id
        FROM public.document_link_revisions dlr
       WHERE dlr.pedido_id = p_pedido_id
    ) s;

  SELECT COUNT(DISTINCT dlr.document_id) INTO v_documentos_vinculados
    FROM (
      SELECT dlro.revision_id AS rev_id
        FROM public.document_link_revision_ops dlro
       WHERE dlro.op_id = ANY(v_target_ops)
      UNION
      SELECT dlr.id AS rev_id
        FROM public.document_link_revisions dlr
       WHERE dlr.pedido_id = p_pedido_id
    ) s
    JOIN public.document_link_revisions dlr ON dlr.id = s.rev_id;

  v_impacto := v_pre->'impacto';

  v_impacto := jsonb_set(v_impacto, '{documentary_history_blocker}', to_jsonb(v_doc_link_revision_ops > 0 OR v_doc_link_revisions > 0), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,document_link_revision_ops}', to_jsonb(v_doc_link_revision_ops), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,document_link_revisions}', to_jsonb(v_doc_link_revisions), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,documentos_vinculados}', to_jsonb(v_documentos_vinculados), TRUE);
  v_impacto := jsonb_set(v_impacto, '{counts,documentary_history_blocker}', to_jsonb(v_doc_link_revision_ops > 0 OR v_doc_link_revisions > 0), TRUE);

  IF v_doc_link_revision_ops > 0 OR v_doc_link_revisions > 0 THEN
    v_blocked := TRUE;
    v_reason := 'Exclusao fisica bloqueada: existe historico canonico de vinculos documentais para este Pedido ou para OP(s) da sua cadeia. A correcao deve ocorrer pelo fluxo documental humano; nao e possivel desvincular automaticamente nesta operacao.';

    v_impacto := jsonb_set(v_impacto, '{classification}', '"blocked"', TRUE);
    v_impacto := jsonb_set(v_impacto, '{blocked}', 'true', TRUE);
    v_impacto := jsonb_set(v_impacto, '{requires_confirmation}', 'false', TRUE);
    v_impacto := jsonb_set(v_impacto, '{cascade_required}', 'false', TRUE);
    v_impacto := jsonb_set(v_impacto, '{cascade_reason}', 'null', TRUE);
    v_impacto := jsonb_set(v_impacto, '{confirmation_required}', 'null', TRUE);
  END IF;

  v_impacto := jsonb_set(
    v_impacto,
    '{policy}',
    to_jsonb('Guarda documental: bloqueia exclusao fisica quando existe historico canonico de vinculos documentais. Correcao somente pelo fluxo documental humano; nao ha desvinculo automatico.'),
    TRUE
  );

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(v_pre, '{impacto}', v_impacto, TRUE),
      '{blocked}', to_jsonb(v_blocked), TRUE
    ),
    '{reason}', to_jsonb(v_reason), TRUE
  );
END;
$$;

-- ============================================================
-- E. Wrapper publico remover_op.
-- ============================================================
CREATE OR REPLACE FUNCTION public.remover_op(p_op_id BIGINT, p_confirmacao TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', TRUE,
      'reason', 'Apenas admin pode excluir OP em modo teste.',
      'impacto', NULL,
      'deleted', jsonb_build_object(),
      'entity', 'op',
      'id', p_op_id
    );
  END IF;

  v_diag := public.diagnosticar_impacto_op(p_op_id);
  IF COALESCE((v_diag->>'blocked')::BOOLEAN, FALSE) THEN
    RETURN jsonb_set(v_diag, '{ok}', 'false'::jsonb, TRUE);
  END IF;

  RETURN public.remover_op_pre53(p_op_id, p_confirmacao);
END;
$$;

-- ============================================================
-- F. Wrapper publico remover_pedido.
-- ============================================================
CREATE OR REPLACE FUNCTION public.remover_pedido(p_pedido_id UUID, p_confirmacao TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'blocked', TRUE,
      'reason', 'Apenas admin pode excluir Pedido em modo teste.',
      'impacto', NULL,
      'deleted', jsonb_build_object(),
      'entity', 'pedido',
      'id', p_pedido_id
    );
  END IF;

  v_diag := public.diagnosticar_impacto_pedido(p_pedido_id);
  IF COALESCE((v_diag->>'blocked')::BOOLEAN, FALSE) THEN
    RETURN jsonb_set(v_diag, '{ok}', 'false'::jsonb, TRUE);
  END IF;

  RETURN public.remover_pedido_pre53(p_pedido_id, p_confirmacao);
END;
$$;

-- ============================================================
-- G. Grants publicos (apenas nas assinaturas publicas) e comentarios.
-- ============================================================
GRANT EXECUTE ON FUNCTION public.diagnosticar_impacto_pedido(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnosticar_impacto_op(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_pedido(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_op(BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.diagnosticar_impacto_pedido(UUID) IS
  'Wrapper publico: diagnostico read-only do impacto de exclusao fisica de Pedido, enriquecido com guarda de historico canonico de vinculos documentais.';
COMMENT ON FUNCTION public.diagnosticar_impacto_op(BIGINT) IS
  'Wrapper publico: diagnostico read-only do impacto de exclusao fisica de OP, enriquecido com guarda de historico canonico de vinculos documentais.';
COMMENT ON FUNCTION public.remover_pedido(UUID, TEXT) IS
  'Wrapper publico: delega a logica de exclusao pre53 apenas quando nao houver historico canonico de vinculos documentais; bloqueia antes de chamar pre53.';
COMMENT ON FUNCTION public.remover_op(BIGINT, TEXT) IS
  'Wrapper publico: delega a logica de exclusao pre53 apenas quando nao houver historico canonico de vinculos documentais; bloqueia antes de chamar pre53.';

NOTIFY pgrst, 'reload schema';
