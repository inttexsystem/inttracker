-- ============================================================
-- Fase: RAVATEX-TAPETES-TEC_TO_ACABAMENTO-CONSOLIDATED-LATEX-OP-A
--
-- Corrige a regra errada em que CADA entrega parcial de Tecelagem
-- gerava uma NOVA OP de Acabamento/Látex.
--
-- Contrato correto:
--   Pedido -> OP Tecelagem -> várias entregas/parciais -> UMA OP
--   Acabamento/Látex consolidada por (OP Tecelagem origem +
--   fornecedor de acabamento destino).
--
-- A entrega parcial é movimento/documento de entrada; NÃO é a
-- identidade de uma nova OP de Acabamento.
--
-- Chave funcional da OP Látex: (origem_op_id, destino_fornecedor_id)
-- com tipo='latex'. O lote é implicado por origem_op_id.
--
-- Ordem (transacional — tudo ou nada):
--   1. ops.destino_fornecedor_id (coluna + backfill).
--   2. op_latex_entregas (tabela N entregas -> 1 OP Látex + backfill).
--   3. Reconciliação de duplicatas existentes (com hard-stop se
--      qualquer OP do grupo tiver downstream: status<>aberta,
--      recebimento látex ou expedição).
--   4. Substituir índice ops_origem_entrega_latex_uidx pelo índice
--      único parcial (origem_op_id, destino_fornecedor_id).
--   5. gerar_op_latex: find-or-accumulate.
--   6. Guards (entregas / entrega_itens) passam a checar
--      op_latex_entregas (cobre entregas consolidadas, não só a 1ª).
--
-- NÃO aplicado em Supabase automaticamente. Migration versionada.
-- Aplicar SOMENTE em staging (ucrjtfswnfdlxwtmxnoo). Produção proibida.
-- Idempotente: pode rodar novamente sem efeito cumulativo.
-- ============================================================

