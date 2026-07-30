-- =====================================================================
-- db/95_op_canonical_identity_refoundation.sql
-- OP-CANONICAL-IDENTITY-REFOUNDATION-R1 — identidade canonica UNICA,
-- persistida e imutavel, derivada do Pedido, para OP e Ordem de Compra.
--
-- Order: OP-CANONICAL-IDENTITY-REFOUNDATION-R1 (formato ratificado pelo
-- arquiteto durante a execucao; ver "FORMATO" abaixo).
-- Schema shapes: docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md.
-- Forward-only; db/01..db/94 sao intocados. O guard terminal de migracao
-- avanca 94 -> 95 no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- FORMATO (nomenclatura casada, decidida pelo arquiteto)
--   Pedido            005-26
--   OP tecelagem      OP-T005-1-26   (1a tecelagem do Pedido 005/2026)
--   OP tecelagem      OP-T005-2-26   (2a tecelagem — outro fornecedor)
--   OP acabamento     OP-A005-1-26
--   Ordem de compra   OC-005-1-26, OC-005-2-26
--
--   numero do Pedido: 3 digitos com zero a esquerda.
--   ano: 2 ultimos digitos do ano COMERCIAL do Pedido.
--   sequencia: inteiro sem zero a esquerda, contado por escopo.
--
--   A sequencia da OP conta por (Pedido, tipo): duas tecelagens do mesmo
--   Pedido sao -1- e -2-, porque um Pedido pode legitimamente ser dividido
--   entre fornecedores de tecelagem diferentes.
--
--   A sequencia da OC conta por PEDIDO, nao por OP. O codigo `OC-005-1-26`
--   nao carrega letra de tipo; se a contagem fosse por OP, a 1a compra da
--   tecelagem e a 1a do acabamento produziriam o MESMO codigo. De qual OP a
--   compra veio continua registrado em `necessidade_compra_fio.op_id` e e
--   exibido como informacao de origem, nunca embutido no nome.
--
-- POR QUE ESTA MIGRACAO EXISTE
--   A decisao D-OC01 escolheu representar a identidade operacional da OP
--   como DISPLAY CALCULADO, explicitamente para evitar migracao/backfill.
--   A consequencia foi um modelo de identidade DUPLA: `ops.numero/ano`
--   permaneceu persistido e continuou sendo renderizado, enquanto o codigo
--   derivado do Pedido existia apenas como alias de apresentacao,
--   recalculado por POSICAO no array de OPs irmas.
--
--   Tres defeitos estruturais provados pela auditoria:
--     1. a MESMA OP aparecia com dois nomes, as vezes na MESMA superficie
--        (modal de movimentacao do Pedido);
--     2. o codigo posicional NAO era estavel: removida uma OP irma, a
--        seguinte HERDAVA o codigo da removida — exatamente o reuso que a
--        politica de numeracao de db/26 proibia para o numero interno;
--     3. superficies sem contexto de Pedido caiam SILENCIOSAMENTE no
--        legado, sem sinal algum, por exigencia de D-OC05.
--
--   E um QUARTO, no mesmo fluxo: `public.ordem_compra` nunca teve numero
--   algum. As telas de distribuicao e de recebimento exibiam a chave
--   primaria crua (`OP 137`, `OC #48`) como se fosse nome de negocio.
--
--   As decisoes D-OC05, D-OC07 e D-OC08 sao superadas por correcao forward.
--   A identidade passa a ser ATRIBUIDA UMA VEZ, PERSISTIDA, UNICA no banco
--   e IMUTAVEL — nunca mais derivada de posicao de array.
--
-- O QUE ESTA MIGRACAO OWNS
--   A. public.ops.identidade_*          — componentes congelados + codigo.
--   B. public.ordem_compra.identidade_* — idem, para a Ordem de Compra.
--   C. public.pedido_identidade_numeros — UM high-water por (pedido,
--      escopo), servindo os tres escopos 'T', 'A' e 'OC'.
--   D. public.proximo_seq_identidade(...) — o UNICO reservador.
--   E. os triggers de atribuicao unica e de imutabilidade executavel.
--   F. public.op_identidade_projecao    — projecao somente leitura para as
--      superficies de compra/recebimento.
--
-- POR QUE UM CONTADOR UNICO COM `escopo` E NAO TRES TABELAS
--   Os tres contadores tem a MESMA chave de negocio (o Pedido), a mesma
--   regra (monotonico, nunca reaproveita) e o mesmo dono. Tres tabelas
--   seriam tres copias da mesma politica, divergindo na primeira correcao
--   aplicada a uma so. `escopo` mantem UMA definicao.
--
-- POR QUE OS COMPONENTES SAO CONGELADOS E NAO LIDOS DO PEDIDO
--   Ler `pedidos.numero` e o ano em tempo de consulta reintroduziria a
--   dependencia de contexto que causou o defeito: a identidade mudaria se a
--   data comercial do Pedido fosse corrigida, e uma OP ou OC JA IMPRESSA em
--   documento externo passaria a ter outro nome. `pedidos.numero` e imutavel
--   desde db/89, mas a data comercial NAO tem a mesma garantia. Congelar e
--   o que torna "atribuida exatamente uma vez" verdadeiro de fato.
--
-- POR QUE NAO HA FK EM identidade_pedido_id
--   A coluna e um CONGELAMENTO HISTORICO, nao uma referencia viva. A
--   convencao de FK do repositorio (`ON DELETE SET NULL`) e incompativel
--   com imutabilidade: um SET NULL em cascata destruiria a identidade de uma
--   OP que continua existindo. O vinculo VIVO permanece intocado
--   (`ops.lote_id -> lotes.pedido_id`, `ordem_compra.pedido_id`). Mesmo
--   racional ja aplicado em db/91 para `prioridade_confirmada_por`.
--
-- OP AVULSA E OC LEGADA
--   OP sem Pedido continua suportada e mantem `numero/ano` como identidade
--   visivel, porque nenhuma identidade derivada de Pedido existe; todas as
--   colunas `identidade_*` ficam NULL. Se e quando ela for vinculada a um
--   Pedido, o trigger atribui a identidade UMA VEZ nessa transicao e nunca
--   recalcula. OC legada sem `pedido_id` idem: identidade NULL, e a UI a
--   rotula explicitamente como legada em vez de exibir a chave crua.
--
-- NUMERACAO INTERNA LEGADA
--   `ops.numero`, `ops.ano` e `public.op_numeros` NAO sao alterados, NAO
--   sao resetados e continuam sendo reservados por
--   `public.proximo_numero_op`. Passam a ser numero INTERNO de
--   rastreabilidade, exibivel apenas sob o rotulo explicito "No interno".
--
-- LIMITE DE RECONSTRUCAO HISTORICA (registro explicito exigido pela ordem)
--   OPs historicas REMOVIDAS FISICAMENTE por db/34..db/37/db/53 nao podem
--   ser reconstruidas a partir do antigo display posicional: o display era
--   funcao do conjunto de irmas VIVAS no instante da renderizacao, e
--   `op_numeros` nunca foi decrementado, de modo que nao existe registro de
--   qual posicao uma OP removida ocupava. O backfill NAO reconstroi
--   historico: ele CONGELA a ordenacao deterministica (criado_em ASC, id
--   ASC) das entidades SOBREVIVENTES como canonica a partir de agora. Onde
--   nenhuma irma foi removida, o codigo congelado coincide com o que era
--   exibido; onde alguma foi removida, o congelado e a nova verdade e o
--   anterior e irrecuperavel por construcao.
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. Letra operacional do tipo de OP
-- ============================================================
-- 'latex' e a etapa que o fluxo do usuario chama de "Acabamento", por isso
-- 'A'. 'acabamento' fica como sinonimo defensivo. Qualquer outro tipo
-- retorna NULL e a OP NAO recebe identidade canonica (fail closed).
CREATE OR REPLACE FUNCTION public.op_tipo_letra(p_tipo TEXT)
RETURNS CHAR(1)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_tipo, '')))
           WHEN 'tecelagem'  THEN 'T'
           WHEN 'latex'      THEN 'A'
           WHEN 'acabamento' THEN 'A'
           ELSE NULL
         END::CHAR(1);
