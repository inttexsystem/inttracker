-- =====================================================================
-- db/99_planejamento_compra_refoundation.sql
-- PURCHASE-PLANNING-REFOUNDATION-R1 — planejar a compra ANTES de existir
-- um Pedido de Compra.
--
-- DEFEITO CORRIGIDO
--   Ate db/98 nao existia nenhuma entidade capaz de representar a frase
--   "esta necessidade sera atendida por este fornecedor". A unica forma
--   de guardar essa decisao era `ordem_compra_item_alocacao`, cujo
--   `item_id` e NOT NULL e cujo unico caminho ate um fornecedor passa
--   por `ordem_compra_item.ordem_id -> ordem_compra.fornecedor_id`.
--   Consequencia estrutural: atribuir um fornecedor CRIAVA um Pedido de
--   Compra imediatamente, em rascunho, e db/96 ainda exigia que o
--   operador digitasse o numero do documento nesse instante — antes de
--   ele ter decidido o que iria comprar.
--
--   Isso nao era um defeito de tela. O modelo de dados nao sabia dizer
--   "planejado mas ainda nao comprado".
--
-- O QUE ESTA MIGRACAO FAZ
--   Cria `public.necessidade_compra_planejamento`, uma entidade propria
--   que guarda (necessidade, fornecedor, kg) SEM tocar em ordem_compra,
--   ordem_compra_item, ordem_compra_item_alocacao ou
--   pedido_identidade_numeros. O Pedido de Compra passa a nascer apenas
--   no ato explicito de GERAR, a partir de linhas de planejamento ja
--   salvas de UM MESMO fornecedor.
--
-- DUAS ETAPAS, HONESTAS E SEPARADAS
--   ETAPA 1  necessidade -> planejamento           (nenhum documento)
--   ETAPA 2  planejamento selecionado -> Pedido de Compra atomico
--
-- NUMERACAO
--   `sugerir_codigo_ordem_compra` LE a sequencia e nao a consome: abrir,
--   atualizar ou cancelar a confirmacao nao reserva numero algum. A
--   reserva acontece exatamente uma vez, no COMMIT da geracao, e
--   acontece MESMO quando o operador substitui o codigo visivel, para
--   que a linhagem canonica do Pedido continue avancando. O contrato de
--   imutabilidade de db/96 continua sendo o dono do congelamento.
--
-- CUTOVER SEGURO PARA CLIENTE ANTIGO
--   `definir_alocacao_necessidade_compra_fio` (5 argumentos, aplicada em
--   producao como 96b) permanece com a MESMA assinatura, para nao repetir
--   o descasamento de cache do PostgREST, mas deixa de ser escritora
--   canonica: ela delega ao planejamento, nunca cria Pedido de Compra,
--   nunca consome numeracao e devolve um discriminador proprio de
--   compatibilidade. `p_codigo_ordem` vira entrada obsoleta.
--
-- ESCOPO NEGATIVO
--   Nao altera recebimento, estoque, Auth, Pedido, OP nem o fence C3C.
--   Nao renomeia objetos internos do dominio ordem_compra.
--   Nao aplica backfill: o dominio comercial estava vazio na verificacao
--   read-only que precedeu esta migracao (ordem_compra = 0,
--   ordem_compra_item = 0, ordem_compra_item_alocacao = 0).
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. A entidade de planejamento
-- ============================================================
-- Independente por construcao: nao referencia ordem_compra_item e nao
-- precisa de nenhum documento para existir. O fornecedor mora AQUI,
-- que e exatamente o dado que a alocacao nunca teve.
CREATE TABLE IF NOT EXISTS public.necessidade_compra_planejamento (
  id              BIGSERIAL PRIMARY KEY,
  necessidade_id  BIGINT NOT NULL
                    REFERENCES public.necessidade_compra_fio(id) ON DELETE CASCADE,
  fornecedor_id   BIGINT NOT NULL
                    REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  kg_planejado    NUMERIC(12,3) NOT NULL CHECK (kg_planejado > 0),

  -- Vinculo de geracao. Os tres nascem juntos e morrem juntos.
  alocacao_id     BIGINT
                    REFERENCES public.ordem_compra_item_alocacao(id) ON DELETE RESTRICT,
  ordem_compra_id BIGINT
                    REFERENCES public.ordem_compra(id) ON DELETE RESTRICT,
  gerado_em       TIMESTAMPTZ,
  gerado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NAO existe unicidade sobre TODA a historia de (necessidade, fornecedor).
  -- Comprar do mesmo fornecedor duas vezes para a mesma necessidade e um
  -- caso REAL e alcancavel: 1.000 kg necessarios, 500 kg comprados do
  -- fornecedor A no Pedido de Compra 1 e outros 500 kg do MESMO fornecedor A
  -- no Pedido de Compra 2. Uma UNIQUE sobre toda a historia proibiria a
  -- segunda compra para sempre. A unicidade correta e apenas sobre a linha
  -- VIVA, e esta declarada como indice parcial logo abaixo.

  -- Quantizacao NUMERIC(12,3) explicita: o alvo digitado e o alvo
  -- gravado, sem residuo binario silencioso.
  CONSTRAINT planejamento_kg_quantizado_chk
    CHECK (round(kg_planejado, 3) = kg_planejado),

  -- Geracao e all-or-nothing.
  CONSTRAINT planejamento_geracao_completa_chk CHECK (
    (alocacao_id IS NULL AND ordem_compra_id IS NULL AND gerado_em IS NULL)
    OR
    (alocacao_id IS NOT NULL AND ordem_compra_id IS NOT NULL AND gerado_em IS NOT NULL))
);

COMMENT ON TABLE public.necessidade_compra_planejamento IS
  'db/99: ETAPA 1 da compra. Guarda (necessidade, fornecedor, kg planejado) SEM criar Pedido de Compra, sem consumir numeracao e sem depender de ordem_compra_item. Uma linha com gerado_em NULL e planejamento vivo e editavel; uma linha com gerado_em preenchido ja virou alocacao real e e imutavel pelos escritores de planejamento.';
COMMENT ON COLUMN public.necessidade_compra_planejamento.alocacao_id IS
  'db/99: projecao gerada desta linha de planejamento, 1:1. NULL enquanto o planejamento ainda nao virou Pedido de Compra.';
COMMENT ON COLUMN public.necessidade_compra_planejamento.ordem_compra_id IS
  'db/99: Pedido de Compra que consumiu esta linha. Preservado quando a ordem e CANCELADA (historia) e liberado quando a ordem e EXCLUIDA permanentemente.';

-- A unicidade real: no maximo UMA linha VIVA por (necessidade, fornecedor).
-- Linhas ja geradas sao historia e podem coexistir livremente com ela e entre
-- si, o que e exatamente o que permite comprar do mesmo fornecedor de novo.
CREATE UNIQUE INDEX IF NOT EXISTS necessidade_compra_planejamento_viva_uidx
  ON public.necessidade_compra_planejamento (necessidade_id, fornecedor_id)
  WHERE gerado_em IS NULL;

-- Uma alocacao pertence a no maximo uma linha de planejamento.
CREATE UNIQUE INDEX IF NOT EXISTS necessidade_compra_planejamento_alocacao_uidx
  ON public.necessidade_compra_planejamento (alocacao_id)
  WHERE alocacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS necessidade_compra_planejamento_necessidade_idx
  ON public.necessidade_compra_planejamento (necessidade_id);

CREATE INDEX IF NOT EXISTS necessidade_compra_planejamento_ordem_idx
  ON public.necessidade_compra_planejamento (ordem_compra_id)
  WHERE ordem_compra_id IS NOT NULL;

-- Selecionavel para geracao = salvo e ainda nao gerado.
CREATE INDEX IF NOT EXISTS necessidade_compra_planejamento_pendente_idx
  ON public.necessidade_compra_planejamento (fornecedor_id)
  WHERE gerado_em IS NULL;

ALTER TABLE public.necessidade_compra_planejamento ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.necessidade_compra_planejamento FROM PUBLIC;
REVOKE ALL ON TABLE public.necessidade_compra_planejamento FROM anon;
REVOKE ALL ON TABLE public.necessidade_compra_planejamento FROM authenticated;

-- Leitura administrativa direta; NENHUMA policy de INSERT/UPDATE/DELETE
-- para role cliente. As RPCs SECURITY DEFINER abaixo sao a unica
-- superficie de escrita, exatamente como em db/67 §R.4 Ruling 3.
GRANT SELECT ON TABLE public.necessidade_compra_planejamento TO authenticated;

DROP POLICY IF EXISTS necessidade_compra_planejamento_admin_select
  ON public.necessidade_compra_planejamento;
CREATE POLICY necessidade_compra_planejamento_admin_select
  ON public.necessidade_compra_planejamento FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON SEQUENCE public.necessidade_compra_planejamento_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.necessidade_compra_planejamento_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.necessidade_compra_planejamento_id_seq FROM authenticated;

-- ============================================================
-- 2. Invariantes executaveis
-- ============================================================

