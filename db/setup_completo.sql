-- ============================================================
-- SETUP COMPLETO — Controle de Tapetes
-- Rode este arquivo INTEIRO em uma única query no SQL Editor.
-- Faz tudo: schema + funções + RLS + GRANTs + seed.
-- Idempotente: pode rodar de novo se precisar.
-- ============================================================

-- ----------------------------------------------------------
-- PARTE 1 — Limpa tudo (caso já exista)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS saldo_fios_op CASCADE;
DROP TABLE IF EXISTS saldo_fios CASCADE;
DROP TABLE IF EXISTS entrega_itens CASCADE;
DROP TABLE IF EXISTS entregas CASCADE;
DROP TABLE IF EXISTS ordens_compra_fio CASCADE;
DROP TABLE IF EXISTS op_fornecedores CASCADE;
DROP TABLE IF EXISTS op_itens CASCADE;
DROP TABLE IF EXISTS ops CASCADE;
DROP TABLE IF EXISTS precos_terceirizada CASCADE;
DROP TABLE IF EXISTS fornecedores CASCADE;
DROP TABLE IF EXISTS parametros_largura CASCADE;
DROP TABLE IF EXISTS modelos CASCADE;
DROP TABLE IF EXISTS cores CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS meu_fornecedor_id() CASCADE;

-- ----------------------------------------------------------
-- PARTE 2 — Cadastros base
-- ----------------------------------------------------------
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'fornecedor')),
  fornecedor_id BIGINT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE modelos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cor_1_id BIGINT NOT NULL REFERENCES cores(id) ON DELETE RESTRICT,
  cor_2_id BIGINT NOT NULL REFERENCES cores(id) ON DELETE RESTRICT,
  largura NUMERIC(3,2) NOT NULL CHECK (largura IN (1.40, 2.10)),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome, cor_1_id, cor_2_id, largura)
);

CREATE TABLE parametros_largura (
  largura NUMERIC(3,2) PRIMARY KEY CHECK (largura IN (1.40, 2.10)),
  peso_linear NUMERIC(10,4) NOT NULL,
  algodao_por_ml NUMERIC(10,6) NOT NULL,
  poliester_por_ml NUMERIC(10,6) NOT NULL,
  valor_x NUMERIC(10,4) NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fornecedores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fio_algodao', 'fio_poliester', 'tecelagem', 'latex')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome, tipo)
);

ALTER TABLE usuarios ADD CONSTRAINT usuarios_fornecedor_id_fkey
  FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL;

CREATE TABLE precos_terceirizada (
  id BIGSERIAL PRIMARY KEY,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN ('cima', 'latex')),
  largura NUMERIC(3,2) NOT NULL CHECK (largura IN (1.40, 2.10)),
  preco_por_metro NUMERIC(10,2) NOT NULL CHECK (preco_por_metro >= 0),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_id, etapa, largura)
);