$$;

COMMENT ON FUNCTION public.op_tipo_letra(TEXT) IS
  'db/95: letra operacional canonica do tipo de OP (tecelagem->T, latex/acabamento->A). Qualquer outro tipo retorna NULL e nao recebe identidade canonica.';

-- Ano COMERCIAL do Pedido. `data_pedido` (db/89) e a data que o negocio e o
-- cliente reconhecem; `criado_em` e apenas o carimbo tecnico de insercao e
-- serve so como rede de seguranca para linha antiga sem data comercial.
CREATE OR REPLACE FUNCTION public.pedido_ano_comercial(p_data_pedido DATE, p_criado_em TIMESTAMPTZ)
RETURNS SMALLINT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(YEAR FROM coalesce(p_data_pedido, (p_criado_em AT TIME ZONE 'UTC')::DATE))::SMALLINT;
$$;

COMMENT ON FUNCTION public.pedido_ano_comercial(DATE, TIMESTAMPTZ) IS
  'db/95: ano comercial do Pedido para fins de identidade. Prefere data_pedido (db/89); cai em criado_em apenas para linha sem data comercial.';

-- ============================================================
-- 2. Contador unico de sequencia por (Pedido, escopo)
-- ============================================================
-- Mesmo padrao provado de public.op_numeros (db/26): monotonico, nunca
-- reduzido, nunca reaproveitado. E ESTE objeto — nao a contagem de linhas
-- vivas — que garante que remover uma OP ou OC nao libera a sua sequencia.
CREATE TABLE IF NOT EXISTS public.pedido_identidade_numeros (
  pedido_id  UUID        NOT NULL,
  escopo     TEXT        NOT NULL CHECK (escopo IN ('T', 'A', 'OC')),
  ultimo_seq INTEGER     NOT NULL CHECK (ultimo_seq >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pedido_id, escopo)
);

