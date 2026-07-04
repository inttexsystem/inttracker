-- ============================================================
-- Fase: RAVATEX-TAPETES-OP-NUMBERING-MONOTONIC-DB26-A
--
-- Objetivo:
--   1. Numeracao monotonia e lock-safe para OPs, sem MAX(numero)+1.
--   2. OP numerada nao deve ser removida fisicamente em reconciliacoes
--      futuras. Cancelar/arquivar/consolidar com rastro, nunca apagar.
--   3. gerar_op_latex passa a retornar flags operacionais para a UI:
--      created, accumulated, already_linked, numero, ano, op_latex_id.
--
-- Incremental sobre db/25_latex_consolidation.sql.
-- Nao recria OP antiga removida, nao altera a OP 4/2026 atual e nao
-- corrige dados por update/delete ad hoc. Aplicar somente em staging
-- ucrjtfswnfdlxwtmxnoo. Producao proibida.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. High-water de numeracao por tipo/ano
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_numeros (
  tipo          TEXT        NOT NULL,
  ano           INTEGER     NOT NULL,
  ultimo_numero INTEGER     NOT NULL CHECK (ultimo_numero >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, ano)
);

COMMENT ON TABLE public.op_numeros IS
  'High-water monotonic de numeracao publica de OP por tipo/ano. Nunca reduzir ultimo_numero nem reaproveitar buracos.';

COMMENT ON COLUMN public.op_numeros.ultimo_numero IS
  'Maior numero ja reservado para o par tipo/ano, incluindo numeros que possam nao ter virado OP por rollback/concorrencia.';

ALTER TABLE public.op_numeros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS op_numeros_admin ON public.op_numeros;
CREATE POLICY op_numeros_admin ON public.op_numeros
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS op_numeros_read ON public.op_numeros;
CREATE POLICY op_numeros_read ON public.op_numeros
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.op_numeros TO authenticated;

-- Backfill idempotente a partir dos numeros existentes. Reexecutar a
-- migration nunca reduz o contador: GREATEST preserva o maior high-water.
INSERT INTO public.op_numeros (tipo, ano, ultimo_numero)
SELECT o.tipo, o.ano, MAX(o.numero) AS ultimo_numero
  FROM public.ops o
 WHERE o.tipo IS NOT NULL
   AND o.ano IS NOT NULL
   AND o.numero IS NOT NULL
 GROUP BY o.tipo, o.ano
ON CONFLICT (tipo, ano) DO UPDATE
   SET ultimo_numero = GREATEST(public.op_numeros.ultimo_numero, EXCLUDED.ultimo_numero),
       updated_at = now();

