-- =====================================================================
-- db/91_pedido_item_production_priority.sql
-- PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1 — sequencia explicita de
-- prioridade de producao ENTRE OS ITENS DE UM MESMO PEDIDO.
--
-- Order: PEDIDO-ITEM-PRODUCTION-PRIORITY-END-TO-END-R1.
-- Schema shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md.
-- Forward-only; db/01..db/90 sao intocados. O guard terminal de migracao
-- avanca 90 -> 91 no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- O QUE ESTA MIGRACAO OWNS
--   A. public.pedidos.prioridade_* — o ESTADO de prioridade do Pedido:
--        nenhuma    — nao existe instrucao de prioridade; `pedido_itens.ordem`
--                     e apenas ordem visual e de persistencia;
--        solicitada — o Cliente pediu explicitamente a sequencia exibida e ela
--                     AGUARDA analise administrativa; a producao nao comeca;
--        confirmada — o Admin confirmou ou definiu diretamente a sequencia, que
--                     passa a ser a instrucao ATIVA de prioridade de producao.
--
--   B. public.pedido_prioridade_eventos — a evidencia de auditoria de cada
--      transicao, com a ordem anterior e a nova como arrays JSON de UUID de
--      item.
--
--   C. public.definir_prioridade_pedido(...) — o UNICO dono de mutacao de
--      prioridade. Nenhuma tela, nenhum caminho de UI e nenhum DML direto de
--      cliente escreve estes campos.
--
--   D. Os quatro guards de banco que tornam o contrato executavel e nao apenas
--      declarado: escrita direta, aceitacao administrativa, criacao de OP e
--      reordenacao direta de itens.
--
-- POR QUE `ordem` E O RANK CANONICO E NAO UMA COLUNA NOVA
--   `pedido_itens.ordem` ja existe (db/13) e ja e a ordem que TODAS as telas
--   leem e gravam. Criar um segundo rank produziria duas fontes de verdade que
--   divergem no primeiro item inserido fora da RPC. `ordem` continua existindo
--   com prioridade desabilitada — ela so PASSA A SIGNIFICAR uma instrucao de
--   producao quando `prioridade_status <> 'nenhuma'`. O significado esta no
--   status do Pedido, nao numa coluna por item.
--
-- POR QUE NAO HA FK EM prioridade_confirmada_por
--   A convencao do repositorio para identidade de autor e
--   `REFERENCES auth.users(id) ON DELETE SET NULL` (db/13 pedido_eventos).
--   Aqui essa convencao e INCOMPATIVEL com a restricao de consistencia que a
--   ordem exige: `confirmada` OBRIGA identidade e carimbo. Um SET NULL em
--   cascata anularia a identidade de um Pedido cujo status continua
--   `confirmada` e violaria o CHECK — na pratica, apagar um administrador
--   passaria a falhar, ou pior, deixaria a linha inconsistente. A coluna e
--   portanto uma CAPTURA de identidade (UUID de auth.uid() no instante da
--   confirmacao), preservada mesmo que a conta deixe de existir. A restricao de
--   consistencia e a garantia forte; a FK seria uma garantia que se
--   auto-destroi.
--
-- DADOS EXISTENTES
--   Nenhuma prioridade e inferida de historico. O DEFAULT 'nenhuma' com
--   NOT NULL resolve TODO Pedido pre-existente para 'nenhuma'. Nenhum item e
--   reordenado, nenhuma observacao e preenchida, e nenhuma linha de negocio e
--   criada, lida como instrucao ou reinterpretada.
--
-- ORDEM DE LOCKS
--   A RPC trava `public.pedidos` FOR UPDATE e SO DEPOIS a populacao de
--   `public.pedido_itens` FOR UPDATE. Essa direcao e OBRIGATORIA e nao
--   opcional: o gatilho AFTER de db/17 (pedido_itens_sync_parciais_after_change)
--   escreve de volta em `public.pedidos`, entao qualquer UPDATE de item ja
--   adquire a linha do Pedido de qualquer forma. Tomando `pedidos` primeiro, a
--   sequencia e pedidos -> pedido_itens -> pedidos (ja detida): nenhuma aresta
--   nova entra na ordem global de locks estabelecida por db/88, e nenhuma
--   inversao e possivel.
--
-- COMO OS GUARDS DISTINGUEM A RPC DE UMA ESCRITA DIRETA
--   Sem GUC de escape e sem flag que um cliente possa forjar. A RPC e
--   SECURITY DEFINER, entao dentro dela `current_user` e o DONO da funcao;
--   toda escrita vinda de PostgREST corre como `anon` ou `authenticated`. Os
--   guards recusam exatamente essas duas identidades. Um cliente nao pode
--   assumir outra identidade, entao o desvio nao existe — nao apenas nao esta
--   exposto.
--
-- Nenhuma coluna existente e renomeada ou removida, nenhuma policy existente e
-- enfraquecida, nenhuma policy PUBLIC ou anon e criada, nenhum DDL destrutivo,
-- nenhuma linha existente e reordenada e nenhum comportamento de OP, Manta ou
-- expedicao nao relacionado e alterado.
--
-- Idempotente: pode rodar varias vezes sem efeito cumulativo e sem drift.
-- Depende de db/12 (is_admin), db/13 (pedidos/pedido_itens), db/14
-- (meu_cliente_id) e db/17 (sincronizacao de parciais).
-- =====================================================================