COMMENT ON TABLE public.pedido_identidade_numeros IS
  'db/95: high-water monotonico de sequencia canonica por (pedido_id, escopo), escopo em (T=tecelagem, A=acabamento, OC=ordem de compra). Nunca reduzir ultimo_seq nem reaproveitar sequencia de linha removida.';
COMMENT ON COLUMN public.pedido_identidade_numeros.ultimo_seq IS
  'db/95: maior sequencia ja reservada para o par (pedido, escopo), incluindo sequencias de linhas posteriormente removidas.';

ALTER TABLE public.pedido_identidade_numeros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedido_identidade_numeros_admin ON public.pedido_identidade_numeros;
CREATE POLICY pedido_identidade_numeros_admin ON public.pedido_identidade_numeros
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pedido_identidade_numeros_read ON public.pedido_identidade_numeros;
CREATE POLICY pedido_identidade_numeros_read ON public.pedido_identidade_numeros
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.pedido_identidade_numeros TO authenticated;

CREATE OR REPLACE FUNCTION public.proximo_seq_identidade(
  p_pedido_id UUID,
  p_escopo    TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  IF p_pedido_id IS NULL THEN
    RAISE EXCEPTION 'Pedido obrigatorio para sequencia canonica';
  END IF;

  IF p_escopo IS NULL OR p_escopo NOT IN ('T', 'A', 'OC') THEN
    RAISE EXCEPTION 'Escopo invalido para sequencia canonica: %', p_escopo;
  END IF;

  INSERT INTO public.pedido_identidade_numeros AS n (pedido_id, escopo, ultimo_seq)
  VALUES (p_pedido_id, p_escopo, 1)
  ON CONFLICT (pedido_id, escopo) DO UPDATE
     SET ultimo_seq = n.ultimo_seq + 1,
         updated_at = now()
  RETURNING ultimo_seq INTO v_seq;

  RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.proximo_seq_identidade(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proximo_seq_identidade(UUID, TEXT) FROM anon;

COMMENT ON FUNCTION public.proximo_seq_identidade(UUID, TEXT) IS
  'db/95: reserva a proxima sequencia canonica por (pedido, escopo) via UPSERT transacional. Nao conta linhas vivas e nao reaproveita sequencia liberada por remocao.';

-- ============================================================
-- 3. Componentes congelados da identidade — public.ops
-- ============================================================
ALTER TABLE public.ops
  ADD COLUMN IF NOT EXISTS identidade_pedido_id     UUID,
  ADD COLUMN IF NOT EXISTS identidade_pedido_numero BIGINT,
  ADD COLUMN IF NOT EXISTS identidade_pedido_ano    SMALLINT,
  ADD COLUMN IF NOT EXISTS identidade_tipo_letra    CHAR(1),
  ADD COLUMN IF NOT EXISTS identidade_seq           INTEGER;

COMMENT ON COLUMN public.ops.identidade_pedido_id IS
  'db/95: Pedido congelado no instante da atribuicao. Congelamento historico, sem FK por design (ver cabecalho). O vinculo vivo continua sendo ops.lote_id -> lotes.pedido_id.';
COMMENT ON COLUMN public.ops.identidade_pedido_numero IS
  'db/95: pedidos.numero congelado. Nunca relido do Pedido.';
COMMENT ON COLUMN public.ops.identidade_pedido_ano IS
  'db/95: ano comercial congelado (public.pedido_ano_comercial) no instante da atribuicao.';
COMMENT ON COLUMN public.ops.identidade_tipo_letra IS
  'db/95: letra operacional congelada (T|A) no instante da atribuicao.';
COMMENT ON COLUMN public.ops.identidade_seq IS
  'db/95: sequencia canonica ATRIBUIDA por public.proximo_seq_identidade. NAO e posicao em lista de irmas e NAO e recalculada apos remocao de irma.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ops'::regclass AND conname = 'ops_identidade_completa_chk') THEN
    ALTER TABLE public.ops ADD CONSTRAINT ops_identidade_completa_chk CHECK (
      (identidade_pedido_id IS NULL AND identidade_pedido_numero IS NULL
       AND identidade_pedido_ano IS NULL AND identidade_tipo_letra IS NULL
       AND identidade_seq IS NULL)
      OR
      (identidade_pedido_id IS NOT NULL AND identidade_pedido_numero IS NOT NULL
       AND identidade_pedido_ano IS NOT NULL AND identidade_tipo_letra IS NOT NULL
       AND identidade_seq IS NOT NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ops'::regclass AND conname = 'ops_identidade_tipo_letra_chk') THEN
    ALTER TABLE public.ops ADD CONSTRAINT ops_identidade_tipo_letra_chk
      CHECK (identidade_tipo_letra IS NULL OR identidade_tipo_letra IN ('T', 'A'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ops'::regclass AND conname = 'ops_identidade_seq_positivo_chk') THEN
    ALTER TABLE public.ops ADD CONSTRAINT ops_identidade_seq_positivo_chk
      CHECK (identidade_seq IS NULL OR identidade_seq > 0);
  END IF;
END
$$;

-- A UNICA string canonica da OP. Coluna GERADA e ARMAZENADA: nao existe
-- caminho de escrita direta, nao existe formatacao paralela em SQL e nao
-- existe recomputacao por renderizacao.
--   OP-T005-1-26
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.ops'::regclass
       AND attname = 'identidade_operacional' AND NOT attisdropped) THEN
    ALTER TABLE public.ops
      ADD COLUMN identidade_operacional TEXT
        GENERATED ALWAYS AS (
          CASE
            WHEN identidade_pedido_numero IS NULL OR identidade_pedido_ano IS NULL
              OR identidade_tipo_letra IS NULL OR identidade_seq IS NULL
            THEN NULL
            ELSE 'OP-' || identidade_tipo_letra
                        || lpad(identidade_pedido_numero::TEXT, 3, '0')
                        || '-' || identidade_seq::TEXT
                        || '-' || lpad((identidade_pedido_ano % 100)::TEXT, 2, '0')
          END
        ) STORED;
  END IF;
END
$$;

COMMENT ON COLUMN public.ops.identidade_operacional IS
  'db/95: IDENTIDADE CANONICA PRODUTO-FACING da OP vinculada a Pedido, no formato OP-{T|A}{pedido:3}-{seq}-{ano:2}. Coluna gerada e armazenada; nunca escrita diretamente. NULL somente para OP avulsa, que exibe numero/ano interno.';

CREATE UNIQUE INDEX IF NOT EXISTS ops_identidade_operacional_uidx
  ON public.ops (identidade_operacional)
  WHERE identidade_operacional IS NOT NULL;

CREATE INDEX IF NOT EXISTS ops_identidade_pedido_idx
  ON public.ops (identidade_pedido_id, identidade_tipo_letra, identidade_seq)
  WHERE identidade_pedido_id IS NOT NULL;

-- ============================================================
-- 4. Componentes congelados da identidade — public.ordem_compra
-- ============================================================
-- `public.ordem_compra` (db/67) nunca teve numero de negocio: era
-- identificada apenas pelo BIGSERIAL, e as telas de distribuicao e
-- recebimento exibiam essa chave crua. Aqui ela recebe o nome que deveria
-- ter sempre tido, amarrado ao mesmo Pedido da OP que originou a compra.
ALTER TABLE public.ordem_compra
  ADD COLUMN IF NOT EXISTS identidade_pedido_id     UUID,
  ADD COLUMN IF NOT EXISTS identidade_pedido_numero BIGINT,
  ADD COLUMN IF NOT EXISTS identidade_pedido_ano    SMALLINT,
  ADD COLUMN IF NOT EXISTS identidade_seq           INTEGER;

COMMENT ON COLUMN public.ordem_compra.identidade_pedido_id IS
  'db/95: Pedido congelado no instante da atribuicao. Congelamento historico, sem FK por design. O vinculo vivo continua sendo ordem_compra.pedido_id.';
COMMENT ON COLUMN public.ordem_compra.identidade_seq IS
  'db/95: sequencia canonica da Ordem de Compra DENTRO do Pedido (escopo OC), nao dentro da OP. O codigo OC nao carrega letra de tipo, portanto contar por OP produziria codigos duplicados.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ordem_compra'::regclass
       AND conname = 'ordem_compra_identidade_completa_chk') THEN
    ALTER TABLE public.ordem_compra ADD CONSTRAINT ordem_compra_identidade_completa_chk CHECK (
      (identidade_pedido_id IS NULL AND identidade_pedido_numero IS NULL
       AND identidade_pedido_ano IS NULL AND identidade_seq IS NULL)
      OR
      (identidade_pedido_id IS NOT NULL AND identidade_pedido_numero IS NOT NULL
       AND identidade_pedido_ano IS NOT NULL AND identidade_seq IS NOT NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ordem_compra'::regclass
       AND conname = 'ordem_compra_identidade_seq_positivo_chk') THEN
    ALTER TABLE public.ordem_compra ADD CONSTRAINT ordem_compra_identidade_seq_positivo_chk
      CHECK (identidade_seq IS NULL OR identidade_seq > 0);
  END IF;
END
$$;

--   OC-005-1-26
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.ordem_compra'::regclass
       AND attname = 'identidade_operacional' AND NOT attisdropped) THEN
    ALTER TABLE public.ordem_compra
      ADD COLUMN identidade_operacional TEXT
        GENERATED ALWAYS AS (
          CASE
            WHEN identidade_pedido_numero IS NULL OR identidade_pedido_ano IS NULL
              OR identidade_seq IS NULL
            THEN NULL
            ELSE 'OC-' || lpad(identidade_pedido_numero::TEXT, 3, '0')
                        || '-' || identidade_seq::TEXT
                        || '-' || lpad((identidade_pedido_ano % 100)::TEXT, 2, '0')
          END
        ) STORED;
  END IF;
END
$$;

COMMENT ON COLUMN public.ordem_compra.identidade_operacional IS
  'db/95: IDENTIDADE CANONICA PRODUTO-FACING da Ordem de Compra, no formato OC-{pedido:3}-{seq}-{ano:2}. Coluna gerada e armazenada. NULL somente para OC legada sem pedido_id, que a UI rotula explicitamente como legada em vez de exibir a chave primaria.';

CREATE UNIQUE INDEX IF NOT EXISTS ordem_compra_identidade_operacional_uidx
  ON public.ordem_compra (identidade_operacional)
  WHERE identidade_operacional IS NOT NULL;

CREATE INDEX IF NOT EXISTS ordem_compra_identidade_pedido_idx
  ON public.ordem_compra (identidade_pedido_id, identidade_seq)
  WHERE identidade_pedido_id IS NOT NULL;

-- ============================================================
-- 5. Atribuicao automatica, exatamente uma vez — public.ops
-- ============================================================
-- BEFORE INSERT OR UPDATE OF lote_id: cobre TODOS os caminhos reais de
-- criacao/vinculo sem recursao de trigger e sem uma segunda versao da
-- linha —
--   * INSERT com lote_id (gerar_op_latex, op_latex_split, rota Manta);
--   * UPDATE de lote_id (persistirOP, que insere a OP antes do Lote);
--   * vinculo posterior de uma OP avulsa a um Pedido.
-- Idempotente por construcao: se `identidade_seq` ja esta preenchida a
-- funcao retorna imediatamente, portanto nenhuma sequencia e consumida duas
-- vezes e nenhuma identidade e recalculada.
CREATE OR REPLACE FUNCTION public.ops_identidade_assign_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id UUID;
  v_numero    BIGINT;
  v_ano       SMALLINT;
  v_letra     CHAR(1);
BEGIN
  IF NEW.identidade_seq IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lote_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_letra := public.op_tipo_letra(NEW.tipo);
  IF v_letra IS NULL THEN
    -- Tipo desconhecido: fail closed. A OP segue como avulsa/interna em vez
    -- de receber um codigo canonico inventado.
    RETURN NEW;
  END IF;

  SELECT l.pedido_id INTO v_pedido_id
    FROM public.lotes l WHERE l.id = NEW.lote_id;

  IF v_pedido_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.numero, public.pedido_ano_comercial(p.data_pedido, p.criado_em)
    INTO v_numero, v_ano
    FROM public.pedidos p WHERE p.id = v_pedido_id;

  IF v_numero IS NULL OR v_ano IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.identidade_pedido_id     := v_pedido_id;
  NEW.identidade_pedido_numero := v_numero;
  NEW.identidade_pedido_ano    := v_ano;
  NEW.identidade_tipo_letra    := v_letra;
  NEW.identidade_seq           := public.proximo_seq_identidade(v_pedido_id, v_letra);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ops_identidade_assign_fn() IS
  'db/95: atribui a identidade canonica da OP EXATAMENTE UMA VEZ, no INSERT com lote_id ou no UPDATE que vincula lote_id. Retorna sem efeito se a identidade ja existe, se nao ha Pedido ou se o tipo e desconhecido (fail closed).';

DROP TRIGGER IF EXISTS ops_identidade_assign ON public.ops;
CREATE TRIGGER ops_identidade_assign
  BEFORE INSERT OR UPDATE OF lote_id ON public.ops
  FOR EACH ROW
  EXECUTE FUNCTION public.ops_identidade_assign_fn();

-- ============================================================
-- 6. Atribuicao automatica, exatamente uma vez — public.ordem_compra
-- ============================================================
CREATE OR REPLACE FUNCTION public.ordem_compra_identidade_assign_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero BIGINT;
  v_ano    SMALLINT;
BEGIN
  IF NEW.identidade_seq IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.pedido_id IS NULL THEN
    -- OC legada sem Pedido: fail closed, sem identidade derivada.
    RETURN NEW;
  END IF;

  SELECT p.numero, public.pedido_ano_comercial(p.data_pedido, p.criado_em)
    INTO v_numero, v_ano
    FROM public.pedidos p WHERE p.id = NEW.pedido_id;

  IF v_numero IS NULL OR v_ano IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.identidade_pedido_id     := NEW.pedido_id;
  NEW.identidade_pedido_numero := v_numero;
  NEW.identidade_pedido_ano    := v_ano;
  NEW.identidade_seq           := public.proximo_seq_identidade(NEW.pedido_id, 'OC');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ordem_compra_identidade_assign_fn() IS
  'db/95: atribui a identidade canonica da Ordem de Compra EXATAMENTE UMA VEZ, no INSERT com pedido_id ou no UPDATE que o vincula. Sequencia no escopo OC do Pedido.';

DROP TRIGGER IF EXISTS ordem_compra_identidade_assign ON public.ordem_compra;
CREATE TRIGGER ordem_compra_identidade_assign
  BEFORE INSERT OR UPDATE OF pedido_id ON public.ordem_compra
  FOR EACH ROW
  EXECUTE FUNCTION public.ordem_compra_identidade_assign_fn();

-- ============================================================
-- 7. Imutabilidade executavel
-- ============================================================
-- Fecha DUAS coisas que a ordem exige explicitamente:
--   * a identidade canonica nunca muda depois de atribuida;
--   * `ops.numero`/`ops.ano` nao podem ser reescritos arbitrariamente por um
--     caminho de edicao — o defeito provado em js/screens/op-persistir.js,
--     onde a tela gravava numero/ano digitados pelo usuario sem tocar em
--     op_numeros, dessincronizando o high-water.
-- NULL -> valor continua permitido: e o proprio caminho de atribuicao e de
-- backfill.
CREATE OR REPLACE FUNCTION public.ops_identidade_immutability_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.identidade_seq IS NOT NULL AND (
       NEW.identidade_pedido_id     IS DISTINCT FROM OLD.identidade_pedido_id
    OR NEW.identidade_pedido_numero IS DISTINCT FROM OLD.identidade_pedido_numero
    OR NEW.identidade_pedido_ano    IS DISTINCT FROM OLD.identidade_pedido_ano
    OR NEW.identidade_tipo_letra    IS DISTINCT FROM OLD.identidade_tipo_letra
    OR NEW.identidade_seq           IS DISTINCT FROM OLD.identidade_seq
  ) THEN
    RAISE EXCEPTION
      'Identidade canonica da OP e imutavel apos a atribuicao (op %: % -> %)',
      OLD.id, OLD.identidade_operacional, NEW.identidade_operacional;
  END IF;

  IF NEW.numero IS DISTINCT FROM OLD.numero OR NEW.ano IS DISTINCT FROM OLD.ano THEN
    RAISE EXCEPTION
      'Numero interno da OP e imutavel apos a criacao (op %: %/% -> %/%). A reserva e automatica por public.proximo_numero_op.',
      OLD.id, OLD.numero, OLD.ano, NEW.numero, NEW.ano;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ops_identidade_immutability_guard ON public.ops;
CREATE TRIGGER ops_identidade_immutability_guard
  BEFORE UPDATE ON public.ops
  FOR EACH ROW
  EXECUTE FUNCTION public.ops_identidade_immutability_guard_fn();

CREATE OR REPLACE FUNCTION public.ordem_compra_identidade_immutability_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.identidade_seq IS NOT NULL AND (
       NEW.identidade_pedido_id     IS DISTINCT FROM OLD.identidade_pedido_id
    OR NEW.identidade_pedido_numero IS DISTINCT FROM OLD.identidade_pedido_numero
    OR NEW.identidade_pedido_ano    IS DISTINCT FROM OLD.identidade_pedido_ano
    OR NEW.identidade_seq           IS DISTINCT FROM OLD.identidade_seq
  ) THEN
    RAISE EXCEPTION
      'Identidade canonica da Ordem de Compra e imutavel apos a atribuicao (oc %: % -> %)',
      OLD.id, OLD.identidade_operacional, NEW.identidade_operacional;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ordem_compra_identidade_immutability_guard ON public.ordem_compra;
CREATE TRIGGER ordem_compra_identidade_immutability_guard
  BEFORE UPDATE ON public.ordem_compra
  FOR EACH ROW
  EXECUTE FUNCTION public.ordem_compra_identidade_immutability_guard_fn();

-- ============================================================
-- 8. Backfill deterministico e congelamento
-- ============================================================
-- Ordenacao (criado_em ASC, id ASC) — a MESMA regra que o display posicional
-- usava, de modo que onde nenhuma irma foi removida o codigo congelado
-- COINCIDE com o que ja era exibido. Ver LIMITE DE RECONSTRUCAO HISTORICA.
--
-- Idempotente: a guarda `identidade_seq IS NULL` faz uma reexecucao virar
-- no-op. Os triggers de atribuicao NAO disparam aqui (`UPDATE OF lote_id` /
-- `UPDATE OF pedido_id`, e o backfill nao toca essas colunas).
WITH vinculadas AS (
  SELECT o.id AS op_id, l.pedido_id, p.numero AS pedido_numero,
         public.pedido_ano_comercial(p.data_pedido, p.criado_em) AS pedido_ano,
         public.op_tipo_letra(o.tipo) AS tipo_letra,
         row_number() OVER (
           PARTITION BY l.pedido_id, public.op_tipo_letra(o.tipo)
           ORDER BY o.criado_em ASC, o.id ASC
         )::INTEGER AS seq
    FROM public.ops o
    JOIN public.lotes l   ON l.id = o.lote_id
    JOIN public.pedidos p ON p.id = l.pedido_id
   WHERE o.identidade_seq IS NULL
     AND public.op_tipo_letra(o.tipo) IS NOT NULL
     AND p.numero IS NOT NULL
)
UPDATE public.ops o
   SET identidade_pedido_id = v.pedido_id, identidade_pedido_numero = v.pedido_numero,
       identidade_pedido_ano = v.pedido_ano, identidade_tipo_letra = v.tipo_letra,
       identidade_seq = v.seq
  FROM vinculadas v
 WHERE o.id = v.op_id AND o.identidade_seq IS NULL;

WITH ocs AS (
  SELECT oc.id AS oc_id, oc.pedido_id, p.numero AS pedido_numero,
         public.pedido_ano_comercial(p.data_pedido, p.criado_em) AS pedido_ano,
         row_number() OVER (
           PARTITION BY oc.pedido_id ORDER BY oc.criado_em ASC, oc.id ASC
         )::INTEGER AS seq
    FROM public.ordem_compra oc
    JOIN public.pedidos p ON p.id = oc.pedido_id
   WHERE oc.identidade_seq IS NULL
     AND oc.pedido_id IS NOT NULL
     AND p.numero IS NOT NULL
)
UPDATE public.ordem_compra oc
   SET identidade_pedido_id = o.pedido_id, identidade_pedido_numero = o.pedido_numero,
       identidade_pedido_ano = o.pedido_ano, identidade_seq = o.seq
  FROM ocs o
 WHERE oc.id = o.oc_id AND oc.identidade_seq IS NULL;

-- Congela o high-water no maior valor atribuido, por escopo, para que a
-- proxima linha continue DEPOIS do backfill e nunca colida. GREATEST
-- preserva um contador que ja esteja adiante.
INSERT INTO public.pedido_identidade_numeros (pedido_id, escopo, ultimo_seq)
SELECT identidade_pedido_id, identidade_tipo_letra, MAX(identidade_seq)
  FROM public.ops
 WHERE identidade_seq IS NOT NULL
 GROUP BY identidade_pedido_id, identidade_tipo_letra
UNION ALL
SELECT identidade_pedido_id, 'OC', MAX(identidade_seq)
  FROM public.ordem_compra
 WHERE identidade_seq IS NOT NULL
 GROUP BY identidade_pedido_id
ON CONFLICT (pedido_id, escopo) DO UPDATE
   SET ultimo_seq = GREATEST(public.pedido_identidade_numeros.ultimo_seq, EXCLUDED.ultimo_seq),
       updated_at = CASE
         WHEN public.pedido_identidade_numeros.ultimo_seq < EXCLUDED.ultimo_seq THEN now()
         ELSE public.pedido_identidade_numeros.updated_at
       END;

-- ============================================================
-- 9. Projecao de identidade para as superficies de compra/recebimento
-- ============================================================
-- As superficies de distribuicao de compra e de recebimento sao alimentadas
-- por RPCs aceitas (`obter_distribuicao_ordem_compra` db/69,
-- `obter_historico_recebimento_ordem_compra` db/70/db/74) que atribuem a
-- origem APENAS por `op_id`. Era isso que fazia a tela de recebimento
-- imprimir `OP 137` — a chave primaria crua como se fosse nome de negocio.
--
-- Esta view e a projecao MINIMA que expoe a identidade canonica para essas
-- telas SEM reescrever nenhuma RPC do ciclo de vida de ordem de compra
-- (fora de escopo). E somente leitura, aditiva e nao muda resposta alguma
-- de RPC existente.
--
-- security_invoker = true: a view NAO amplia visibilidade. A RLS de
-- public.ops continua sendo aplicada com os privilegios de QUEM CONSULTA.
CREATE OR REPLACE VIEW public.op_identidade_projecao
  WITH (security_invoker = true) AS
SELECT o.id AS op_id, o.identidade_operacional, o.identidade_pedido_id,
       o.numero, o.ano, o.tipo
  FROM public.ops o;

COMMENT ON VIEW public.op_identidade_projecao IS
  'db/95: projecao somente leitura de op_id -> identidade canonica, para as superficies de compra e recebimento cujas RPCs aceitas atribuem origem apenas por op_id. security_invoker: a RLS de public.ops continua valendo.';

GRANT SELECT ON public.op_identidade_projecao TO authenticated;

-- ============================================================
-- 10. Invariantes pos-migracao (fail closed)
-- ============================================================
DO $post$
DECLARE
  bad TEXT := '';
  v_parcial BIGINT; v_orfa BIGINT; v_hw BIGINT; v_oc_parcial BIGINT; v_oc_orfa BIGINT;
BEGIN
  SELECT count(*) INTO v_parcial FROM public.ops
   WHERE (identidade_seq IS NULL) <> (identidade_operacional IS NULL);
  IF v_parcial <> 0 THEN bad := bad || 'op_identidade_parcial=' || v_parcial || ';'; END IF;

  SELECT count(*) INTO v_oc_parcial FROM public.ordem_compra
   WHERE (identidade_seq IS NULL) <> (identidade_operacional IS NULL);
  IF v_oc_parcial <> 0 THEN bad := bad || 'oc_identidade_parcial=' || v_oc_parcial || ';'; END IF;

  SELECT count(*) INTO v_orfa
    FROM public.ops o
    JOIN public.lotes l ON l.id = o.lote_id
    JOIN public.pedidos p ON p.id = l.pedido_id
   WHERE o.identidade_seq IS NULL AND public.op_tipo_letra(o.tipo) IS NOT NULL
     AND p.numero IS NOT NULL;
  IF v_orfa <> 0 THEN bad := bad || 'op_vinculada_sem_identidade=' || v_orfa || ';'; END IF;

  SELECT count(*) INTO v_oc_orfa
    FROM public.ordem_compra oc JOIN public.pedidos p ON p.id = oc.pedido_id
   WHERE oc.identidade_seq IS NULL AND p.numero IS NOT NULL;
  IF v_oc_orfa <> 0 THEN bad := bad || 'oc_vinculada_sem_identidade=' || v_oc_orfa || ';'; END IF;

  SELECT count(*) INTO v_hw FROM (
    SELECT identidade_pedido_id AS pid, identidade_tipo_letra AS esc, MAX(identidade_seq) AS mx
      FROM public.ops WHERE identidade_seq IS NOT NULL GROUP BY 1, 2
    UNION ALL
    SELECT identidade_pedido_id, 'OC', MAX(identidade_seq)
      FROM public.ordem_compra WHERE identidade_seq IS NOT NULL GROUP BY 1, 2
  ) m LEFT JOIN public.pedido_identidade_numeros n
        ON n.pedido_id = m.pid AND n.escopo = m.esc
   WHERE n.ultimo_seq IS NULL OR n.ultimo_seq < m.mx;
  IF v_hw <> 0 THEN bad := bad || 'highwater_atrasado=' || v_hw || ';'; END IF;

  IF bad <> '' THEN
    RAISE EXCEPTION 'db/95 post-invariant falhou: %', bad;
  END IF;
END
$post$;

-- ============================================================
-- 11. Reload PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