-- ============================================================
-- 2. Proximo numero lock-safe
-- ============================================================
CREATE OR REPLACE FUNCTION public.proximo_numero_op(p_tipo TEXT, p_ano INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  IF p_tipo IS NULL OR btrim(p_tipo) = '' THEN
    RAISE EXCEPTION 'Tipo de OP obrigatorio para numeracao';
  END IF;

  IF p_ano IS NULL THEN
    RAISE EXCEPTION 'Ano da OP obrigatorio para numeracao';
  END IF;

  INSERT INTO public.op_numeros AS n (tipo, ano, ultimo_numero)
  VALUES (p_tipo, p_ano, 1)
  ON CONFLICT (tipo, ano) DO UPDATE
     SET ultimo_numero = n.ultimo_numero + 1,
         updated_at = now()
  RETURNING ultimo_numero INTO v_numero;

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.proximo_numero_op(TEXT, INTEGER) FROM PUBLIC;

COMMENT ON FUNCTION public.proximo_numero_op(TEXT, INTEGER) IS
  'Reserva o proximo numero publico de OP por tipo/ano via UPSERT transacional. Nao consulta ops e nao reaproveita buracos.';

-- ============================================================
-- 3. Politica anti-delete fisico de OP numerada
-- ============================================================
CREATE OR REPLACE FUNCTION public.ops_numeradas_no_delete_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.numero IS NOT NULL AND OLD.ano IS NOT NULL THEN
    RAISE EXCEPTION
      'OP numerada %/% (id %) nao pode ser removida fisicamente. Use cancelamento/arquivamento/consolidacao com rastro.',
      OLD.numero, OLD.ano, OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ops_numeradas_no_delete ON public.ops;
CREATE TRIGGER ops_numeradas_no_delete
  BEFORE DELETE ON public.ops
  FOR EACH ROW
  EXECUTE FUNCTION public.ops_numeradas_no_delete_fn();

COMMENT ON FUNCTION public.ops_numeradas_no_delete_fn() IS
  'Politica db/26: OP numerada nao deve sofrer delete fisico em reconciliacoes futuras; preservar rastro operacional.';

COMMENT ON TRIGGER ops_numeradas_no_delete ON public.ops IS
  'Bloqueia delete fisico de OP numerada. Reconciliacoes futuras devem cancelar/arquivar/consolidar com rastro.';

-- ============================================================
-- 4. gerar_op_latex com numeracao monotonia e retorno operacional
-- ============================================================
DROP FUNCTION IF EXISTS public.gerar_op_latex(BIGINT);

CREATE OR REPLACE FUNCTION public.gerar_op_latex(p_entrega_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega        public.entregas%ROWTYPE;
  v_op_id          BIGINT;
  v_lote_id        BIGINT;
  v_destino        BIGINT;
  v_ano            INTEGER;
  v_numero         INTEGER;
  v_latex_op_id    BIGINT;
  v_latex_numero   INTEGER;
  v_latex_ano      INTEGER;
  v_existing       BIGINT;
  v_link_id        BIGINT;
  v_created        BOOLEAN := FALSE;
  v_accumulated    BOOLEAN := FALSE;
  v_already_linked BOOLEAN := FALSE;
  ei               RECORD;
BEGIN
  SELECT * INTO v_entrega FROM public.entregas WHERE id = p_entrega_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega % nao encontrada', p_entrega_id;
  END IF;

  IF v_entrega.etapa <> 'cima' THEN
    RAISE EXCEPTION 'Entrega % nao e de tecelagem (etapa=%)', p_entrega_id, v_entrega.etapa;
  END IF;

  IF NOT (public.is_admin() OR v_entrega.fornecedor_id = public.meu_fornecedor_id()) THEN
    RAISE EXCEPTION 'Sem permissao para gerar OP de latex da entrega %', p_entrega_id;
  END IF;

  v_destino := v_entrega.destino_fornecedor_id;
  IF v_destino IS NULL THEN
    RAISE EXCEPTION 'Entrega % sem destino de latex', p_entrega_id;
  END IF;

  -- Idempotencia por entrega: ja vinculada => nao acumula novamente.
  SELECT ole.op_latex_id, o.numero, o.ano
    INTO v_existing, v_latex_numero, v_latex_ano
    FROM public.op_latex_entregas ole
    JOIN public.ops o ON o.id = ole.op_latex_id
   WHERE ole.entrega_id = p_entrega_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'op_latex_id', v_existing,
      'numero', v_latex_numero,
      'ano', v_latex_ano,
      'created', false,
      'accumulated', false,
      'already_linked', true
    );
  END IF;

  -- OP de producao (tecelagem) de origem.
  SELECT op_id INTO v_op_id
    FROM public.entrega_itens
   WHERE entrega_id = p_entrega_id
   LIMIT 1;

  IF v_op_id IS NULL THEN
    RETURN jsonb_build_object(
      'op_latex_id', NULL,
      'numero', NULL,
      'ano', NULL,
      'created', false,
      'accumulated', false,
      'already_linked', false
    );
  END IF;

  -- Sem metros sem defeito => nada a consolidar.
  IF NOT EXISTS (
    SELECT 1
      FROM public.entrega_itens
     WHERE entrega_id = p_entrega_id
       AND defeito = FALSE
       AND metros_entregues > 0
  ) THEN
    RETURN jsonb_build_object(
      'op_latex_id', NULL,
      'numero', NULL,
      'ano', NULL,
      'created', false,
      'accumulated', false,
      'already_linked', false
    );
  END IF;

  -- Chave canonica da OP Latex: (origem_op_id, destino_fornecedor_id).
  SELECT id, numero, ano
    INTO v_latex_op_id, v_latex_numero, v_latex_ano
    FROM public.ops
   WHERE tipo = 'latex'
     AND origem_op_id = v_op_id
     AND destino_fornecedor_id = v_destino;

  IF v_latex_op_id IS NULL THEN
    SELECT lote_id INTO v_lote_id FROM public.ops WHERE id = v_op_id;
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    v_numero := public.proximo_numero_op('latex', v_ano);

    INSERT INTO public.ops
      (numero, ano, status, tipo, origem_op_id, origem_entrega_id, lote_id, destino_fornecedor_id, observacao)
    VALUES (
      v_numero, v_ano, 'aberta', 'latex', v_op_id, p_entrega_id, v_lote_id, v_destino,
      'Consolidada da OP ' || (SELECT numero || '/' || ano FROM public.ops WHERE id = v_op_id)
        || ' (tecelagem) para o acabamento'
    )
    ON CONFLICT (origem_op_id, destino_fornecedor_id) WHERE tipo = 'latex'
    DO NOTHING
    RETURNING id, numero, ano INTO v_latex_op_id, v_latex_numero, v_latex_ano;

    IF v_latex_op_id IS NOT NULL THEN
      v_created := TRUE;
    ELSE
      -- Corrida concorrente: outro processo criou a OP canonica primeiro.
      SELECT id, numero, ano
        INTO v_latex_op_id, v_latex_numero, v_latex_ano
        FROM public.ops
       WHERE tipo = 'latex'
         AND origem_op_id = v_op_id
         AND destino_fornecedor_id = v_destino;
    END IF;
  END IF;

  IF v_latex_op_id IS NULL THEN
    RAISE EXCEPTION 'Nao foi possivel resolver OP de latex para entrega %', p_entrega_id;
  END IF;

  INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa)
  VALUES (v_latex_op_id, v_destino, 'latex')
  ON CONFLICT (op_id, fornecedor_id, etapa) DO NOTHING;

  -- Vincula a entrega a OP Latex (N:1). So acumula itens se o vinculo
  -- foi criado agora; se ja existia, nao duplica metros.
  INSERT INTO public.op_latex_entregas (op_latex_id, entrega_id)
  VALUES (v_latex_op_id, p_entrega_id)
  ON CONFLICT (entrega_id) DO NOTHING
  RETURNING id INTO v_link_id;

  IF v_link_id IS NULL THEN
    v_already_linked := TRUE;
  ELSE
    v_accumulated := NOT v_created;

    FOR ei IN
      SELECT oi.modelo_id AS modelo_id, SUM(e.metros_entregues) AS metros
        FROM public.entrega_itens e
        JOIN public.op_itens oi ON oi.id = e.op_item_id
       WHERE e.entrega_id = p_entrega_id
         AND e.defeito = FALSE
         AND e.metros_entregues > 0
       GROUP BY oi.modelo_id
    LOOP
      UPDATE public.op_itens c
         SET metros_pedidos = c.metros_pedidos + ei.metros
       WHERE c.op_id = v_latex_op_id
         AND c.modelo_id = ei.modelo_id
         AND c.pedido_item_id IS NULL;

      IF NOT FOUND THEN
        INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos)
        VALUES (v_latex_op_id, ei.modelo_id, ei.metros);
      END IF;
    END LOOP;
  END IF;

  SELECT numero, ano INTO v_latex_numero, v_latex_ano
    FROM public.ops
   WHERE id = v_latex_op_id;

  RETURN jsonb_build_object(
    'op_latex_id', v_latex_op_id,
    'numero', v_latex_numero,
    'ano', v_latex_ano,
    'created', v_created,
    'accumulated', v_accumulated,
    'already_linked', v_already_linked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_op_latex(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.gerar_op_latex(BIGINT) IS
  'Cria ou reutiliza OP de Acabamento/Latex consolidada por (origem_op_id, destino_fornecedor_id), usando proximo_numero_op e retornando flags created/accumulated/already_linked.';

-- ============================================================
-- 5. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
