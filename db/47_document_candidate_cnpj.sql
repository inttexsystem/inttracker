-- ============================================================
-- G25-B2-A-R4-B6-B -- CNPJs documentais observados em candidates.
-- Valores extraidos do documento; nao sao cadastros mestres.
-- ============================================================

BEGIN;

ALTER TABLE public.document_candidates
  ADD COLUMN IF NOT EXISTS cnpj_emitente TEXT;

ALTER TABLE public.document_candidates
  ADD COLUMN IF NOT EXISTS cnpj_destinatario TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_candidates_cnpj_emitente_format_chk'
      AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_cnpj_emitente_format_chk
      CHECK (cnpj_emitente IS NULL OR cnpj_emitente ~ '^[0-9]{14}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_candidates_cnpj_destinatario_format_chk'
      AND conrelid = 'public.document_candidates'::regclass
  ) THEN
    ALTER TABLE public.document_candidates
      ADD CONSTRAINT document_candidates_cnpj_destinatario_format_chk
      CHECK (cnpj_destinatario IS NULL OR cnpj_destinatario ~ '^[0-9]{14}$');
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