-- 2.1 Compatibilidade fornecedor x material.
-- Mesma regra que o servidor ja aplicava na distribuicao (db/74/db/96):
-- algodao -> fio_algodao, poliester -> fio_poliester. Aqui ela vira
-- invariante de tabela, e nao apenas de escritor.
CREATE OR REPLACE FUNCTION public.trg_planejamento_compatibilidade_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_material TEXT;
  v_tipo     TEXT;
  v_legado   BOOLEAN;
  v_pedido   UUID;
BEGIN
  SELECT n.material, n.legado, n.pedido_id
    INTO v_material, v_legado, v_pedido
    FROM public.necessidade_compra_fio n
   WHERE n.id = NEW.necessidade_id;

  IF v_material IS NULL THEN
    RAISE EXCEPTION 'Necessidade % inexistente para planejamento', NEW.necessidade_id;
  END IF;

  IF v_legado THEN
    RAISE EXCEPTION 'Necessidade legada nao pode receber planejamento nativo (necessidade %)',
      NEW.necessidade_id;
  END IF;

  IF v_pedido IS NULL THEN
    RAISE EXCEPTION 'Necessidade sem Pedido nao pode receber planejamento (necessidade %)',
      NEW.necessidade_id;
  END IF;

  SELECT f.tipo INTO v_tipo FROM public.fornecedores f WHERE f.id = NEW.fornecedor_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Fornecedor % inexistente para planejamento', NEW.fornecedor_id;
  END IF;

  IF (v_material = 'algodao'   AND v_tipo <> 'fio_algodao')
     OR (v_material = 'poliester' AND v_tipo <> 'fio_poliester') THEN
    RAISE EXCEPTION 'Fornecedor % (%) e incompativel com o material % da necessidade %',
      NEW.fornecedor_id, v_tipo, v_material, NEW.necessidade_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planejamento_compatibilidade_guard
  ON public.necessidade_compra_planejamento;
CREATE TRIGGER planejamento_compatibilidade_guard
  BEFORE INSERT OR UPDATE OF necessidade_id, fornecedor_id
  ON public.necessidade_compra_planejamento
  FOR EACH ROW EXECUTE FUNCTION public.trg_planejamento_compatibilidade_guard();

-- 2.2 Teto da necessidade.
-- Constraint trigger DEFERRABLE porque a geracao e o planejamento rapido
-- mexem em varias linhas da mesma necessidade dentro de UMA transacao;
-- o estado intermediario pode estourar, o estado final nunca.
CREATE OR REPLACE FUNCTION public.trg_planejamento_saldo_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_need      BIGINT;
  v_total     NUMERIC(12,3);
  v_necessario NUMERIC(12,3);
BEGIN
  v_need := COALESCE(NEW.necessidade_id, OLD.necessidade_id);
  IF v_need IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT n.kg_necessario INTO v_necessario
    FROM public.necessidade_compra_fio n WHERE n.id = v_need;
  IF v_necessario IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(sum(p.kg_planejado), 0)::NUMERIC(12,3) INTO v_total
    FROM public.necessidade_compra_planejamento p
   WHERE p.necessidade_id = v_need;

  IF v_total > v_necessario THEN
    RAISE EXCEPTION
      'Planejamento total (% kg) excede a necessidade % (% kg)',
      v_total, v_need, v_necessario
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS planejamento_saldo_guard
  ON public.necessidade_compra_planejamento;
CREATE CONSTRAINT TRIGGER planejamento_saldo_guard
  AFTER INSERT OR UPDATE OR DELETE
  ON public.necessidade_compra_planejamento
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.trg_planejamento_saldo_guard();

-- 2.3 Imutabilidade do planejamento ja gerado.
-- Uma linha gerada representa uma alocacao real dentro de um Pedido de
-- Compra: os escritores de planejamento nao a alteram e nao a apagam.
-- O UNICO relaxamento e a liberacao autorizada durante a exclusao
-- permanente da propria ordem, pelo mesmo padrao de GUC transacional que
-- db/96 ja usa em `oc_exclusao_autorizada`.
CREATE OR REPLACE FUNCTION public.oc_planejamento_liberacao_autorizada(p_ordem_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p_ordem_id IS NOT NULL
     AND coalesce(current_setting('app.oc_plan_release_id', true), '') = p_ordem_id::text;
$$;

COMMENT ON FUNCTION public.oc_planejamento_liberacao_autorizada(BIGINT) IS
  'db/99: verdadeiro somente durante public.excluir_ordem_compra, e somente para a UNICA ordem que ela esta apagando. O GUC e transacional e nenhuma role cliente tem DML direto na tabela de planejamento.';

CREATE OR REPLACE FUNCTION public.trg_planejamento_geracao_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.gerado_em IS NOT NULL THEN
      -- Excecao unica: a exclusao permanente da PROPRIA ordem, que ja
      -- devolveu a quantidade desta linha a linha viva do mesmo par
      -- (necessidade, fornecedor). Sem isto a devolucao teria de escolher
      -- entre violar o indice de unicidade da linha viva ou perder a
      -- decisao de compra.
      IF public.oc_planejamento_liberacao_autorizada(OLD.ordem_compra_id) THEN
        RETURN OLD;
      END IF;
      RAISE EXCEPTION
        'Planejamento % ja gerado no Pedido de Compra % e nao pode ser removido',
        OLD.id, OLD.ordem_compra_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.gerado_em IS NOT NULL THEN
    -- Liberacao autorizada: a ordem esta sendo permanentemente excluida e
    -- a linha volta a ser planejamento vivo, com a MESMA quantidade.
    IF public.oc_planejamento_liberacao_autorizada(OLD.ordem_compra_id)
       AND NEW.gerado_em IS NULL
       AND NEW.alocacao_id IS NULL
       AND NEW.ordem_compra_id IS NULL
       AND NEW.kg_planejado = OLD.kg_planejado
       AND NEW.necessidade_id = OLD.necessidade_id
       AND NEW.fornecedor_id = OLD.fornecedor_id THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Planejamento % ja gerado no Pedido de Compra % e imutavel',
      OLD.id, OLD.ordem_compra_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planejamento_geracao_guard
  ON public.necessidade_compra_planejamento;
CREATE TRIGGER planejamento_geracao_guard
  BEFORE UPDATE OR DELETE
  ON public.necessidade_compra_planejamento
  FOR EACH ROW EXECUTE FUNCTION public.trg_planejamento_geracao_guard();

-- ============================================================
-- 3. Namespace de idempotencia do planejamento
-- ============================================================
-- db/74 restringiu `idempotency_namespace` a um unico valor. O
-- planejamento e um comando diferente e precisa do seu proprio espaco,
-- para que uma chave de planejamento nunca colida com uma chave de
-- distribuicao historica.
ALTER TABLE public.ordem_compra_distribuicao_comandos
  DROP CONSTRAINT IF EXISTS ordem_compra_distribuicao_comandos_idempotency_namespace_check;

ALTER TABLE public.ordem_compra_distribuicao_comandos
  ADD CONSTRAINT ordem_compra_distribuicao_comandos_idempotency_namespace_check
  CHECK (idempotency_namespace IN (
    'native_distribution_v1',
    'native_planning_v1',
    'native_generation_v1'
  ));

-- ============================================================
-- 4. Read model do planejamento de um Pedido
-- ============================================================
CREATE OR REPLACE FUNCTION public.obter_planejamento_compra_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_necessidades JSONB;
  v_fornecedores JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode ler o planejamento de compras');
  END IF;

  IF p_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_invalido',
      'erro', 'Pedido obrigatorio');
  END IF;

  SELECT coalesce(jsonb_agg(linha ORDER BY linha->>'ordenacao', (linha->>'necessidade_id')::BIGINT), '[]'::jsonb)
    INTO v_necessidades
    FROM (
      SELECT jsonb_build_object(
               'necessidade_id',  n.id,
               'origem_tipo',     n.origem_tipo,
               'op_id',           n.op_id,
               'op_identidade',   o.identidade_operacional,
               'material',        n.material,
               'cor_id',          n.cor_id,
               'cor_nome',        c.nome,
               'cor_poliester',   n.cor_poliester,
               'kg_necessario',   n.kg_necessario,
               'kg_planejado',    coalesce(pl.total, 0)::NUMERIC(12,3),
               'kg_restante',     (n.kg_necessario - coalesce(pl.total, 0))::NUMERIC(12,3),
               'kg_gerado',       coalesce(pl.total_gerado, 0)::NUMERIC(12,3),
               -- Ordenacao obrigatoria: pendente, parcial, distribuido.
               'situacao',
                 CASE
                   WHEN coalesce(pl.total, 0) <= 0                THEN 'pendente'
                   WHEN coalesce(pl.total, 0) < n.kg_necessario   THEN 'parcial'
                   ELSE 'distribuido'
                 END,
               'ordenacao',
                 CASE
                   WHEN coalesce(pl.total, 0) <= 0                THEN '1'
                   WHEN coalesce(pl.total, 0) < n.kg_necessario   THEN '2'
                   ELSE '3'
                 END,
               'planejamentos', coalesce(pl.linhas, '[]'::jsonb)
             ) AS linha
        FROM public.necessidade_compra_fio n
        LEFT JOIN public.ops o   ON o.id = n.op_id
        LEFT JOIN public.cores c ON c.id = n.cor_id
        LEFT JOIN LATERAL (
          SELECT sum(p.kg_planejado) AS total,
                 sum(p.kg_planejado) FILTER (WHERE p.gerado_em IS NOT NULL) AS total_gerado,
                 jsonb_agg(jsonb_build_object(
                   'planejamento_id', p.id,
                   'fornecedor_id',   p.fornecedor_id,
                   'fornecedor_nome', f.nome,
                   'kg_planejado',    p.kg_planejado,
                   'gerado',          p.gerado_em IS NOT NULL,
                   'gerado_em',       p.gerado_em,
                   'ordem_compra_id', p.ordem_compra_id,
                   'ordem_identidade', oc.identidade_operacional
                 ) ORDER BY f.nome, p.id) AS linhas
            FROM public.necessidade_compra_planejamento p
            JOIN public.fornecedores f ON f.id = p.fornecedor_id
            LEFT JOIN public.ordem_compra oc ON oc.id = p.ordem_compra_id
           WHERE p.necessidade_id = n.id
        ) pl ON TRUE
       WHERE n.pedido_id = p_pedido_id
         AND n.legado = FALSE
    ) s;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'fornecedor_id', f.id, 'nome', f.nome, 'tipo', f.tipo
         ) ORDER BY f.nome), '[]'::jsonb)
    INTO v_fornecedores
    FROM public.fornecedores f
   WHERE f.tipo IN ('fio_algodao', 'fio_poliester');

  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'pedido_id', p_pedido_id,
    'necessidades', v_necessidades,
    'fornecedores', v_fornecedores
  );
