-- ============================================================
-- Fase: RAVATEX-TAPETES-TEC_TO_ACABAMENTO-FLOW-CONTRACT-C-B
-- Guard server-side: uma entrega de Tecelagem (etapa='cima') que já
-- gerou OP de Acabamento/Látex (ops.origem_entrega_id) não pode ser
-- alterada/excluída diretamente no banco sem retificação autorizada.
--
-- Pré-condição (D-C-A validada em staging):
--   latex_orfas = 0, cima_com_latex = 2, cima_sem_latex = 0, divergências = 0
--
-- Alternativa C (combinação): trigger em `entregas` + trigger em
-- `entrega_itens`. Escape via GUC de sessão
-- `app.retificacao_autorizada = 'on'` para retificação futura (D-C-D).
--
-- Idempotente: DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION.
-- Não altera dados, não dropa tabelas, não mexe em gerar_op_latex,
-- não altera ops.status.
-- ============================================================

-- ============================================================
-- 1. Função + Trigger para `entregas`
-- ============================================================

CREATE OR REPLACE FUNCTION public.entrega_cima_latex_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só aplica a entregas de tecelagem (etapa='cima'). Entregas latex
  -- (recebimento de acabamento) não geram OP Látex downstream e
  -- continuam editáveis.
  IF OLD.etapa = 'cima'
     AND EXISTS (
       SELECT 1
       FROM public.ops o
       WHERE o.tipo = 'latex'
         AND o.origem_entrega_id = OLD.id
     )
     AND current_setting('app.retificacao_autorizada', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Entrega de tecelagem vinculada a OP de acabamento não pode ser alterada/excluída sem retificação autorizada.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entrega_cima_latex_guard ON public.entregas;
CREATE TRIGGER entrega_cima_latex_guard
  BEFORE UPDATE OR DELETE ON public.entregas
  FOR EACH ROW
  EXECUTE FUNCTION public.entrega_cima_latex_guard_fn();


-- ============================================================
-- 2. Função + Trigger para `entrega_itens`
-- ============================================================

CREATE OR REPLACE FUNCTION public.entrega_itens_cima_latex_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entrega_id BIGINT;
BEGIN
  -- Identifica a entrega afetada: NEW no INSERT/UPDATE, OLD no DELETE.
  v_entrega_id := COALESCE(NEW.entrega_id, OLD.entrega_id);

  -- A existência de OP Látex com origem_entrega_id já implica que a
  -- entrega é 'cima' (gerar_op_latex exige etapa='cima'), então não
  -- precisamos checar etapa aqui — a op_latex vinculada é suficiente.
  IF v_entrega_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.ops o
       WHERE o.tipo = 'latex'
         AND o.origem_entrega_id = v_entrega_id
     )
     AND current_setting('app.retificacao_autorizada', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Itens de entrega de tecelagem vinculada a OP de acabamento não podem ser alterados sem retificação autorizada.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entrega_itens_cima_latex_guard ON public.entrega_itens;
CREATE TRIGGER entrega_itens_cima_latex_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.entrega_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.entrega_itens_cima_latex_guard_fn();


-- ============================================================
-- 3. Reload PostgREST
-- ============================================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
