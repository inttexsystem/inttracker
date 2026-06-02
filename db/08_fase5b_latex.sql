-- ============================================================
-- Fase 5b — OP de Látex (recebimento do produto final)
-- Idempotente: pode rodar várias vezes.
-- ============================================================

-- 1) Tipo da OP: 'tecelagem' (produção, padrão) ou 'latex'.
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'tecelagem';
ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_tipo_chk;
ALTER TABLE ops
  ADD CONSTRAINT ops_tipo_chk CHECK (tipo IN ('tecelagem','latex'));

-- 2) Vínculos de origem (preenchidos só nas OPs de látex).
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS origem_op_id BIGINT REFERENCES ops(id) ON DELETE SET NULL;
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS origem_entrega_id BIGINT REFERENCES entregas(id) ON DELETE SET NULL;

-- 3) Observação livre / texto automático de origem.
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS observacao TEXT;

-- 4) Numeração independente por tipo (substitui UNIQUE(numero, ano)).
-- Dropa qualquer UNIQUE de 2 colunas sobre {numero, ano}, independente do nome
-- auto-gerado (defensivo: o nome pode variar entre ambientes).
DO $$
DECLARE
  v_conname TEXT;
  v_numero_attnum SMALLINT := (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ops'::regclass AND attname = 'numero');
  v_ano_attnum    SMALLINT := (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ops'::regclass AND attname = 'ano');
BEGIN
  FOR v_conname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ops'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
      AND conkey @> ARRAY[v_numero_attnum, v_ano_attnum]
      AND conkey <@ ARRAY[v_numero_attnum, v_ano_attnum]
  LOOP
    EXECUTE format('ALTER TABLE ops DROP CONSTRAINT %I', v_conname);
  END LOOP;
END $$;

ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_numero_ano_tipo_key;
ALTER TABLE ops
  ADD CONSTRAINT ops_numero_ano_tipo_key UNIQUE (numero, ano, tipo);

-- 5) Idempotência: uma entrega de tecelagem gera no máximo uma OP de látex.
DROP INDEX IF EXISTS ops_origem_entrega_latex_uidx;
CREATE UNIQUE INDEX ops_origem_entrega_latex_uidx
  ON ops (origem_entrega_id) WHERE tipo = 'latex';

-- ============================================================
-- Função: gera a OP de látex a partir de uma entrega de tecelagem.
-- SECURITY DEFINER: cria ops/op_itens/op_fornecedores com privilégio,
-- mas valida que o chamador é o fornecedor dono da entrega ou admin.
-- Retorna o id da OP de látex (nova ou já existente). NULL se nada a enviar.
-- ============================================================
CREATE OR REPLACE FUNCTION gerar_op_latex(p_entrega_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega       entregas%ROWTYPE;
  v_op_id         BIGINT;
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

  -- Autorização: admin ou o próprio fornecedor da entrega.
  IF NOT (is_admin() OR v_entrega.fornecedor_id = meu_fornecedor_id()) THEN
    RAISE EXCEPTION 'Sem permissão para gerar OP de látex da entrega %', p_entrega_id;
  END IF;

  IF v_entrega.destino_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'Entrega % sem destino de látex', p_entrega_id;
  END IF;

  -- Idempotência: já existe OP de látex para esta entrega?
  SELECT id INTO v_latex_op_id FROM ops
    WHERE tipo = 'latex' AND origem_entrega_id = p_entrega_id;
  IF v_latex_op_id IS NOT NULL THEN
    RETURN v_latex_op_id;
  END IF;

  -- OP de produção de origem (todas as linhas da entrega são da mesma OP).
  SELECT op_id INTO v_op_id FROM entrega_itens WHERE entrega_id = p_entrega_id LIMIT 1;
  IF v_op_id IS NULL THEN
    RETURN NULL;  -- entrega sem itens
  END IF;

  -- Se não há metros sem defeito, não cria OP de látex.
  IF NOT EXISTS (
    SELECT 1 FROM entrega_itens
    WHERE entrega_id = p_entrega_id AND defeito = FALSE AND metros_entregues > 0
  ) THEN
    RETURN NULL;
  END IF;

  v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
    FROM ops WHERE tipo = 'latex' AND ano = v_ano;

  INSERT INTO ops (numero, ano, status, tipo, origem_op_id, origem_entrega_id, observacao)
  VALUES (
    v_numero, v_ano, 'em_producao', 'latex', v_op_id, p_entrega_id,
    'Gerada da entrega de ' || to_char(v_entrega.data, 'DD/MM/YYYY')
      || ' da OP ' || (SELECT numero || '/' || ano FROM ops WHERE id = v_op_id) || ' (tecelagem)'
  )
  RETURNING id INTO v_latex_op_id;

  -- Enviado por modelo (soma sem defeito), via join entrega_itens -> op_itens.
  INSERT INTO op_itens (op_id, modelo_id, metros_pedidos)
  SELECT v_latex_op_id, oi.modelo_id, SUM(ei.metros_entregues)
  FROM entrega_itens ei
  JOIN op_itens oi ON oi.id = ei.op_item_id
  WHERE ei.entrega_id = p_entrega_id AND ei.defeito = FALSE AND ei.metros_entregues > 0
  GROUP BY oi.modelo_id;

  -- Empresa de látex dona da OP de látex.
  INSERT INTO op_fornecedores (op_id, fornecedor_id, etapa)
  VALUES (v_latex_op_id, v_entrega.destino_fornecedor_id, 'latex')
  ON CONFLICT (op_id, fornecedor_id, etapa) DO NOTHING;

  RETURN v_latex_op_id;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_op_latex(BIGINT) TO authenticated;
