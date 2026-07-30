-- =====================================================================
-- db/96_ordem_compra_codigo_operador_e_exclusao.sql
-- OC-OPERATOR-CODE-AND-DELETION-R1 — o operador escolhe o codigo da Ordem
-- de Compra, e uma OC sem historico irreversivel pode ser EXCLUIDA.
--
-- Order: ruling do arquiteto (2026-07-30). Ela SUPERSEDE a sequencia
-- automatica de OC decidida em db/95 para o CODIGO VISIVEL; a linhagem
-- (identidade_pedido_id/numero/ano) permanece intocada e a numeracao de OP
-- (escopos 'T'/'A') nao e alterada por esta migracao.
-- Forward-only; db/01..db/95 sao intocados. O guard terminal de migracao
-- avanca 95 -> 96 no mesmo commit (tests/ordem-compra-c3d-deploy.smoke.js).
--
-- PARTE 1 — CODIGO ESCOLHIDO PELO OPERADOR
--   db/95 tornou `identidade_operacional` uma coluna GERADA a partir de
--   (identidade_pedido_numero, identidade_seq, identidade_pedido_ano), ou
--   seja, o sistema escolhia o numero. A regra de produto agora e outra: o
--   numero/codigo da OC e um dado do NEGOCIO, escolhido por quem compra.
--
--   `ordem_compra.codigo` passa a ser esse valor, preservado EXATAMENTE como
--   digitado — sem trim, sem upper, sem normalizacao. A validacao e apenas a
--   necessaria: nao vazio, sem espaco nas bordas, sem caractere de controle,
--   ate 40 caracteres, e unico entre as ordens vivas.
--
--   `identidade_operacional` continua existindo e continua sendo o UNICO
--   nome de negocio lido pelas telas (js/op-display.js). Ela passa a ser
--   COALESCE(codigo, <derivacao db/95>): quando ha codigo do operador ele
--   vence; sem codigo, a derivacao antiga ainda responde, de modo que
--   nenhuma linha existente perde o nome e nenhum consumidor muda.
--
--   A sequencia so e consumida quando NAO ha codigo. Uma OC criada com
--   codigo nao gasta `pedido_identidade_numeros`.
--
-- PARTE 2 — EXCLUSAO
--   `cancelar_ordem_compra` deixa a ordem no historico e, por contrato,
--   NAO devolve a distribuicao. Isso e correto para uma ordem real, mas
--   deixava presas as alocacoes de uma ordem de teste: o saldo da
--   necessidade continuava consumido por uma OC que nao existe mais
--   comercialmente, e `definir_alocacao_necessidade_compra_fio` recusava
--   qualquer novo alvo com `estado_invalido` — inclusive o alvo 0, que e o
--   proprio caminho documentado de remocao. Nao havia saida pelo produto.
--
--   `excluir_ordem_compra` e essa saida, e NAO redesenha o cancelamento:
--   Cancelar continua sendo o caminho de uma ordem real que precisa
--   permanecer na historia; Excluir apaga uma ordem que nunca deveria ter
--   existido, e so quando nada irreversivel aconteceu com ela.
--
--   ELEGIBILIDADE (fail closed): nativa; status rascunho ou cancelada; nunca
--   emitida; aceite nao decidido; e ZERO recebimentos, lancamentos de fio e
--   movimentos de estoque — exatamente os tres filhos ON DELETE RESTRICT.
--
--   As guardas `alocacao_rascunho_guard` e `item_quantidade_rascunho_guard`
--   proibem apagar filhos de uma ordem fora de rascunho, o que impediria
--   apagar uma ordem CANCELADA. Elas passam a aceitar a exclusao autorizada
--   em curso, identificada pelo GUC transacional `app.oc_exclusao_id`, que
--   carrega o id da UNICA ordem sendo apagada. Nenhuma outra ordem e
--   afetada, e o relaxamento vale so para DELETE. O GUC nao e um furo de
--   seguranca: nenhuma role cliente tem policy de INSERT/UPDATE/DELETE
--   nessas tabelas (db/67), entao o unico caminho ate elas e esta funcao
--   SECURITY DEFINER, que exige is_admin().
--
--   `trg_item_kg_pedido_derivado_guard` e DEFERRABLE INITIALLY DEFERRED, de
--   modo que apagar alocacoes e itens na MESMA transacao e consistente: no
--   COMMIT o item ja nao existe e a verificacao nao encontra linha.
--
-- Nenhuma linha de outra Ordem de Compra e lida, escrita ou apagada.
-- =====================================================================