-- ============================================================
-- 1. ops.destino_fornecedor_id (fornecedor de acabamento da OP Látex)
-- ============================================================
ALTER TABLE public.ops
  ADD COLUMN IF NOT EXISTS destino_fornecedor_id BIGINT
    REFERENCES public.fornecedores(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.ops.destino_fornecedor_id IS
  'Fornecedor de acabamento/látex destino da OP (tipo=latex). Compõe a '
  'chave de consolidação (origem_op_id, destino_fornecedor_id).';

-- Backfill a partir de op_fornecedores(etapa=latex) para OPs látex já existentes.
UPDATE public.ops o
   SET destino_fornecedor_id = ofn.fornecedor_id
  FROM public.op_fornecedores ofn
 WHERE ofn.op_id = o.id
   AND ofn.etapa = 'latex'
   AND o.tipo = 'latex'
   AND o.destino_fornecedor_id IS NULL;

-- ============================================================
-- 2. op_latex_entregas — vínculo N entregas (cima) -> 1 OP Látex
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_latex_entregas (
  id           BIGSERIAL PRIMARY KEY,
  op_latex_id  BIGINT NOT NULL REFERENCES public.ops(id) ON DELETE CASCADE,
  entrega_id   BIGINT NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uma entrega de tecelagem alimenta no máximo UMA OP Látex.
  UNIQUE (entrega_id)
);

CREATE INDEX IF NOT EXISTS op_latex_entregas_op_idx
  ON public.op_latex_entregas(op_latex_id);

-- Backfill a partir do vínculo legado ops.origem_entrega_id.
INSERT INTO public.op_latex_entregas (op_latex_id, entrega_id)
SELECT o.id, o.origem_entrega_id
  FROM public.ops o
 WHERE o.tipo = 'latex'
   AND o.origem_entrega_id IS NOT NULL
ON CONFLICT (entrega_id) DO NOTHING;

-- RLS: espelha o acesso de ops (admin gerencia; leitura pelo fornecedor
-- se as políticas de ops permitirem). Mantém-se admin-only por segurança;
-- a geração/consolidação acontece via RPC SECURITY DEFINER.
ALTER TABLE public.op_latex_entregas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS op_latex_entregas_admin ON public.op_latex_entregas;
CREATE POLICY op_latex_entregas_admin ON public.op_latex_entregas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS op_latex_entregas_read ON public.op_latex_entregas;
CREATE POLICY op_latex_entregas_read ON public.op_latex_entregas
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Reconciliação de duplicatas existentes (antes do índice único)
--    Mantém a OP mais antiga (menor id) como canônica; acumula
--    op_itens das redundantes por modelo; move provenance para a
--    canônica; remove a redundante. HARD-STOP se houver downstream.
-- ============================================================
DO $$
DECLARE
  g          RECORD;
  v_canon    BIGINT;
  v_red      BIGINT;
  ri         RECORD;
BEGIN
  FOR g IN
    SELECT o.origem_op_id, o.destino_fornecedor_id,
           array_agg(o.id ORDER BY o.id) AS op_ids
      FROM public.ops o
     WHERE o.tipo = 'latex'
       AND o.origem_op_id IS NOT NULL
       AND o.destino_fornecedor_id IS NOT NULL
     GROUP BY o.origem_op_id, o.destino_fornecedor_id
    HAVING count(*) > 1
  LOOP
    -- Guardas de segurança: nenhum downstream nas OPs do grupo.
    IF EXISTS (SELECT 1 FROM public.ops o
                WHERE o.id = ANY(g.op_ids) AND o.status <> 'aberta') THEN
      RAISE EXCEPTION 'Consolidacao abortada: grupo origem_op=% destino=% possui OP nao-aberta (downstream). Reconciliar manualmente.',
        g.origem_op_id, g.destino_fornecedor_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.entrega_itens ei
                 JOIN public.entregas e ON e.id = ei.entrega_id
                WHERE ei.op_id = ANY(g.op_ids) AND e.etapa = 'latex') THEN
      RAISE EXCEPTION 'Consolidacao abortada: grupo origem_op=% destino=% possui recebimento latex. Reconciliar manualmente.',
        g.origem_op_id, g.destino_fornecedor_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.expedicoes x
                WHERE x.op_latex_id = ANY(g.op_ids)) THEN
      RAISE EXCEPTION 'Consolidacao abortada: grupo origem_op=% destino=% possui expedicao. Reconciliar manualmente.',
        g.origem_op_id, g.destino_fornecedor_id;
    END IF;

    v_canon := g.op_ids[1]; -- menor id = OP mais antiga = canônica

    -- Acumula op_itens de cada redundante na canônica (upsert por modelo).
    FOREACH v_red IN ARRAY g.op_ids[2:array_length(g.op_ids, 1)] LOOP
      FOR ri IN
        SELECT modelo_id, metros_pedidos, pedido_item_id
          FROM public.op_itens WHERE op_id = v_red
      LOOP
        UPDATE public.op_itens c
           SET metros_pedidos = c.metros_pedidos + ri.metros_pedidos
         WHERE c.op_id = v_canon
           AND c.modelo_id = ri.modelo_id
           AND c.pedido_item_id IS NOT DISTINCT FROM ri.pedido_item_id;
        IF NOT FOUND THEN
          INSERT INTO public.op_itens (op_id, modelo_id, metros_pedidos, pedido_item_id)
          VALUES (v_canon, ri.modelo_id, ri.metros_pedidos, ri.pedido_item_id);
        END IF;
      END LOOP;

      -- Move provenance (entregas vinculadas) para a canônica antes do delete.
      UPDATE public.op_latex_entregas
         SET op_latex_id = v_canon
       WHERE op_latex_id = v_red;

      -- Remove a OP redundante (cascata: op_itens/op_fornecedores restantes).
      DELETE FROM public.ops WHERE id = v_red;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 4. Índice: substitui o antigo (1 OP por entrega) pelo consolidado
-- ============================================================
DROP INDEX IF EXISTS public.ops_origem_entrega_latex_uidx;
DROP INDEX IF EXISTS public.ops_latex_origem_destino_uidx;
CREATE UNIQUE INDEX ops_latex_origem_destino_uidx
  ON public.ops (origem_op_id, destino_fornecedor_id)
  WHERE tipo = 'latex';

