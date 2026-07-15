-- ============================================================
-- Fase: RAVATEX-TAPETES-CONTROLLED-DELETE-DOCUMENT-LINK-DIAGNOSTICS-NULL-SAFE-56
-- Correcao emergencial staging-only para a migration 53 ja aplicada.
--
-- Causa raiz (provada por consulta read-only antes desta migration):
-- jsonb_set(...) e STRICT: quando o terceiro argumento e SQL NULL, o
-- retorno inteiro da chamada colapsa para NULL (nao apenas a chave).
-- O ultimo passo dos wrappers publicos diagnosticar_impacto_op e
-- diagnosticar_impacto_pedido (introduzidos pela migration 53) monta o
-- retorno com:
--   jsonb_set(..., '{reason}', to_jsonb(v_reason), TRUE)
-- Para QUALQUER alvo nao bloqueado pelo guard documental (blocked=false,
-- ou seja classification IN ('safe','requires_confirmation',
-- 'requires_cascade_confirmation')), v_reason e sempre NULL porque:
--   1) v_reason parte de v_pre->>'reason', e a diagnostica pre53 (db/37)
--      nunca marca v_blocked=TRUE nas suas diagnosticas (o bloqueio por
--      entrega/expedicao foi substituido por cascata nesta fase; a unica
--      excecao e o early-return "OP/Pedido nao encontrado", que retorna
--      antes de chegar neste jsonb_set e nao e afetado);
--   2) o guard documental do wrapper 53 so sobrescreve v_reason quando
--      ha historico documental (bloqueio), o que nao e o caso aqui.
-- to_jsonb(NULL::text) e SQL NULL (nao JSON null), logo o jsonb_set
-- final colapsa TODO o retorno da RPC para NULL sempre que o alvo NAO
-- estiver bloqueado por historico documental -- isto e, para todo alvo
-- elegivel para exclusao fisica (com ou sem dependencias em cascata).
--
-- Contrato esperado (o mesmo desde db/34/db/37, que usavam
-- jsonb_build_object -- funcao null-safe: um argumento NULL vira a
-- chave JSON "reason": null, sem colapsar o objeto):
--   {"ok": true, "blocked": false, "reason": null, "impacto": {...}, ...}
-- js/delete-helpers.js consome diag.reason/diag.blocked/diag.impacto
-- assumindo sempre um objeto valido (nunca a resposta inteira nula).
--
-- Correcao minima: envolver o valor de reason com COALESCE(...,
-- 'null'::jsonb) apenas no jsonb_set final de cada diagnostica. Nenhuma
-- outra linha muda em relacao ao corpo atualmente aplicado em staging
-- (migration 53 + patch de tipagem da migration 55). Nao altera:
-- - o guard documental (bloqueio por historico canonico);
-- - a ACL (migration 54);
-- - remover_op / remover_pedido / funcoes *_pre53;
-- - o schema JSON retornado (mesmas chaves, mesma semantica).
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
    to_jsonb('Guarda documental: bloqueia exclusao fisica quando existe historico canonico de vinculos documentais. Correcao somente pelo fluxo documental humano; nao ha desvinculo automatico.'::TEXT),
    TRUE
  );

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(v_pre, '{impacto}', v_impacto, TRUE),
      '{blocked}', to_jsonb(v_blocked), TRUE
    ),
    '{reason}', COALESCE(to_jsonb(v_reason), 'null'::jsonb), TRUE
  );
END;
$$;

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
    to_jsonb('Guarda documental: bloqueia exclusao fisica quando existe historico canonico de vinculos documentais. Correcao somente pelo fluxo documental humano; nao ha desvinculo automatico.'::TEXT),
    TRUE
  );

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(v_pre, '{impacto}', v_impacto, TRUE),
      '{blocked}', to_jsonb(v_blocked), TRUE
    ),
    '{reason}', COALESCE(to_jsonb(v_reason), 'null'::jsonb), TRUE
  );
END;
$$;

-- ============================================================
-- Sem alteracao de grants: as GRANTs da migration 53/54 ja concedem
-- EXECUTE somente a authenticated nestas duas assinaturas publicas.
-- CREATE OR REPLACE preserva ACL existente (nao reseta grants).
-- ============================================================

NOTIFY pgrst, 'reload schema';
