-- ============================================================
-- Fase: G25-B2-A-R3-R2-B3 -- Remove legacy partner CNPJ schema
--
-- Remove o modelo Parceiros rejeitado (migration 44), mantendo
-- as colunas CNPJ diretas em Cliente e Fornecedor (migration 45).
--
-- Sem CASCADE indiscriminado.
-- Cada remocao e explicita e baseada no inventario do preflight.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Guard validations: abort if any legacy data exists
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.parceiros;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: public.parceiros contem % registros. Remocao bloqueada.', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.parceiro_cnpjs;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: public.parceiro_cnpjs contem % registros. Remocao bloqueada.', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.clientes WHERE parceiro_id IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: clientes contem % registros com parceiro_id. Remocao bloqueada.', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.fornecedores WHERE parceiro_id IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ABORT: fornecedores contem % registros com parceiro_id. Remocao bloqueada.', v_count;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 2. Drop triggers (BEFORE UPDATE on parceiros and parceiro_cnpjs)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS parceiros_touch_updated_at ON public.parceiros;
DROP TRIGGER IF EXISTS parceiro_cnpjs_touch_updated_at ON public.parceiro_cnpjs;

-- ------------------------------------------------------------
-- 3. Drop trigger functions
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.touch_parceiros_updated_at();
DROP FUNCTION IF EXISTS public.touch_parceiro_cnpjs_updated_at();

-- ------------------------------------------------------------
-- 4. Drop RLS policies (admin-only on parceiros and parceiro_cnpjs)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS parceiros_admin ON public.parceiros;
DROP POLICY IF EXISTS parceiro_cnpjs_admin ON public.parceiro_cnpjs;

-- ------------------------------------------------------------
-- 5. Drop CHECK constraint on parceiro_cnpjs (used is_valid_cnpj)
-- ------------------------------------------------------------
ALTER TABLE public.parceiro_cnpjs
  DROP CONSTRAINT IF EXISTS parceiro_cnpjs_cnpj_valido;

-- ------------------------------------------------------------
-- 6. Drop indexes on clientes.parceiro_id and fornecedores.parceiro_id
-- ------------------------------------------------------------
DROP INDEX IF EXISTS public.fornecedores_parceiro_id_idx;
DROP INDEX IF EXISTS public.clientes_parceiro_id_idx;

-- ------------------------------------------------------------
-- 7. Drop FK constraints from entities to parceiros
-- ------------------------------------------------------------
ALTER TABLE public.fornecedores
  DROP CONSTRAINT IF EXISTS fornecedores_parceiro_id_fkey;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_parceiro_id_fkey;

-- ------------------------------------------------------------
-- 8. Drop partner_id columns from entities
-- ------------------------------------------------------------
ALTER TABLE public.fornecedores
  DROP COLUMN IF EXISTS parceiro_id;

ALTER TABLE public.clientes
  DROP COLUMN IF EXISTS parceiro_id;

-- ------------------------------------------------------------
-- 9. Drop table parceiro_cnpjs
--    (also drops its PK, FK to parceiros, indexes, RLS, and sequence)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.parceiro_cnpjs;

-- ------------------------------------------------------------
-- 10. Drop table parceiros
--     (also drops its PK, indexes, RLS, and sequence)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.parceiros;

-- ------------------------------------------------------------
-- 11. Drop function is_valid_cnpj (migration 44)
--     Only object using it was the CHECK constraint already dropped.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_valid_cnpj(TEXT);

-- ------------------------------------------------------------
-- 12. Reload PostgREST schema cache
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
