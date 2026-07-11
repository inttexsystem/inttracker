-- ============================================================
-- Fase: G25-B2-A-R3-R2-B1 -- Direct CNPJ schema expand
--
-- Expansao aditiva para o cutover posterior da interface.
-- Nao le, grava, remove ou altera objetos do modelo Parceiros.
-- ============================================================

BEGIN;

-- Validacao pura e neutra: CNPJ canonico com 14 digitos, sem pontuacao,
-- sequencia repetida ou digitos verificadores invalidos.
CREATE OR REPLACE FUNCTION public.is_valid_entity_cnpj(p_cnpj TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  v_cnpj TEXT := p_cnpj;
  v_pesos_primeiro INTEGER[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  v_pesos_segundo  INTEGER[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_soma INTEGER := 0;
  v_resto INTEGER;
  v_digito INTEGER;
  v_indice INTEGER;
BEGIN
  IF v_cnpj IS NULL OR v_cnpj !~ '^[0-9]{14}$' THEN
    RETURN FALSE;
  END IF;

  IF v_cnpj = repeat(left(v_cnpj, 1), 14) THEN
    RETURN FALSE;
  END IF;

  FOR v_indice IN 1..12 LOOP
    v_soma := v_soma + substr(v_cnpj, v_indice, 1)::INTEGER * v_pesos_primeiro[v_indice];
  END LOOP;
  v_resto := v_soma % 11;
  v_digito := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
  IF v_digito <> substr(v_cnpj, 13, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  v_soma := 0;
  FOR v_indice IN 1..13 LOOP
    v_soma := v_soma + substr(v_cnpj, v_indice, 1)::INTEGER * v_pesos_segundo[v_indice];
  END LOOP;
  v_resto := v_soma % 11;
  v_digito := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;

  RETURN v_digito = substr(v_cnpj, 14, 1)::INTEGER;
END;
$$;

COMMENT ON FUNCTION public.is_valid_entity_cnpj(TEXT) IS
  'Valida CNPJ canonico de Cliente ou Fornecedor: 14 digitos sem pontuacao, DV valido e sem sequencia repetida.';

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cnpj TEXT;

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS cnpj TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clientes_cnpj_valido'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_cnpj_valido
      CHECK (cnpj IS NULL OR public.is_valid_entity_cnpj(cnpj));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fornecedores_cnpj_valido'
      AND conrelid = 'public.fornecedores'::regclass
  ) THEN
    ALTER TABLE public.fornecedores
      ADD CONSTRAINT fornecedores_cnpj_valido
      CHECK (cnpj IS NULL OR public.is_valid_entity_cnpj(cnpj));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_cnpj_uidx
  ON public.clientes (cnpj)
  WHERE cnpj IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_cnpj_uidx
  ON public.fornecedores (cnpj)
  WHERE cnpj IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
