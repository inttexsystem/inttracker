-- ============================================================
-- Fase 6 — Cliente, Lote, fios sob demanda
-- Idempotente: pode rodar várias vezes.
-- ============================================================

-- 1) Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Lotes (numero sequencial global + cliente)
CREATE TABLE IF NOT EXISTS lotes (
  id BIGSERIAL PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) OP aponta pro lote (nullable; OPs antigas ficam sem lote)
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS lote_id BIGINT REFERENCES lotes(id) ON DELETE SET NULL;

-- 4) Ordem de fio pode nascer sem fornecedor
ALTER TABLE ordens_compra_fio ALTER COLUMN fornecedor_id DROP NOT NULL;

-- 5) RLS admin-only para clientes e lotes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clientes_admin ON clientes;
CREATE POLICY clientes_admin ON clientes FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS lotes_admin ON lotes;
CREATE POLICY lotes_admin ON lotes FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 6) gerar_op_latex: OP de látex herda o lote_id da OP de origem
CREATE OR REPLACE FUNCTION gerar_op_latex(p_entrega_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega       entregas%ROWTYPE;
  v_op_id         BIGINT;
  v_lote_id       BIGINT;
  v_ano           INTEGER;
  v_numero        INTEGER;
  v_latex_op_id   BIGINT;
BEGIN
  SELECT * INTO v_entrega FROM entregas WHERE id = p_entrega_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega % não encontrada', p_entrega_id;
  END IF;

  IF v_entrega.etapa <> 'cima' THEN
    RAISE EXCEPTION 'Entrega % não é de tecelagem (etapa=%)', p_entrega_id, v_entrega.etapa;
  END IF;

  IF NOT (is_admin() OR v_entrega.fornecedor_id = meu_fornecedor_id()) THEN
    RAISE EXCEPTION 'Sem permissão para gerar OP de látex da entrega %', p_entrega_id;
  END IF;

  IF v_entrega.destino_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'Entrega % sem destino de látex', p_entrega_id;
  END IF;

  SELECT id INTO v_latex_op_id FROM ops
    WHERE tipo = 'latex' AND origem_entrega_id = p_entrega_id;
  IF v_latex_op_id IS NOT NULL THEN
    RETURN v_latex_op_id;
  END IF;

  SELECT op_id INTO v_op_id FROM entrega_itens WHERE entrega_id = p_entrega_id LIMIT 1;
  IF v_op_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM entrega_itens
    WHERE entrega_id = p_entrega_id AND defeito = FALSE AND metros_entregues > 0
  ) THEN
    RETURN NULL;
  END IF;

  SELECT lote_id INTO v_lote_id FROM ops WHERE id = v_op_id;

  v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
    FROM ops WHERE tipo = 'latex' AND ano = v_ano;

  INSERT INTO ops (numero, ano, status, tipo, origem_op_id, origem_entrega_id, lote_id, observacao)
  VALUES (
    v_numero, v_ano, 'em_producao', 'latex', v_op_id, p_entrega_id, v_lote_id,
    'Gerada da entrega de ' || to_char(v_entrega.data, 'DD/MM/YYYY')
      || ' da OP ' || (SELECT numero || '/' || ano FROM ops WHERE id = v_op_id) || ' (tecelagem)'
  )
  RETURNING id INTO v_latex_op_id;

  INSERT INTO op_itens (op_id, modelo_id, metros_pedidos)
  SELECT v_latex_op_id, oi.modelo_id, SUM(ei.metros_entregues)
  FROM entrega_itens ei
  JOIN op_itens oi ON oi.id = ei.op_item_id
  WHERE ei.entrega_id = p_entrega_id AND ei.defeito = FALSE AND ei.metros_entregues > 0
  GROUP BY oi.modelo_id;

  INSERT INTO op_fornecedores (op_id, fornecedor_id, etapa)
  VALUES (v_latex_op_id, v_entrega.destino_fornecedor_id, 'latex')
  ON CONFLICT (op_id, fornecedor_id, etapa) DO NOTHING;

  RETURN v_latex_op_id;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_op_latex(BIGINT) TO authenticated;