BEGIN;

-- ============================================================
-- 1. Codigo escolhido pelo operador
-- ============================================================

ALTER TABLE public.ordem_compra
  ADD COLUMN IF NOT EXISTS codigo TEXT;

COMMENT ON COLUMN public.ordem_compra.codigo IS
  'db/96: codigo/numero VISIVEL da Ordem de Compra, escolhido pelo operador na criacao e preservado exatamente como digitado. Imutavel depois de atribuido. Quando presente, vence a derivacao automatica em identidade_operacional.';

ALTER TABLE public.ordem_compra
  DROP CONSTRAINT IF EXISTS ordem_compra_codigo_formato;
ALTER TABLE public.ordem_compra
  ADD CONSTRAINT ordem_compra_codigo_formato CHECK (
    codigo IS NULL
    OR (length(codigo) BETWEEN 1 AND 40
        AND codigo = btrim(codigo)
        AND codigo !~ '[[:cntrl:]]')
  );

-- A coluna gerada precisa ser recriada para mudar a expressao. Nenhuma view,
-- regra ou constraint depende dela (verificado em pg_depend antes da escrita),
-- e o indice unico e recriado logo abaixo.
ALTER TABLE public.ordem_compra DROP COLUMN IF EXISTS identidade_operacional;

ALTER TABLE public.ordem_compra
  ADD COLUMN identidade_operacional TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN codigo IS NOT NULL THEN codigo
      WHEN identidade_pedido_numero IS NULL
        OR identidade_pedido_ano IS NULL
        OR identidade_seq IS NULL THEN NULL
      ELSE 'OC-' || lpad(identidade_pedido_numero::text, 3, '0')
           || '-' || identidade_seq::text
           || '-' || lpad(((identidade_pedido_ano)::integer % 100)::text, 2, '0')
    END
  ) STORED;

COMMENT ON COLUMN public.ordem_compra.identidade_operacional IS
  'db/95 + db/96: UNICO nome de negocio da Ordem de Compra. COALESCE do codigo escolhido pelo operador com a derivacao Pedido+sequencia de db/95, que sobrevive para as linhas anteriores a db/96. A chave primaria NUNCA e nome.';

CREATE UNIQUE INDEX IF NOT EXISTS ordem_compra_identidade_operacional_uidx
  ON public.ordem_compra (identidade_operacional)
  WHERE identidade_operacional IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ordem_compra_codigo_uidx
  ON public.ordem_compra (codigo)
  WHERE codigo IS NOT NULL;

-- Imutabilidade: o codigo entra uma vez e nunca muda, pela mesma razao da
-- identidade derivada — um documento de compra nao troca de nome.
CREATE OR REPLACE FUNCTION public.ordem_compra_identidade_immutability_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.codigo IS NOT NULL AND NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    RAISE EXCEPTION
      'Codigo da Ordem de Compra e imutavel apos a atribuicao (oc %: % -> %)',
      OLD.id, OLD.codigo, NEW.codigo;
  END IF;

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

-- A linhagem continua sendo atribuida; a SEQUENCIA so e gasta quando o
-- operador nao deu codigo, para que uma OC nomeada nao consuma numeracao.
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
  IF NEW.identidade_pedido_id IS NOT NULL THEN
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

  IF NEW.codigo IS NULL AND NEW.identidade_seq IS NULL THEN
    NEW.identidade_seq := public.proximo_seq_identidade(NEW.pedido_id, 'OC');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ordem_compra_identidade_assign_fn() IS
  'db/95 + db/96: atribui a LINHAGEM da Ordem de Compra (Pedido, numero, ano) exatamente uma vez. A sequencia automatica so e consumida quando o operador nao escolheu um codigo.';

-- ============================================================
-- 2. Guardas de rascunho cientes da exclusao autorizada
-- ============================================================