-- ----------------------------------------------------------
-- PARTE 3 — Operação (OP)
-- ----------------------------------------------------------
CREATE TABLE ops (
  id BIGSERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'simulada' CHECK (status IN ('simulada','aberta','em_producao','finalizada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizada_em TIMESTAMPTZ,
  UNIQUE (numero, ano)
);

CREATE TABLE op_itens (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  modelo_id BIGINT NOT NULL REFERENCES modelos(id) ON DELETE RESTRICT,
  metros_pedidos NUMERIC(10,2) NOT NULL CHECK (metros_pedidos > 0),
  metros_ajustados NUMERIC(10,2),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE op_fornecedores (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  etapa TEXT NOT NULL CHECK (etapa IN ('fio_algodao','fio_poliester','cima','latex')),
  UNIQUE (op_id, fornecedor_id, etapa)
);

CREATE INDEX op_fornecedores_fornecedor_idx ON op_fornecedores(fornecedor_id);

-- ----------------------------------------------------------
-- PARTE 4 — Compra e recebimento de fios
-- ----------------------------------------------------------
CREATE TABLE ordens_compra_fio (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('algodao','poliester')),
  cor_id BIGINT REFERENCES cores(id),
  cor_poliester TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),
  kg_pedido NUMERIC(10,3) NOT NULL CHECK (kg_pedido > 0),
  kg_recebido NUMERIC(10,3),
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  data_recebimento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','recebido_parcial','recebido_total')),
  CHECK (
    (tipo = 'algodao' AND cor_id IS NOT NULL AND cor_poliester IS NULL) OR
    (tipo = 'poliester' AND cor_poliester IS NOT NULL AND cor_id IS NULL)
  )
);

CREATE INDEX ordens_compra_fio_fornecedor_idx ON ordens_compra_fio(fornecedor_id);
CREATE INDEX ordens_compra_fio_op_idx ON ordens_compra_fio(op_id);

-- ----------------------------------------------------------
-- PARTE 5 — Entregas
-- ----------------------------------------------------------
CREATE TABLE entregas (
  id BIGSERIAL PRIMARY KEY,
  fornecedor_id BIGINT NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  etapa TEXT NOT NULL CHECK (etapa IN ('cima','latex')),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX entregas_fornecedor_idx ON entregas(fornecedor_id);

CREATE TABLE entrega_itens (
  id BIGSERIAL PRIMARY KEY,
  entrega_id BIGINT NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE RESTRICT,
  op_item_id BIGINT REFERENCES op_itens(id) ON DELETE RESTRICT,
  modelo_id BIGINT REFERENCES modelos(id) ON DELETE RESTRICT,
  metros_entregues NUMERIC(10,2) NOT NULL CHECK (metros_entregues > 0),
  defeito BOOLEAN NOT NULL DEFAULT FALSE,
  observacao TEXT,
  CHECK (op_item_id IS NOT NULL OR modelo_id IS NOT NULL)
);

CREATE INDEX entrega_itens_op_idx ON entrega_itens(op_id);

-- ----------------------------------------------------------
-- PARTE 6 — Saldos
-- ----------------------------------------------------------
CREATE TABLE saldo_fios (
  id BIGSERIAL PRIMARY KEY,
  cor_id BIGINT REFERENCES cores(id),
  cor_poliester TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),
  tipo TEXT NOT NULL CHECK (tipo IN ('algodao','poliester')),
  kg_total NUMERIC(10,3) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'algodao' AND cor_id IS NOT NULL AND cor_poliester IS NULL) OR
    (tipo = 'poliester' AND cor_poliester IS NOT NULL AND cor_id IS NULL)
  ),
  UNIQUE (cor_id, cor_poliester, tipo)
);

CREATE TABLE saldo_fios_op (
  id BIGSERIAL PRIMARY KEY,
  op_id BIGINT NOT NULL REFERENCES ops(id) ON DELETE CASCADE,
  cor_id BIGINT REFERENCES cores(id),
  cor_poliester TEXT CHECK (cor_poliester IN ('PRETO','BRANCO')),
  tipo TEXT NOT NULL CHECK (tipo IN ('algodao','poliester')),
  kg_sobra NUMERIC(10,3) NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- PARTE 7 — Funções auxiliares (resilientes)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  SELECT tipo INTO v_tipo FROM public.usuarios WHERE id = auth.uid();
  RETURN COALESCE(v_tipo = 'admin', FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.meu_fornecedor_id()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  SELECT fornecedor_id INTO v_id FROM public.usuarios WHERE id = auth.uid();
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------
-- PARTE 8 — GRANTs explícitos
-- ----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meu_fornecedor_id() TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;

-- ----------------------------------------------------------
-- PARTE 9 — RLS
-- ----------------------------------------------------------
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cores ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_largura ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE precos_terceirizada ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_compra_fio ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldo_fios ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldo_fios_op ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuarios_select ON usuarios FOR SELECT
  USING (id = auth.uid() OR is_admin());
CREATE POLICY usuarios_admin_all ON usuarios FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY cores_admin ON cores FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY cores_read ON cores FOR SELECT USING (true);

CREATE POLICY modelos_admin ON modelos FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY modelos_read ON modelos FOR SELECT USING (true);

CREATE POLICY parametros_admin ON parametros_largura FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY fornecedores_admin ON fornecedores FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY fornecedores_self ON fornecedores FOR SELECT USING (id = meu_fornecedor_id());

CREATE POLICY precos_admin ON precos_terceirizada FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY ops_admin ON ops FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY ops_fornecedor_read ON ops FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM op_fornecedores
    WHERE op_fornecedores.op_id = ops.id
      AND op_fornecedores.fornecedor_id = meu_fornecedor_id()
  ));