END;
$$;

COMMENT ON FUNCTION public.obter_planejamento_compra_pedido(UUID) IS
  'db/99: read model unico da tela Planejamento de compras. Projeta necessidade, total planejado, saldo restante, situacao (pendente/parcial/distribuido) e as linhas de planejamento com o vinculo de geracao. A tela nao reimplementa nenhuma dessas regras.';

-- ============================================================
-- 5. Escritor canonico do planejamento (alvo ABSOLUTO)
-- ============================================================
-- Zero = remover a linha. Nunca cria Pedido de Compra, nunca toca em
-- pedido_identidade_numeros e nunca aceita codigo.
CREATE OR REPLACE FUNCTION public.definir_planejamento_compra(
  p_necessidade_id  BIGINT,
  p_fornecedor_id   BIGINT,
  p_kg_planejado    NUMERIC,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor    UUID;
  v_key      TEXT;
  v_payload  JSONB;
  v_hash     TEXT;
  v_command  public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_need     public.necessidade_compra_fio%ROWTYPE;
  v_plan     public.necessidade_compra_planejamento%ROWTYPE;
  v_target   NUMERIC(12,3);
  v_previous NUMERIC(12,3) := 0;
  v_disponivel NUMERIC(12,3);
  v_total    NUMERIC(12,3);
  v_disc     TEXT;
  v_plan_id  BIGINT;
  v_result   JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  v_target := p_kg_planejado;
  IF v_target IS NULL OR v_target < 0 OR round(v_target, 3) IS DISTINCT FROM v_target THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
      'erro', 'Quantidade deve usar NUMERIC(12,3), sem sinal negativo');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'necessidade_id', p_necessidade_id,
    'fornecedor_id', p_fornecedor_id,
    'kg_planejado', to_char(v_target, 'FM9999999990.000')
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor
     AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT * INTO v_need FROM public.necessidade_compra_fio
   WHERE id = p_necessidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
      'erro', 'Necessidade nao encontrada');
  END IF;
  IF v_need.legado OR v_need.pedido_id IS NULL OR v_need.kg_necessario <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
      'erro', 'Necessidade nao e nativa e planejavel');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = p_fornecedor_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
      'erro', 'Fornecedor inexistente');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.fornecedores f
     WHERE f.id = p_fornecedor_id
       AND ((v_need.material = 'algodao'   AND f.tipo = 'fio_algodao')
         OR (v_need.material = 'poliester' AND f.tipo = 'fio_poliester'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
      'erro', 'Fornecedor incompativel com o material');
  END IF;

  -- Somente a linha VIVA participa: uma linha ja gerada e historia e nao
  -- bloqueia uma nova compra do mesmo fornecedor para a mesma necessidade.
  SELECT * INTO v_plan FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = p_necessidade_id AND fornecedor_id = p_fornecedor_id
     AND gerado_em IS NULL
   FOR UPDATE;
  IF FOUND THEN
    v_previous := v_plan.kg_planejado;
    v_plan_id  := v_plan.id;
  END IF;

  SELECT coalesce(sum(kg_planejado), 0)::NUMERIC(12,3) INTO v_total
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = p_necessidade_id;

  v_disponivel := v_need.kg_necessario - (v_total - v_previous);
  IF v_target > v_disponivel THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'Planejamento excede o saldo da necessidade',
      'necessidade_id', v_need.id, 'disponivel', v_disponivel);
  END IF;

  IF v_target = 0 AND v_plan_id IS NOT NULL THEN
    DELETE FROM public.necessidade_compra_planejamento WHERE id = v_plan_id;
    v_disc := 'removido';
    v_plan_id := NULL;
  ELSIF v_target = 0 THEN
    v_disc := 'inalterado';
  ELSIF v_plan_id IS NULL THEN
    INSERT INTO public.necessidade_compra_planejamento(
      necessidade_id, fornecedor_id, kg_planejado, criado_por
    ) VALUES (p_necessidade_id, p_fornecedor_id, v_target, v_actor)
    RETURNING id INTO v_plan_id;
    v_disc := 'criado';
  ELSIF v_target <> v_previous THEN
    UPDATE public.necessidade_compra_planejamento
       SET kg_planejado = v_target, atualizado_em = now()
     WHERE id = v_plan_id;
    v_disc := CASE WHEN v_target > v_previous THEN 'aumentado' ELSE 'reduzido' END;
  ELSE
    v_disc := 'inalterado';
  END IF;

  SELECT coalesce(sum(kg_planejado), 0)::NUMERIC(12,3) INTO v_total
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = p_necessidade_id;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', v_disc,
    'planejamento_id', v_plan_id,
    'necessidade_id', v_need.id,
    'pedido_id', v_need.pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'kg_anterior', v_previous,
    'kg_final', v_target,
    'necessidade_kg_necessario', v_need.kg_necessario,
    'necessidade_kg_planejado', v_total,
    'necessidade_kg_restante', (v_need.kg_necessario - v_total)::NUMERIC(12,3),
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT) IS
  'db/99: escritor canonico e idempotente da ETAPA 1. Alvo ABSOLUTO por (necessidade, fornecedor); zero remove a linha. NAO cria ordem_compra, NAO cria ordem_compra_item, NAO cria ordem_compra_item_alocacao e NAO consome pedido_identidade_numeros.';