CREATE OR REPLACE FUNCTION public.oc_exclusao_autorizada(p_ordem_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p_ordem_id IS NOT NULL
     AND coalesce(current_setting('app.oc_exclusao_id', true), '') = p_ordem_id::text;
$$;

COMMENT ON FUNCTION public.oc_exclusao_autorizada(BIGINT) IS
  'db/96: verdadeiro somente durante public.excluir_ordem_compra, e somente para a UNICA ordem que ela esta apagando. O GUC e transacional (set_config(..., true)) e nenhuma role cliente possui policy de DELETE nas tabelas guardadas, entao este relaxamento so e alcancavel pela funcao SECURITY DEFINER que exige is_admin().';

CREATE OR REPLACE FUNCTION public.trg_alocacao_rascunho_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_old_ordem  BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT oc.status_administrativo, oc.id INTO v_old_status, v_old_ordem
    FROM public.ordem_compra_item i
    JOIN public.ordem_compra oc ON oc.id = i.ordem_id
    WHERE i.id = OLD.item_id;

    IF public.oc_exclusao_autorizada(v_old_ordem) THEN
      RETURN OLD;
    END IF;
  ELSIF TG_OP <> 'INSERT' THEN
    SELECT oc.status_administrativo INTO v_old_status
    FROM public.ordem_compra_item i
    JOIN public.ordem_compra oc ON oc.id = i.ordem_id
    WHERE i.id = OLD.item_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT oc.status_administrativo INTO v_new_status
    FROM public.ordem_compra_item i
    JOIN public.ordem_compra oc ON oc.id = i.ordem_id
    WHERE i.id = NEW.item_id;
  END IF;

  IF COALESCE(v_old_status, 'rascunho') IS DISTINCT FROM 'rascunho'
     OR COALESCE(v_new_status, 'rascunho') IS DISTINCT FROM 'rascunho' THEN
    RAISE EXCEPTION 'ordem_compra_item_alocacao is immutable outside rascunho';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_item_quantidade_rascunho_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' AND public.oc_exclusao_autorizada(OLD.ordem_id) THEN
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    SELECT status_administrativo INTO v_old_status
    FROM public.ordem_compra WHERE id = OLD.ordem_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT status_administrativo INTO v_new_status
    FROM public.ordem_compra WHERE id = NEW.ordem_id;
  END IF;

  IF TG_OP = 'INSERT' AND v_new_status IS DISTINCT FROM 'rascunho' THEN
    RAISE EXCEPTION 'ordem_compra_item cannot be inserted outside rascunho';
  ELSIF TG_OP = 'DELETE' AND v_old_status IS DISTINCT FROM 'rascunho' THEN
    RAISE EXCEPTION 'ordem_compra_item cannot be deleted outside rascunho';
  ELSIF TG_OP = 'UPDATE'
    AND (NEW.ordem_id IS DISTINCT FROM OLD.ordem_id
      OR NEW.material IS DISTINCT FROM OLD.material
      OR NEW.cor_id IS DISTINCT FROM OLD.cor_id
      OR NEW.cor_poliester IS DISTINCT FROM OLD.cor_poliester
      OR NEW.kg_pedido IS DISTINCT FROM OLD.kg_pedido)
    AND (v_old_status IS DISTINCT FROM 'rascunho'
      OR v_new_status IS DISTINCT FROM 'rascunho') THEN
    RAISE EXCEPTION 'ordem_compra_item identity/quantity is immutable outside rascunho';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 3. Exclusao atomica de uma Ordem de Compra sem historico
-- ============================================================

CREATE OR REPLACE FUNCTION public.excluir_ordem_compra(p_ordem_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem       public.ordem_compra%ROWTYPE;
  v_necessidades JSONB;
  v_itens       BIGINT;
  v_alocacoes   BIGINT;
  v_eventos     BIGINT;
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

  IF v_ordem.legado THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ordem_legado',
      'erro', 'Ordem legada nao pode ser excluida por esta via');
  END IF;

  IF v_ordem.status_administrativo NOT IN ('rascunho', 'cancelada') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'estado_invalido',
      'erro', 'Somente uma ordem em rascunho ou cancelada pode ser excluida');
  END IF;

  IF v_ordem.emitida_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ordem_emitida',
      'erro', 'Uma ordem que ja foi emitida nao pode ser excluida');
  END IF;

  IF v_ordem.status_aceite IN ('aceita', 'rejeitada') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'aceite_decidido',
      'erro', 'Uma ordem com aceite decidido pelo fornecedor nao pode ser excluida');
  END IF;

  -- Os tres filhos ON DELETE RESTRICT sao exatamente o historico irreversivel.
  IF EXISTS (SELECT 1 FROM public.ordem_compra_recebimentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_lancamentos WHERE ordem_compra_id = p_ordem_id)
     OR EXISTS (SELECT 1 FROM public.ordem_compra_fio_movimentos_estoque WHERE ordem_compra_id = p_ordem_id) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'historico_irreversivel',
      'erro', 'A ordem possui recebimento, lancamento de fio ou movimento de estoque e nao pode ser excluida');
  END IF;

  -- Estado ANTES, para provar a devolucao do saldo.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'necessidade_id', n.id,
           'material', n.material,
           'kg_necessario', n.kg_necessario,
           'kg_alocado_antes', n.kg_alocado,
           'kg_devolvido', s.kg
         ) ORDER BY n.id), '[]'::jsonb)
    INTO v_necessidades
    FROM (
      SELECT a.necessidade_id AS nid, sum(a.kg_alocado) AS kg
      FROM public.ordem_compra_item_alocacao a
      JOIN public.ordem_compra_item i ON i.id = a.item_id
      WHERE i.ordem_id = p_ordem_id
      GROUP BY a.necessidade_id
    ) s
    JOIN public.necessidade_compra_fio n ON n.id = s.nid;

  -- Autoriza, para ESTA transacao e ESTA ordem, o relaxamento das guardas.
  PERFORM set_config('app.oc_exclusao_id', p_ordem_id::text, true);

  WITH alvo AS (
    DELETE FROM public.ordem_compra_item_alocacao a
    USING public.ordem_compra_item i
    WHERE i.id = a.item_id AND i.ordem_id = p_ordem_id
    RETURNING a.id
  ) SELECT count(*) INTO v_alocacoes FROM alvo;

  WITH alvo AS (
    DELETE FROM public.ordem_compra_item WHERE ordem_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_itens FROM alvo;

  WITH alvo AS (
    DELETE FROM public.ordem_compra_eventos WHERE ordem_compra_id = p_ordem_id RETURNING id
  ) SELECT count(*) INTO v_eventos FROM alvo;

  DELETE FROM public.ordem_compra WHERE id = p_ordem_id;

  PERFORM set_config('app.oc_exclusao_id', '', true);

  RETURN jsonb_build_object(
    'ok', true, 'codigo', 'ok',
    'ordem_compra_id', p_ordem_id,
    'identidade_operacional', v_ordem.identidade_operacional,
    'status_anterior', v_ordem.status_administrativo,
    'itens_removidos', v_itens,
    'alocacoes_liberadas', v_alocacoes,
    'eventos_removidos', v_eventos,
    'necessidades_liberadas', v_necessidades
  );
END;
$$;

COMMENT ON FUNCTION public.excluir_ordem_compra(BIGINT) IS
  'db/96: exclusao atomica de uma Ordem de Compra NATIVA sem historico irreversivel (rascunho ou cancelada, nunca emitida, aceite nao decidido, zero recebimentos/lancamentos/movimentos). Libera as alocacoes de volta para as necessidades pelo cache mantido por trg_alocacao_kg_alocado_cache, remove itens e eventos administrativos proprios, e nao toca em nenhuma outra ordem. Cancelar continua sendo o caminho de uma ordem real que precisa permanecer na historia.';

ALTER FUNCTION public.excluir_ordem_compra(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.excluir_ordem_compra(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_ordem_compra(BIGINT) TO authenticated;

ALTER FUNCTION public.oc_exclusao_autorizada(BIGINT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.oc_exclusao_autorizada(BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

-- ============================================================
-- 4. Distribuicao passa a exigir o codigo ao CRIAR uma ordem
-- ============================================================
-- A assinatura ganha p_codigo_ordem com DEFAULT NULL: um cliente antigo que
-- ainda envie quatro argumentos continua funcionando para REUTILIZAR um
-- rascunho existente, e recebe uma recusa nomeada quando a chamada exigiria
-- criar uma ordem nova. Fail closed, sem janela quebrada durante o release.

DROP FUNCTION IF EXISTS public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.definir_alocacao_necessidade_compra_fio(
  p_necessidade_id BIGINT,
  p_fornecedor_id BIGINT,
  p_kg_alocado NUMERIC,
  p_idempotency_key TEXT,
  p_codigo_ordem TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_key TEXT;
  v_target NUMERIC(12,3);
  v_payload JSONB;
  v_hash TEXT;
  v_command public.ordem_compra_distribuicao_comandos%ROWTYPE;
  v_need public.necessidade_compra_fio%ROWTYPE;
  v_supplier public.fornecedores%ROWTYPE;
  v_order public.ordem_compra%ROWTYPE;
  v_item public.ordem_compra_item%ROWTYPE;
  v_allocation public.ordem_compra_item_alocacao%ROWTYPE;
  v_resolved_pedido UUID;
  v_previous NUMERIC(12,3) := 0;
  v_available NUMERIC(12,3);
  v_item_total NUMERIC(12,3);
  v_need_allocated NUMERIC(12,3);
  v_discriminator TEXT;
  v_order_id BIGINT;
  v_item_id BIGINT;
  v_allocation_id BIGINT;
  v_item_removed BOOLEAN := FALSE;
  v_order_removed BOOLEAN := FALSE;
  v_remove_item BOOLEAN := FALSE;
  v_remove_order BOOLEAN := FALSE;
  v_codigo TEXT;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'sem_permissao', 'erro', 'Somente administrador autenticado pode distribuir necessidades');
  END IF;

  v_key := btrim(p_idempotency_key);
  IF p_idempotency_key IS NULL OR length(v_key) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_invalida', 'erro', 'Chave de idempotencia invalida');
  END IF;
  IF p_kg_alocado IS NULL OR p_kg_alocado < 0
     OR round(p_kg_alocado, 3) IS DISTINCT FROM p_kg_alocado
     OR p_kg_alocado > 999999999.999 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'kg_invalido', 'erro', 'Quantidade deve usar NUMERIC(12,3), sem sinal negativo');
  END IF;
  v_target := p_kg_alocado::NUMERIC(12,3);

  -- Preservado EXATAMENTE como digitado: nada de trim silencioso. Um valor
  -- so-de-espacos e tratado como ausente.
  v_codigo := p_codigo_ordem;
  IF v_codigo IS NOT NULL AND btrim(v_codigo) = '' THEN
    v_codigo := NULL;
  END IF;
  IF v_codigo IS NOT NULL AND (
       length(v_codigo) > 40
    OR v_codigo <> btrim(v_codigo)
    OR v_codigo ~ '[[:cntrl:]]'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_invalido',
      'erro', 'O codigo da ordem deve ter ate 40 caracteres, sem espaco no inicio ou fim e sem caractere de controle');
  END IF;

  v_payload := jsonb_build_object(
    'namespace', 'native_distribution_v1',
    'necessidade_id', p_necessidade_id,
    'fornecedor_id', p_fornecedor_id,
    'kg_alocado', to_char(v_target, 'FM9999999990.000'),
    'codigo_ordem', v_codigo
  );
  v_hash := md5(v_payload::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_distribution_v1|command|' || v_actor::TEXT || '|' || v_key, 0
  ));

  SELECT * INTO v_command
  FROM public.ordem_compra_distribuicao_comandos
  WHERE idempotency_namespace = 'native_distribution_v1'
    AND ator_id = v_actor
    AND idempotency_key = v_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_command.comando_payload = v_payload THEN
      RETURN v_command.resultado;
    END IF;
    RETURN jsonb_build_object('ok', false, 'codigo', 'idempotencia_conflitante', 'erro', 'Chave reutilizada com comando materialmente diferente');
  END IF;

  SELECT * INTO v_need
  FROM public.necessidade_compra_fio
  WHERE id = p_necessidade_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_nao_encontrada', 'erro', 'Necessidade nao encontrada');
  END IF;
  IF v_need.legado OR v_need.kg_necessario <= 0 OR v_need.pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_invalida', 'erro', 'Necessidade nao e nativa e distribuivel');
  END IF;

  IF v_need.origem_tipo = 'op' THEN
    IF v_need.material <> 'algodao' OR v_need.op_id IS NULL OR v_need.cor_id IS NULL OR v_need.cor_poliester IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_origem_invalida', 'erro', 'Forma OP-origin invalida');
    END IF;
    SELECT l.pedido_id INTO v_resolved_pedido
    FROM public.ops o
    JOIN public.lotes l ON l.id = o.lote_id
    WHERE o.id = v_need.op_id;
    IF v_resolved_pedido IS DISTINCT FROM v_need.pedido_id THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'pedido_incoerente', 'erro', 'OP da necessidade nao pertence ao Pedido');
    END IF;
  ELSIF v_need.origem_tipo = 'pedido' THEN
    IF v_need.material <> 'poliester' OR v_need.op_id IS NOT NULL OR v_need.cor_id IS NOT NULL OR v_need.cor_poliester IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_origem_invalida', 'erro', 'Forma Pedido-origin invalida');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'codigo', 'necessidade_origem_invalida', 'erro', 'Origem da necessidade invalida');
  END IF;

  SELECT * INTO v_supplier
  FROM public.fornecedores
  WHERE id = p_fornecedor_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_invalido', 'erro', 'Fornecedor inexistente');
  END IF;
  IF (v_need.material = 'algodao' AND v_supplier.tipo <> 'fio_algodao')
     OR (v_need.material = 'poliester' AND v_supplier.tipo <> 'fio_poliester') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'fornecedor_incompativel', 'erro', 'Fornecedor incompativel com o material');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'native_distribution_v1|draft|' || v_need.pedido_id::TEXT || '|' || p_fornecedor_id::TEXT, 0
  ));

  SELECT * INTO v_order
  FROM public.ordem_compra
  WHERE pedido_id = v_need.pedido_id
    AND fornecedor_id = p_fornecedor_id
    AND legado = FALSE
    AND status_administrativo = 'rascunho'
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.ordem_compra_item_alocacao a
      JOIN public.ordem_compra_item i ON i.id = a.item_id
      JOIN public.ordem_compra o ON o.id = i.ordem_id
      WHERE a.necessidade_id = v_need.id
        AND o.pedido_id = v_need.pedido_id
        AND o.fornecedor_id = p_fornecedor_id
        AND o.status_administrativo <> 'rascunho'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'estado_invalido', 'erro', 'A alocacao correspondente pertence a entidade historica congelada');
    END IF;
    IF v_target = 0 THEN
      v_discriminator := 'unchanged';
      v_need_allocated := v_need.kg_alocado;
      v_result := jsonb_build_object(
        'ok', true, 'codigo', 'ok', 'idempotency_key', v_key,
        'discriminador', v_discriminator, 'necessidade_id', v_need.id,
        'pedido_id', v_need.pedido_id, 'fornecedor_id', p_fornecedor_id,
        'origem_tipo', v_need.origem_tipo, 'op_id', v_need.op_id,
        'material', v_need.material, 'cor_id', v_need.cor_id,
        'cor_poliester', v_need.cor_poliester, 'ordem_compra_id', NULL,
        'ordem_compra_item_id', NULL, 'alocacao_id', NULL,
        'kg_anterior', 0::NUMERIC(12,3), 'kg_final', v_target,
        'item_kg_pedido', NULL, 'necessidade_kg_necessario', v_need.kg_necessario,
        'necessidade_kg_alocado', v_need_allocated,
        'necessidade_kg_restante', v_need.kg_necessario - v_need_allocated,
        'item_removido', false, 'ordem_removida', false
      );
      INSERT INTO public.ordem_compra_distribuicao_comandos(
        ator_id, idempotency_key, comando_payload, comando_hash, resultado
      ) VALUES (v_actor, v_key, v_payload, v_hash, v_result);
      RETURN v_result;
    END IF;

    v_available := v_need.kg_necessario - v_need.kg_alocado;
    IF v_target > v_available THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
        'erro', 'Alocacao excede o saldo da necessidade',
        'necessidade_id', v_need.id, 'disponivel', v_available);
    END IF;

    -- REGRA DE PRODUTO (db/96): criar uma ordem exige o codigo do operador.
    IF v_codigo IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_obrigatorio',
        'erro', 'Informe o numero/codigo da ordem de compra para este fornecedor',
        'pedido_id', v_need.pedido_id, 'fornecedor_id', p_fornecedor_id);
    END IF;
    IF EXISTS (SELECT 1 FROM public.ordem_compra WHERE codigo = v_codigo) THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'codigo_ordem_duplicado',
        'erro', 'Ja existe uma ordem de compra com este codigo');
    END IF;

    INSERT INTO public.ordem_compra(
      pedido_id, fornecedor_id, codigo, status_administrativo, status_aceite,
      status_recebimento, legado
    ) VALUES (
      v_need.pedido_id, p_fornecedor_id, v_codigo, 'rascunho', 'nao_aplicavel',
      'nao_recebido', FALSE
    ) RETURNING * INTO v_order;
  END IF;
  v_order_id := v_order.id;

  SELECT * INTO v_item
  FROM public.ordem_compra_item
  WHERE ordem_id = v_order.id
    AND material = v_need.material
    AND cor_id IS NOT DISTINCT FROM v_need.cor_id
    AND cor_poliester IS NOT DISTINCT FROM v_need.cor_poliester
  FOR UPDATE;

  IF NOT FOUND AND v_target = 0 THEN
    v_need_allocated := v_need.kg_alocado;
    v_result := jsonb_build_object(
      'ok', true, 'codigo', 'ok', 'idempotency_key', v_key,
      'discriminador', 'unchanged', 'necessidade_id', v_need.id,
      'pedido_id', v_need.pedido_id, 'fornecedor_id', p_fornecedor_id,
      'origem_tipo', v_need.origem_tipo, 'op_id', v_need.op_id,
      'material', v_need.material, 'cor_id', v_need.cor_id,
      'cor_poliester', v_need.cor_poliester, 'ordem_compra_id', NULL,
      'ordem_compra_item_id', NULL, 'alocacao_id', NULL,
      'kg_anterior', 0::NUMERIC(12,3), 'kg_final', v_target,
      'item_kg_pedido', NULL, 'necessidade_kg_necessario', v_need.kg_necessario,
      'necessidade_kg_alocado', v_need_allocated,
      'necessidade_kg_restante', v_need.kg_necessario - v_need_allocated,
      'item_removido', false, 'ordem_removida', false
    );
    INSERT INTO public.ordem_compra_distribuicao_comandos(
      ator_id, idempotency_key, comando_payload, comando_hash, resultado
    ) VALUES (v_actor, v_key, v_payload, v_hash, v_result);
    RETURN v_result;
  ELSIF NOT FOUND THEN
    v_available := v_need.kg_necessario - v_need.kg_alocado;
    IF v_target > v_available THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
        'erro', 'Alocacao excede o saldo da necessidade',
        'necessidade_id', v_need.id, 'disponivel', v_available);
    END IF;
    INSERT INTO public.ordem_compra_item(
      ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido
    ) VALUES (
      v_order.id, v_need.material, v_need.cor_id, v_need.cor_poliester,
      v_target, 0
    ) RETURNING * INTO v_item;
  END IF;
  v_item_id := v_item.id;

  SELECT * INTO v_allocation
  FROM public.ordem_compra_item_alocacao
  WHERE item_id = v_item.id
    AND necessidade_id = v_need.id
  FOR UPDATE;
  IF FOUND THEN
    v_previous := v_allocation.kg_alocado;
    v_allocation_id := v_allocation.id;
  END IF;

  v_available := v_need.kg_necessario - (v_need.kg_alocado - v_previous);
  IF v_target > v_available THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'excede_saldo',
      'erro', 'Alocacao excede o saldo da necessidade',
      'necessidade_id', v_need.id, 'disponivel', v_available);
  END IF;

  IF v_target = 0 AND v_allocation.id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.ordem_compra_item_alocacao
      WHERE item_id = v_item.id
        AND id <> v_allocation.id
    ) INTO v_remove_item;

    IF v_remove_item THEN
      IF EXISTS (
        SELECT 1 FROM public.ordem_compra_fio_lancamentos
        WHERE ordem_compra_item_id = v_item.id
      ) THEN
        RETURN jsonb_build_object('ok', false, 'codigo', 'limpeza_conflitante', 'erro', 'Item possui historico e nao pode ser limpo');
      END IF;

      SELECT NOT EXISTS (
        SELECT 1
        FROM public.ordem_compra_item
        WHERE ordem_id = v_order.id
          AND id <> v_item.id
      ) INTO v_remove_order;

      IF v_remove_order AND (
        v_order.status_administrativo <> 'rascunho'
        OR v_order.emitida_em IS NOT NULL
        OR v_order.cancelada_em IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.ordem_compra_eventos WHERE ordem_compra_id = v_order.id)
        OR EXISTS (SELECT 1 FROM public.ordem_compra_recebimentos WHERE ordem_compra_id = v_order.id)
      ) THEN
        RETURN jsonb_build_object('ok', false, 'codigo', 'limpeza_conflitante', 'erro', 'Ordem possui historico e nao pode ser limpa');
      END IF;
    END IF;
  END IF;

  IF v_target > 0 AND v_allocation.id IS NULL THEN
    INSERT INTO public.ordem_compra_item_alocacao(
      item_id, necessidade_id, op_id, kg_alocado
    ) VALUES (
      v_item.id, v_need.id,
      CASE WHEN v_need.origem_tipo = 'op' THEN v_need.op_id ELSE NULL END,
      v_target
    ) RETURNING id INTO v_allocation_id;
    v_discriminator := 'created';
  ELSIF v_target > v_previous THEN
    UPDATE public.ordem_compra_item_alocacao
    SET kg_alocado = v_target
    WHERE id = v_allocation.id;
    v_discriminator := 'increased';
  ELSIF v_target > 0 AND v_target < v_previous THEN
    UPDATE public.ordem_compra_item_alocacao
    SET kg_alocado = v_target
    WHERE id = v_allocation.id;
    v_discriminator := 'reduced';
  ELSIF v_target = 0 AND v_allocation.id IS NOT NULL THEN
    DELETE FROM public.ordem_compra_item_alocacao WHERE id = v_allocation.id;
    v_discriminator := 'removed';
  ELSE
    v_discriminator := 'unchanged';
  END IF;

  IF v_target = 0 AND v_allocation.id IS NOT NULL AND v_remove_item THEN
      DELETE FROM public.ordem_compra_item WHERE id = v_item.id;
      v_item_removed := TRUE;
      v_item_total := NULL;

      IF v_remove_order THEN
        DELETE FROM public.ordem_compra WHERE id = v_order.id;
        v_order_removed := TRUE;
      END IF;
  END IF;

  IF NOT v_item_removed THEN
    SELECT sum(kg_alocado)::NUMERIC(12,3) INTO v_item_total
    FROM public.ordem_compra_item_alocacao
    WHERE item_id = v_item.id;
    UPDATE public.ordem_compra_item
    SET kg_pedido = v_item_total
    WHERE id = v_item.id;
  END IF;

  SELECT kg_alocado INTO v_need_allocated
  FROM public.necessidade_compra_fio
  WHERE id = v_need.id;

  v_result := jsonb_build_object(
    'ok', true, 'codigo', 'ok', 'idempotency_key', v_key,
    'discriminador', v_discriminator, 'necessidade_id', v_need.id,
    'pedido_id', v_need.pedido_id, 'fornecedor_id', p_fornecedor_id,
    'origem_tipo', v_need.origem_tipo,
    'op_id', CASE WHEN v_need.origem_tipo = 'op' THEN v_need.op_id ELSE NULL END,
    'material', v_need.material, 'cor_id', v_need.cor_id,
    'cor_poliester', v_need.cor_poliester,
    'ordem_compra_id', v_order_id, 'ordem_compra_item_id', v_item_id,
    'alocacao_id', v_allocation_id, 'kg_anterior', v_previous,
    'kg_final', v_target, 'item_kg_pedido', v_item_total,
    'necessidade_kg_necessario', v_need.kg_necessario,
    'necessidade_kg_alocado', v_need_allocated,
    'necessidade_kg_restante', v_need.kg_necessario - v_need_allocated,
    'item_removido', v_item_removed, 'ordem_removida', v_order_removed
  );

  INSERT INTO public.ordem_compra_distribuicao_comandos(
    ator_id, idempotency_key, comando_payload, comando_hash, resultado
  ) VALUES (v_actor, v_key, v_payload, v_hash, v_result);

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'alocacao_duplicada', 'erro', 'Identidade logica de alocacao duplicada');
END;
$$;

