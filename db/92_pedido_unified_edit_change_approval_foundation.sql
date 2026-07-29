-- =====================================================================
-- db/92_pedido_unified_edit_change_approval_foundation.sql
-- PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1 — fundacao de banco para a
-- edicao unificada de Pedido e para a solicitacao/aprovacao de alteracao
-- pelo Cliente.
--
-- Order: PEDIDO-UNIFIED-EDIT-CHANGE-APPROVAL-SCHEMA-R1.
-- Contract shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md,
--   secao "## Update 2026-07-29 — Unified Pedido Editing and Client Change
--   Approval Design R1" (U1..U14), com as emendas vinculantes do supervisor.
-- Forward-only; db/01..db/91 sao INTOCADOS. O guard terminal de migracao
-- avanca 91 -> 92 no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- O QUE ESTA MIGRACAO OWNS
--   A. public.pedidos.revisao — o UNICO dono de concorrencia otimista do
--      Pedido. `atualizado_em` NAO e mantido por gatilho algum (provado:
--      atualizado_em = criado_em em toda linha de producao) e por isso NAO
--      pode ser usado como versao. `revisao` avanca quando muda um campo de
--      cabecalho relevante, quando muda a colecao de itens e quando muda a
--      prioridade; NAO avanca por publicacao de status visual ao cliente.
--
--   B. public.pedido_alteracao_solicitacoes e
--      public.pedido_alteracao_solicitacao_itens — o modelo HIBRIDO aceito:
--      cabecalho relacional, colecao de itens propostos relacional e ABSOLUTA,
--      e imagem-anterior JSONB IMUTAVEL.
--
--   C. Os oito donos transacionais de escrita (RPC). Nenhuma tela e nenhum DML
--      direto de cliente escreve Pedido, item, prioridade ou solicitacao.
--
--   D. As politicas RLS das duas tabelas novas.
--
-- EMENDA VINCULANTE — MUDANCA ESTRUTURAL DEPOIS DE QUALQUER OP
--   Mudanca ESTRUTURAL de item e: trocar modelo_id, trocar metros, inserir
--   item, remover item. Enquanto NAO existe OP relacionada ao Pedido, uma
--   mudanca estrutural valida pode ser aplicada. A PARTIR do instante em que
--   existe QUALQUER OP relacionada — em qualquer status, inclusive `simulada`
--   e `cancelada` — a mudanca estrutural e RECUSADA por estes fluxos
--   genericos. A confirmacao de impacto NAO e um override: nao existe
--   parametro que a libere. Reconciliacao de producao e um fluxo proprio e
--   NENHUMA funcao desta migracao altera, recria, apaga ou reconcilia
--   `op_itens`, `ops`, `expedicoes` ou `entregas`.
--   Cabecalho, observacao geral e observacao de item permanecem editaveis
--   conforme o ciclo de vida, porque nao sao estruturais.
--
-- EMENDA VINCULANTE — data_pedido DO CLIENTE
--   O Cliente PODE informar `data_pedido` na CRIACAO, pelo fluxo de criacao
--   existente, que esta migracao nao toca. Depois que o Pedido existe,
--   `data_pedido` e SOMENTE LEITURA para o Cliente: `salvar_pedido_cliente`
--   recusa qualquer payload que tente altera-la e `solicitar_alteracao_pedido`
--   recusa qualquer proposta sobre ela.
--
-- PRIORIDADE
--   `public.definir_prioridade_pedido()` (db/91) continua sendo o UNICO dono
--   de mutacao de prioridade e de `pedido_itens.ordem` sob prioridade ativa.
--   Esta migracao NAO o redefine e NAO cria um segundo dono. Quando a
--   prioridade nao esta ativa, `ordem` e apenas ordem de persistencia e e
--   normalizada diretamente, exatamente como a tela administrativa ja faz.
--
-- DADOS EXISTENTES
--   Nenhuma linha de negocio e criada, apagada, reinterpretada ou
--   retrocompatibilizada. `revisao` resolve todo Pedido pre-existente para 1
--   pelo DEFAULT com NOT NULL. Nenhuma solicitacao e criada.
--
-- ORDEM DE LOCKS
--   Toda RPC trava `public.pedidos` FOR UPDATE e SO DEPOIS a populacao de
--   `public.pedido_itens` ORDER BY id FOR UPDATE — exatamente a ordem que
--   `definir_prioridade_pedido()` ja estabeleceu. Nenhuma aresta nova entra na
--   ordem global de locks de db/88.
--
-- Idempotente: pode rodar varias vezes sem efeito cumulativo e sem drift.
-- Depende de db/13, db/14, db/15, db/17, db/20, db/23 e db/91.
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. GATE DE PRE-REQUISITOS. Falha fechada. NAO repara nada.
-- ============================================================
DO $gate$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.pedidos')                IS NULL THEN v_missing := array_append(v_missing, 'table public.pedidos'); END IF;
  IF to_regclass('public.pedido_itens')           IS NULL THEN v_missing := array_append(v_missing, 'table public.pedido_itens'); END IF;
  IF to_regclass('public.pedido_eventos')         IS NULL THEN v_missing := array_append(v_missing, 'table public.pedido_eventos'); END IF;
  IF to_regclass('public.pedido_cliente_eventos') IS NULL THEN v_missing := array_append(v_missing, 'table public.pedido_cliente_eventos'); END IF;
  IF to_regclass('public.pedido_prioridade_eventos') IS NULL THEN v_missing := array_append(v_missing, 'table public.pedido_prioridade_eventos'); END IF;
  IF to_regclass('public.ops')                    IS NULL THEN v_missing := array_append(v_missing, 'table public.ops'); END IF;
  IF to_regclass('public.lotes')                  IS NULL THEN v_missing := array_append(v_missing, 'table public.lotes'); END IF;
  IF to_regclass('public.op_itens')               IS NULL THEN v_missing := array_append(v_missing, 'table public.op_itens'); END IF;
  IF to_regclass('public.expedicoes')             IS NULL THEN v_missing := array_append(v_missing, 'table public.expedicoes'); END IF;
  IF to_regclass('public.expedicao_itens')        IS NULL THEN v_missing := array_append(v_missing, 'table public.expedicao_itens'); END IF;
  IF to_regclass('public.pedido_parcial_itens')   IS NULL THEN v_missing := array_append(v_missing, 'table public.pedido_parcial_itens'); END IF;

  IF to_regprocedure('public.is_admin()')       IS NULL THEN v_missing := array_append(v_missing, 'function public.is_admin()'); END IF;
  IF to_regprocedure('public.meu_cliente_id()') IS NULL THEN v_missing := array_append(v_missing, 'function public.meu_cliente_id()'); END IF;
  IF to_regprocedure('public.definir_prioridade_pedido(uuid,uuid[],boolean,text,boolean)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.definir_prioridade_pedido(uuid,uuid[],boolean,text,boolean)'); END IF;
  IF to_regprocedure('public.recalcular_pedido_metros_total(uuid)') IS NULL
    THEN v_missing := array_append(v_missing, 'function public.recalcular_pedido_metros_total(uuid)'); END IF;

  -- Colunas de ligacao Pedido <-> producao exigidas pela avaliacao de impacto.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='lotes' AND column_name='pedido_id')
    THEN v_missing := array_append(v_missing, 'column public.lotes.pedido_id'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='ops' AND column_name='lote_id')
    THEN v_missing := array_append(v_missing, 'column public.ops.lote_id'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='op_itens' AND column_name='pedido_item_id')
    THEN v_missing := array_append(v_missing, 'column public.op_itens.pedido_item_id'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='expedicao_itens' AND column_name='pedido_item_id')
    THEN v_missing := array_append(v_missing, 'column public.expedicao_itens.pedido_item_id'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='expedicoes' AND column_name='pedido_id')
    THEN v_missing := array_append(v_missing, 'column public.expedicoes.pedido_id'); END IF;

  -- Colunas db/89 + db/91 que este contrato assume.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='pedidos' AND column_name='data_pedido')
    THEN v_missing := array_append(v_missing, 'column public.pedidos.data_pedido (db/89)'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='pedidos' AND column_name='prioridade_status')
    THEN v_missing := array_append(v_missing, 'column public.pedidos.prioridade_status (db/91)'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='pedidos' AND column_name='referencia_cliente')
    THEN v_missing := array_append(v_missing, 'column public.pedidos.referencia_cliente'); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='pedidos' AND column_name='tipo_recebimento')
    THEN v_missing := array_append(v_missing, 'column public.pedidos.tipo_recebimento'); END IF;

  -- Guards que esta migracao depende de NAO ter que recriar.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pedidos'::regclass
                  AND tgname='pedidos_numero_immutability_guard' AND NOT tgisinternal)
    THEN v_missing := array_append(v_missing, 'trigger pedidos_numero_immutability_guard (db/89)'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pedidos'::regclass
                  AND tgname='pedidos_prioridade_direct_write_guard' AND NOT tgisinternal)
    THEN v_missing := array_append(v_missing, 'trigger pedidos_prioridade_direct_write_guard (db/91)'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pedidos'::regclass
                  AND tgname='pedidos_prioridade_acceptance_gate' AND NOT tgisinternal)
    THEN v_missing := array_append(v_missing, 'trigger pedidos_prioridade_acceptance_gate (db/91)'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.pedido_itens'::regclass
                  AND tgname='pedido_itens_ordem_direct_write_guard' AND NOT tgisinternal)
    THEN v_missing := array_append(v_missing, 'trigger pedido_itens_ordem_direct_write_guard (db/91)'); END IF;

  -- Politicas de criacao do Cliente: esta fase NAO as remove e depende delas.
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.pedidos'::regclass AND polname='pedidos_cliente_insert')
    THEN v_missing := array_append(v_missing, 'policy pedidos_cliente_insert'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.pedido_itens'::regclass AND polname='pedido_itens_cliente_insert')
    THEN v_missing := array_append(v_missing, 'policy pedido_itens_cliente_insert'); END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'db/92 gate: pre-requisito(s) ausente(s): %. Corrija sob ordem propria; esta migracao NAO repara.',
      array_to_string(v_missing, '; ');
  END IF;
END;
$gate$;

-- ============================================================
-- 1. public.pedidos.revisao — dono unico de concorrencia otimista
-- ============================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS revisao BIGINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.pedidos.revisao IS
  'db/92: token de concorrencia otimista do Pedido. Estritamente crescente. Avanca em mudanca de campo de cabeçalho relevante, de colecao de itens e de prioridade; NAO avanca por publicacao de status visual ao cliente. atualizado_em NAO e mantido e NAO pode ser usado como versao.';

-- 1.1 Normalizador de revisao.
--     E o UNICO escritor efetivo de `revisao`: qualquer valor que um chamador
--     tente gravar e SUBSTITUIDO. Isso torna a coluna monotonica por
--     construcao, impede retrocesso e impede que um cliente escolha um valor.
--     Nao ha recursao: o gatilho de item faz `SET revisao = revisao + 1`, que
--     cai no ramo "nada relevante mudou, mas revisao foi tocada" e resolve
--     para OLD.revisao + 1 uma unica vez.
CREATE OR REPLACE FUNCTION public.pedidos_revisao_normalize_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_relevante BOOLEAN;
BEGIN
  -- Campos que INVALIDAM uma solicitacao pendente. `status_cliente_visual`,
  -- `status_cliente_excecao`, `status_cliente_mensagem` e
  -- `status_cliente_atualizado_em` estao DELIBERADAMENTE fora: sao publicacao
  -- externa (PORTAL_B2B_ARCHITECTURE_RULES.md sec.3) e nao mudam a
  -- elegibilidade de nenhuma proposta.
  v_relevante :=
       NEW.cliente_id          IS DISTINCT FROM OLD.cliente_id
    OR NEW.numero              IS DISTINCT FROM OLD.numero
    OR NEW.status              IS DISTINCT FROM OLD.status
    OR NEW.data_pedido         IS DISTINCT FROM OLD.data_pedido
    OR NEW.prazo_entrega       IS DISTINCT FROM OLD.prazo_entrega
    OR NEW.prazo_desejado      IS DISTINCT FROM OLD.prazo_desejado
    OR NEW.referencia_cliente  IS DISTINCT FROM OLD.referencia_cliente
    OR NEW.tipo_recebimento    IS DISTINCT FROM OLD.tipo_recebimento
    OR NEW.observacao          IS DISTINCT FROM OLD.observacao
    OR NEW.parcial_habilitado  IS DISTINCT FROM OLD.parcial_habilitado
    OR NEW.prioridade_status   IS DISTINCT FROM OLD.prioridade_status
    OR NEW.prioridade_observacao IS DISTINCT FROM OLD.prioridade_observacao
    OR NEW.prioridade_confirmada_em IS DISTINCT FROM OLD.prioridade_confirmada_em;

  IF v_relevante OR NEW.revisao IS DISTINCT FROM OLD.revisao THEN
    NEW.revisao := OLD.revisao + 1;
  ELSE
    NEW.revisao := OLD.revisao;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pedidos_revisao_normalize_fn() IS
  'db/92: unico escritor de pedidos.revisao. Substitui qualquer valor informado; a coluna e monotonica e nao retrocede. Publicacao de status visual nao avanca a revisao.';

REVOKE EXECUTE ON FUNCTION public.pedidos_revisao_normalize_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedidos_revisao_normalize_fn() FROM anon;

DROP TRIGGER IF EXISTS pedidos_revisao_normalize ON public.pedidos;
CREATE TRIGGER pedidos_revisao_normalize
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_revisao_normalize_fn();

-- 1.2 A colecao de itens faz parte da revisao do Pedido.
CREATE OR REPLACE FUNCTION public.pedido_itens_revisao_bump_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old UUID := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.pedido_id ELSE NULL END;
  v_new UUID := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN NEW.pedido_id ELSE NULL END;
BEGIN
  IF v_old IS NOT NULL THEN
    UPDATE public.pedidos SET revisao = revisao + 1 WHERE id = v_old;
  END IF;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    UPDATE public.pedidos SET revisao = revisao + 1 WHERE id = v_new;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.pedido_itens_revisao_bump_fn() IS
  'db/92: propaga qualquer mudanca da colecao de itens para pedidos.revisao. O normalizador do Pedido resolve o incremento; nao ha duplo dono nem recursao.';

REVOKE EXECUTE ON FUNCTION public.pedido_itens_revisao_bump_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_revisao_bump_fn() FROM anon;

DROP TRIGGER IF EXISTS pedido_itens_revisao_bump ON public.pedido_itens;
CREATE TRIGGER pedido_itens_revisao_bump
  AFTER INSERT OR UPDATE OR DELETE ON public.pedido_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.pedido_itens_revisao_bump_fn();

-- ============================================================
-- 2. Avaliacao de impacto de producao (LEITURA APENAS)
-- ============================================================

-- 2.1 Existe QUALQUER OP relacionada a este Pedido?
--     Qualquer status conta, inclusive `simulada` e `cancelada`: a emenda do
--     supervisor e explicita — "any related OP exists, regardless of OP
--     status". Expedicao direta do Pedido e item ja vinculado a op_itens /
--     expedicao_itens tambem contam, porque provam a mesma ligacao.
CREATE OR REPLACE FUNCTION public.pedido_tem_op_relacionada(p_pedido_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.ops o
                   JOIN public.lotes l ON l.id = o.lote_id
                  WHERE l.pedido_id = p_pedido_id)
      OR EXISTS (SELECT 1 FROM public.expedicoes e WHERE e.pedido_id = p_pedido_id)
      OR EXISTS (SELECT 1 FROM public.op_itens oi
                   JOIN public.pedido_itens pi ON pi.id = oi.pedido_item_id
                  WHERE pi.pedido_id = p_pedido_id)
      OR EXISTS (SELECT 1 FROM public.expedicao_itens ei
                   JOIN public.pedido_itens pi ON pi.id = ei.pedido_item_id
                  WHERE pi.pedido_id = p_pedido_id);
$$;

COMMENT ON FUNCTION public.pedido_tem_op_relacionada(UUID) IS
  'db/92: TRUE quando existe qualquer OP, expedicao ou vinculo de item de producao para o Pedido, em qualquer status. E o gate de mudanca ESTRUTURAL de item.';

REVOKE EXECUTE ON FUNCTION public.pedido_tem_op_relacionada(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_tem_op_relacionada(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.pedido_tem_op_relacionada(UUID) TO authenticated;

-- 2.2 O item esta vinculado a producao, expedicao ou parcial?
--     Isto e o que impede a ORFANDADE SILENCIOSA: op_itens.pedido_item_id e
--     expedicao_itens.pedido_item_id sao ON DELETE SET NULL e
--     pedido_parcial_itens.pedido_item_id e ON DELETE CASCADE, ou seja, o
--     banco NAO recusa a remocao — ele a aceita e apaga a origem comercial.
CREATE OR REPLACE FUNCTION public.pedido_item_tem_vinculo_producao(p_item_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.op_itens oi WHERE oi.pedido_item_id = p_item_id)
      OR EXISTS (SELECT 1 FROM public.expedicao_itens ei WHERE ei.pedido_item_id = p_item_id)
      OR EXISTS (SELECT 1 FROM public.pedido_parcial_itens ppi WHERE ppi.pedido_item_id = p_item_id);
$$;

COMMENT ON FUNCTION public.pedido_item_tem_vinculo_producao(UUID) IS
  'db/92: TRUE quando remover o item orfanaria uma linha de op_itens ou expedicao_itens (ON DELETE SET NULL) ou apagaria uma linha de pedido_parcial_itens (ON DELETE CASCADE).';

REVOKE EXECUTE ON FUNCTION public.pedido_item_tem_vinculo_producao(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_item_tem_vinculo_producao(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.pedido_item_tem_vinculo_producao(UUID) TO authenticated;

-- ============================================================
-- 3. Tabelas de solicitacao de alteracao
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pedido_alteracao_solicitacoes (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id                     UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status                        TEXT NOT NULL DEFAULT 'pendente',
  solicitante_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_papel             TEXT NOT NULL,
  base_revisao                  BIGINT NOT NULL,
  base_snapshot                 JSONB NOT NULL,
  proposto_prazo_entrega        DATE,
  proposto_referencia_cliente   TEXT,
  proposto_tipo_recebimento     TEXT,
  proposto_observacao           TEXT,
  proposto_prioridade_habilitada BOOLEAN NOT NULL DEFAULT FALSE,
  campos_alterados              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  itens_propostos               BOOLEAN NOT NULL DEFAULT FALSE,
  mensagem_cliente              TEXT,
  criado_em                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  decidido_em                   TIMESTAMPTZ,
  decidido_por                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decisao_motivo                TEXT,
  falha_identificador           TEXT
);

CREATE TABLE IF NOT EXISTS public.pedido_alteracao_solicitacao_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  UUID NOT NULL REFERENCES public.pedido_alteracao_solicitacoes(id) ON DELETE CASCADE,
  pedido_item_id  UUID REFERENCES public.pedido_itens(id) ON DELETE SET NULL,
  modelo_id       BIGINT NOT NULL REFERENCES public.modelos(id) ON DELETE RESTRICT,
  metros          NUMERIC NOT NULL,
  largura         NUMERIC,
  observacao      TEXT,
  ordem           INTEGER NOT NULL
);

-- 3.1 Restricoes (idempotentes)
DO $cons$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacoes'::regclass
                    AND conname='pedido_alteracao_status_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacoes
      ADD CONSTRAINT pedido_alteracao_status_chk
      CHECK (status = ANY (ARRAY['pendente','aprovada','rejeitada','retirada','substituida','falha_aplicacao']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacoes'::regclass
                    AND conname='pedido_alteracao_papel_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacoes
      ADD CONSTRAINT pedido_alteracao_papel_chk
      CHECK (solicitante_papel = ANY (ARRAY['cliente','admin']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacoes'::regclass
                    AND conname='pedido_alteracao_tipo_recebimento_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacoes
      ADD CONSTRAINT pedido_alteracao_tipo_recebimento_chk
      CHECK (proposto_tipo_recebimento IS NULL
             OR proposto_tipo_recebimento = ANY (ARRAY['retirada','entrega']));
  END IF;

  -- Decisao e coerente com o status: pendente nunca carrega decisao; um estado
  -- decidido sempre carrega carimbo. `rejeitada` exige motivo.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacoes'::regclass
                    AND conname='pedido_alteracao_decisao_coerente_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacoes
      ADD CONSTRAINT pedido_alteracao_decisao_coerente_chk
      CHECK (
        (status = 'pendente' AND decidido_em IS NULL AND decidido_por IS NULL)
        OR (status IN ('aprovada','rejeitada','falha_aplicacao') AND decidido_em IS NOT NULL)
        OR (status IN ('retirada','substituida'))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacoes'::regclass
                    AND conname='pedido_alteracao_rejeicao_motivo_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacoes
      ADD CONSTRAINT pedido_alteracao_rejeicao_motivo_chk
      CHECK (status <> 'rejeitada' OR nullif(btrim(coalesce(decisao_motivo,'')), '') IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacoes'::regclass
                    AND conname='pedido_alteracao_falha_identificador_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacoes
      ADD CONSTRAINT pedido_alteracao_falha_identificador_chk
      CHECK (status <> 'falha_aplicacao' OR falha_identificador IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacao_itens'::regclass
                    AND conname='pedido_alteracao_item_metros_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacao_itens
      ADD CONSTRAINT pedido_alteracao_item_metros_chk CHECK (metros > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacao_itens'::regclass
                    AND conname='pedido_alteracao_item_largura_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacao_itens
      ADD CONSTRAINT pedido_alteracao_item_largura_chk
      CHECK (largura IS NULL OR largura = ANY (ARRAY[1.40, 2.10]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.pedido_alteracao_solicitacao_itens'::regclass
                    AND conname='pedido_alteracao_item_ordem_chk') THEN
    ALTER TABLE public.pedido_alteracao_solicitacao_itens
      ADD CONSTRAINT pedido_alteracao_item_ordem_chk CHECK (ordem >= 0);
  END IF;
END;
$cons$;

-- 3.2 No maximo UMA solicitacao pendente por Pedido. Indice parcial unico: a
--     regra e do BANCO, nao de checagem de aplicacao.
CREATE UNIQUE INDEX IF NOT EXISTS pedido_alteracao_um_pendente_por_pedido_uq
  ON public.pedido_alteracao_solicitacoes (pedido_id)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS pedido_alteracao_pedido_historico_idx
  ON public.pedido_alteracao_solicitacoes (pedido_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS pedido_alteracao_solicitante_idx
  ON public.pedido_alteracao_solicitacoes (solicitante_id);

CREATE UNIQUE INDEX IF NOT EXISTS pedido_alteracao_itens_ordem_uq
  ON public.pedido_alteracao_solicitacao_itens (solicitacao_id, ordem);

CREATE INDEX IF NOT EXISTS pedido_alteracao_itens_pedido_item_idx
  ON public.pedido_alteracao_solicitacao_itens (pedido_item_id);

COMMENT ON TABLE public.pedido_alteracao_solicitacoes IS
  'db/92: cabecalho da solicitacao de alteracao de Pedido. base_snapshot e a imagem-anterior IMUTAVEL; base_revisao e o token de concorrencia. No maximo uma linha pendente por Pedido.';
COMMENT ON TABLE public.pedido_alteracao_solicitacao_itens IS
  'db/92: colecao ABSOLUTA de itens propostos. pedido_item_id NULL = item novo; um pedido_itens.id vivo AUSENTE desta colecao e uma remocao proposta.';

-- 3.3 Imutabilidade da imagem-anterior e da colecao proposta apos a submissao.
CREATE OR REPLACE FUNCTION public.pedido_alteracao_imutabilidade_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.base_snapshot   IS DISTINCT FROM OLD.base_snapshot
     OR NEW.base_revisao IS DISTINCT FROM OLD.base_revisao
     OR NEW.pedido_id    IS DISTINCT FROM OLD.pedido_id
     OR NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id
     OR NEW.solicitante_papel IS DISTINCT FROM OLD.solicitante_papel
     OR NEW.criado_em    IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_IMUTAVEL: a imagem-anterior, a revisao base e a identidade da solicitacao sao imutaveis apos a submissao (solicitacao %)', OLD.id
      USING ERRCODE = '23514';
  END IF;
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_alteracao_imutabilidade_guard_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_alteracao_imutabilidade_guard_fn() FROM anon;

DROP TRIGGER IF EXISTS pedido_alteracao_imutabilidade_guard ON public.pedido_alteracao_solicitacoes;
CREATE TRIGGER pedido_alteracao_imutabilidade_guard
  BEFORE UPDATE ON public.pedido_alteracao_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.pedido_alteracao_imutabilidade_guard_fn();

CREATE OR REPLACE FUNCTION public.pedido_alteracao_itens_imutabilidade_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_id     UUID := COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);
BEGIN
  SELECT status INTO v_status FROM public.pedido_alteracao_solicitacoes WHERE id = v_id;
  -- A linha desaparece junto com o cabecalho (ON DELETE CASCADE); nesse caso
  -- nao ha status a consultar e nada a proteger.
  IF v_status IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_IMUTAVEL: a colecao proposta da solicitacao % e imutavel apos a decisao (status %)', v_id, v_status
      USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_alteracao_itens_imutabilidade_guard_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_alteracao_itens_imutabilidade_guard_fn() FROM anon;

DROP TRIGGER IF EXISTS pedido_alteracao_itens_imutabilidade_guard ON public.pedido_alteracao_solicitacao_itens;
CREATE TRIGGER pedido_alteracao_itens_imutabilidade_guard
  BEFORE UPDATE OR DELETE ON public.pedido_alteracao_solicitacao_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.pedido_alteracao_itens_imutabilidade_guard_fn();

-- ============================================================
-- 4. RLS das tabelas novas
-- ============================================================

ALTER TABLE public.pedido_alteracao_solicitacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_alteracao_solicitacao_itens  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedido_alteracao_admin_all ON public.pedido_alteracao_solicitacoes;
CREATE POLICY pedido_alteracao_admin_all ON public.pedido_alteracao_solicitacoes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Cliente: SELECT e SO. Nenhuma politica de INSERT, UPDATE ou DELETE existe
-- para o Cliente nestas tabelas — o unico caminho de escrita e a RPC
-- SECURITY DEFINER, que rededuz o chamador.
DROP POLICY IF EXISTS pedido_alteracao_cliente_select ON public.pedido_alteracao_solicitacoes;
CREATE POLICY pedido_alteracao_cliente_select ON public.pedido_alteracao_solicitacoes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pedidos p
             WHERE p.id = pedido_alteracao_solicitacoes.pedido_id
               AND p.cliente_id = public.meu_cliente_id())
  );

DROP POLICY IF EXISTS pedido_alteracao_itens_admin_all ON public.pedido_alteracao_solicitacao_itens;
CREATE POLICY pedido_alteracao_itens_admin_all ON public.pedido_alteracao_solicitacao_itens
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pedido_alteracao_itens_cliente_select ON public.pedido_alteracao_solicitacao_itens;
CREATE POLICY pedido_alteracao_itens_cliente_select ON public.pedido_alteracao_solicitacao_itens
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pedido_alteracao_solicitacoes s
              JOIN public.pedidos p ON p.id = s.pedido_id
             WHERE s.id = pedido_alteracao_solicitacao_itens.solicitacao_id
               AND p.cliente_id = public.meu_cliente_id())
  );

-- Grants de tabela.
--
-- O REVOKE de `authenticated` e OBRIGATORIO e nao e defensivo por excesso: o
-- projeto Supabase carrega ALTER DEFAULT PRIVILEGES concedendo DML completo a
-- anon, authenticated e service_role em toda tabela nova de `public` — e por
-- isso que public.pedidos e public.pedido_itens aparecem com
-- DELETE/INSERT/UPDATE para os dois papeis. Sem este REVOKE, `authenticated`
-- nasceria com INSERT/UPDATE/DELETE DIRETO nas duas tabelas novas, e um
-- administrador poderia gravar solicitacao e decisao por DML cru, contornando
-- as RPC — inclusive a imutabilidade da imagem-anterior e o indice de uma
-- unica pendente. Escrita SO pelas RPC SECURITY DEFINER, que sao owner
-- `postgres` e portanto nao dependem destes grants.
REVOKE ALL ON public.pedido_alteracao_solicitacoes      FROM PUBLIC;
REVOKE ALL ON public.pedido_alteracao_solicitacoes      FROM anon;
REVOKE ALL ON public.pedido_alteracao_solicitacoes      FROM authenticated;
REVOKE ALL ON public.pedido_alteracao_solicitacao_itens FROM PUBLIC;
REVOKE ALL ON public.pedido_alteracao_solicitacao_itens FROM anon;
REVOKE ALL ON public.pedido_alteracao_solicitacao_itens FROM authenticated;
GRANT SELECT ON public.pedido_alteracao_solicitacoes      TO authenticated;
GRANT SELECT ON public.pedido_alteracao_solicitacao_itens TO authenticated;
GRANT ALL    ON public.pedido_alteracao_solicitacoes      TO service_role;
GRANT ALL    ON public.pedido_alteracao_solicitacao_itens TO service_role;

-- ============================================================
-- 5. Helpers internos de payload (nao sao API publica)
-- ============================================================

-- 5.1 Imagem-anterior canonica do Pedido.
CREATE OR REPLACE FUNCTION public.pedido_snapshot(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pedido_id', p.id,
    'revisao', p.revisao,
    'status', p.status,
    'data_pedido', p.data_pedido,
    'prazo_entrega', p.prazo_entrega,
    'referencia_cliente', p.referencia_cliente,
    'tipo_recebimento', p.tipo_recebimento,
    'observacao', p.observacao,
    'prioridade_status', p.prioridade_status,
    'prioridade_observacao', p.prioridade_observacao,
    'metros_total', p.metros_total,
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'pedido_item_id', pi.id,
               'modelo_id', pi.modelo_id,
               'modelo_nome', m.nome,
               'metros', pi.metros,
               'largura', pi.largura,
               'observacao', pi.observacao,
               'ordem', pi.ordem)
             ORDER BY pi.ordem, pi.criado_em)
        FROM public.pedido_itens pi
        LEFT JOIN public.modelos m ON m.id = pi.modelo_id
       WHERE pi.pedido_id = p.id), '[]'::jsonb)
  )
  FROM public.pedidos p WHERE p.id = p_pedido_id;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_snapshot(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_snapshot(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.pedido_snapshot(UUID) TO authenticated;

-- 5.2 Validacao e normalizacao da colecao ABSOLUTA de itens propostos.
--     Devolve o array normalizado. Levanta erro estavel em qualquer invalidez.
CREATE OR REPLACE FUNCTION public.pedido_itens_payload_normalizar(p_pedido_id UUID, p_itens JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out   JSONB := '[]'::jsonb;
  v_row   JSONB;
  v_idx   INTEGER := 0;
  v_item_id UUID;
  v_modelo BIGINT;
  v_metros NUMERIC;
  v_seen   UUID[] := ARRAY[]::UUID[];
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: a colecao de itens deve ser um array JSON'
      USING ERRCODE = '22004';
  END IF;
  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: o Pedido deve manter ao menos um item'
      USING ERRCODE = '23514';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_item_id := NULLIF(v_row->>'pedido_item_id', '')::UUID;
    v_modelo  := NULLIF(v_row->>'modelo_id', '')::BIGINT;
    v_metros  := NULLIF(v_row->>'metros', '')::NUMERIC;

    IF v_modelo IS NULL THEN
      RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item na posicao % sem modelo_id', v_idx
        USING ERRCODE = '22004';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.modelos WHERE id = v_modelo) THEN
      RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: modelo_id % inexistente', v_modelo
        USING ERRCODE = '23503';
    END IF;
    IF v_metros IS NULL OR v_metros <= 0 THEN
      RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item na posicao % com metros invalido', v_idx
        USING ERRCODE = '23514';
    END IF;

    IF v_item_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.pedido_itens
                      WHERE id = v_item_id AND pedido_id = p_pedido_id) THEN
        RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item % nao pertence a este Pedido', v_item_id
          USING ERRCODE = '23514';
      END IF;
      IF v_item_id = ANY (v_seen) THEN
        RAISE EXCEPTION 'PEDIDO_ALTERACAO_ITEM_SET_INVALIDO: item % informado mais de uma vez', v_item_id
          USING ERRCODE = '23514';
      END IF;
      v_seen := v_seen || v_item_id;
    END IF;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'pedido_item_id', v_item_id,
      'modelo_id', v_modelo,
      'metros', v_metros,
      'largura', NULLIF(v_row->>'largura','')::NUMERIC,
      'observacao', NULLIF(btrim(COALESCE(v_row->>'observacao','')), ''),
      'ordem', v_idx));
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_itens_payload_normalizar(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_payload_normalizar(UUID, JSONB) FROM anon;

-- 5.3 A colecao proposta muda a ESTRUTURA do Pedido?
--     Estrutural = trocar modelo_id, trocar metros, inserir item, remover item.
--     Observacao de item e ordem NAO sao estruturais.
CREATE OR REPLACE FUNCTION public.pedido_itens_payload_e_estrutural(p_pedido_id UUID, p_itens JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_id  UUID;
  v_vivos INTEGER;
  v_informados INTEGER := 0;
BEGIN
  IF p_itens IS NULL THEN RETURN FALSE; END IF;

  SELECT count(*) INTO v_vivos FROM public.pedido_itens WHERE pedido_id = p_pedido_id;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULLIF(v_row->>'pedido_item_id','')::UUID;
    v_informados := v_informados + 1;
    IF v_id IS NULL THEN
      RETURN TRUE;                                    -- insercao
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.pedido_itens pi
       WHERE pi.id = v_id
         AND (pi.modelo_id IS DISTINCT FROM NULLIF(v_row->>'modelo_id','')::BIGINT
              OR pi.metros IS DISTINCT FROM NULLIF(v_row->>'metros','')::NUMERIC)
    ) THEN
      RETURN TRUE;                                    -- troca de modelo ou metros
    END IF;
  END LOOP;

  IF v_informados <> v_vivos THEN
    RETURN TRUE;                                      -- remocao
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_itens_payload_e_estrutural(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_payload_e_estrutural(UUID, JSONB) FROM anon;

-- 5.4 Reconciliacao da colecao absoluta contra as linhas vivas.
--     Chamada SOMENTE depois que a estrutura ja foi autorizada.
CREATE OR REPLACE FUNCTION public.pedido_itens_reconciliar(p_pedido_id UUID, p_itens JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      JSONB;
  v_id       UUID;
  v_manter   UUID[] := ARRAY[]::UUID[];
  v_remover  UUID;
BEGIN
  -- Remocoes primeiro, para que a orfandade seja recusada ANTES de qualquer
  -- escrita. op_itens/expedicao_itens sao ON DELETE SET NULL e
  -- pedido_parcial_itens e ON DELETE CASCADE: o banco NAO recusa sozinho.
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULLIF(v_row->>'pedido_item_id','')::UUID;
    IF v_id IS NOT NULL THEN v_manter := v_manter || v_id; END IF;
  END LOOP;

  FOR v_remover IN
    SELECT pi.id FROM public.pedido_itens pi
     WHERE pi.pedido_id = p_pedido_id
       AND NOT (pi.id = ANY (v_manter))
  LOOP
    IF public.pedido_item_tem_vinculo_producao(v_remover) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ITEM_VINCULADO_A_OP: o item % ja esta vinculado a producao, expedicao ou entrega parcial e nao pode ser removido; a reconciliacao de producao e um fluxo proprio', v_remover
        USING ERRCODE = '23514';
    END IF;
    DELETE FROM public.pedido_itens WHERE id = v_remover;
  END LOOP;

  -- Atualizacoes e insercoes, na ordem informada.
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULLIF(v_row->>'pedido_item_id','')::UUID;
    IF v_id IS NULL THEN
      INSERT INTO public.pedido_itens (pedido_id, modelo_id, metros, largura, observacao, ordem)
      VALUES (p_pedido_id,
              (v_row->>'modelo_id')::BIGINT,
              (v_row->>'metros')::NUMERIC,
              NULLIF(v_row->>'largura','')::NUMERIC,
              NULLIF(v_row->>'observacao',''),
              (v_row->>'ordem')::INTEGER);
    ELSE
      UPDATE public.pedido_itens
         SET modelo_id  = (v_row->>'modelo_id')::BIGINT,
             metros     = (v_row->>'metros')::NUMERIC,
             largura    = NULLIF(v_row->>'largura','')::NUMERIC,
             observacao = NULLIF(v_row->>'observacao',''),
             ordem      = (v_row->>'ordem')::INTEGER
       WHERE id = v_id AND pedido_id = p_pedido_id;
    END IF;
  END LOOP;

  PERFORM public.recalcular_pedido_metros_total(p_pedido_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_itens_reconciliar(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_reconciliar(UUID, JSONB) FROM anon;

-- 5.5 Sequencia final de itens, para alimentar definir_prioridade_pedido().
CREATE OR REPLACE FUNCTION public.pedido_itens_sequencia(p_pedido_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(pi.id ORDER BY pi.ordem, pi.criado_em), ARRAY[]::UUID[])
    FROM public.pedido_itens pi WHERE pi.pedido_id = p_pedido_id;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_itens_sequencia(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_itens_sequencia(UUID) FROM anon;

-- ============================================================
-- 6. Helpers de cabecalho
-- ============================================================

-- 6.1 Valida as chaves propostas e devolve a lista de campos alterados.
--     `admin` pode propor cliente_id e data_pedido; `cliente` nunca pode.
--     `numero` e `status` nao sao editaveis por NENHUM papel por estes fluxos:
--     numero e imutavel (db/89) e status pertence aos controles de ciclo de
--     vida da tela de detalhe.
CREATE OR REPLACE FUNCTION public.pedido_header_validar(p_header JSONB, p_papel TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key    TEXT;
  v_campos TEXT[] := ARRAY[]::TEXT[];
  v_permitidos TEXT[];
BEGIN
  IF p_header IS NULL OR jsonb_typeof(p_header) = 'null' THEN
    RETURN v_campos;
  END IF;
  IF jsonb_typeof(p_header) <> 'object' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_CAMPO_NAO_PERMITIDO: o cabecalho deve ser um objeto JSON'
      USING ERRCODE = '22004';
  END IF;

  v_permitidos := CASE WHEN p_papel = 'admin'
    THEN ARRAY['cliente_id','data_pedido','prazo_entrega','referencia_cliente','tipo_recebimento','observacao']
    ELSE ARRAY['prazo_entrega','referencia_cliente','tipo_recebimento','observacao']
  END;

  FOR v_key IN SELECT jsonb_object_keys(p_header) LOOP
    IF p_papel <> 'admin' AND v_key = 'data_pedido' THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_DATA_PEDIDO_IMUTAVEL_CLIENTE: a data do pedido pode ser informada na criacao, mas nao pode ser alterada pelo cliente depois que o Pedido existe'
        USING ERRCODE = '42501';
    END IF;
    IF NOT (v_key = ANY (v_permitidos)) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_CAMPO_NAO_PERMITIDO: o campo "%" nao pode ser alterado por este fluxo (papel %)', v_key, p_papel
        USING ERRCODE = '42501';
    END IF;
    v_campos := v_campos || v_key;
  END LOOP;

  RETURN v_campos;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_header_validar(JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_header_validar(JSONB, TEXT) FROM anon;

-- 6.2 Aplica SOMENTE as chaves presentes. Ausencia = nao proposto; presenca
--     com null = proposto como NULL.
CREATE OR REPLACE FUNCTION public.pedido_header_aplicar(p_pedido_id UUID, p_header JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_header IS NULL OR jsonb_typeof(p_header) <> 'object' THEN RETURN; END IF;

  UPDATE public.pedidos p SET
    cliente_id = CASE WHEN p_header ? 'cliente_id'
                      THEN (p_header->>'cliente_id')::BIGINT ELSE p.cliente_id END,
    data_pedido = CASE WHEN p_header ? 'data_pedido'
                       THEN (p_header->>'data_pedido')::DATE ELSE p.data_pedido END,
    prazo_entrega = CASE WHEN p_header ? 'prazo_entrega'
                         THEN NULLIF(p_header->>'prazo_entrega','')::DATE ELSE p.prazo_entrega END,
    referencia_cliente = CASE WHEN p_header ? 'referencia_cliente'
                              THEN NULLIF(btrim(COALESCE(p_header->>'referencia_cliente','')),'') ELSE p.referencia_cliente END,
    tipo_recebimento = CASE WHEN p_header ? 'tipo_recebimento'
                            THEN NULLIF(p_header->>'tipo_recebimento','') ELSE p.tipo_recebimento END,
    observacao = CASE WHEN p_header ? 'observacao'
                      THEN NULLIF(btrim(COALESCE(p_header->>'observacao','')),'') ELSE p.observacao END
  WHERE p.id = p_pedido_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_header_aplicar(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_header_aplicar(UUID, JSONB) FROM anon;

-- 6.3 Aplica a prioridade pelo dono canonico db/91. NUNCA escreve
--     prioridade_* nem `ordem` sob prioridade ativa por conta propria.
CREATE OR REPLACE FUNCTION public.pedido_prioridade_aplicar(
  p_pedido_id UUID, p_habilitada BOOLEAN, p_confirmar_impacto BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_habilitada IS NULL THEN RETURN; END IF;      -- NULL = nao tocar
  PERFORM public.definir_prioridade_pedido(
    p_pedido_id,
    CASE WHEN p_habilitada THEN public.pedido_itens_sequencia(p_pedido_id) ELSE NULL END,
    p_habilitada,
    NULL,
    COALESCE(p_confirmar_impacto, FALSE));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pedido_prioridade_aplicar(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedido_prioridade_aplicar(UUID, BOOLEAN, BOOLEAN) FROM anon;

-- ============================================================
-- 7. RPC 1 — salvar_pedido_cliente
-- ============================================================
CREATE OR REPLACE FUNCTION public.salvar_pedido_cliente(
  p_pedido_id    UUID,
  p_base_revisao BIGINT,
  p_header       JSONB DEFAULT NULL,
  p_itens        JSONB DEFAULT NULL,
  p_prioridade   BOOLEAN DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_pedido   public.pedidos%ROWTYPE;
  v_cliente  BIGINT := public.meu_cliente_id();
  v_campos   TEXT[];
  v_itens    JSONB;
BEGIN
  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: chamador nao e um cliente' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND: Pedido % inexistente', p_pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.cliente_id IS DISTINCT FROM v_cliente THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: Pedido nao pertence a este cliente' USING ERRCODE = '42501';
  END IF;
  IF v_pedido.status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL: Pedido em status % nao aceita edicao', v_pedido.status USING ERRCODE = '23514';
  END IF;
  IF v_pedido.status NOT IN ('rascunho','recebido') THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_PEDIDO_NAO_EDITAVEL: o Pedido ja foi aceito pela equipe; use solicitar_alteracao_pedido'
      USING ERRCODE = '42501';
  END IF;
  IF p_base_revisao IS NOT NULL AND v_pedido.revisao IS DISTINCT FROM p_base_revisao THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a abertura do editor (base %, atual %)', p_base_revisao, v_pedido.revisao
      USING ERRCODE = '40001';
  END IF;

  -- data_pedido, cliente_id, numero e status sao recusados pelo validador.
  v_campos := public.pedido_header_validar(p_header, 'cliente');

  PERFORM 1 FROM public.pedido_itens WHERE pedido_id = p_pedido_id ORDER BY id FOR UPDATE;

  IF p_itens IS NOT NULL THEN
    v_itens := public.pedido_itens_payload_normalizar(p_pedido_id, p_itens);
    IF public.pedido_itens_payload_e_estrutural(p_pedido_id, v_itens)
       AND public.pedido_tem_op_relacionada(p_pedido_id) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada; alterar modelo, metragem ou a composicao de itens exige reconciliacao de producao e nao pode ser feito por este fluxo'
        USING ERRCODE = '23514';
    END IF;
    PERFORM public.pedido_itens_reconciliar(p_pedido_id, v_itens);
  END IF;

  PERFORM public.pedido_header_aplicar(p_pedido_id, p_header);
  PERFORM public.pedido_prioridade_aplicar(p_pedido_id, p_prioridade, FALSE);

  INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
  VALUES (p_pedido_id, v_pedido.status, v_pedido.status, auth.uid(),
          'db/92 salvar_pedido_cliente: campos=' || COALESCE(array_to_string(v_campos, ','), '') ||
          '; itens=' || CASE WHEN p_itens IS NULL THEN 'inalterados' ELSE 'reconciliados' END);

  RETURN jsonb_build_object('ok', true, 'pedido_id', p_pedido_id,
    'revisao', (SELECT revisao FROM public.pedidos WHERE id = p_pedido_id),
    'campos_alterados', to_jsonb(v_campos));
END;
$$;

COMMENT ON FUNCTION public.salvar_pedido_cliente(UUID, BIGINT, JSONB, JSONB, BOOLEAN) IS
  'db/92: unico caminho de escrita do Cliente sobre o proprio Pedido AINDA NAO ACEITO. data_pedido, cliente_id, numero e status sao imutaveis. Colecao de itens absoluta. Prioridade so por definir_prioridade_pedido().';

REVOKE EXECUTE ON FUNCTION public.salvar_pedido_cliente(UUID, BIGINT, JSONB, JSONB, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.salvar_pedido_cliente(UUID, BIGINT, JSONB, JSONB, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.salvar_pedido_cliente(UUID, BIGINT, JSONB, JSONB, BOOLEAN) TO authenticated;

-- ============================================================
-- 8. RPC 2 — salvar_pedido_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.salvar_pedido_admin(
  p_pedido_id         UUID,
  p_base_revisao      BIGINT,
  p_header            JSONB DEFAULT NULL,
  p_itens             JSONB DEFAULT NULL,
  p_prioridade        BOOLEAN DEFAULT NULL,
  p_confirmar_impacto BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_campos TEXT[];
  v_itens  JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: operacao restrita a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND: Pedido % inexistente', p_pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL: Pedido em status % nao aceita edicao', v_pedido.status USING ERRCODE = '23514';
  END IF;
  IF p_base_revisao IS NOT NULL AND v_pedido.revisao IS DISTINCT FROM p_base_revisao THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a abertura do editor (base %, atual %)', p_base_revisao, v_pedido.revisao
      USING ERRCODE = '40001';
  END IF;

  v_campos := public.pedido_header_validar(p_header, 'admin');

  PERFORM 1 FROM public.pedido_itens WHERE pedido_id = p_pedido_id ORDER BY id FOR UPDATE;

  IF p_itens IS NOT NULL THEN
    v_itens := public.pedido_itens_payload_normalizar(p_pedido_id, p_itens);
    -- A confirmacao de impacto NAO libera estrutura depois de existir OP.
    -- Nao existe override: o fluxo correto e a reconciliacao de producao.
    IF public.pedido_itens_payload_e_estrutural(p_pedido_id, v_itens)
       AND public.pedido_tem_op_relacionada(p_pedido_id) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada; alterar modelo, metragem ou a composicao de itens exige reconciliacao de producao e nao pode ser feito por este fluxo'
        USING ERRCODE = '23514';
    END IF;
    PERFORM public.pedido_itens_reconciliar(p_pedido_id, v_itens);
  END IF;

  PERFORM public.pedido_header_aplicar(p_pedido_id, p_header);
  -- A prioridade conserva o gate de impacto de db/91: com producao iniciada,
  -- `p_confirmar_impacto` e exigido POR AQUELA funcao, nao por esta.
  PERFORM public.pedido_prioridade_aplicar(p_pedido_id, p_prioridade, p_confirmar_impacto);

  INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
  VALUES (p_pedido_id, v_pedido.status, v_pedido.status, auth.uid(),
          'db/92 salvar_pedido_admin: campos=' || COALESCE(array_to_string(v_campos, ','), '') ||
          '; itens=' || CASE WHEN p_itens IS NULL THEN 'inalterados' ELSE 'reconciliados' END);

  RETURN jsonb_build_object('ok', true, 'pedido_id', p_pedido_id,
    'revisao', (SELECT revisao FROM public.pedidos WHERE id = p_pedido_id),
    'campos_alterados', to_jsonb(v_campos));
END;
$$;

COMMENT ON FUNCTION public.salvar_pedido_admin(UUID, BIGINT, JSONB, JSONB, BOOLEAN, BOOLEAN) IS
  'db/92: dono transacional administrativo do Pedido. Nao transiciona status, nao altera numero e nao faz mudanca estrutural de item depois que existe qualquer OP relacionada.';

REVOKE EXECUTE ON FUNCTION public.salvar_pedido_admin(UUID, BIGINT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.salvar_pedido_admin(UUID, BIGINT, JSONB, JSONB, BOOLEAN, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.salvar_pedido_admin(UUID, BIGINT, JSONB, JSONB, BOOLEAN, BOOLEAN) TO authenticated;

-- ============================================================
-- 9. RPC 3 — solicitar_alteracao_pedido
-- ============================================================
CREATE OR REPLACE FUNCTION public.solicitar_alteracao_pedido(
  p_pedido_id  UUID,
  p_header     JSONB DEFAULT NULL,
  p_itens      JSONB DEFAULT NULL,
  p_prioridade BOOLEAN DEFAULT NULL,
  p_mensagem   TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_pedido    public.pedidos%ROWTYPE;
  v_cliente   BIGINT := public.meu_cliente_id();
  v_campos    TEXT[];
  v_itens     JSONB;
  v_id        UUID;
  v_substituidas INTEGER := 0;
  v_row       JSONB;
BEGIN
  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: chamador nao e um cliente' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND: Pedido % inexistente', p_pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.cliente_id IS DISTINCT FROM v_cliente THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: Pedido nao pertence a este cliente' USING ERRCODE = '42501';
  END IF;
  IF v_pedido.status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL: Pedido em status % nao aceita solicitacao', v_pedido.status USING ERRCODE = '23514';
  END IF;
  IF v_pedido.status IN ('rascunho','recebido') THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_PEDIDO_NAO_ACEITO: o Pedido ainda nao foi aceito; edite-o diretamente por salvar_pedido_cliente'
      USING ERRCODE = '23514';
  END IF;

  v_campos := public.pedido_header_validar(p_header, 'cliente');

  IF p_itens IS NOT NULL THEN
    v_itens := public.pedido_itens_payload_normalizar(p_pedido_id, p_itens);
    IF public.pedido_itens_payload_e_estrutural(p_pedido_id, v_itens)
       AND public.pedido_tem_op_relacionada(p_pedido_id) THEN
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada; alterar modelo, metragem ou a composicao de itens exige reconciliacao de producao e nao pode ser solicitado por este fluxo'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Substituicao ATOMICA: a pendente anterior vira `substituida` e permanece
  -- no historico com seus proprios carimbos. Nunca ha duas pendentes.
  UPDATE public.pedido_alteracao_solicitacoes
     SET status = 'substituida', decidido_em = now()
   WHERE pedido_id = p_pedido_id AND status = 'pendente';
  GET DIAGNOSTICS v_substituidas = ROW_COUNT;

  INSERT INTO public.pedido_alteracao_solicitacoes (
    pedido_id, status, solicitante_id, solicitante_papel, base_revisao, base_snapshot,
    proposto_prazo_entrega, proposto_referencia_cliente, proposto_tipo_recebimento,
    proposto_observacao, proposto_prioridade_habilitada, campos_alterados,
    itens_propostos, mensagem_cliente)
  VALUES (
    p_pedido_id, 'pendente', auth.uid(), 'cliente', v_pedido.revisao,
    public.pedido_snapshot(p_pedido_id),
    CASE WHEN p_header ? 'prazo_entrega' THEN NULLIF(p_header->>'prazo_entrega','')::DATE END,
    CASE WHEN p_header ? 'referencia_cliente' THEN NULLIF(btrim(COALESCE(p_header->>'referencia_cliente','')),'') END,
    CASE WHEN p_header ? 'tipo_recebimento' THEN NULLIF(p_header->>'tipo_recebimento','') END,
    CASE WHEN p_header ? 'observacao' THEN NULLIF(btrim(COALESCE(p_header->>'observacao','')),'') END,
    COALESCE(p_prioridade, FALSE), v_campos,
    p_itens IS NOT NULL, NULLIF(btrim(COALESCE(p_mensagem,'')),''))
  RETURNING id INTO v_id;

  IF v_itens IS NOT NULL THEN
    FOR v_row IN SELECT value FROM jsonb_array_elements(v_itens) LOOP
      INSERT INTO public.pedido_alteracao_solicitacao_itens
        (solicitacao_id, pedido_item_id, modelo_id, metros, largura, observacao, ordem)
      VALUES (v_id,
              NULLIF(v_row->>'pedido_item_id','')::UUID,
              (v_row->>'modelo_id')::BIGINT,
              (v_row->>'metros')::NUMERIC,
              NULLIF(v_row->>'largura','')::NUMERIC,
              NULLIF(v_row->>'observacao',''),
              (v_row->>'ordem')::INTEGER);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'solicitacao_id', v_id, 'status', 'pendente',
    'base_revisao', v_pedido.revisao, 'substituiu_pendente', v_substituidas > 0);
END;
$$;

COMMENT ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT) IS
  'db/92: submissao/substituicao de solicitacao de alteracao pelo Cliente sobre um Pedido JA ACEITO e nao terminal. Captura revisao base e imagem-anterior. Nao toca o Pedido vivo.';

REVOKE EXECUTE ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.solicitar_alteracao_pedido(UUID, JSONB, JSONB, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- 10. RPC 4 — retirar_alteracao_pedido
-- ============================================================
CREATE OR REPLACE FUNCTION public.retirar_alteracao_pedido(p_solicitacao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_sol     public.pedido_alteracao_solicitacoes%ROWTYPE;
  v_cliente BIGINT := public.meu_cliente_id();
  v_dono    BIGINT;
BEGIN
  SELECT * INTO v_sol FROM public.pedido_alteracao_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND: solicitacao % inexistente', p_solicitacao_id USING ERRCODE = 'P0002';
  END IF;

  SELECT cliente_id INTO v_dono FROM public.pedidos WHERE id = v_sol.pedido_id;
  IF NOT public.is_admin() AND (v_cliente IS NULL OR v_dono IS DISTINCT FROM v_cliente) THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: solicitacao nao pertence a este cliente' USING ERRCODE = '42501';
  END IF;
  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA: solicitacao ja esta em %', v_sol.status USING ERRCODE = '23514';
  END IF;

  UPDATE public.pedido_alteracao_solicitacoes
     SET status = 'retirada', decidido_em = now()
   WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('ok', true, 'solicitacao_id', p_solicitacao_id, 'status', 'retirada');
END;
$$;

COMMENT ON FUNCTION public.retirar_alteracao_pedido(UUID) IS
  'db/92: retirada da propria solicitacao pendente. Nao toca o Pedido vivo.';

REVOKE EXECUTE ON FUNCTION public.retirar_alteracao_pedido(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retirar_alteracao_pedido(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.retirar_alteracao_pedido(UUID) TO authenticated;

-- ============================================================
-- 11. RPC 5 — aprovar_alteracao_pedido
-- ============================================================
-- CONTRATO DE FALHA (emenda vinculante secao 4.4):
--   * recusa ESPERADA de validacao -> identificador estavel, solicitacao
--     CONTINUA `pendente`, nenhuma linha viva muda;
--   * falha INESPERADA durante a APLICACAO -> a subtransacao PL/pgSQL desfaz
--     todo o trabalho de aplicacao, e a transacao externa marca a solicitacao
--     como `falha_aplicacao` com `falha_identificador`.
--   Toda a validacao acontece ANTES do bloco com EXCEPTION, exatamente para
--   que uma recusa esperada nunca seja confundida com uma falha de aplicacao.
CREATE OR REPLACE FUNCTION public.aprovar_alteracao_pedido(
  p_solicitacao_id    UUID,
  p_confirmar_impacto BOOLEAN DEFAULT FALSE,
  p_motivo            TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_sol    public.pedido_alteracao_solicitacoes%ROWTYPE;
  v_pedido public.pedidos%ROWTYPE;
  v_header JSONB := '{}'::jsonb;
  v_itens  JSONB;
  v_campo  TEXT;
  v_falha  TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: operacao restrita a administradores' USING ERRCODE = '42501';
  END IF;

  -- ---------- VALIDACAO (fora da subtransacao) ----------
  SELECT * INTO v_sol FROM public.pedido_alteracao_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND: solicitacao % inexistente', p_solicitacao_id USING ERRCODE = 'P0002';
  END IF;
  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA: solicitacao ja esta em %', v_sol.status USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = v_sol.pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND: Pedido % inexistente', v_sol.pedido_id USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.status IN ('entregue','cancelado') THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_PEDIDO_TERMINAL: Pedido em status % nao aceita aplicacao', v_pedido.status USING ERRCODE = '23514';
  END IF;

  -- Concorrencia: sem merge silencioso. Falha fechada, solicitacao continua
  -- pendente, e o cliente reabre o editor contra o estado aceito mais recente.
  IF v_pedido.revisao IS DISTINCT FROM v_sol.base_revisao THEN
    RAISE EXCEPTION
      'PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA: o Pedido mudou desde a criacao da solicitacao (base %, atual %)', v_sol.base_revisao, v_pedido.revisao
      USING ERRCODE = '40001';
  END IF;

  PERFORM 1 FROM public.pedido_itens WHERE pedido_id = v_sol.pedido_id ORDER BY id FOR UPDATE;

  -- Recompoe o cabecalho proposto SOMENTE com os campos declarados.
  FOREACH v_campo IN ARRAY v_sol.campos_alterados LOOP
    v_header := v_header || CASE v_campo
      WHEN 'prazo_entrega'      THEN jsonb_build_object('prazo_entrega', v_sol.proposto_prazo_entrega)
      WHEN 'referencia_cliente' THEN jsonb_build_object('referencia_cliente', v_sol.proposto_referencia_cliente)
      WHEN 'tipo_recebimento'   THEN jsonb_build_object('tipo_recebimento', v_sol.proposto_tipo_recebimento)
      WHEN 'observacao'         THEN jsonb_build_object('observacao', v_sol.proposto_observacao)
      ELSE '{}'::jsonb END;
  END LOOP;
  PERFORM public.pedido_header_validar(v_header, 'cliente');

  IF v_sol.itens_propostos THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'pedido_item_id', i.pedido_item_id,
             'modelo_id', i.modelo_id,
             'metros', i.metros,
             'largura', i.largura,
             'observacao', i.observacao,
             'ordem', i.ordem) ORDER BY i.ordem), '[]'::jsonb)
      INTO v_itens
      FROM public.pedido_alteracao_solicitacao_itens i
     WHERE i.solicitacao_id = p_solicitacao_id;

    v_itens := public.pedido_itens_payload_normalizar(v_sol.pedido_id, v_itens);

    IF public.pedido_itens_payload_e_estrutural(v_sol.pedido_id, v_itens)
       AND public.pedido_tem_op_relacionada(v_sol.pedido_id) THEN
      -- A aprovacao NAO e um override. Uma proposta estrutural sobre um Pedido
      -- que ja tem producao vinculada deve ser REJEITADA pelo revisor.
      RAISE EXCEPTION
        'PEDIDO_ALTERACAO_ESTRUTURA_BLOQUEADA_APOS_OP: este Pedido ja tem producao vinculada; a proposta estrutural nao pode ser aplicada e deve ser rejeitada com justificativa'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- ---------- APLICACAO (dentro da subtransacao) ----------
  BEGIN
    IF v_itens IS NOT NULL THEN
      PERFORM public.pedido_itens_reconciliar(v_sol.pedido_id, v_itens);
    END IF;

    PERFORM public.pedido_header_aplicar(v_sol.pedido_id, v_header);

    -- Prioridade pelo dono canonico, sob a identidade ADMINISTRATIVA de quem
    -- aprova: o resultado correto e `confirmada`.
    PERFORM public.pedido_prioridade_aplicar(
      v_sol.pedido_id, v_sol.proposto_prioridade_habilitada, p_confirmar_impacto);

    INSERT INTO public.pedido_eventos (pedido_id, status_anterior, status_novo, criado_por, observacao)
    VALUES (v_sol.pedido_id, v_pedido.status, v_pedido.status, auth.uid(),
            'db/92 aprovar_alteracao_pedido: solicitacao ' || p_solicitacao_id ||
            '; campos=' || COALESCE(array_to_string(v_sol.campos_alterados, ','), ''));

    INSERT INTO public.pedido_cliente_eventos (pedido_id, status, titulo, mensagem, origem, visivel_cliente, criado_por)
    VALUES (v_sol.pedido_id, COALESCE(v_pedido.status_cliente_visual, 'confirmado'),
            'Solicitacao de alteracao aprovada',
            COALESCE(NULLIF(btrim(COALESCE(p_motivo,'')),''), 'Sua solicitacao de alteracao foi aprovada pela equipe.'),
            'sistema', TRUE, auth.uid());

    UPDATE public.pedido_alteracao_solicitacoes
       SET status = 'aprovada', decidido_em = now(), decidido_por = auth.uid(),
           decisao_motivo = NULLIF(btrim(COALESCE(p_motivo,'')),'')
     WHERE id = p_solicitacao_id;

  EXCEPTION WHEN OTHERS THEN
    -- Toda a aplicacao acima foi desfeita por esta subtransacao. O Pedido vivo
    -- esta EXATAMENTE como estava. Registramos a falha na transacao externa.
    v_falha := SQLSTATE || ':' || left(COALESCE(SQLERRM, ''), 300);
    UPDATE public.pedido_alteracao_solicitacoes
       SET status = 'falha_aplicacao', decidido_em = now(), decidido_por = auth.uid(),
           falha_identificador = v_falha
     WHERE id = p_solicitacao_id;
    RETURN jsonb_build_object('ok', false,
      'erro', 'PEDIDO_ALTERACAO_FALHA_APLICACAO',
      'solicitacao_id', p_solicitacao_id,
      'status', 'falha_aplicacao',
      'falha_identificador', v_falha);
  END;

  RETURN jsonb_build_object('ok', true, 'solicitacao_id', p_solicitacao_id, 'status', 'aprovada',
    'pedido_id', v_sol.pedido_id,
    'revisao', (SELECT revisao FROM public.pedidos WHERE id = v_sol.pedido_id));
END;
$$;

COMMENT ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) IS
  'db/92: aplicacao ATOMICA da revisao aprovada. Recusa esperada mantem a solicitacao pendente e nao toca o Pedido; falha inesperada e desfeita por subtransacao e a solicitacao vira falha_aplicacao. Nunca altera OP ou op_itens.';

REVOKE EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.aprovar_alteracao_pedido(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- 12. RPC 6 — rejeitar_alteracao_pedido
-- ============================================================
CREATE OR REPLACE FUNCTION public.rejeitar_alteracao_pedido(
  p_solicitacao_id UUID, p_motivo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_sol public.pedido_alteracao_solicitacoes%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_FORBIDDEN: operacao restrita a administradores' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_motivo,'')),'') IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_MOTIVO_OBRIGATORIO: informe o motivo da rejeicao' USING ERRCODE = '22004';
  END IF;

  SELECT * INTO v_sol FROM public.pedido_alteracao_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND: solicitacao % inexistente', p_solicitacao_id USING ERRCODE = 'P0002';
  END IF;
  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'PEDIDO_ALTERACAO_SOLICITACAO_JA_DECIDIDA: solicitacao ja esta em %', v_sol.status USING ERRCODE = '23514';
  END IF;

  UPDATE public.pedido_alteracao_solicitacoes
     SET status = 'rejeitada', decidido_em = now(), decidido_por = auth.uid(),
         decisao_motivo = btrim(p_motivo)
   WHERE id = p_solicitacao_id;

  INSERT INTO public.pedido_cliente_eventos (pedido_id, status, titulo, mensagem, origem, visivel_cliente, criado_por)
  SELECT v_sol.pedido_id, COALESCE(p.status_cliente_visual, 'confirmado'),
         'Solicitacao de alteracao nao aprovada', btrim(p_motivo), 'sistema', TRUE, auth.uid()
    FROM public.pedidos p WHERE p.id = v_sol.pedido_id;

  RETURN jsonb_build_object('ok', true, 'solicitacao_id', p_solicitacao_id, 'status', 'rejeitada');
END;
$$;

COMMENT ON FUNCTION public.rejeitar_alteracao_pedido(UUID, TEXT) IS
  'db/92: rejeicao com motivo obrigatorio. NUNCA altera o Pedido vivo.';

REVOKE EXECUTE ON FUNCTION public.rejeitar_alteracao_pedido(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rejeitar_alteracao_pedido(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rejeitar_alteracao_pedido(UUID, TEXT) TO authenticated;

-- ============================================================
-- 13. RPC 7 — cliente_alteracao_resumo (leitura sanitizada)
-- ============================================================
-- Whitelist EXPLICITA. Nao devolve OP, lote, fornecedor, ordem de compra,
-- documento fiscal, custo, metadado interno nem `pedidos.numero`.
CREATE OR REPLACE FUNCTION public.cliente_alteracao_resumo(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente BIGINT := public.meu_cliente_id();
  v_dono    BIGINT;
  v_admin   BOOLEAN := public.is_admin();
BEGIN
  SELECT cliente_id INTO v_dono FROM public.pedidos WHERE id = p_pedido_id;
  IF v_dono IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'PEDIDO_ALTERACAO_PEDIDO_NOT_FOUND');
  END IF;
  IF NOT v_admin AND (v_cliente IS NULL OR v_dono IS DISTINCT FROM v_cliente) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'PEDIDO_ALTERACAO_FORBIDDEN');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pedido_id', p_pedido_id,
    'pendente', (
      SELECT jsonb_build_object(
               'solicitacao_id', s.id, 'status', s.status,
               'campos_alterados', to_jsonb(s.campos_alterados),
               'itens_propostos', s.itens_propostos,
               'prioridade_proposta', s.proposto_prioridade_habilitada,
               'mensagem', s.mensagem_cliente, 'criado_em', s.criado_em)
        FROM public.pedido_alteracao_solicitacoes s
       WHERE s.pedido_id = p_pedido_id AND s.status = 'pendente'),
    'historico', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'solicitacao_id', s.id, 'status', s.status,
               'criado_em', s.criado_em, 'decidido_em', s.decidido_em,
               'motivo', s.decisao_motivo) ORDER BY s.criado_em DESC)
        FROM public.pedido_alteracao_solicitacoes s
       WHERE s.pedido_id = p_pedido_id AND s.status <> 'pendente'), '[]'::jsonb));
END;
$$;

COMMENT ON FUNCTION public.cliente_alteracao_resumo(UUID) IS
  'db/92: leitura sanitizada do estado de solicitacao para o Cliente. Whitelist explicita; nenhum dado operacional interno e exposto.';

REVOKE EXECUTE ON FUNCTION public.cliente_alteracao_resumo(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cliente_alteracao_resumo(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.cliente_alteracao_resumo(UUID) TO authenticated;

-- ============================================================
-- 14. RPC 8 — admin_alteracao_comparacao (leitura administrativa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_alteracao_comparacao(p_solicitacao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol   public.pedido_alteracao_solicitacoes%ROWTYPE;
  v_prop  JSONB := '{}'::jsonb;
  v_campo TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'PEDIDO_ALTERACAO_FORBIDDEN');
  END IF;

  SELECT * INTO v_sol FROM public.pedido_alteracao_solicitacoes WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'PEDIDO_ALTERACAO_SOLICITACAO_NOT_FOUND');
  END IF;

  FOREACH v_campo IN ARRAY v_sol.campos_alterados LOOP
    v_prop := v_prop || CASE v_campo
      WHEN 'prazo_entrega'      THEN jsonb_build_object('prazo_entrega', v_sol.proposto_prazo_entrega)
      WHEN 'referencia_cliente' THEN jsonb_build_object('referencia_cliente', v_sol.proposto_referencia_cliente)
      WHEN 'tipo_recebimento'   THEN jsonb_build_object('tipo_recebimento', v_sol.proposto_tipo_recebimento)
      WHEN 'observacao'         THEN jsonb_build_object('observacao', v_sol.proposto_observacao)
      ELSE '{}'::jsonb END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'solicitacao', jsonb_build_object(
      'id', v_sol.id, 'pedido_id', v_sol.pedido_id, 'status', v_sol.status,
      'solicitante_id', v_sol.solicitante_id, 'solicitante_papel', v_sol.solicitante_papel,
      'base_revisao', v_sol.base_revisao, 'criado_em', v_sol.criado_em,
      'decidido_em', v_sol.decidido_em, 'decidido_por', v_sol.decidido_por,
      'decisao_motivo', v_sol.decisao_motivo, 'falha_identificador', v_sol.falha_identificador,
      'mensagem_cliente', v_sol.mensagem_cliente,
      'campos_alterados', to_jsonb(v_sol.campos_alterados),
      'itens_propostos', v_sol.itens_propostos,
      'prioridade_proposta', v_sol.proposto_prioridade_habilitada),
    'antes', v_sol.base_snapshot,
    'atual', public.pedido_snapshot(v_sol.pedido_id),
    'proposto_header', v_prop,
    'proposto_itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'pedido_item_id', i.pedido_item_id, 'modelo_id', i.modelo_id,
               'modelo_nome', m.nome, 'metros', i.metros, 'largura', i.largura,
               'observacao', i.observacao, 'ordem', i.ordem) ORDER BY i.ordem)
        FROM public.pedido_alteracao_solicitacao_itens i
        LEFT JOIN public.modelos m ON m.id = i.modelo_id
       WHERE i.solicitacao_id = p_solicitacao_id), '[]'::jsonb),
    'impacto', jsonb_build_object(
      'tem_op_relacionada', public.pedido_tem_op_relacionada(v_sol.pedido_id),
      'revisao_atual', (SELECT revisao FROM public.pedidos WHERE id = v_sol.pedido_id),
      'base_desatualizada', (SELECT revisao FROM public.pedidos WHERE id = v_sol.pedido_id) IS DISTINCT FROM v_sol.base_revisao));
END;
$$;

COMMENT ON FUNCTION public.admin_alteracao_comparacao(UUID) IS
  'db/92: payload administrativo de comparacao antes/atual/proposto, com impacto vivo. Somente leitura.';

REVOKE EXECUTE ON FUNCTION public.admin_alteracao_comparacao(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_alteracao_comparacao(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_alteracao_comparacao(UUID) TO authenticated;

-- ============================================================
-- 15. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