BEGIN;

-- ============================================================
-- 0. PRE-REQUISITE GATE.
--    Falha fechada se qualquer objeto sobre o qual esta migracao raciocina
--    estiver ausente. Sem reparo, sem criacao, sem reinterpretacao.
-- ============================================================
DO $gate$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'db/91 gate: public.is_admin() ausente; aplique db/12 antes.';
  END IF;

  IF to_regprocedure('public.meu_cliente_id()') IS NULL THEN
    RAISE EXCEPTION 'db/91 gate: public.meu_cliente_id() ausente; aplique db/14 antes.';
  END IF;

  IF to_regclass('public.pedido_itens') IS NULL THEN
    RAISE EXCEPTION 'db/91 gate: public.pedido_itens ausente; aplique db/13 antes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pedido_itens' AND column_name = 'ordem'
  ) THEN
    RAISE EXCEPTION 'db/91 gate: public.pedido_itens.ordem ausente; aplique db/13 antes.';
  END IF;

  IF to_regclass('public.lotes') IS NULL OR to_regclass('public.ops') IS NULL THEN
    RAISE EXCEPTION 'db/91 gate: public.ops/public.lotes ausentes; o gate de criacao de OP nao tem onde existir.';
  END IF;
END;
$gate$;

-- ============================================================
-- 1. Colunas de prioridade em public.pedidos
-- ============================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS prioridade_status        TEXT        NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS prioridade_observacao    TEXT        NULL,
  ADD COLUMN IF NOT EXISTS prioridade_confirmada_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS prioridade_confirmada_por UUID       NULL,
  ADD COLUMN IF NOT EXISTS prioridade_atualizada_em TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.pedidos.prioridade_status IS
  'db/91: nenhuma|solicitada|confirmada. Sequencia de prioridade de producao ENTRE OS ITENS DESTE Pedido. NAO e prioridade de um Pedido sobre outro, nao e urgencia global, nao e prioridade de cliente e nao e categoria de prazo. Somente public.definir_prioridade_pedido() escreve esta coluna.';
COMMENT ON COLUMN public.pedidos.prioridade_observacao IS
  'db/91: observacao livre associada a instrucao de prioridade. NAO e a fonte canonica da prioridade — a fonte e prioridade_status mais pedido_itens.ordem.';
COMMENT ON COLUMN public.pedidos.prioridade_confirmada_em IS
  'db/91: instante da confirmacao administrativa. Obrigatoriamente NULL fora de prioridade_status = confirmada.';
COMMENT ON COLUMN public.pedidos.prioridade_confirmada_por IS
  'db/91: CAPTURA do auth.uid() do administrador que confirmou. Sem FK deliberadamente: ON DELETE SET NULL violaria a restricao de consistencia de confirmada. Ver o cabecalho da migracao.';
COMMENT ON COLUMN public.pedidos.prioridade_atualizada_em IS
  'db/91: instante da ultima mutacao de prioridade, qualquer que tenha sido o ator.';

-- 1.1 Estados exatos
DO $prio_status_chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pedidos'::regclass
       AND conname  = 'pedidos_prioridade_status_chk'
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_prioridade_status_chk
      CHECK (prioridade_status IN ('nenhuma', 'solicitada', 'confirmada'));
  END IF;
END;
$prio_status_chk$;

-- 1.2 Consistencia da identidade de confirmacao.
--     confirmada  => carimbo E identidade presentes;
--     nenhuma/solicitada => nem carimbo nem identidade.
DO $prio_conf_chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pedidos'::regclass
       AND conname  = 'pedidos_prioridade_confirmacao_chk'
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_prioridade_confirmacao_chk
      CHECK (
        (prioridade_status = 'confirmada'
           AND prioridade_confirmada_em  IS NOT NULL
           AND prioridade_confirmada_por IS NOT NULL)
        OR
        (prioridade_status <> 'confirmada'
           AND prioridade_confirmada_em  IS NULL
           AND prioridade_confirmada_por IS NULL)
      );
  END IF;
