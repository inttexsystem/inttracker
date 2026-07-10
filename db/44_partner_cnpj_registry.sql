-- ============================================================
-- Fase: RAVATEX-DOCUMENTS-G25-B2-A-R2-SHARED-PARTNER-CNPJ-REGISTRY
-- Registro empresarial compartilhado (MODELO C) + CNPJ por estabelecimento.
--
-- Escopo (ADITIVO, nao destrutivo; aplicar SOMENTE em staging nesta fase):
--   - public.parceiros: entidade empresarial compartilhada.
--   - public.parceiro_cnpjs: um ou varios CNPJs/estabelecimentos por parceiro.
--   - public.is_valid_cnpj(text): validacao imutavel (14 digitos + DV; rejeita
--     sequencia repetida e pontuacao). Usada em CHECK.
--   - fornecedores.parceiro_id / clientes.parceiro_id: links aditivos, NULLABLE.
--   - RLS admin-only; timestamps canonicos via trigger BEFORE UPDATE.
--
-- Nao implementado / proibido nesta fase:
--   - preencher CNPJ de qualquer empresa;
--   - vincular fornecedores/clientes existentes automaticamente;
--   - alterar fornecedores/clientes/pedidos/OPs existentes;
--   - producao (bhgifjrfagkzubpyqpew).
--
-- Preservacao: fornecedores.id, clientes.id, fornecedores.tipo, pedidos.cliente_id,
--   lotes.cliente_id, op_fornecedores e todas as FKs atuais permanecem intactos.
--   Apos a migration, todo registro legado tem parceiro_id = NULL.
--
-- Idempotente: pode rodar mais de uma vez sem efeito cumulativo.
-- Sem DELETE destrutivo, sem dados reais, sem secrets.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Validacao de CNPJ (IMMUTABLE, testavel, usavel em CHECK)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_cnpj(p_cnpj TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v   TEXT := p_cnpj;
  w1  INT[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  w2  INT[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s1  INT := 0;
  s2  INT := 0;
  r   INT;
  dv1 INT;
  dv2 INT;
  i   INT;
BEGIN
  IF v IS NULL THEN
    RETURN FALSE;
  END IF;
  -- exatamente 14 digitos, sem pontuacao (formatacao nunca e valor canonico)
  IF v !~ '^[0-9]{14}$' THEN
    RETURN FALSE;
  END IF;
  -- rejeita sequencia repetida (ex.: 00000000000000, 11111111111111)
  IF v = repeat(left(v, 1), 14) THEN
    RETURN FALSE;
  END IF;
  -- primeiro digito verificador
  FOR i IN 1..12 LOOP
    s1 := s1 + substr(v, i, 1)::INT * w1[i];
  END LOOP;
  r := s1 % 11;
  dv1 := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF dv1 <> substr(v, 13, 1)::INT THEN
    RETURN FALSE;
  END IF;
  -- segundo digito verificador
  FOR i IN 1..13 LOOP
    s2 := s2 + substr(v, i, 1)::INT * w2[i];
  END LOOP;
  r := s2 % 11;
  dv2 := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF dv2 <> substr(v, 14, 1)::INT THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.is_valid_cnpj(TEXT) IS
  'Valida CNPJ canonico: exatamente 14 digitos sem pontuacao, rejeita sequencia repetida e digitos verificadores invalidos. IMMUTABLE para uso em CHECK.';

-- ------------------------------------------------------------
-- 2. Entidade empresarial compartilhada (MODELO C)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parceiros (
  id            BIGSERIAL PRIMARY KEY,
  nome          TEXT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Sem UNIQUE(nome): nomes comerciais podem coincidir; a identidade canonica e o CNPJ.

COMMENT ON TABLE public.parceiros IS
  'Entidade empresarial compartilhada (MODELO C). fornecedor/cliente sao papeis operacionais que apontam para o mesmo parceiro. O CNPJ vive em parceiro_cnpjs.';

-- ------------------------------------------------------------
-- 3. CNPJs / estabelecimentos do parceiro
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parceiro_cnpjs (
  id            BIGSERIAL PRIMARY KEY,
  parceiro_id   BIGINT NOT NULL REFERENCES public.parceiros(id) ON DELETE RESTRICT,
  cnpj          TEXT NOT NULL,
  principal     BOOLEAN NOT NULL DEFAULT FALSE,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT parceiro_cnpjs_cnpj_valido CHECK (public.is_valid_cnpj(cnpj))
);

COMMENT ON COLUMN public.parceiro_cnpjs.cnpj IS
  'CNPJ canonico: exatamente 14 digitos, sem pontuacao. A formatacao XX.XXX.XXX/XXXX-XX e apenas exibicao.';

-- Unicidade GLOBAL do CNPJ (todos os estabelecimentos, ativos ou nao).
CREATE UNIQUE INDEX IF NOT EXISTS parceiro_cnpjs_cnpj_uidx
  ON public.parceiro_cnpjs (cnpj);

-- No maximo UM CNPJ principal ativo por parceiro (indice parcial).
CREATE UNIQUE INDEX IF NOT EXISTS parceiro_cnpjs_um_principal_ativo_uidx
  ON public.parceiro_cnpjs (parceiro_id)
  WHERE principal = TRUE AND ativo = TRUE;

CREATE INDEX IF NOT EXISTS parceiro_cnpjs_parceiro_id_idx
  ON public.parceiro_cnpjs (parceiro_id);

-- ------------------------------------------------------------
-- 4. Links ADITIVOS (papeis operacionais -> parceiro)
--    NULLABLE; nao preenchidos automaticamente. Legados ficam NULL.
-- ------------------------------------------------------------
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS parceiro_id BIGINT REFERENCES public.parceiros(id) ON DELETE RESTRICT;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS parceiro_id BIGINT REFERENCES public.parceiros(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS fornecedores_parceiro_id_idx ON public.fornecedores (parceiro_id);
CREATE INDEX IF NOT EXISTS clientes_parceiro_id_idx     ON public.clientes (parceiro_id);

-- ------------------------------------------------------------
-- 5. Timestamps canonicos (atualizado_em via trigger BEFORE UPDATE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_parceiros_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parceiros_touch_updated_at ON public.parceiros;
CREATE TRIGGER parceiros_touch_updated_at
  BEFORE UPDATE ON public.parceiros
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parceiros_updated_at();

CREATE OR REPLACE FUNCTION public.touch_parceiro_cnpjs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parceiro_cnpjs_touch_updated_at ON public.parceiro_cnpjs;
CREATE TRIGGER parceiro_cnpjs_touch_updated_at
  BEFORE UPDATE ON public.parceiro_cnpjs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parceiro_cnpjs_updated_at();

-- ------------------------------------------------------------
-- 6. RLS admin-only (leitura + escrita por admin).
--    Desativacao canonica = ativo=false. FK ON DELETE RESTRICT protege
--    a integridade de registros em uso; delete fisico segue restrito a admin,
--    conforme o padrao de clientes/fornecedores.
-- ------------------------------------------------------------
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parceiros_admin ON public.parceiros;
CREATE POLICY parceiros_admin ON public.parceiros
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.parceiro_cnpjs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parceiro_cnpjs_admin ON public.parceiro_cnpjs;
CREATE POLICY parceiro_cnpjs_admin ON public.parceiro_cnpjs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 7. Reload do schema cache do PostgREST
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
