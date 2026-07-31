// scripts/c3d/p1-fixture.mjs
//
// Shared synthetic fixture for the P1 additive-backend integration suites.
//
// SYNTHETIC IDENTIFIERS AND QUANTITIES ONLY. No real Purchase Order id,
// no real Pedido, no real supplier and no real quantity appears here.
// Identity/setup rows are planted under session_replication_role =
// replica so the business guards do not fire on fixture construction;
// every behaviour the suites assert on is exercised through the real
// RPCs afterwards.
//
// Shape (all ids in the 94xxxxxxx synthetic band):
//
//   Pedido PED --- lote LOT --- OP1 (target)   needs: N1 cotton COR1
//                            \- OP2 (sibling)  needs: N2 cotton COR1
//                            \- OP3 (spare)
//                    Pedido-origin need:       N3 poliester PRETO
//
//   OP-origin cotton proves SIBLING ISOLATION: N1 and N2 share a colour,
//   so a correct implementation must NOT let OP2's reservation reduce
//   OP1's ceiling. Pedido-origin polyester proves the opposite: the pool
//   IS reduced by the other active OP.
//
//   Receipts are planted directly on the native ledger because the
//   canonical receipt writer is deliberately still fenced in P1
//   (ordem_compra_cutover is legacy_active / flat). The suites assert the
//   AVAILABILITY FORMULA, never the receipt writer.

export const PED = '94f10000-0000-4000-8000-000000000001';
export const CLI = 940000601;
export const LOT = 940000701;
export const OP1 = 940000101;
export const OP2 = 940000102;
export const OP3 = 940000103;
export const COR1 = 940000201;
export const COR2 = 940000202;
export const MOD1 = 940000301;
export const FORN_ALG = 940000401;
export const FORN_POL = 940000402;
export const N1 = 940000501;   // OP-origin cotton, OP1
export const N2 = 940000502;   // OP-origin cotton, OP2 (same colour)
export const N3 = 940000503;   // Pedido-origin poliester PRETO
export const OC1 = 940000801;
export const OC2 = 940000802;
export const OCI1 = 940000811;  // item cotton  -> N1
export const OCI2 = 940000812;  // item cotton  -> N2
export const OCI3 = 940000813;  // item poliest -> N3
export const ALO1 = 940000821;
export const ALO2 = 940000822;
export const ALO3 = 940000823;
export const REC1 = 940000901;