-- ============================================================
-- 5b. Substituicao ATOMICA de todas as linhas VIVAS de uma necessidade
-- ============================================================
-- Este e o dono do "salvar o cartao" da tela. Salvar um cartao e UMA
-- operacao de negocio, e nao uma sequencia de chamadas independentes:
-- com o escritor linha-a-linha, uma recusa na segunda linha deixava a
-- primeira ja gravada e o cartao ficava num estado que o operador nunca
-- pediu. Aqui o conjunto INTEIRO e validado antes de qualquer escrita, de
-- modo que uma recusa devolve o estado anterior intacto.
--
-- `p_linhas` e o conjunto COMPLETO de linhas vivas desejadas:
--   [{"fornecedor_id": 1, "kg": 600.000}, {"fornecedor_id": 2, "kg": 400.000}]
-- Um fornecedor ausente do conjunto tem a sua linha viva REMOVIDA. Um
-- conjunto vazio remove todas as linhas vivas. Linhas ja geradas nao sao
-- tocadas: elas sao historia e continuam contando no total.
CREATE OR REPLACE FUNCTION public.substituir_planejamento_compra_necessidade(
  p_necessidade_id  BIGINT,
  p_linhas          JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor    UUID;
  v_key      TEXT;
  v_payload  JSONB;
  v_hash     TEXT;
  v_command  public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_need     public.necessidade_compra_fio%ROWTYPE;
  v_linha    JSONB;
  v_forn     BIGINT;
  v_kg       NUMERIC(12,3);
  v_tipo     TEXT;
  v_gerado   NUMERIC(12,3);
  v_soma     NUMERIC(12,3) := 0;
  v_validas  JSONB := '[]'::jsonb;
  v_ids      BIGINT[] := ARRAY[]::BIGINT[];
  v_criadas  INTEGER := 0;
  v_atualizadas INTEGER := 0;
  v_removidas   INTEGER := 0;
  v_result   JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_invalida',
      'erro', 'O conjunto de distribuicoes e invalido');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'modo', 'substituicao',
    'necessidade_id', p_necessidade_id,
    'linhas', p_linhas
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  -- Trava a necessidade: o teto e a soma sao lidos e aplicados sob a mesma
  -- trava, de modo que duas edicoes concorrentes do mesmo cartao serializam.
  SELECT * INTO v_need FROM public.necessidade_compra_fio
   WHERE id = p_necessidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
      'erro', 'Necessidade nao encontrada');
  END IF;
  IF v_need.legado OR v_need.pedido_id IS NULL OR v_need.kg_necessario <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
      'erro', 'Necessidade nao e nativa e planejavel');
  END IF;

  -- ---------- PASSO 1: VALIDAR O CONJUNTO INTEIRO, SEM ESCREVER ----------
  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    v_forn := (v_linha->>'fornecedor_id')::BIGINT;
    IF v_forn IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
        'erro', 'Informe o fornecedor de cada distribuicao');
    END IF;

    -- Fornecedor repetido no MESMO conjunto: o alvo e absoluto por
    -- fornecedor, entao duas linhas do mesmo fornecedor nao tem significado.
    IF v_forn = ANY(v_ids) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_duplicado',
        'erro', 'O mesmo fornecedor aparece mais de uma vez nesta distribuicao',
        'fornecedor_id', v_forn);
    END IF;
    v_ids := v_ids || v_forn;

    v_kg := (v_linha->>'kg')::NUMERIC(12,3);
    IF v_kg IS NULL OR v_kg <= 0 OR round(v_kg, 3) IS DISTINCT FROM v_kg THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
        'erro', 'Quantidade deve ser positiva e usar NUMERIC(12,3)',
        'fornecedor_id', v_forn);
    END IF;

    SELECT f.tipo INTO v_tipo FROM public.fornecedores f WHERE f.id = v_forn;
    IF v_tipo IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
        'erro', 'Fornecedor inexistente', 'fornecedor_id', v_forn);
    END IF;
    IF (v_need.material = 'algodao'   AND v_tipo <> 'fio_algodao')
       OR (v_need.material = 'poliester' AND v_tipo <> 'fio_poliester') THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
        'erro', 'Fornecedor incompativel com o material', 'fornecedor_id', v_forn);
    END IF;

    v_soma := v_soma + v_kg;
    v_validas := v_validas || jsonb_build_object('fornecedor_id', v_forn, 'kg', v_kg);
  END LOOP;

  -- O teto considera a historia: linhas ja geradas continuam ocupando saldo.
  SELECT coalesce(sum(kg_planejado), 0)::NUMERIC(12,3) INTO v_gerado
    FROM public.necessidade_compra_planejamento
   WHERE necessidade_id = p_necessidade_id AND gerado_em IS NOT NULL;

  IF (v_soma + v_gerado) > v_need.kg_necessario THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'A distribuicao excede a necessidade',
      'necessidade_id', v_need.id,
      'kg_necessario', v_need.kg_necessario,
      'kg_gerado', v_gerado,
      'kg_solicitado', v_soma,
      'disponivel', (v_need.kg_necessario - v_gerado)::NUMERIC(12,3));
  END IF;

  -- ---------- PASSO 2: APLICAR. Nao ha mais caminho de recusa. ----------
  WITH alvo AS (
    DELETE FROM public.necessidade_compra_planejamento
     WHERE necessidade_id = p_necessidade_id
       AND gerado_em IS NULL
       AND NOT (fornecedor_id = ANY(v_ids))
    RETURNING id
  ) SELECT count(*) INTO v_removidas FROM alvo;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(v_validas)
  LOOP
    v_forn := (v_linha->>'fornecedor_id')::BIGINT;
    v_kg   := (v_linha->>'kg')::NUMERIC(12,3);

    UPDATE public.necessidade_compra_planejamento
       SET kg_planejado = v_kg, atualizado_em = now()
     WHERE necessidade_id = p_necessidade_id
       AND fornecedor_id = v_forn
       AND gerado_em IS NULL;
    IF FOUND THEN
      v_atualizadas := v_atualizadas + 1;
    ELSE
      INSERT INTO public.necessidade_compra_planejamento(
        necessidade_id, fornecedor_id, kg_planejado, criado_por
      ) VALUES (p_necessidade_id, v_forn, v_kg, v_actor);
      v_criadas := v_criadas + 1;
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'substituido',
    'necessidade_id', v_need.id,
    'pedido_id', v_need.pedido_id,
    'linhas_criadas', v_criadas,
    'linhas_atualizadas', v_atualizadas,
    'linhas_removidas', v_removidas,
    'necessidade_kg_necessario', v_need.kg_necessario,
    'necessidade_kg_gerado', v_gerado,
    'necessidade_kg_planejado', (v_soma + v_gerado)::NUMERIC(12,3),
    'necessidade_kg_restante', (v_need.kg_necessario - v_soma - v_gerado)::NUMERIC(12,3),
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT) IS
  'db/99: dono ATOMICO do salvar de um cartao de necessidade. Recebe o conjunto COMPLETO de linhas VIVAS desejadas, valida tudo (fornecedor duplicado, existencia, compatibilidade, quantidade, teto somado a historia ja gerada) ANTES de qualquer escrita e so entao insere, atualiza e remove. Uma recusa deixa o estado anterior integralmente intacto. Linhas ja geradas nunca sao tocadas e continuam contando no teto. Nao cria Pedido de Compra e nao consome numeracao.';

-- ============================================================
-- 6. Planejamento rapido (lote atomico, um fornecedor)
-- ============================================================
CREATE OR REPLACE FUNCTION public.aplicar_planejamento_rapido(
  p_pedido_id       UUID,
  p_fornecedor_id   BIGINT,
  p_itens           JSONB,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor   UUID;
  v_key     TEXT;
  v_payload JSONB;
  v_hash    TEXT;
  v_command public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_tipo    TEXT;
  v_item    JSONB;
  v_need    public.necessidade_compra_fio%ROWTYPE;
  v_kg      NUMERIC(12,3);
  v_total   NUMERIC(12,3);
  v_prev    NUMERIC(12,3);
  v_aplicados JSONB := '[]'::jsonb;
  v_count   INTEGER := 0;
  v_necessidades_prelim BIGINT[];
  v_result  JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode planejar compras');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma necessidade');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_planning_v1',
    'modo', 'rapido',
    'pedido_id', p_pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'itens', p_itens
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_planning_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_planning_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT f.tipo INTO v_tipo FROM public.fornecedores f WHERE f.id = p_fornecedor_id;
  IF v_tipo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido',
      'erro', 'Fornecedor inexistente');
  END IF;

  -- Uma necessidade nao pode aparecer duas vezes no mesmo lote: o alvo e
  -- absoluto e um lote com a mesma necessidade repetida nao tem significado.
  IF (SELECT count(DISTINCT value->>'necessidade_id') FROM jsonb_array_elements(p_itens))
     <> jsonb_array_length(p_itens) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_duplicada',
      'erro', 'A mesma necessidade aparece mais de uma vez na selecao');
  END IF;

  -- PASSO 0 — TRAVAR AS NECESSIDADES EM ORDEM CANONICA DE id.
  -- A ORDEM DO ARRAY DO CLIENTE NAO PODE DECIDIR A ORDEM DE TRAVA. Antes, a
  -- validacao percorria jsonb_array_elements(p_itens) e travava cada
  -- necessidade na ordem em que o cliente as enviou; um lote [2,1] concorrente
  -- com uma geracao que trava [1,2] fechava um ciclo apenas entre linhas de
  -- necessidade, antes mesmo de qualquer linha de planejamento.
  --
  -- Esta leitura e PRELIMINAR e NAO AUTORITATIVA: serve so para descobrir o
  -- conjunto distinto a travar. Todo o resto continua sendo validado abaixo,
  -- ja sob as travas.
  SELECT array_agg(DISTINCT (value->>'necessidade_id')::BIGINT
                   ORDER BY (value->>'necessidade_id')::BIGINT)
    INTO v_necessidades_prelim
    FROM jsonb_array_elements(p_itens);

  IF v_necessidades_prelim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma necessidade');
  END IF;

  PERFORM 1 FROM public.necessidade_compra_fio
   WHERE id = ANY(v_necessidades_prelim) ORDER BY id FOR UPDATE;

  -- PASSO 1 — VALIDAR TUDO. Nenhuma linha e escrita nesta passagem.
  -- Um RETURN de erro no meio de uma escrita NAO desfaz o que ja foi
  -- gravado: a funcao participa da transacao do chamador e nao a aborta.
  -- Por isso a validacao e completa ANTES de qualquer INSERT, e o lote e
  -- atomico de verdade em vez de apenas parecer atomico.
  --
  -- A releitura abaixo e a AUTORITATIVA: ela acontece com as necessidades ja
  -- travadas, entao nada que a leitura preliminar viu pode autorizar escrita.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    SELECT * INTO v_need FROM public.necessidade_compra_fio
     WHERE id = (v_item->>'necessidade_id')::BIGINT FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada',
        'erro', 'Necessidade nao encontrada', 'necessidade_id', v_item->>'necessidade_id');
    END IF;

    IF v_need.pedido_id IS DISTINCT FROM p_pedido_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_incoerente',
        'erro', 'Necessidade nao pertence ao Pedido informado',
        'necessidade_id', v_need.id);
    END IF;
    IF v_need.legado OR v_need.kg_necessario <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida',
        'erro', 'Necessidade nao e nativa e planejavel', 'necessidade_id', v_need.id);
    END IF;

    IF (v_need.material = 'algodao'   AND v_tipo <> 'fio_algodao')
       OR (v_need.material = 'poliester' AND v_tipo <> 'fio_poliester') THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel',
        'erro', 'Fornecedor incompativel com o material da necessidade',
        'necessidade_id', v_need.id);
    END IF;

    SELECT coalesce(sum(kg_planejado), 0)::NUMERIC(12,3) INTO v_total
      FROM public.necessidade_compra_planejamento WHERE necessidade_id = v_need.id;
    SELECT coalesce(kg_planejado, 0)::NUMERIC(12,3) INTO v_prev
      FROM public.necessidade_compra_planejamento
     WHERE necessidade_id = v_need.id AND fornecedor_id = p_fornecedor_id
       AND gerado_em IS NULL;
    v_prev := coalesce(v_prev, 0);

    -- Sem `kg` explicito o comando significa "preencher com o saldo exato".
    IF v_item ? 'kg' AND (v_item->>'kg') IS NOT NULL THEN
      v_kg := (v_item->>'kg')::NUMERIC(12,3);
    ELSE
      v_kg := (v_need.kg_necessario - (v_total - v_prev))::NUMERIC(12,3);
    END IF;

    IF v_kg IS NULL OR v_kg <= 0 OR round(v_kg, 3) IS DISTINCT FROM v_kg THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido',
        'erro', 'Quantidade invalida para a necessidade', 'necessidade_id', v_need.id);
    END IF;
    IF v_kg > (v_need.kg_necessario - (v_total - v_prev)) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
        'erro', 'Planejamento excede o saldo da necessidade',
        'necessidade_id', v_need.id,
        'disponivel', (v_need.kg_necessario - (v_total - v_prev))::NUMERIC(12,3));
    END IF;

    v_aplicados := v_aplicados || jsonb_build_object(
      'necessidade_id', v_need.id, 'kg_planejado', v_kg);
  END LOOP;

  -- PASSO 2 — APLICAR. Toda a validacao passou; daqui para a frente nao
  -- existe mais nenhum caminho de recusa.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_aplicados)
  LOOP
    INSERT INTO public.necessidade_compra_planejamento(
      necessidade_id, fornecedor_id, kg_planejado, criado_por
    ) VALUES (
      (v_item->>'necessidade_id')::BIGINT, p_fornecedor_id,
      (v_item->>'kg_planejado')::NUMERIC(12,3), v_actor
    )
    ON CONFLICT (necessidade_id, fornecedor_id) WHERE gerado_em IS NULL DO UPDATE
      SET kg_planejado = EXCLUDED.kg_planejado, atualizado_em = now();
    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'rapido',
    'pedido_id', p_pedido_id,
    'fornecedor_id', p_fornecedor_id,
    'necessidades_aplicadas', v_count,
    'aplicados', v_aplicados,
    'ordem_compra_criada', false
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_planning_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT) IS
  'db/99: aplica UM fornecedor a varias necessidades compativeis do mesmo Pedido em uma unica transacao. Item sem `kg` significa preencher com o saldo exato da necessidade. Compatibilidade e teto continuam sendo decididos pelo servidor. Nao cria Pedido de Compra.';

