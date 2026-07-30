-- =====================================================================
-- db/98_ordem_compra_identidade_completa_com_codigo.sql
-- OC-OPERATOR-CODE-AND-DELETION-R1 (correcao forward) — a completude da
-- identidade passa a reconhecer o codigo escolhido pelo operador.
--
-- DEFEITO CORRIGIDO
--   db/95 criou `ordem_compra_identidade_completa_chk` exigindo que o
--   quarteto (identidade_pedido_id, _numero, _ano, _seq) estivesse
--   INTEIRAMENTE nulo ou INTEIRAMENTE preenchido. Aquilo era correto quando o
--   sistema era o unico a nomear a ordem: sem sequencia nao havia nome.
--
--   db/96 mudou a regra de produto — o operador escolhe o codigo e a
--   sequencia automatica so e consumida quando ele NAO escolhe. Uma ordem
--   nomeada pelo operador tem linhagem completa e `identidade_seq` NULL, que
--   a constraint antiga recusava. O INSERT falhava dentro de
--   definir_alocacao_necessidade_compra_fio com 23514, ou seja: com db/96
--   aplicado era IMPOSSIVEL criar uma ordem com codigo escolhido.
--
--   Detectado na jornada de validacao contra producao, executada dentro de
--   uma transacao com rollback — nenhuma linha comercial foi tocada. O ensaio
--   em cluster descartavel nao pegou porque o fixture reproduziu as colunas e
--   os triggers, mas nao esta CHECK constraint.
--
-- REGRA NOVA
--   A LINHAGEM continua all-or-nothing: identificar o Pedido pela metade
--   seria uma identidade mentirosa. O que deixa de ser obrigatorio e apenas a
--   SEQUENCIA, e somente quando existe `codigo` — porque nesse caso o nome de
--   negocio ja existe e nao depende dela.
--
-- Forward-only; db/01..db/97 sao intocados. O guard terminal avanca 97 -> 98
-- no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
-- =====================================================================

BEGIN;

ALTER TABLE public.ordem_compra
  DROP CONSTRAINT IF EXISTS ordem_compra_identidade_completa_chk;

ALTER TABLE public.ordem_compra
  ADD CONSTRAINT ordem_compra_identidade_completa_chk CHECK (
    (identidade_pedido_id IS NULL
      AND identidade_pedido_numero IS NULL
      AND identidade_pedido_ano IS NULL
      AND identidade_seq IS NULL)
    OR
    (identidade_pedido_id IS NOT NULL
      AND identidade_pedido_numero IS NOT NULL
      AND identidade_pedido_ano IS NOT NULL
      AND (identidade_seq IS NOT NULL OR codigo IS NOT NULL))
  );

COMMENT ON CONSTRAINT ordem_compra_identidade_completa_chk ON public.ordem_compra IS
  'db/95 + db/98: a linhagem do Pedido continua all-or-nothing; identidade_seq so e exigida quando a ordem NAO tem codigo escolhido pelo operador, porque nesse caso a sequencia e a unica origem do nome de negocio.';

-- Invariante: toda ordem viva continua com um nome de negocio resolvivel.
DO $inv$
DECLARE v_sem_nome INT;
BEGIN
  SELECT count(*) INTO v_sem_nome FROM public.ordem_compra
  WHERE pedido_id IS NOT NULL AND identidade_operacional IS NULL;
  IF v_sem_nome > 0 THEN
    RAISE EXCEPTION 'db/98 abortada: % ordem(ns) sem identidade_operacional', v_sem_nome;
  END IF;
END
$inv$;

COMMIT;