// Recipe constants chosen so every expected number is exact:
//   algodao_por_ml = 0.500, poliester_por_ml = 0.250, valor_x = 1.0000
//   => 100 m reserves  50.000 kg cotton on EACH of cor_1 and cor_2
//                      25.000 kg poliester on EACH of PRETO and BRANCO
export const FIXTURE_SQL = (adminUuid) => `
SET session_replication_role = replica;

INSERT INTO public.cores (id, nome) VALUES
  (${COR1}, 'P1-COR-UM'), (${COR2}, 'P1-COR-DOIS')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clientes (id, nome) VALUES (${CLI}, 'P1 Cliente Sintetico')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fornecedores (id, nome, tipo) VALUES
  (${FORN_ALG}, 'P1-FORN-ALGODAO', 'fio_algodao'),
  (${FORN_POL}, 'P1-FORN-POLIESTER', 'fio_poliester')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parametros_largura (largura, peso_linear, algodao_por_ml, poliester_por_ml, valor_x)
VALUES (1.40, 1.0000, 0.500000, 0.250000, 1.0000)
ON CONFLICT (largura) DO UPDATE
  SET algodao_por_ml = EXCLUDED.algodao_por_ml,
      poliester_por_ml = EXCLUDED.poliester_por_ml,
      valor_x = EXCLUDED.valor_x;

INSERT INTO public.modelos (id, nome, cor_1_id, cor_2_id, largura, tipo_produto)
VALUES (${MOD1}, 'P1-MODELO-TAPETE', ${COR1}, ${COR2}, 1.40, 'tapete')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pedidos (id, cliente_id, numero, data_pedido, status, criado_em)
VALUES ('${PED}', ${CLI}, 940001, DATE '2026-03-10', 'confirmado', now())
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lotes (id, numero, cliente_id, pedido_id)
VALUES (${LOT}, 940701, ${CLI}, '${PED}')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ops (id, numero, ano, lote_id, status, tipo) VALUES
  (${OP1}, 940101, 2099, ${LOT}, 'aberta', 'tecelagem'),
  (${OP2}, 940102, 2099, ${LOT}, 'aberta', 'tecelagem'),
  (${OP3}, 940103, 2099, ${LOT}, 'aberta', 'tecelagem')
  ON CONFLICT (id) DO NOTHING;

-- 100 m on each OP: 50 kg cotton per colour, 25 kg poliester per colour.
INSERT INTO public.op_itens (id, op_id, modelo_id, metros_pedidos) VALUES
  (940000111, ${OP1}, ${MOD1}, 100.00),
  (940000112, ${OP2}, ${MOD1}, 100.00),
  (940000113, ${OP3}, ${MOD1}, 100.00)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.necessidade_compra_fio
  (id, pedido_id, origem_tipo, op_id, material, cor_id, cor_poliester, kg_necessario, kg_alocado, legado)
VALUES
  (${N1}, '${PED}', 'op',     ${OP1}, 'algodao',   ${COR1}, NULL,    1000.000, 0, FALSE),
  (${N2}, '${PED}', 'op',     ${OP2}, 'algodao',   ${COR1}, NULL,    1000.000, 0, FALSE),
  (${N3}, '${PED}', 'pedido', NULL,   'poliester', NULL,    'PRETO', 1000.000, 0, FALSE)
  ON CONFLICT (id) DO NOTHING;

-- TWO emitted Purchase Orders. ordem_compra_item_unico_algodao makes
-- (ordem_id, cor_id) unique, and N1/N2 deliberately SHARE a colour to
-- prove sibling isolation, so the second cotton item needs its own order.
INSERT INTO public.ordem_compra
  (id, pedido_id, fornecedor_id, status_administrativo, status_aceite, status_recebimento,
   aceite_exigido_na_emissao, legado, emitida_em)
VALUES
  (${OC1}, '${PED}', ${FORN_ALG}, 'emitida', 'pendente', 'nao_recebido', TRUE,  FALSE, now()),
  (${OC2}, '${PED}', ${FORN_ALG}, 'emitida', 'nao_aplicavel', 'nao_recebido', FALSE, FALSE, now())
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ordem_compra_item (id, ordem_id, material, cor_id, cor_poliester, kg_pedido, kg_recebido)
VALUES
  (${OCI1}, ${OC1}, 'algodao',   ${COR1}, NULL,    500.000, 0),
  (${OCI3}, ${OC1}, 'poliester', NULL,    'PRETO', 500.000, 0),
  (${OCI2}, ${OC2}, 'algodao',   ${COR1}, NULL,    500.000, 0)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ordem_compra_item_alocacao (id, item_id, necessidade_id, op_id, kg_alocado)
VALUES
  (${ALO1}, ${OCI1}, ${N1}, ${OP1}, 500.000),
  (${ALO2}, ${OCI2}, ${N2}, ${OP2}, 500.000),
  (${ALO3}, ${OCI3}, ${N3}, NULL,   500.000)
  ON CONFLICT (id) DO NOTHING;

-- One receipt command header plus its native ledger lines.
INSERT INTO public.ordem_compra_recebimentos
  (id, ordem_compra_id, comando_tipo, idempotency_namespace, idempotency_key,
   ator_id, ator_tipo, ocorrido_em, documento_ref, origem_tipo, origem_ref,
   comando_payload, comando_hash, resultado_metadata)
VALUES (${REC1}, ${OC1}, 'recebimento', 'native_receipt_v1', 'p1-fixture-recebimento-1',
        '${adminUuid}', 'admin', now(), 'P1-DOC-1', 'nota_fiscal', 'P1-NF-1',
        '{"fixture":true}'::jsonb, md5('p1-fixture-recebimento-1'), '{"fixture":true}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

-- PRODUCTIVE (allocation-destined) lines: kg_excesso = 0.
INSERT INTO public.ordem_compra_fio_lancamentos
  (ordem_compra_fio_id, kg_recebido, data_recebimento, criado_por, ordem_compra_item_id,
   tipo, idempotency_key, recebimento_id, ordem_compra_id, ordem_compra_item_alocacao_id,
   op_id, material, cor_id, cor_poliester, kg_excesso, ator_tipo, linha_indice)
VALUES
  (NULL, 100.000, CURRENT_DATE, '${adminUuid}', ${OCI1}, 'recebimento', 'p1-lan-1',
   ${REC1}, ${OC1}, ${ALO1}, ${OP1}, 'algodao', ${COR1}, NULL, 0, 'admin', 1),
  (NULL, 100.000, CURRENT_DATE, '${adminUuid}', ${OCI2}, 'recebimento', 'p1-lan-2',
   ${REC1}, ${OC2}, ${ALO2}, ${OP2}, 'algodao', ${COR1}, NULL, 0, 'admin', 2),
  -- The shared Pedido-origin polyester line deliberately carries the
  -- DENORMALIZED ledger op_id of the OTHER OP (OP2). The availability
  -- authority must resolve origin through the NEED, not through this
  -- column: if it read the ledger op_id instead, OP1's polyester ceiling
  -- would collapse to zero. ordem_compra_fio_lancamentos_native_shape
  -- requires op_id NOT NULL on any allocation-destined line, so some OP
  -- must be named here.
  (NULL, 200.000, CURRENT_DATE, '${adminUuid}', ${OCI3}, 'recebimento', 'p1-lan-3',
   ${REC1}, ${OC1}, ${ALO3}, ${OP2},   'poliester', NULL, 'PRETO', 0, 'admin', 3),
  -- SURPLUS line: kg_excesso = kg_recebido and NO allocation, which is
  -- what the native shape constraint enforces. It must NEVER raise an OP
  -- ceiling (9.9.A.1).
  (NULL, 999.000, CURRENT_DATE, '${adminUuid}', ${OCI1}, 'recebimento', 'p1-lan-surplus',
   ${REC1}, ${OC1}, NULL, NULL, 'algodao', ${COR1}, NULL, 999.000, 'admin', 4)
  ON CONFLICT DO NOTHING;

SET session_replication_role = origin;
`;