-- ============================================================
-- 7. Sugestao de numero — LEITURA PURA
-- ============================================================
-- Nao consome sequencia, nao escreve em pedido_identidade_numeros e nao
-- cria linha alguma. Abrir, atualizar ou cancelar a confirmacao e
-- gratuito. Declarada STABLE justamente para que qualquer escrita
-- acidental futura falhe em tempo de execucao.
CREATE OR REPLACE FUNCTION public.sugerir_codigo_ordem_compra(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_numero BIGINT;
  v_ano    SMALLINT;
  v_ultimo INTEGER;
  v_seq    INTEGER;
  v_codigo TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode gerar Pedido de Compra');
  END IF;

  SELECT p.numero, public.pedido_ano_comercial(p.data_pedido, p.criado_em)
    INTO v_numero, v_ano
    FROM public.pedidos p WHERE p.id = p_pedido_id;

  IF v_numero IS NULL OR v_ano IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_sem_identidade',
      'erro', 'O Pedido ainda nao tem numero comercial e ano definidos');
  END IF;

  SELECT n.ultimo_seq INTO v_ultimo
    FROM public.pedido_identidade_numeros n
   WHERE n.pedido_id = p_pedido_id AND n.escopo = 'OC';

  v_seq := coalesce(v_ultimo, 0) + 1;
  v_codigo := 'OC-' || lpad(v_numero::TEXT, 3, '0')
              || '-' || v_seq::TEXT
              || '-' || lpad((v_ano % 100)::TEXT, 2, '0');

  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'pedido_id', p_pedido_id,
    'sequencia_sugerida', v_seq,
    'codigo_sugerido', v_codigo,
    'consumiu_sequencia', false
  );
END;
$$;

COMMENT ON FUNCTION public.sugerir_codigo_ordem_compra(UUID) IS
  'db/99: sugestao NAO MUTANTE do proximo codigo canonico de Pedido de Compra do Pedido. Le pedido_identidade_numeros e nao reserva nada; a reserva acontece somente no COMMIT de gerar_ordem_compra_do_planejamento. Declarada STABLE de proposito.';