END;
$prio_conf_chk$;

CREATE INDEX IF NOT EXISTS pedidos_prioridade_status_idx
  ON public.pedidos (prioridade_status)
  WHERE prioridade_status <> 'nenhuma';

-- ============================================================
-- 2. public.pedido_prioridade_eventos — auditoria da prioridade
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pedido_prioridade_eventos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID        NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  evento          TEXT        NOT NULL,
  ator_id         UUID        NULL,
  ator_papel      TEXT        NOT NULL,
  ordem_anterior  JSONB       NULL,
  ordem_nova      JSONB       NULL,
  observacao      TEXT        NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pedido_prioridade_eventos IS
  'db/91: evidencia append-only de cada transicao de prioridade de producao de um Pedido. ordem_anterior/ordem_nova sao arrays JSON de UUID de pedido_itens em ordem de prioridade. Escrita EXCLUSIVAMENTE por public.definir_prioridade_pedido(); nenhum cliente insere, atualiza ou remove.';

DO $evt_chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pedido_prioridade_eventos'::regclass
       AND conname  = 'pedido_prioridade_eventos_evento_chk'
  ) THEN
    ALTER TABLE public.pedido_prioridade_eventos
      ADD CONSTRAINT pedido_prioridade_eventos_evento_chk
      CHECK (evento IN ('solicitada', 'alterada_pelo_cliente', 'confirmada', 'alterada_pelo_admin', 'removida'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.pedido_prioridade_eventos'::regclass
       AND conname  = 'pedido_prioridade_eventos_papel_chk'
  ) THEN
    ALTER TABLE public.pedido_prioridade_eventos
      ADD CONSTRAINT pedido_prioridade_eventos_papel_chk
      CHECK (ator_papel IN ('cliente', 'admin'));
  END IF;
END;
$evt_chk$;

CREATE INDEX IF NOT EXISTS pedido_prioridade_eventos_pedido_idx
  ON public.pedido_prioridade_eventos (pedido_id, criado_em DESC);

-- 2.1 RLS: admin le tudo; cliente le apenas os eventos do proprio Pedido.
--     NAO existe policy de INSERT/UPDATE/DELETE para nenhum papel de cliente,
--     e NAO existe policy PUBLIC nem anon.
ALTER TABLE public.pedido_prioridade_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedido_prioridade_eventos_admin_select ON public.pedido_prioridade_eventos;
CREATE POLICY pedido_prioridade_eventos_admin_select ON public.pedido_prioridade_eventos
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS pedido_prioridade_eventos_cliente_select ON public.pedido_prioridade_eventos;
CREATE POLICY pedido_prioridade_eventos_cliente_select ON public.pedido_prioridade_eventos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos p
       WHERE p.id = pedido_prioridade_eventos.pedido_id
         AND p.cliente_id = public.meu_cliente_id()
    )
  );

-- 2.2 Grants: os defaults do Supabase concedem tudo a anon/authenticated.
--     Aqui a superficie e reduzida a SELECT para authenticated (filtrado pelas
--     policies acima) e a NADA para anon.
REVOKE ALL ON TABLE public.pedido_prioridade_eventos FROM PUBLIC;
REVOKE ALL ON TABLE public.pedido_prioridade_eventos FROM anon;
REVOKE ALL ON TABLE public.pedido_prioridade_eventos FROM authenticated;
GRANT SELECT ON TABLE public.pedido_prioridade_eventos TO authenticated;