COMMENT ON FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT) IS
  'db/74 + db/96: escritor absoluto e idempotente da distribuicao. A criacao de uma NOVA ordem para (Pedido, fornecedor) exige p_codigo_ordem, preservado exatamente como digitado e unico; reutilizar um rascunho existente nao pede codigo algum. Todo o resto do contrato de db/74 e preservado.';

ALTER FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_alocacao_necessidade_compra_fio(BIGINT, BIGINT, NUMERIC, TEXT, TEXT)
  TO authenticated;

-- ============================================================
-- 5. Invariante pos-migracao (fail closed)
-- ============================================================
DO $$
DECLARE
  v_missing INT;
BEGIN
  SELECT count(*) INTO v_missing FROM public.ordem_compra
  WHERE pedido_id IS NOT NULL AND identidade_operacional IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'db/96 abortada: % ordem(ns) vinculada(s) a Pedido ficaram sem identidade_operacional', v_missing;
  END IF;

  IF to_regprocedure('public.excluir_ordem_compra(bigint)') IS NULL THEN
    RAISE EXCEPTION 'db/96 abortada: excluir_ordem_compra ausente';
  END IF;
  IF to_regprocedure('public.definir_alocacao_necessidade_compra_fio(bigint,bigint,numeric,text,text)') IS NULL THEN
    RAISE EXCEPTION 'db/96 abortada: assinatura de 5 argumentos ausente';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