-- ============================================================
-- 8. Geracao atomica do Pedido de Compra
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_ordem_compra_do_planejamento(
  p_planejamento_ids BIGINT[],
  p_codigo           TEXT,
  p_sequencia_esperada INTEGER,
  p_idempotency_key  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor     UUID;
  v_key       TEXT;
  v_payload   JSONB;
  v_hash      TEXT;
  v_command   public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_codigo    TEXT;
  v_pedido    UUID;
  v_fornecedor BIGINT;
  v_numero    BIGINT;
  v_ano       SMALLINT;
  v_ultimo    INTEGER;
  v_proximo   INTEGER;
  v_seq       INTEGER;
  v_ordem_id  BIGINT;
  v_item_id   BIGINT;
  v_aloc_id   BIGINT;
  v_grupo     RECORD;
  v_plan      RECORD;
  v_itens     INTEGER := 0;
  v_alocacoes INTEGER := 0;
  v_distintos_fornecedor INTEGER;
  v_distintos_pedido     INTEGER;
  v_rascunho  BIGINT;
  v_necessidades_prelim BIGINT[];
  v_necessidades        BIGINT[];
  v_total     NUMERIC(12,3) := 0;
  v_identidade TEXT;
  v_result    JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode gerar Pedido de Compra');
  END IF;

  v_key := btrim(coalesce(p_idempotency_key, ''));
  IF v_key = '' OR length(v_key) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida',
      'erro', 'Chave de idempotencia invalida');
  END IF;

  IF p_planejamento_ids IS NULL OR array_length(p_planejamento_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'selecao_vazia',
      'erro', 'Selecione ao menos uma distribuicao salva');
  END IF;

  v_codigo := btrim(coalesce(p_codigo, ''));
  IF v_codigo = '' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_invalido',
      'erro', 'Informe o numero do Pedido de Compra');
  END IF;
  IF length(v_codigo) > 40 OR v_codigo ~ '[[:cntrl:]]' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_invalido',
      'erro', 'O numero deve ter ate 40 caracteres, sem espaco no inicio ou fim e sem caractere de controle');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_generation_v1',
    'planejamento_ids', to_jsonb(p_planejamento_ids),
    'codigo', v_codigo
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_generation_v1|command|' || v_actor::TEXT || '|' || v_key, 0));

  SELECT * INTO v_command
    FROM public.ordem_compra_distribuicao_comandos
   WHERE idempotency_namespace = 'native_generation_v1'
     AND ator_id = v_actor AND idempotency_key = v_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante',
      'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  -- ============================================================
  -- ORDEM CANONICA DE TRAVA: (1) necessidade, (2) planejamento.
  -- ============================================================
  -- Os escritores de planejamento travam a necessidade PRIMEIRO e so depois
  -- as linhas de planejamento. A geracao fazia o contrario: travava as linhas
  -- de planejamento aqui e so alcancava a necessidade no fim, indiretamente,
  -- quando o gatilho de cache `trg_alocacao_kg_alocado_cache` (db/67) atualiza
  -- necessidade_compra_fio.kg_alocado a cada alocacao inserida. Duas sessoes
  -- concorrentes fechavam um ciclo e o PostgreSQL abortava uma delas com
  -- SQLSTATE 40P01 — um erro cru, fora do contrato de recusa em JSON destas
  -- RPCs. O ciclo e removido aqui adotando a MESMA ordem dos demais
  -- escritores; nao ha captura de 40P01 em lugar nenhum.
  --
  -- Esta leitura e PRELIMINAR e NAO AUTORITATIVA: serve unicamente para
  -- descobrir QUAIS linhas de necessidade travar. Nada que ela devolve
  -- autoriza a geracao — tudo e relido e revalidado sob as duas travas logo
  -- abaixo.
  SELECT array_agg(DISTINCT p.necessidade_id ORDER BY p.necessidade_id)
    INTO v_necessidades_prelim
    FROM public.necessidade_compra_planejamento p
   WHERE p.id = ANY(p_planejamento_ids);

  IF v_necessidades_prelim IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_nao_encontrado',
      'erro', 'Alguma distribuicao selecionada nao existe mais. Recarregue a tela.');
  END IF;

  -- (1) necessidade, em ordem determinista de id.
  PERFORM 1 FROM public.necessidade_compra_fio
   WHERE id = ANY(v_necessidades_prelim) ORDER BY id FOR UPDATE;

  -- (2) planejamento, em ordem determinista de id.
  PERFORM 1 FROM public.necessidade_compra_planejamento
   WHERE id = ANY(p_planejamento_ids) ORDER BY id FOR UPDATE;

  -- ---------- REVALIDACAO AUTORITATIVA SOB AS DUAS TRAVAS ----------
  -- A partir daqui nada depende da leitura preliminar. Se o conjunto de
  -- necessidades mudou entre as duas leituras, a selecao da tela envelheceu
  -- e a geracao e recusada em vez de trabalhar sobre um alvo diferente do
  -- que foi travado.
  SELECT array_agg(DISTINCT p.necessidade_id ORDER BY p.necessidade_id)
    INTO v_necessidades
    FROM public.necessidade_compra_planejamento p
   WHERE p.id = ANY(p_planejamento_ids);

  IF v_necessidades IS DISTINCT FROM v_necessidades_prelim THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_nao_encontrado',
      'erro', 'Alguma distribuicao selecionada nao existe mais. Recarregue a tela.');
  END IF;

  IF (SELECT count(*) FROM public.necessidade_compra_planejamento
       WHERE id = ANY(p_planejamento_ids)) <> array_length(p_planejamento_ids, 1) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_nao_encontrado',
      'erro', 'Alguma distribuicao selecionada nao existe mais. Recarregue a tela.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.necessidade_compra_planejamento
              WHERE id = ANY(p_planejamento_ids) AND gerado_em IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'planejamento_ja_gerado',
      'erro', 'Alguma distribuicao selecionada ja pertence a um Pedido de Compra. Recarregue a tela.');
  END IF;

  SELECT count(DISTINCT p.fornecedor_id), count(DISTINCT n.pedido_id),
         min(p.fornecedor_id), min(n.pedido_id::TEXT)::UUID
    INTO STRICT v_distintos_fornecedor, v_distintos_pedido, v_fornecedor, v_pedido
    FROM public.necessidade_compra_planejamento p
    JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
   WHERE p.id = ANY(p_planejamento_ids);

  IF v_distintos_fornecedor <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_misturado',
      'erro', 'Um Pedido de Compra pertence a um unico fornecedor. Selecione somente distribuicoes do mesmo fornecedor.');
  END IF;
  IF v_distintos_pedido <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_misturado',
      'erro', 'Um Pedido de Compra pertence a um unico Pedido.');
  END IF;

  -- Teto revalidado SOB A TRAVA. A geracao nao altera quantidades — ela
  -- apenas marca linhas como geradas — mas o teto e reafirmado aqui para que
  -- nenhuma leitura anterior a trava possa autorizar um documento sobre uma
  -- necessidade que ficou sobre-planejada nesse intervalo.
  IF EXISTS (
    SELECT 1
      FROM public.necessidade_compra_planejamento p
      JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
     WHERE p.necessidade_id = ANY(v_necessidades)
     GROUP BY p.necessidade_id, n.kg_necessario
    HAVING sum(p.kg_planejado) > n.kg_necessario
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'A distribuicao excede a necessidade');
  END IF;

  IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE codigo = v_codigo) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_duplicado',
      'erro', 'Ja existe um Pedido de Compra com este numero');
  END IF;

  -- db/67 `ordem_compra_um_rascunho_ativo` admite UM rascunho ativo por
  -- (Pedido, fornecedor). Comprar de novo do mesmo fornecedor e legitimo — e
  -- foi para isso que a unicidade do planejamento passou a valer so para a
  -- linha viva — mas o Pedido de Compra anterior precisa ter saido do
  -- rascunho (emitido ou cancelado) antes que o proximo nasca. Sem esta
  -- verificacao explicita a violacao do indice caia no handler de
  -- unique_violation e chegava ao operador como "numero duplicado", que e
  -- falso e manda corrigir a coisa errada.
  SELECT id INTO v_rascunho
    FROM public.ordem_compra
   WHERE pedido_id = v_pedido
     AND fornecedor_id = v_fornecedor
     AND legado = FALSE
     AND status_administrativo = 'rascunho'
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'rascunho_em_aberto',
      'erro', 'Ja existe um Pedido de Compra em rascunho para este fornecedor neste Pedido. Emita ou cancele aquele antes de gerar outro.',
      'ordem_compra_id', v_rascunho,
      'fornecedor_id', v_fornecedor);
  END IF;

  SELECT p.numero, public.pedido_ano_comercial(p.data_pedido, p.criado_em)
    INTO v_numero, v_ano FROM public.pedidos p WHERE p.id = v_pedido;
  IF v_numero IS NULL OR v_ano IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_sem_identidade',
      'erro', 'O Pedido ainda nao tem numero comercial e ano definidos');
  END IF;

  -- Serializa a numeracao DESTE Pedido antes de comparar a sugestao, para
  -- que duas geracoes concorrentes nao leiam o mesmo proximo numero.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_generation_v1|seq|' || v_pedido::TEXT, 0));

  SELECT n.ultimo_seq INTO v_ultimo
    FROM public.pedido_identidade_numeros n
   WHERE n.pedido_id = v_pedido AND n.escopo = 'OC';
  v_proximo := coalesce(v_ultimo, 0) + 1;

  -- Sugestao vencida: falha fechada, sem mutacao, com a sugestao fresca.
  IF p_sequencia_esperada IS DISTINCT FROM v_proximo THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sugestao_desatualizada',
      'erro', 'A numeracao deste Pedido avancou enquanto a confirmacao estava aberta. Confira o numero e confirme novamente.',
      'sequencia_esperada', p_sequencia_esperada,
      'sequencia_sugerida', v_proximo,
      'codigo_sugerido', 'OC-' || lpad(v_numero::TEXT, 3, '0')
                         || '-' || v_proximo::TEXT
                         || '-' || lpad((v_ano % 100)::TEXT, 2, '0'));
  END IF;

  -- A sequencia canonica e reservada MESMO com codigo proprio: a linhagem
  -- do Pedido de Compra continua avancando e a proxima sugestao nao repete.
  v_seq := public.proximo_seq_identidade(v_pedido, 'OC');

  INSERT INTO public.ordem_compra(
    pedido_id, fornecedor_id, codigo,
    identidade_pedido_id, identidade_pedido_numero, identidade_pedido_ano, identidade_seq,
    status_administrativo, status_aceite, status_recebimento, legado
  ) VALUES (
    v_pedido, v_fornecedor, v_codigo,
    v_pedido, v_numero, v_ano, v_seq,
    'rascunho', 'nao_aplicavel', 'nao_recebido', FALSE
  ) RETURNING id, identidade_operacional INTO v_ordem_id, v_identidade;

  -- Um item por (material, cor), uma alocacao por linha de planejamento.
  FOR v_grupo IN
    SELECT n.material, n.cor_id, n.cor_poliester,
           sum(p.kg_planejado)::NUMERIC(12,3) AS kg
      FROM public.necessidade_compra_planejamento p
      JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
     WHERE p.id = ANY(p_planejamento_ids)
     GROUP BY n.material, n.cor_id, n.cor_poliester
     ORDER BY n.material, n.cor_id, n.cor_poliester
  LOOP
    INSERT INTO public.ordem_compra_item(
      ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido
    ) VALUES (
      v_ordem_id, v_grupo.material, v_grupo.cor_id, v_grupo.cor_poliester,
      v_grupo.kg, 0
    ) RETURNING id INTO v_item_id;
    v_itens := v_itens + 1;
    v_total := v_total + v_grupo.kg;

    FOR v_plan IN
      SELECT p.id, p.kg_planejado, n.id AS necessidade_id, n.origem_tipo, n.op_id
        FROM public.necessidade_compra_planejamento p
        JOIN public.necessidade_compra_fio n ON n.id = p.necessidade_id
       WHERE p.id = ANY(p_planejamento_ids)
         AND n.material = v_grupo.material
         AND n.cor_id IS NOT DISTINCT FROM v_grupo.cor_id
         AND n.cor_poliester IS NOT DISTINCT FROM v_grupo.cor_poliester
       ORDER BY p.id
    LOOP
      INSERT INTO public.ordem_compra_item_alocacao(
        item_id, necessidade_id, op_id, kg_alocado
      ) VALUES (
        v_item_id, v_plan.necessidade_id,
        CASE WHEN v_plan.origem_tipo = 'op' THEN v_plan.op_id ELSE NULL END,
        v_plan.kg_planejado
      ) RETURNING id INTO v_aloc_id;

      UPDATE public.necessidade_compra_planejamento
         SET alocacao_id = v_aloc_id,
             ordem_compra_id = v_ordem_id,
             gerado_em = now(),
             gerado_por = v_actor,
             atualizado_em = now()
       WHERE id = v_plan.id;

      v_alocacoes := v_alocacoes + 1;
    END LOOP;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'idempotency_key', v_key,
    'discriminador', 'gerado',
    'ordem_compra_id', v_ordem_id,
    'identidade_operacional', v_identidade,
    'codigo_final', v_codigo,
    'sequencia_reservada', v_seq,
    'pedido_id', v_pedido,
    'fornecedor_id', v_fornecedor,
    'itens_criados', v_itens,
    'alocacoes_criadas', v_alocacoes,
    'kg_total', v_total
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    idempotency_namespace, ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES ('native_generation_v1', v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_duplicado',
      'erro', 'Ja existe um Pedido de Compra com este numero');