-- ============================================================
-- 3. GUARD A — escrita direta dos campos de prioridade em public.pedidos
--
--    Recusa qualquer INSERT que ja nasca com prioridade e qualquer UPDATE que
--    mude um campo de prioridade quando a identidade que escreve e uma
--    identidade de cliente PostgREST (anon/authenticated). Dentro da RPC
--    SECURITY DEFINER current_user e o dono da funcao, entao a RPC passa.
--
--    O guard NAO toca as demais colunas: a transicao de status, a data
--    comercial, as parciais e todo o restante do caminho legitimo de criacao de
--    Pedido pelo Cliente continuam funcionando exatamente como hoje.
-- ============================================================
-- SECURITY INVOKER DELIBERADO (o modo default), e nao SECURITY DEFINER como os
-- demais guards do repositorio: este guard PRECISA enxergar a identidade
-- efetiva de quem escreve. Dentro de uma funcao SECURITY DEFINER o
-- `current_user` passa a ser o DONO da funcao, entao um guard SECURITY DEFINER
-- leria sempre o proprio dono e nunca reconheceria `authenticated` — o guard
-- existiria e nunca dispararia. Em modo invoker o `current_user` e o papel
-- efetivo da chamada PostgREST (`anon`/`authenticated`), e dentro da RPC
-- SECURITY DEFINER e o dono dela, que e exatamente a distincao pretendida.
CREATE OR REPLACE FUNCTION public.pedidos_prioridade_direct_write_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.prioridade_status IS DISTINCT FROM 'nenhuma'
       OR NEW.prioridade_observacao    IS NOT NULL
       OR NEW.prioridade_confirmada_em IS NOT NULL
       OR NEW.prioridade_confirmada_por IS NOT NULL
       OR NEW.prioridade_atualizada_em IS NOT NULL THEN
      RAISE EXCEPTION
        'PEDIDO_PRIORITY_DIRECT_WRITE_FORBIDDEN: a prioridade de producao e definida somente por public.definir_prioridade_pedido()'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.prioridade_status        IS DISTINCT FROM OLD.prioridade_status
     OR NEW.prioridade_observacao    IS DISTINCT FROM OLD.prioridade_observacao
     OR NEW.prioridade_confirmada_em IS DISTINCT FROM OLD.prioridade_confirmada_em
     OR NEW.prioridade_confirmada_por IS DISTINCT FROM OLD.prioridade_confirmada_por
     OR NEW.prioridade_atualizada_em IS DISTINCT FROM OLD.prioridade_atualizada_em THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_DIRECT_WRITE_FORBIDDEN: a prioridade de producao e definida somente por public.definir_prioridade_pedido()'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pedidos_prioridade_direct_write_guard_fn() IS
  'db/91 GUARD A: recusa qualquer escrita direta (anon/authenticated) nos campos prioridade_* de public.pedidos. SECURITY INVOKER de proposito, para enxergar a identidade real de quem escreve. A RPC passa porque nela current_user e o dono dela. Sem GUC de escape. Tooling administrativo (postgres/service_role) nao herda esta restricao, exatamente como no restante do repositorio.';

-- NAO ha REVOKE de EXECUTE aqui: uma funcao de gatilho em modo invoker precisa
-- permanecer executavel pelo papel que dispara o DML. A funcao nao expoe nada —
-- fora do contexto de gatilho ela apenas falha.

DROP TRIGGER IF EXISTS pedidos_prioridade_direct_write_guard ON public.pedidos;
CREATE TRIGGER pedidos_prioridade_direct_write_guard
  BEFORE INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.pedidos_prioridade_direct_write_guard_fn();