-- ============================================================
-- 5. gerar_op_latex — find-or-accumulate
--    - Idempotência por entrega: se a entrega já está vinculada
--      (op_latex_entregas), retorna a OP existente sem reacumular.
--    - Chave da OP: (origem_op_id, destino_fornecedor_id).
--    - Acumula op_itens por modelo (upsert), sem apagar linhas
--      existentes (op_itens é referenciado por expedicao_itens).
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_op_latex(p_entrega_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega       public.entregas%ROWTYPE;
  v_op_id         BIGINT;
  v_lote_id       BIGINT;
  v_destino       BIGINT;
  v_ano           INTEGER;
  v_numero        INTEGER;
  v_latex_op_id   BIGINT;
  v_existing      BIGINT;
  ei              RECORD;
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

  -- Idempotência por entrega: já vinculada => já consolidada.
  SELECT op_latex_id INTO v_existing
    FROM public.op_latex_entregas WHERE entrega_id = p_entrega_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- OP de produção (tecelagem) de origem.
  SELECT op_id INTO v_op_id
    FROM public.entrega_itens WHERE entrega_id = p_entrega_id LIMIT 1;
  IF v_op_id IS NULL THEN
    RETURN NULL; -- entrega sem itens
  END IF;

  -- Sem metros sem defeito => nada a consolidar.
  IF NOT EXISTS (
    SELECT 1 FROM public.entrega_itens
     WHERE entrega_id = p_entrega_id AND defeito = FALSE AND metros_entregues > 0
  ) THEN
    RETURN NULL;
  END IF;

  -- Chave de consolidação: (origem_op_id, destino_fornecedor_id).
  SELECT id INTO v_latex_op_id
    FROM public.ops
   WHERE tipo = 'latex'
     AND origem_op_id = v_op_id
     AND destino_fornecedor_id = v_destino;

  IF v_latex_op_id IS NULL THEN
    -- Cria a OP Látex consolidada (nasce aberta — aguardando entrada).
    SELECT lote_id INTO v_lote_id FROM public.ops WHERE id = v_op_id;
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
      FROM public.ops WHERE tipo = 'latex' AND ano = v_ano;

    INSERT INTO public.ops
      (numero, ano, status, tipo, origem_op_id, origem_entrega_id, lote_id, destino_fornecedor_id, observacao)
    VALUES (
      v_numero, v_ano, 'aberta', 'latex', v_op_id, p_entrega_id, v_lote_id, v_destino,
      'Consolidada da OP ' || (SELECT numero || '/' || ano FROM public.ops WHERE id = v_op_id)
        || ' (tecelagem) para o acabamento'
    )
    RETURNING id INTO v_latex_op_id;

    INSERT INTO public.op_fornecedores (op_id, fornecedor_id, etapa)
    VALUES (v_latex_op_id, v_destino, 'latex')
    ON CONFLICT (op_id, fornecedor_id, etapa) DO NOTHING;
  END IF;

  -- Vincula a entrega à OP Látex (N:1).
  INSERT INTO public.op_latex_entregas (op_latex_id, entrega_id)
  VALUES (v_latex_op_id, p_entrega_id)
  ON CONFLICT (entrega_id) DO NOTHING;

  -- Acumula op_itens por modelo (upsert incremental; nunca apaga linhas).
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

  RETURN v_latex_op_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_op_latex(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.gerar_op_latex(BIGINT) IS
  'Cria ou REUTILIZA a OP de Acabamento/Latex consolidada por '
  '(origem_op_id, destino_fornecedor_id). Vincula a entrega em '
  'op_latex_entregas e acumula op_itens por modelo. Idempotente por entrega.';

-- ============================================================
-- 6. Guards: passam a reconhecer entregas consolidadas via
--    op_latex_entregas (não apenas a 1ª entrega por origem_entrega_id).
--    Substitui as funções de db/24 (triggers permanecem os mesmos).
-- ============================================================
CREATE OR REPLACE FUNCTION public.entrega_cima_latex_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.etapa = 'cima'
     AND EXISTS (
       SELECT 1 FROM public.op_latex_entregas ole WHERE ole.entrega_id = OLD.id
     )
     AND current_setting('app.retificacao_autorizada', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Entrega de tecelagem vinculada a OP de acabamento não pode ser alterada/excluída sem retificação autorizada.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.entrega_itens_cima_latex_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entrega_id BIGINT;
BEGIN
  v_entrega_id := COALESCE(NEW.entrega_id, OLD.entrega_id);
  IF v_entrega_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.op_latex_entregas ole WHERE ole.entrega_id = v_entrega_id
     )
     AND current_setting('app.retificacao_autorizada', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Itens de entrega de tecelagem vinculada a OP de acabamento não podem ser alterados sem retificação autorizada.';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