CREATE POLICY op_itens_admin ON op_itens FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY op_itens_fornecedor_read ON op_itens FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM op_fornecedores
    WHERE op_fornecedores.op_id = op_itens.op_id
      AND op_fornecedores.fornecedor_id = meu_fornecedor_id()
  ));

CREATE POLICY op_fornecedores_admin ON op_fornecedores FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY op_fornecedores_self_read ON op_fornecedores FOR SELECT
  USING (fornecedor_id = meu_fornecedor_id());

CREATE POLICY ocf_admin ON ordens_compra_fio FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY ocf_fornecedor_read ON ordens_compra_fio FOR SELECT
  USING (fornecedor_id = meu_fornecedor_id());
CREATE POLICY ocf_fornecedor_update ON ordens_compra_fio FOR UPDATE
  USING (fornecedor_id = meu_fornecedor_id())
  WITH CHECK (fornecedor_id = meu_fornecedor_id());

CREATE POLICY entregas_admin ON entregas FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY entregas_fornecedor_read ON entregas FOR SELECT
  USING (fornecedor_id = meu_fornecedor_id());
CREATE POLICY entregas_fornecedor_insert ON entregas FOR INSERT
  WITH CHECK (fornecedor_id = meu_fornecedor_id());

CREATE POLICY entrega_itens_admin ON entrega_itens FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY entrega_itens_fornecedor ON entrega_itens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM entregas
    WHERE entregas.id = entrega_itens.entrega_id
      AND entregas.fornecedor_id = meu_fornecedor_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM entregas
    WHERE entregas.id = entrega_itens.entrega_id
      AND entregas.fornecedor_id = meu_fornecedor_id()
  ));

CREATE POLICY saldo_fios_admin ON saldo_fios FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY saldo_fios_op_admin ON saldo_fios_op FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ----------------------------------------------------------
-- PARTE 10 — Seed de cadastros
-- ----------------------------------------------------------
INSERT INTO cores (nome) VALUES
  ('BRANCO'),
  ('PRETO'),
  ('BEGE');

INSERT INTO fornecedores (nome, tipo) VALUES
  ('Fios Sul Algodão', 'fio_algodao'),
  ('Polifios Brasil',  'fio_poliester'),
  ('Tecelagem Aurora', 'tecelagem'),
  ('Látex Premier',    'latex');

INSERT INTO parametros_largura (largura, peso_linear, algodao_por_ml, poliester_por_ml, valor_x) VALUES
  (1.40, 1.5000, 0.000350, 0.000420, 1.0000),
  (2.10, 2.2500, 0.000525, 0.000630, 1.0000);

INSERT INTO modelos (nome, cor_1_id, cor_2_id, largura) VALUES
  ('Conforto', (SELECT id FROM cores WHERE nome='BRANCO'), (SELECT id FROM cores WHERE nome='PRETO'), 1.40),
  ('Conforto', (SELECT id FROM cores WHERE nome='PRETO'),  (SELECT id FROM cores WHERE nome='BRANCO'), 2.10);

INSERT INTO precos_terceirizada (fornecedor_id, etapa, largura, preco_por_metro) VALUES
  ((SELECT id FROM fornecedores WHERE nome='Tecelagem Aurora'), 'cima', 1.40, 8.50),
  ((SELECT id FROM fornecedores WHERE nome='Tecelagem Aurora'), 'cima', 2.10, 12.00),
  ((SELECT id FROM fornecedores WHERE nome='Látex Premier'),    'latex', 1.40, 4.00),
  ((SELECT id FROM fornecedores WHERE nome='Látex Premier'),    'latex', 2.10, 6.00);

-- ----------------------------------------------------------
-- PARTE 11 — Reload do schema cache
-- ----------------------------------------------------------
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ============================================================
-- FIM. Próximos passos manuais:
--   1. Criar 4 usuários no Authentication > Users
--   2. Inserir os 4 registros em public.usuarios com os UIDs
-- ============================================================