END;
$$;

COMMENT ON FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT) IS
  'db/99: ETAPA 2. Cria em UMA transacao o Pedido de Compra, os itens agrupados por (material, cor) e uma alocacao por linha de planejamento, e marca cada linha como gerada. Exige selecao de um unico fornecedor e de um unico Pedido, recusa linha ja gerada, recusa codigo duplicado e falha fechada quando a sequencia sugerida ficou desatualizada. Reserva exatamente uma sequencia canonica, inclusive quando o operador substitui o codigo visivel.';

-- ============================================================
-- 9. Exclusao permanente libera o planejamento
-- ============================================================
-- Substitui a versao de db/97. A elegibilidade continua sendo de
-- `oc_elegivel_exclusao`; a unica adicao e devolver as linhas de
-- planejamento ao estado vivo ANTES de apagar as alocacoes, para que
-- nenhuma linha fique apontando para uma alocacao inexistente e nenhuma
-- decisao de compra seja perdida junto com o documento.
CREATE OR REPLACE FUNCTION public.excluir_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem        public.ordem_compra%ROWTYPE;
  v_elegivel     JSONB;
  v_necessidades JSONB;
  v_itens        BIGINT;
  v_alocacoes    BIGINT;
  v_eventos      BIGINT;
  v_planejamentos BIGINT;
  v_liberado     RECORD;
  v_viva         BIGINT;
  v_necessidades_prelim BIGINT[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao',
      'erro', 'Somente administrador autenticado pode excluir uma ordem de compra');
  END IF;

  SELECT * INTO v_ordem FROM public.ordem_compra WHERE id = p_ordem_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nao_encontrada',
      'erro', 'Ordem de compra nao encontrada');
  END IF;

  v_elegivel := public.oc_elegivel_exclusao(p_ordem_id);
  IF (v_elegivel->>'elegivel')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false,
      'codigo', v_elegivel->>'codigo', 'erro', v_elegivel->>'erro');
  END IF;

  -- ============================================================
  -- ORDEM CANONICA DE TRAVA: (1) necessidade, (2) planejamento.
  -- ============================================================
  -- A exclusao mexe nas duas entidades: libera linhas de planejamento e, ao
  -- apagar as alocacoes mais abaixo, faz o gatilho de cache de db/67
  -- (`trg_alocacao_kg_alocado_cache`) atualizar necessidade_compra_fio. Sem
  -- esta trava previa a exclusao alcancava a necessidade so no fim, depois de
  -- ja segurar as linhas de planejamento — exatamente a inversao que o
  -- escritor de cartao (necessidade -> planejamento) fecha em ciclo quando o
  -- merge encontra uma linha viva existente.
  --
  -- Leitura PRELIMINAR e NAO AUTORITATIVA: descobre o conjunto de
  -- necessidades a travar. As duas leituras seguintes, ja sob as travas, sao
  -- as que decidem o que e liberado.
  SELECT array_agg(DISTINCT p.necessidade_id ORDER BY p.necessidade_id)
    INTO v_necessidades_prelim
    FROM public.necessidade_compra_planejamento p
   WHERE p.ordem_compra_id = p_ordem_id;

  -- Uma ordem legada ou sem planejamento vinculado nao tem necessidade a
  -- travar por esta via; as alocacoes ainda podem alcancar necessidades pelo
  -- gatilho, entao o conjunto e a UNIAO dos dois caminhos.
  SELECT array_agg(DISTINCT n ORDER BY n) INTO v_necessidades_prelim
    FROM (
      SELECT unnest(coalesce(v_necessidades_prelim, ARRAY[]::BIGINT[])) AS n
      UNION
      SELECT a.necessidade_id
        FROM public.ordem_compra_item_alocacao a
        JOIN public.ordem_compra_item i ON i.id = a.item_id
       WHERE i.ordem_id = p_ordem_id
    ) s;

  IF v_necessidades_prelim IS NOT NULL THEN
    PERFORM 1 FROM public.necessidade_compra_fio
     WHERE id = ANY(v_necessidades_prelim) ORDER BY id FOR UPDATE;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'necessidade_id', n.id, 'material', n.material,
           'kg_necessario', n.kg_necessario, 'kg_alocado_antes', n.kg_alocado,
           'kg_devolvido', s.kg) ORDER BY n.id), '[]'::jsonb)
    INTO v_necessidades
    FROM (SELECT a.necessidade_id AS nid, sum(a.kg_alocado) AS kg
          FROM public.ordem_compra_item_alocacao a
          JOIN public.ordem_compra_item i ON i.id = a.item_id
          WHERE i.ordem_id = p_ordem_id GROUP BY a.necessidade_id) s
    JOIN public.necessidade_compra_fio n ON n.id = s.nid;

  PERFORM set_config('app.oc_exclusao_id', p_ordem_id::text, true);
  PERFORM set_config('app.oc_plan_release_id', p_ordem_id::text, true);

  -- db/99: o planejamento volta a ser uma decisao viva e selecionavel.
  -- A quantidade e preservada EXATAMENTE; nada e recalculado.
  --
  -- Duas situacoes, porque desde a correcao C1 pode ja existir uma linha
  -- VIVA para o mesmo (necessidade, fornecedor) — foi justamente para
  -- permitir comprar do mesmo fornecedor de novo que a unicidade passou a
  -- valer so para a linha viva:
  --   (a) existe linha viva  -> a quantidade liberada e SOMADA nela e a
  --       linha historica, agora obsoleta, e removida;
  --   (b) nao existe         -> a propria linha volta a viver, em lugar.
  -- Em ambos os casos o total planejado da necessidade e identico ao de
  -- antes da exclusao e nao sobra linha viva duplicada nem vinculo orfao.
  v_planejamentos := 0;

  -- (2) planejamento, ja com as necessidades travadas acima. Trava TODAS as
  -- linhas envolvidas — as geradas por esta ordem e as vivas do mesmo par
  -- (necessidade, fornecedor) que o merge vai alcancar — numa unica passagem
  -- em ordem crescente de id, para que o laco abaixo nao adquira travas em
  -- ordem ditada pelos dados.
  PERFORM 1 FROM public.necessidade_compra_planejamento p
   WHERE p.ordem_compra_id = p_ordem_id
      OR (p.gerado_em IS NULL AND EXISTS (
            SELECT 1 FROM public.necessidade_compra_planejamento g
             WHERE g.ordem_compra_id = p_ordem_id
               AND g.necessidade_id = p.necessidade_id
               AND g.fornecedor_id = p.fornecedor_id))
   ORDER BY p.id FOR UPDATE;

  FOR v_liberado IN
    SELECT p.id, p.necessidade_id, p.fornecedor_id, p.kg_planejado
      FROM public.necessidade_compra_planejamento p
     WHERE p.ordem_compra_id = p_ordem_id
     ORDER BY p.id
     FOR UPDATE
  LOOP
    SELECT id INTO v_viva
      FROM public.necessidade_compra_planejamento
     WHERE necessidade_id = v_liberado.necessidade_id
       AND fornecedor_id = v_liberado.fornecedor_id
       AND gerado_em IS NULL
     FOR UPDATE;

    IF FOUND THEN
      UPDATE public.necessidade_compra_planejamento
         SET kg_planejado = kg_planejado + v_liberado.kg_planejado,
             atualizado_em = now()
       WHERE id = v_viva;
      DELETE FROM public.necessidade_compra_planejamento WHERE id = v_liberado.id;
    ELSE
      UPDATE public.necessidade_compra_planejamento
         SET alocacao_id = NULL, ordem_compra_id = NULL,
             gerado_em = NULL, gerado_por = NULL, atualizado_em = now()
       WHERE id = v_liberado.id;
    END IF;

    v_planejamentos := v_planejamentos + 1;
  END LOOP;

  WITH alvo AS (
    DELETE FROM public.ordem_compra_item_alocacao a USING public.ordem_compra_item i
    WHERE i.id = a.item_id AND i.ordem_id = p_ordem_id RETURNING a.id
  ) SELECT count(*) INTO v_alocacoes FROM alvo;
  WITH alvo AS (
    DELETE FROM public.ordem_compra_item WHERE ordem_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_itens FROM alvo;
  WITH alvo AS (
    DELETE FROM public.ordem_compra_eventos WHERE ordem_compra_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_eventos FROM alvo;
  DELETE FROM public.ordem_compra WHERE id = p_ordem_id;

  PERFORM set_config('app.oc_exclusao_id', '', true);
  PERFORM set_config('app.oc_plan_release_id', '', true);

  RETURN jsonb_build_object('ok', true, 'codigo', 'ok',
    'ordem_compra_id', p_ordem_id,
    'identidade_operacional', v_ordem.identidade_operacional,
    'codigo_liberado', v_ordem.codigo,
    'status_anterior', v_ordem.status_administrativo,
    'itens_removidos', v_itens, 'alocacoes_liberadas', v_alocacoes,
    'eventos_removidos', v_eventos,
    'planejamentos_liberados', v_planejamentos,
    'necessidades_liberadas', v_necessidades);
END;
$$;

COMMENT ON FUNCTION public.excluir_ordem_compra(BIGINT) IS
  'db/96 + db/97 + db/99: exclusao atomica de um Pedido de Compra NATIVO sem historico irreversivel. A elegibilidade continua sendo de oc_elegivel_exclusao. db/99 acrescenta a liberacao das linhas de planejamento, que voltam ao estado vivo com a mesma quantidade e ficam novamente selecionaveis para geracao. Cancelar continua sendo o caminho de uma ordem real que precisa permanecer na historia, e uma ordem cancelada preserva o vinculo de planejamento ate ser excluida.';

-- ============================================================
-- 10. Compatibilidade de cliente antigo
-- ============================================================
-- MESMA assinatura de 5 argumentos aplicada em producao (96b), para que
-- um bundle antigo servido de cache nao encontre um PostgREST sem a
-- funcao. O comportamento, porem, deixa de criar documento: delega ao
-- planejamento canonico e trata `p_codigo_ordem` como entrada obsoleta.
CREATE OR REPLACE FUNCTION public.definir_alocacao_necessidade_compra_fio(
  p_necessidade_id  BIGINT,
  p_fornecedor_id   BIGINT,
  p_kg_alocado      NUMERIC,
  p_idempotency_key TEXT,
  p_codigo_ordem    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.definir_planejamento_compra(
    p_necessidade_id, p_fornecedor_id, p_kg_alocado, p_idempotency_key);

  IF (v_result->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  -- Discriminador proprio: um chamador antigo consegue distinguir que
  -- caiu no caminho de compatibilidade e que NENHUM Pedido de Compra foi
  -- criado, em vez de acreditar que distribuiu como antes.
  RETURN v_result
    || jsonb_build_object(
         'discriminador', 'compatibilidade_planejamento',
         'discriminador_planejamento', v_result->>'discriminador',
         'compatibilidade', true,
         'codigo_ordem_ignorado', p_codigo_ordem IS NOT NULL,
         'ordem_compra_id', NULL,
         'ordem_compra_item_id', NULL,
         'alocacao_id', NULL,
         'ordem_compra_criada', false,
         'aviso', 'Esta versao da tela esta desatualizada. A distribuicao foi salva como planejamento e nenhum Pedido de Compra foi criado. Recarregue a pagina para gerar o Pedido de Compra.');
END;
$$;

COMMENT ON FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT) IS
  'db/99: CAMINHO DE COMPATIBILIDADE, nao mais o escritor canonico. Preserva a assinatura de 5 argumentos aplicada em producao para nao quebrar um bundle antigo em cache durante a janela de publicacao, mas delega a public.definir_planejamento_compra: nunca cria ordem_compra, nunca cria item, nunca cria alocacao e nunca consome numeracao. p_codigo_ordem e entrada obsoleta e e ignorada. O frontend novo NAO chama esta funcao.';

-- ============================================================
-- 11. Privilegios explicitos
-- ============================================================
-- Nada depende do grant-por-padrao do Supabase: cada funcao declara o
-- seu estado final, como db/93 estabeleceu.

ALTER FUNCTION public.trg_planejamento_compatibilidade_guard() OWNER TO postgres;
ALTER FUNCTION public.trg_planejamento_saldo_guard() OWNER TO postgres;
ALTER FUNCTION public.trg_planejamento_geracao_guard() OWNER TO postgres;
ALTER FUNCTION public.oc_planejamento_liberacao_autorizada(BIGINT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.trg_planejamento_compatibilidade_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_planejamento_saldo_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_planejamento_geracao_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.oc_planejamento_liberacao_autorizada(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.obter_planejamento_compra_pedido(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.obter_planejamento_compra_pedido(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_planejamento_compra_pedido(UUID) TO authenticated;

ALTER FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_planejamento_compra(BIGINT, BIGINT, NUMERIC, TEXT)
  TO authenticated;

ALTER FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.substituir_planejamento_compra_necessidade(BIGINT, JSONB, TEXT)
  TO authenticated;

ALTER FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_planejamento_rapido(UUID, BIGINT, JSONB, TEXT)
  TO authenticated;

ALTER FUNCTION public.sugerir_codigo_ordem_compra(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sugerir_codigo_ordem_compra(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sugerir_codigo_ordem_compra(UUID) TO authenticated;

ALTER FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerar_ordem_compra_do_planejamento(BIGINT[], TEXT, INTEGER, TEXT)
  TO authenticated;

ALTER FUNCTION public.excluir_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.excluir_ordem_compra(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_ordem_compra(BIGINT) TO authenticated;

ALTER FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT)
  TO authenticated;

-- ============================================================
-- 12. Invariantes pos-migracao (fail closed)
-- ============================================================
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  IF to_regclass('public.necessidade_compra_planejamento') IS NULL THEN
    RAISE EXCEPTION 'db/99: tabela de planejamento ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'necessidade_compra_planejamento'
       AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'db/99: RLS nao habilitada na tabela de planejamento';
  END IF;

  -- Nenhuma role cliente escreve direto na tabela.
  IF has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'INSERT')
     OR has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.necessidade_compra_planejamento', 'DELETE')
     OR has_table_privilege('anon', 'public.necessidade_compra_planejamento', 'SELECT') THEN
    RAISE EXCEPTION 'db/99: privilegio direto indevido na tabela de planejamento';
  END IF;

  -- As seis RPCs publicas do dominio existem e sao executaveis pelo app.
  SELECT string_agg(f, ', ') INTO v_missing FROM (
    SELECT f FROM (VALUES
      ('public.obter_planejamento_compra_pedido(uuid)'),
      ('public.definir_planejamento_compra(bigint,bigint,numeric,text)'),
      ('public.substituir_planejamento_compra_necessidade(bigint,jsonb,text)'),
      ('public.aplicar_planejamento_rapido(uuid,bigint,jsonb,text)'),
      ('public.sugerir_codigo_ordem_compra(uuid)'),
      ('public.gerar_ordem_compra_do_planejamento(bigint[],text,integer,text)')
    ) AS t(f)
    WHERE to_regprocedure(f) IS NULL
       OR NOT has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')
  ) s;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'db/99: RPC ausente ou sem grant para authenticated: %', v_missing;
  END IF;

  -- Os tres guardas de integridade estao instalados.
  IF (SELECT count(*) FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'necessidade_compra_planejamento'
        AND NOT t.tgisinternal) <> 3 THEN
    RAISE EXCEPTION 'db/99: guardas de integridade do planejamento incompletos';
  END IF;

  -- A sugestao e declarada STABLE: nao pode escrever.
  IF (SELECT provolatile FROM pg_proc
       WHERE oid = to_regprocedure('public.sugerir_codigo_ordem_compra(uuid)')) <> 's' THEN
    RAISE EXCEPTION 'db/99: a sugestao de numero precisa ser STABLE';
  END IF;

  -- Zero orfaos: nenhuma linha gerada sem alocacao viva.
  IF EXISTS (
    SELECT 1 FROM public.necessidade_compra_planejamento p
     WHERE p.gerado_em IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.ordem_compra_item_alocacao a
                        WHERE a.id = p.alocacao_id)) THEN
    RAISE EXCEPTION 'db/99: planejamento gerado sem alocacao correspondente';
  END IF;

  -- A unicidade e da linha VIVA, nunca de toda a historia: comprar do mesmo
  -- fornecedor duas vezes para a mesma necessidade tem de continuar possivel.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.necessidade_compra_planejamento'::regclass
       AND conname = 'necessidade_compra_planejamento_identidade') THEN
    RAISE EXCEPTION 'db/99: a UNIQUE sobre toda a historia proibiria recompra do mesmo fornecedor';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'necessidade_compra_planejamento_viva_uidx') THEN
    RAISE EXCEPTION 'db/99: indice de unicidade da linha viva ausente';
  END IF;
END
$$;

COMMIT;

-- ============================================================
-- 13. Recarga do cache de schema do PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