-- ============================================================
-- 4. GUARD B — reordenacao direta de itens por Cliente
--
--    `pedido_itens.ordem` e o rank canonico. O Cliente nunca o reescreve
--    diretamente: ele passa pela RPC. O ADMIN continua reescrevendo `ordem`
--    pela tela de edicao de itens (#/pedidos/<id>/itens), que ja normaliza a
--    ordem pela posicao final — comportamento existente e preservado.
--    INSERT permanece livre: e o caminho legitimo de criacao de Pedido pelo
--    Cliente, e a RPC normaliza a sequencia logo em seguida.
-- ============================================================
-- SECURITY INVOKER deliberado, pela mesma razao do GUARD A.
CREATE OR REPLACE FUNCTION public.pedido_itens_ordem_direct_write_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'PEDIDO_PRIORITY_DIRECT_WRITE_FORBIDDEN: a ordem dos itens e definida somente por public.definir_prioridade_pedido()'
    USING ERRCODE = '42501';
END;
$$;

COMMENT ON FUNCTION public.pedido_itens_ordem_direct_write_guard_fn() IS
  'db/91 GUARD B: recusa UPDATE direto de pedido_itens.ordem vindo de identidade de cliente nao administrativa. Admin e a RPC passam. INSERT nao e afetado (caminho de criacao de Pedido pelo Cliente). SECURITY INVOKER de proposito.';

-- Sem REVOKE de EXECUTE, pela mesma razao do GUARD A.

DROP TRIGGER IF EXISTS pedido_itens_ordem_direct_write_guard ON public.pedido_itens;
CREATE TRIGGER pedido_itens_ordem_direct_write_guard
  BEFORE UPDATE OF ordem ON public.pedido_itens
  FOR EACH ROW
  WHEN (NEW.ordem IS DISTINCT FROM OLD.ordem)
  EXECUTE FUNCTION public.pedido_itens_ordem_direct_write_guard_fn();

-- ============================================================
-- 5. GUARD C — aceitacao administrativa com solicitacao pendente
--
--    Um Pedido NAO transita para `confirmado` enquanto houver uma solicitacao
--    de prioridade aguardando analise. Sem conversao silenciosa para
--    `confirmada` e sem remocao silenciosa: o Admin decide explicitamente.
-- ============================================================
CREATE OR REPLACE FUNCTION public.pedidos_prioridade_acceptance_gate_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.prioridade_status = 'solicitada' THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_ADMIN_REVIEW_REQUIRED: existe uma solicitacao de prioridade aguardando analise; confirme, ajuste ou remova a sequencia antes de aceitar o Pedido'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pedidos_prioridade_acceptance_gate_fn() IS
  'db/91 GUARD C: bloqueia a transicao de status para confirmado enquanto prioridade_status = solicitada. Erro estavel PEDIDO_PRIORITY_ADMIN_REVIEW_REQUIRED.';

REVOKE EXECUTE ON FUNCTION public.pedidos_prioridade_acceptance_gate_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pedidos_prioridade_acceptance_gate_fn() FROM anon;

DROP TRIGGER IF EXISTS pedidos_prioridade_acceptance_gate ON public.pedidos;
CREATE TRIGGER pedidos_prioridade_acceptance_gate
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  WHEN (NEW.status = 'confirmado' AND OLD.status IS DISTINCT FROM 'confirmado')
  EXECUTE FUNCTION public.pedidos_prioridade_acceptance_gate_fn();

-- ============================================================
-- 6. GUARD D — criacao de OP com solicitacao pendente
--
--    A ordem exige o guard em TODO dono que cria a primeira OP ou uma OP
--    derivada a partir de um Pedido. Em vez de reescrever gerar_op_latex,
--    gerar_op_latex_split e o caminho de aplicacao (o que exigiria duplicar
--    centenas de linhas de logica NAO relacionada e arriscaria alterar
--    comportamento de ciclo de vida de OP fora do escopo), o gate vive na
--    UNICA aresta que todos eles obrigatoriamente atravessam: o VINCULO entre
--    a OP e o Pedido.
--
--    Uma OP so pertence a um Pedido por `ops.lote_id -> lotes.pedido_id`. Os
--    dois pontos onde esse vinculo passa a existir sao cobertos:
--      * lotes  — INSERT com pedido_id, ou UPDATE que passa a apontar para um;
--      * ops    — INSERT ja com lote_id, ou UPDATE que passa a apontar para um.
--    Cobrindo a aresta, TODO dono presente e futuro fica coberto por
--    construcao, sem que nenhum deles precise ser reescrito.
--
--    CONSUMO DE NUMERO DE OP: proximo_numero_op (db/26) reserva o numero por
--    UPSERT em public.op_numeros, que e TRANSACIONAL. Quando este gate aborta,
--    a reserva volta atras junto com o resto da transacao, entao nenhum numero
--    de OP e queimado. O caminho principal (js/screens/op-persistir.js) ainda
--    checa antes de pedir o numero, para que o operador nunca chegue ate aqui.
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_pedido_prioridade_revisada(p_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_pedido_id IS NULL THEN
    RETURN;
  END IF;

  SELECT prioridade_status INTO v_status
    FROM public.pedidos
   WHERE id = p_pedido_id;

  IF v_status = 'solicitada' THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_REVIEW_REQUIRED_BEFORE_OP: o Pedido tem uma solicitacao de prioridade aguardando analise; confirme, ajuste ou remova a sequencia antes de gerar OP'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_pedido_prioridade_revisada(UUID) IS
  'db/91 GUARD D: levanta PEDIDO_PRIORITY_REVIEW_REQUIRED_BEFORE_OP quando o Pedido carrega uma solicitacao de prioridade pendente. Chamado pelos gatilhos de vinculo de lotes e ops.';

REVOKE EXECUTE ON FUNCTION public.assert_pedido_prioridade_revisada(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assert_pedido_prioridade_revisada(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.assert_pedido_prioridade_revisada(UUID) TO   authenticated;

CREATE OR REPLACE FUNCTION public.lotes_prioridade_op_gate_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_pedido_prioridade_revisada(NEW.pedido_id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.lotes_prioridade_op_gate_fn() IS
  'db/91 GUARD D (lotes): impede que um Lote passe a apontar para um Pedido com prioridade pendente de analise.';

REVOKE EXECUTE ON FUNCTION public.lotes_prioridade_op_gate_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lotes_prioridade_op_gate_fn() FROM anon;

DROP TRIGGER IF EXISTS lotes_prioridade_op_gate ON public.lotes;
CREATE TRIGGER lotes_prioridade_op_gate
  BEFORE INSERT OR UPDATE OF pedido_id ON public.lotes
  FOR EACH ROW
  WHEN (NEW.pedido_id IS NOT NULL)
  EXECUTE FUNCTION public.lotes_prioridade_op_gate_fn();

CREATE OR REPLACE FUNCTION public.ops_prioridade_op_gate_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
BEGIN
  SELECT l.pedido_id INTO v_pedido_id
    FROM public.lotes l
   WHERE l.id = NEW.lote_id;

  PERFORM public.assert_pedido_prioridade_revisada(v_pedido_id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ops_prioridade_op_gate_fn() IS
  'db/91 GUARD D (ops): impede que uma OP passe a pertencer, via lote, a um Pedido com prioridade pendente de analise. Cobre o caminho de aplicacao e as RPCs de OP derivada sem reescrever nenhuma delas.';

REVOKE EXECUTE ON FUNCTION public.ops_prioridade_op_gate_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ops_prioridade_op_gate_fn() FROM anon;

DROP TRIGGER IF EXISTS ops_prioridade_op_gate ON public.ops;
CREATE TRIGGER ops_prioridade_op_gate
  BEFORE INSERT OR UPDATE OF lote_id ON public.ops
  FOR EACH ROW
  WHEN (NEW.lote_id IS NOT NULL)
  EXECUTE FUNCTION public.ops_prioridade_op_gate_fn();

-- ============================================================
-- 7. public.definir_prioridade_pedido — o UNICO dono de mutacao
--
--    Retorno JSONB no formato ja usado pelo repositorio para RPCs de Pedido
--    (concluir_pedido_se_pronto): { ok, ... }. As recusas de autorizacao e de
--    regra de negocio sao LEVANTADAS com tokens estaveis, porque os mesmos
--    tokens precisam existir nos gatilhos, onde um retorno JSON e impossivel.
-- ============================================================
CREATE OR REPLACE FUNCTION public.definir_prioridade_pedido(
  p_pedido_id                   UUID,
  p_item_ids                    UUID[],
  p_habilitada                  BOOLEAN,
  p_observacao                  TEXT    DEFAULT NULL,
  p_confirmar_impacto_producao  BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_pedido        public.pedidos%ROWTYPE;
  v_is_admin      BOOLEAN;
  v_cliente_id    BIGINT;
  v_papel         TEXT;
  v_ator          UUID;
  v_total_itens   INTEGER;
  v_informados    INTEGER;
  v_distintos     INTEGER;
  v_pertencentes  INTEGER;
  v_ordem_ant     JSONB;
  v_ordem_nova    JSONB;
  v_evento        TEXT;
  v_novo_status   TEXT;
  v_obs           TEXT;
BEGIN
  IF p_pedido_id IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_PRIORITY_PEDIDO_REQUIRED: identificador de Pedido obrigatorio'
      USING ERRCODE = '22004';
  END IF;

  -- ---------- 7.1 papel do chamador ----------
  v_is_admin   := public.is_admin();
  v_cliente_id := public.meu_cliente_id();
  v_ator       := auth.uid();

  IF v_is_admin THEN
    v_papel := 'admin';
  ELSIF v_cliente_id IS NOT NULL THEN
    v_papel := 'cliente';
  ELSE
    RAISE EXCEPTION 'PEDIDO_PRIORITY_FORBIDDEN: sem permissao para definir prioridade'
      USING ERRCODE = '42501';
  END IF;

  -- ---------- 7.2 trava o Pedido ANTES de qualquer leitura de populacao ----------
  -- Direcao obrigatoria: pedidos -> pedido_itens. Ver ORDEM DE LOCKS no
  -- cabecalho desta migracao.
  SELECT * INTO v_pedido
    FROM public.pedidos
   WHERE id = p_pedido_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_PRIORITY_PEDIDO_NOT_FOUND: Pedido % inexistente', p_pedido_id
      USING ERRCODE = 'P0002';
  END IF;

  -- ---------- 7.3 propriedade ----------
  -- O Cliente nunca alcanca um Pedido de outro cliente, e os IDs de item
  -- informados NAO podem servir de desvio: a checagem e sobre o Pedido, e a
  -- validacao de conjunto abaixo exige que todo item pertenca a ELE.
  IF v_papel = 'cliente' AND v_pedido.cliente_id IS DISTINCT FROM v_cliente_id THEN
    RAISE EXCEPTION 'PEDIDO_PRIORITY_FORBIDDEN: Pedido nao pertence a este cliente'
      USING ERRCODE = '42501';
  END IF;

  -- ---------- 7.4 Pedidos terminais sao somente leitura para os dois papeis ----------
  IF v_pedido.status IN ('entregue', 'cancelado') THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_PEDIDO_READ_ONLY: Pedido em status % nao aceita alteracao de prioridade', v_pedido.status
      USING ERRCODE = '23514';
  END IF;

  -- ---------- 7.5 trava do Cliente apos aceitacao administrativa ----------
  IF v_papel = 'cliente' THEN
    IF v_pedido.status <> 'recebido' THEN
      RAISE EXCEPTION
        'PEDIDO_PRIORITY_CLIENT_LOCKED: o Pedido ja foi aceito pela equipe e a prioridade nao pode mais ser alterada pelo cliente'
        USING ERRCODE = '42501';
    END IF;
    IF v_pedido.prioridade_status = 'confirmada' THEN
      RAISE EXCEPTION
        'PEDIDO_PRIORITY_CLIENT_LOCKED: a prioridade ja foi confirmada pela equipe e somente a administracao pode altera-la'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ---------- 7.6 impacto de producao (somente Admin alcanca produzindo) ----------
  IF v_pedido.status = 'produzindo' AND COALESCE(p_confirmar_impacto_producao, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_PRODUCTION_IMPACT_CONFIRMATION_REQUIRED: a producao deste Pedido ja foi iniciada; confirme o impacto antes de alterar a prioridade'
      USING ERRCODE = '23514';
  END IF;

  -- ---------- 7.7 populacao corrente de itens, travada ----------
  PERFORM 1
     FROM public.pedido_itens
    WHERE pedido_id = p_pedido_id
    ORDER BY id
      FOR UPDATE;

  SELECT count(*) INTO v_total_itens
    FROM public.pedido_itens
   WHERE pedido_id = p_pedido_id;

  SELECT jsonb_agg(to_jsonb(t.id) ORDER BY t.ordem, t.id)
    INTO v_ordem_ant
    FROM (SELECT id, ordem FROM public.pedido_itens WHERE pedido_id = p_pedido_id) t;

  -- ==========================================================
  -- 7.8 REMOCAO / DESABILITACAO
  -- ==========================================================
  IF COALESCE(p_habilitada, FALSE) IS NOT TRUE THEN
    IF v_pedido.prioridade_status = 'nenhuma' THEN
      -- Ja nao ha instrucao. Nada muda e nenhum evento e fabricado.
      RETURN jsonb_build_object(
        'ok', true,
        'prioridade_status', 'nenhuma',
        'alterado', false,
        'total_itens', v_total_itens
      );
    END IF;

    -- A ordem visual existente permanece INTACTA: nenhuma linha e reordenada
    -- ao limpar a prioridade.
    UPDATE public.pedidos
       SET prioridade_status         = 'nenhuma',
           prioridade_observacao     = NULL,
           prioridade_confirmada_em  = NULL,
           prioridade_confirmada_por = NULL,
           prioridade_atualizada_em  = now()
     WHERE id = p_pedido_id;

    INSERT INTO public.pedido_prioridade_eventos
      (pedido_id, evento, ator_id, ator_papel, ordem_anterior, ordem_nova, observacao)
    VALUES
      (p_pedido_id, 'removida', v_ator, v_papel, v_ordem_ant, NULL, p_observacao);

    RETURN jsonb_build_object(
      'ok', true,
      'prioridade_status', 'nenhuma',
      'alterado', true,
      'evento', 'removida',
      'total_itens', v_total_itens
    );
  END IF;

  -- ==========================================================
  -- 7.9 HABILITACAO — validacao EXATA do conjunto de itens
  -- ==========================================================
  IF p_item_ids IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_PRIORITY_ITEM_SET_INVALID: lista de itens obrigatoria'
      USING ERRCODE = '22004';
  END IF;

  IF v_total_itens < 2 THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_MIN_ITEMS: a prioridade so se aplica a um Pedido com pelo menos dois itens'
      USING ERRCODE = '23514';
  END IF;

  v_informados := array_length(p_item_ids, 1);
  IF v_informados IS NULL THEN
    RAISE EXCEPTION 'PEDIDO_PRIORITY_ITEM_SET_INVALID: lista de itens vazia'
      USING ERRCODE = '22004';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(p_item_ids) AS u(id) WHERE u.id IS NULL) THEN
    RAISE EXCEPTION 'PEDIDO_PRIORITY_ITEM_SET_INVALID: lista de itens contem valor nulo'
      USING ERRCODE = '22004';
  END IF;

  SELECT count(DISTINCT u.id) INTO v_distintos FROM unnest(p_item_ids) AS u(id);
  IF v_distintos <> v_informados THEN
    RAISE EXCEPTION 'PEDIDO_PRIORITY_ITEM_SET_INVALID: lista de itens contem duplicatas'
      USING ERRCODE = '23514';
  END IF;

  IF v_informados <> v_total_itens THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_ITEM_SET_INVALID: a lista tem % item(ns) e o Pedido tem %; informe cada item exatamente uma vez',
      v_informados, v_total_itens
      USING ERRCODE = '23514';
  END IF;

  -- Todo item informado pertence a ESTE Pedido. Combinado a cardinalidade
  -- igual e a ausencia de duplicatas, isto prova que o conjunto informado e
  -- EXATAMENTE a populacao corrente: nenhum item estranho, nenhum faltante.
  SELECT count(*) INTO v_pertencentes
    FROM unnest(p_item_ids) AS u(id)
    JOIN public.pedido_itens pi ON pi.id = u.id AND pi.pedido_id = p_pedido_id;

  IF v_pertencentes <> v_informados THEN
    RAISE EXCEPTION
      'PEDIDO_PRIORITY_ITEM_SET_INVALID: a lista contem item que nao pertence a este Pedido'
      USING ERRCODE = '23514';
  END IF;

  -- ---------- 7.10 aplica a sequencia: ordem contigua base zero ----------
  UPDATE public.pedido_itens pi
     SET ordem = seq.pos
    FROM (
      SELECT u.id, (u.ord - 1)::INTEGER AS pos
        FROM unnest(p_item_ids) WITH ORDINALITY AS u(id, ord)
    ) seq
   WHERE pi.id = seq.id
     AND pi.pedido_id = p_pedido_id
     AND pi.ordem IS DISTINCT FROM seq.pos;

  SELECT jsonb_agg(to_jsonb(u.id) ORDER BY u.ord)
    INTO v_ordem_nova
    FROM unnest(p_item_ids) WITH ORDINALITY AS u(id, ord);

  -- ---------- 7.11 resolve estado e evento ----------
  v_obs := NULLIF(btrim(COALESCE(p_observacao, '')), '');

  IF v_papel = 'admin' THEN
    -- Admin sempre resolve para confirmada; o Cliente nunca alcanca este ramo.
    v_novo_status := 'confirmada';
    v_evento := CASE
      WHEN v_pedido.prioridade_status = 'solicitada' THEN 'confirmada'
      WHEN v_pedido.prioridade_status = 'confirmada' THEN 'alterada_pelo_admin'
      ELSE 'confirmada'
    END;

    UPDATE public.pedidos
       SET prioridade_status         = 'confirmada',
           prioridade_observacao     = v_obs,
           prioridade_confirmada_em  = now(),
           prioridade_confirmada_por = v_ator,
           prioridade_atualizada_em  = now()
     WHERE id = p_pedido_id;
  ELSE
    -- Cliente: solicitar ou alterar a propria solicitacao. Nunca confirma e
    -- nunca preenche identidade de confirmacao.
    v_novo_status := 'solicitada';
    v_evento := CASE
      WHEN v_pedido.prioridade_status = 'solicitada' THEN 'alterada_pelo_cliente'
      ELSE 'solicitada'
    END;

    UPDATE public.pedidos
       SET prioridade_status         = 'solicitada',
           prioridade_observacao     = v_obs,
           prioridade_confirmada_em  = NULL,
           prioridade_confirmada_por = NULL,
           prioridade_atualizada_em  = now()
     WHERE id = p_pedido_id;
  END IF;

  INSERT INTO public.pedido_prioridade_eventos
    (pedido_id, evento, ator_id, ator_papel, ordem_anterior, ordem_nova, observacao)
  VALUES
    (p_pedido_id, v_evento, v_ator, v_papel, v_ordem_ant, v_ordem_nova, v_obs);

  RETURN jsonb_build_object(
    'ok', true,
    'prioridade_status', v_novo_status,
    'alterado', true,
    'evento', v_evento,
    'total_itens', v_total_itens,
    'ordem', v_ordem_nova
  );
END;
$$;

COMMENT ON FUNCTION public.definir_prioridade_pedido(UUID, UUID[], BOOLEAN, TEXT, BOOLEAN) IS
  'db/91: UNICO dono de mutacao da prioridade de producao entre os itens de um Pedido. Trava o Pedido e a populacao de itens antes de reordenar; exige o conjunto EXATO de itens correntes ao habilitar; Cliente resolve para solicitada e Admin para confirmada; Cliente e recusado apos aceitacao administrativa ou confirmacao; alteracao com producao iniciada exige p_confirmar_impacto_producao. Registra um evento em pedido_prioridade_eventos por mutacao efetiva.';

REVOKE ALL     ON FUNCTION public.definir_prioridade_pedido(UUID, UUID[], BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.definir_prioridade_pedido(UUID, UUID[], BOOLEAN, TEXT, BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION public.definir_prioridade_pedido(UUID, UUID[], BOOLEAN, TEXT, BOOLEAN) TO   authenticated;

-- ============================================================
-- 8. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
