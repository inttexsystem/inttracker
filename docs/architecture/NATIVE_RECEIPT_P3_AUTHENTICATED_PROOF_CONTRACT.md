# Native receipt — P3 authenticated proof contract

Canonical execution contract for `NATIVE-RECEIPT-COORDINATED-RELEASE-P3-AUTHENTICATED-PROOF`.

This file is the single canonical anchor for P3 execution. It owns the P3
environment boundary, the caller inventory, the identity model, the synthetic
fixture namespace, the productive-availability seed, the complete `S01`–`S47`
scenario matrix, the P3/P4 classification boundary, the failure-injection rule,
the required invariants and the evidence schema.

It owns no product semantics. The accepted functional specification remains
section 9 (rulings `R1`–`R13`, `D1`–`D7`) and the accepted technical design
remains section 9.9 of `docs/architecture/PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md`.
Section 9.9.Q of that plan owns the authenticated acceptance intent; this file
canonicalises the reviewed enumeration of it and never contradicts it.

```
P2 CLOSED / ACCEPTED
P3 AUTHORIZED / AWAITING AUTHENTICATED PROOF EXECUTION
P4 NOT AUTHORIZED
P5 NOT AUTHORIZED
NATIVE RECEIPT INACTIVE
```

**Authorising this contract does not authorise scenario mutation.** Executing
any part of section 7 requires a separate explicit P3 EXECUTION order.

---

## 1. P3 purpose

P3 is the authenticated mutation proof of the coordinated native-receipt
release. Every new frontend caller introduced by P2 is exercised through the
canonical P1 server RPCs, under real authenticated identities, against a
**disposable database restored from a production backup/dump** — never against
production rows and never against production itself.

P3 proves that the new callers work, that wrong identities are refused, and that
the isolation between synthetic proof data and copied production data is total.
Production authority is unchanged throughout, and the native receipt remains
inactive.

## 2. Environment boundary

- Production `ucrjtfswnfdlxwtmxnoo` may be contacted **only** by separately
  authorized read-only dump/verification work. No P3 scenario writes to it.
- All P3 mutation occurs **only** against the named disposable clone recorded in
  section 12.
- P3 does **not** activate the receipt.
- P3 does **not** alter production authority.
- P3 does **not** apply `db/103b`, `db/104`, `db/106` or `db/110`. Those numbers
  remain RESERVED and uncreated; the terminal migration stays `db/111`.
- The retired project `gqmpsxkxynrjvidfmojk` is not a target. The forbidden
  project `bhgifjrfagkzubpyqpew` is not accessed at all.

## 3. Exact 14-RPC inventory

All 14 exist in production as exactly one overload each, all `SECURITY DEFINER`,
all `SET search_path = ''`, all owned by `postgres`, all with ACL exactly
`postgres=X/postgres | authenticated=X/postgres`. **`anon`, `service_role` and
`PUBLIC` hold no EXECUTE on any of the 14.** Source-versus-production signature
drift is ZERO across argument names, types, order, defaults, return type,
language, volatility, `prosecdef`, `proconfig`, owner and ACL.

### 3.1 Read RPCs (4)

| RPC | Owner | Production signature | Identity required | Guard |
|---|---|---|---|---|
| `oc_disponibilidade_op` | `db/101` | `(p_op_id bigint)` → `TABLE(16 cols)`, STABLE | admin | `auth.uid() IS NOT NULL AND public.is_admin()` |
| `pedido_elegivel_cancelamento` | `db/105` | `(p_pedido_id uuid)` → `jsonb`, STABLE | admin | `auth.uid() IS NOT NULL AND is_admin()` |
| `listar_fila_aceite_fornecedor` | `db/103` | `()` → `TABLE(8 cols)`, STABLE | **supplier only** | `auth.uid()` bound to `usuarios.tipo='fornecedor' AND ativo` with non-null `fornecedor_id`; otherwise `sem_permissao` (`42501`). **An admin is refused.** |
| `pode_recuperar_op_acabamento` | `db/108` | `(p_entrega_id bigint)` → `boolean`, STABLE, `LANGUAGE sql` | admin | `is_admin()` |

### 3.2 Mutation RPCs (10)

| RPC | Owner | Production signature | Identity | Idempotency | Deterministic refusals |
|---|---|---|---|---|---|
| `salvar_ajuste_producao_op` | `db/102` | `(p_op_id bigint, p_base_ajuste_rev integer, p_itens jsonb)` → `jsonb` | admin | optimistic — `ops.ajuste_revisao` | `AJUSTE_REVISAO_DESATUALIZADA`, `AJUSTE_EXCEDE_DISPONIVEL`, `AJUSTE_OP_ESTADO_INVALIDO`, `AJUSTE_OP_SEM_PEDIDO`, `AJUSTE_PAYLOAD_INCOMPLETO`, `OP_NAO_ENCONTRADA`, `PEDIDO_CANCELADO`, `SEM_MUDANCA`, `concorrencia_ocupada` |
| `iniciar_producao_op` | `db/102` | `(p_op_id bigint, p_base_ajuste_rev integer)` → `jsonb` | admin | optimistic — `ajuste_revisao` | `INICIO_AJUSTE_INCOMPLETO`, `INICIO_OP_ESTADO_INVALIDO`, `INICIO_OP_SEM_PEDIDO`, `OP_TRANSICAO_INVALIDA`, `AJUSTE_REVISAO_DESATUALIZADA`, `concorrencia_ocupada` |
| `aceitar_ordem_compra` | `db/103` | `(p_ordem_id bigint, p_idempotency_key text, p_motivo text DEFAULT NULL)` → `jsonb` | **bound supplier only** | key-based, `ordem_compra_aceite_comandos` | `ACEITE_CHAVE_OBRIGATORIA`, `ACEITE_JA_DECIDIDO`, `ACEITE_ORDEM_NAO_EMITIDA`, `ORDEM_NAO_ENCONTRADA`, `comando_conflitante`, `concorrencia_ocupada` |
| `rejeitar_ordem_compra` | `db/103` | `(p_ordem_id bigint, p_idempotency_key text, p_motivo text)` — **no default** | bound supplier only | key-based | as above plus `ACEITE_MOTIVO_OBRIGATORIO` |
| `alterar_status_pedido` | `db/105` | `(p_pedido_id uuid, p_novo_status text, p_base_revisao bigint, p_motivo text DEFAULT NULL)` → `jsonb` | admin | optimistic — `pedidos.revisao` | `PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA`, `PEDIDO_TRANSICAO_NAO_PERMITIDA`, `ADMIN_REVIEW_REQUIRED`, `PEDIDO_CANCELADO`, `PEDIDO_NAO_ENCONTRADO`, `PEDIDO_COM_SOLICITACAO_PENDENTE` |
| `cancelar_pedido` | `db/105` | `(p_pedido_id uuid, p_base_revisao bigint, p_motivo text)` → `jsonb` | admin | optimistic — `pedidos.revisao` | `CANCELAMENTO_MOTIVO_OBRIGATORIO`, `PEDIDO_JA_CANCELADO`, `PEDIDO_CANCELAMENTO_APOS_ENTREGA`, `PEDIDO_COM_ENTREGA_REGISTRADA`, `CANCELAMENTO_OP_FALHOU`, `CANCELAMENTO_ORDEM_COMPRA_FALHOU`, `PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA` |
| `registrar_entrega_cima_com_acabamento` | `db/111` | `(p_fornecedor_id bigint, p_op_id bigint, p_data date, p_observacao text, p_destino_fornecedor_id bigint, p_linhas jsonb, p_idempotency_key text, p_motivo_split text DEFAULT NULL)` → `jsonb` | admin | key-based, `entrega_cima_comandos` | `ENTREGA_CHAVE_OBRIGATORIA`, `ENTREGA_PAYLOAD_VAZIO`, `ENTREGA_ROTA_NAO_TAPETE`, `ENTREGA_OP_INEXISTENTE` / `_SEM_PEDIDO` / `_TIPO_INVALIDO` / `_VAZIA`, `ENTREGA_ITEM_FORA_DA_OP` / `_DUPLICADO` / `_INVALIDO`, `ENTREGA_METROS_INVALIDOS`, `ENTREGA_DESTINO_OBRIGATORIO`, `ENTREGA_FORNECEDOR_INVALIDO`, `ACABAMENTO_CRIACAO_FALHOU` (server-recorded; delivery persists), `comando_conflitante`, `concorrencia_ocupada` |
| `gerar_op_acabamento` | `db/108` | `(p_entrega_id bigint, p_idempotency_key text, p_motivo text DEFAULT NULL)` → `jsonb` | admin | key-based, `op_acabamento_comandos` / `op_acabamento_tentativas` | `ACABAMENTO_CHAVE_OBRIGATORIA`, `ACABAMENTO_CRIACAO_FALHOU`, `comando_conflitante`, `concorrencia_ocupada` |
| `estornar_expedicao_tapete_parcial` | `db/109` | `(p_expedicao_id bigint, p_itens jsonb, p_motivo text, p_idempotency_key text DEFAULT NULL)` → `jsonb` | admin | key-based (optional key) | `ESTORNO_ACIMA_DO_LIBERADO`, `ESTORNO_ABAIXO_DO_ENTREGUE`, `ESTORNO_ITEM_NAO_ENCONTRADO`, `ESTORNO_PAYLOAD_INVALIDO`, `EXPEDICAO_NAO_ENCONTRADA`, `EXPEDICAO_ROTA_INVALIDA`, `comando_conflitante` |
| `corrigir_entrega_expedicao` | `db/109` | `(p_expedicao_id bigint, p_itens jsonb, p_motivo text, p_idempotency_key text DEFAULT NULL)` → `jsonb` | admin | key-based | `CORRECAO_QUANTIDADE_INVALIDA`, `CORRECAO_ITEM_NAO_ENCONTRADO`, `CORRECAO_PAYLOAD_INVALIDO`, `EXPEDICAO_NAO_ENCONTRADA`, `EXPEDICAO_ROTA_INVALIDA`, `comando_conflitante` |

**Client-side allowlist posture (P2, `js/supabase-client.js`).** `_READ_ONLY_RPCS`
contains the 4 read RPCs and **none of the 10 writers**. `_P2_RPC_INVENTORY` is
declarative metadata only and the write-guard proxy never reads it. No writer is
reachable through the read-only path.

## 4. Identity model

| ID | Identity | Representation in P3 |
|---|---|---|
| `A` | synthetic active administrator | `SET LOCAL ROLE authenticated` + `request.jwt.claims = {"sub":<A>,"role":"authenticated"}`; `usuarios` row `tipo='admin', ativo=true` |
| `B` | synthetic supplier bound to supplier 1 | as `A`, with `tipo='fornecedor', ativo=true, fornecedor_id=<supplier 1>` |
| `B′` | synthetic supplier bound to supplier 2 | as `B`, bound to a different supplier |
| `C` | synthetic active authenticated non-admin | as `A`, with `tipo='cliente', ativo=true` |
| `D` | anon | `SET LOCAL ROLE anon`, no claims |
| `E` | service_role | `SET LOCAL ROLE service_role` |
| `F` | postgres owner/setup only | superuser; **fixture preparation and teardown only**, never used to satisfy a caller-proof scenario |

**Expected authority.**

| Identity | Must SUCCEED | Must be REFUSED |
|---|---|---|
| `A` | the 3 admin reads and the 8 admin writers | `listar_fila_aceite_fornecedor`, `aceitar_ordem_compra`, `rejeitar_ordem_compra` (`sem_permissao`) |
| `B` | `listar_fila_aceite_fornecedor` (own orders only), `aceitar_`/`rejeitar_ordem_compra` on its own orders | the 8 admin writers and the 3 admin reads |
| `B′` | nothing | `aceitar_`/`rejeitar_ordem_compra` on `B`'s order; `B`'s rows absent from `B′`'s queue |
| `C` | nothing | all 14 |
| `D` | nothing | all 14, at the **grant** layer |
| `E` | nothing | all 14, at the **grant** layer |

**Application-equivalent proof.** PostgREST executes RPCs as role
`authenticated` with `request.jwt.claims` set from the verified JWT. A P3
scenario reproduces that interface by (i) `SET LOCAL ROLE authenticated` and
(ii) setting the claims GUC. Every application-equivalent scenario must assert,
**inside the same transaction as the call and before it**:

```sql
SELECT current_user;
SELECT auth.uid();
SELECT auth.role();
SELECT auth.jwt();
```

so that a scenario which silently ran as `postgres` cannot pass.

**Mandatory preamble fidelity.** The P3 preamble must install the production
`auth.uid()` / `auth.role()` / `auth.jwt()` bodies verbatim. Production
`auth.uid()` coalesces `request.jwt.claim.sub` with
`request.jwt.claims::jsonb ->> 'sub'`; the older disposable-harness preamble
implements only the legacy singular branch, under which a scenario setting the
real PostgREST GUC observes `auth.uid() = NULL` and every guard refuses for the
wrong reason. Recorded as `OSO-2`. The restored clone in section 12 carries the
real production `auth` schema (`auth_compat_applied: false`), which satisfies
this requirement for that clone.

**Owner-only helper unreachability.** `_oc_aceite_ator_autorizado`,
`_oc_disponibilidade_linhas`, `_oc_material_recebido_liquido`,
`_oc_reserva_ativa`, `_op_status_aplicar`, `_pedido_status_recalcular`,
`_expedicao_estorno_aplicar`, `_oc_aceite_decidir`,
`ordem_compra_c3c_purge_generation` and `ordem_compra_c3c_pre_ponr_rollback`
must each be proved `has_function_privilege(<role>, …, 'EXECUTE') = false` for
`authenticated`, `anon` and `service_role`, **and** proved to raise `42501` at
runtime under `SET LOCAL ROLE`.

## 5. Synthetic namespace

One namespace, **`P3F`**, entirely synthetic.

- Human-readable labels are prefixed `P3F-`.
- BIGINT surrogate keys occupy the reserved band **`950000000`–`950999999`**,
  disjoint from the C3D `930…` band, the P1 `940…` band and every production id.
- UUIDs must be syntactically valid; the reserved band is
  `9d1f0000-0000-4000-8000-0000000P3F##`.
- Deterministic idempotency keys: `p3f:<scenario-id>:<attempt>`, literal, never
  `Date.now()` or a random source, so replay and conflict scenarios reproduce.

**Contents.** Synthetic `clientes`; `fornecedores` (tecelagem, latex, fio, plus a
second supplier for the wrong-supplier negative); `auth.users` + `usuarios` for
`A`/`B`/`B′`/`C`; `pedidos` + `pedido_itens`; `lotes`; `ops` (Tapete tecelagem,
Manta, latex/acabamento) + `op_itens`; `necessidade_compra_fio` +
`necessidade_compra_planejamento`; `ordem_compra` + `ordem_compra_item` +
`ordem_compra_item_alocacao`; `entregas` + items; `expedicoes` +
`expedicao_itens`; and at least one `saldo_fios` row carrying a non-zero TD1
balance.

**Creation order (FK-driven).** `auth.users` → `clientes`/`fornecedores` →
`usuarios` → `modelos`/`cores` (existing production reference rows are read
read-only and never mutated) → `pedidos` → `pedido_itens` → `lotes` → `ops` →
`op_itens` → `necessidade_compra_fio` → `necessidade_compra_planejamento` →
`ordem_compra` → `ordem_compra_item` → `ordem_compra_item_alocacao` →
`saldo_fios` → `entregas` → `expedicoes` → `expedicao_itens`. Sequence
high-water marks (`op_numeros`, `pedido_identidade_numeros`) are reconciled with
the `db/27` / `db/95` high-water idiom **after** fixture insert.

**Protected Purchase Orders.** `OC-001-3-26` and `OC-001-4-26` are protected and
must never be scenario fixtures or command targets. A preflight assertion must
fail the run if either code, or any `ordem_compra.id` outside the `950…` band,
appears in a scenario parameter.

**Cleanup.** Reverse of creation, inside the disposable clone only. The explicit
cleanup exists so the only-synthetic-rows-changed assertion can run against the
restored baseline in the same cluster.

## 6. Productive availability seed

`P3F_FIXTURE_PRODUCTIVE_RECEIPT_SEED` anchors the fixture-only productive
receipt lineage required before any positive adjustment test. The minimum
productive ledger predicate, taken from `db/101`, is:

```sql
recebimento_id IS NOT NULL
AND ordem_compra_item_alocacao_id IS NOT NULL
AND kg_excesso = 0
```

The seed:

- is **owner/setup fixture data only** (identity `F`);
- uses synthetic `P3F` rows only;
- exists only in the disposable clone;
- must **never** invoke the public native receipt writer;
- must **not** alter `ordem_compra_cutover`;
- must **not** set `productive_receipt_started_at`;
- must **not** touch the five real TD1 `saldo_fios` rows;
- must **not** touch `OC-001-3-26` or `OC-001-4-26`;
- must **not** touch any copied non-`P3F` production row.

Before the matrix runs, the executor must prove that `oc_disponibilidade_op`
returns the exact expected positive native availability derived from this
synthetic lineage, and must record that proof as `04b-productive-receipt-seed.json`.

## 7. Scenario matrix S01-S47

47 scenarios. Each carries setup, caller identity, command, expected result,
expected persisted delta, expected non-delta, authoritative postcondition query,
cleanup and evidence artifact. **Ordering is dependency-driven and must be
executed in the order given.**

Console output must use TAP-style stable identifiers (`P3_S17_PASS` /
`not ok - S17: …`) so a failure is greppable and a run cannot report success by
silence.

### 7.1 Group 1 — availability and production (S01–S12)

| ID | Identity | Scenario | Expected |
|---|---|---|---|
| S01 | A | Native availability on a `P3F` OP with no productive receipt | `oc_disponibilidade_op` returns rows; `kg_disponivel = 0` for every line; no delta anywhere |
| S02 | A | **TD1**: a non-zero synthetic `saldo_fios` row exists | ceiling unchanged from S01; the row appears in no productive total. Direct proof of TD1. |
| S03 | A | Valid atomic adjustment within ceiling | `ok`; `ajuste_revisao` +1; `op_itens.metros_ajustados` set; `ops.status` unchanged |
| S04 | A | Over-ceiling adjustment | `AJUSTE_EXCEDE_DISPONIVEL`; **zero** rows written; `ajuste_revisao` unchanged |
| S05 | A | Stale `p_base_ajuste_rev` | `AJUSTE_REVISAO_DESATUALIZADA`; zero delta |
| S06 | A | Clear an adjustment (`metros_ajustados: null`) | `ok`; revision +1; value NULL |
| S07 | A | Incomplete payload (item missing) | `AJUSTE_PAYLOAD_INCOMPLETO`; zero delta |
| S08 | A | `iniciar_producao_op` from `aberta`, all items adjusted | `ok`; `ops.status → em_producao`; `saldo_fios_op` snapshot written; Pedido recomputed; `proxima_acao` returned |
| S09 | A | `iniciar_producao_op` from `simulada` | `INICIO_OP_ESTADO_INVALIDO`; zero delta; no snapshot |
| S10 | A | `iniciar_producao_op` with one item unadjusted | `INICIO_AJUSTE_INCOMPLETO`; zero delta |
| S11 | A | Replayed `iniciar_producao_op` after success | `OP_TRANSICAO_INVALIDA` or `SEM_MUDANCA`; **no second snapshot row** |
| S12 | A | Adjustment on an OP whose Pedido is cancelled | `PEDIDO_CANCELADO`; zero delta |

### 7.2 Group 2 — supplier acceptance (S13–S20)

| ID | Identity | Scenario | Expected |
|---|---|---|---|
| S13 | B | Queue isolation | only `B`'s own `emitida`/`pendente` orders; `B′`'s order absent |
| S14 | B′ | Queue isolation, other side | `B`'s order absent from `B′`'s queue |
| S15 | A | Admin calls the supplier queue | `sem_permissao` (`42501`) — an admin is **not** a supplier |
| S16 | B | Accept own order | `ok`; `status_aceite → aceita`; exactly one immutable command row |
| S17 | B | Reject own order with reason | `ok`; `status_aceite → rejeitada`; reason persisted |
| S18 | B | Reject with blank/whitespace reason | `ACEITE_MOTIVO_OBRIGATORIO`; zero delta |
| S19 | B′ | Accept `B`'s order | `sem_permissao`; zero delta; no command row |
| S20 | B | Replay S16 with the **same** key | same canonical result, **no second command row**; then replay with the same key and a **different** payload → `comando_conflitante`, zero delta |

### 7.3 Group 3 — Pedido lifecycle (S21–S29)

| ID | Identity | Scenario | Expected |
|---|---|---|---|
| S21 | A | Permitted operator transition (`rascunho → confirmado`) | `ok`; `revisao` +1; event row written |
| S22 | A | Forbidden derived transition (e.g. → `produzindo` by hand) | `PEDIDO_TRANSICAO_NAO_PERMITIDA`; zero delta |
| S23 | A | Stale `p_base_revisao` | `PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA`; zero delta |
| S24 | A | Confirm with a pending client priority request | `ADMIN_REVIEW_REQUIRED`; zero delta |
| S25 | A | `pedido_elegivel_cancelamento` on an eligible Pedido | `elegivel: true` |
| S26 | A | Cancel eligible Pedido | `ok`; Pedido `cancelado`; related OPs cancelled; purchase planning **released, not deleted**; history preserved |
| S27 | A | `pedido_elegivel_cancelamento` on a Pedido with a registered delivery | `elegivel: false`, `PEDIDO_COM_ENTREGA_REGISTRADA` |
| S28 | A | Cancel that ineligible Pedido anyway | refusal code; zero delta |
| S29 | C | Direct `UPDATE public.pedidos SET status=…` as authenticated non-admin | denied by RLS/grant; and `alterar_status_pedido` → refusal. Proves no direct client status authority. |

### 7.4 Group 4 — delivery and finishing (S30–S38)

| ID | Identity | Scenario | Expected |
|---|---|---|---|
| S30 | A | Successful Tapete delivery + finishing creation | `ok`; delivery persisted; finishing OP created; canonical identity returned; **one** command row |
| S31 | A | Replay S30, same key, same payload | byte-identical canonical result; no second delivery, no second finishing OP |
| S32 | A | Same key, **different** payload | `comando_conflitante`; zero delta |
| S33 | A | Validation refusal (`ENTREGA_ITEM_FORA_DA_OP`) | refusal; **no partial persistence** — assert `entregas` count unchanged |
| S34 | A | Server-recorded finishing failure (injected — see section 9) | `ACABAMENTO_CRIACAO_FALHOU`; delivery **persists**; `op_acabamento_tentativas` carries a `falha` row; no finishing OP |
| S35 | A | `pode_recuperar_op_acabamento` after S34 | `true` |
| S36 | A | `gerar_op_acabamento` after S34 | `ok`; finishing OP created; recovery no longer eligible |
| S37 | A | `pode_recuperar_op_acabamento` on a healthy delivery | `false`; `gerar_op_acabamento` refuses |
| S38 | A | Manta route delivery | remains on its own distinct route; `ENTREGA_ROTA_NAO_TAPETE` for the Tapete-only writer |

### 7.5 Group 5 — expedition (S39–S44)

| ID | Identity | Scenario | Expected |
|---|---|---|---|
| S39 | A | Valid partial Tapete reversal | `ok`; `liberado` reduced; availability of finished product increased |
| S40 | A | Reversal above `liberado` | `ESTORNO_ACIMA_DO_LIBERADO`; zero delta |
| S41 | A | Reversal that would drop `liberado` below `entregue` | `ESTORNO_ABAIXO_DO_ENTREGUE`; zero delta |
| S42 | A | Valid delivery correction | `ok`; `entregue` corrected; nothing returned to production |
| S43 | A | Correction above `liberado` / negative | `CORRECAO_QUANTIDADE_INVALIDA`; zero delta |
| S44 | A | Correction that makes the Pedido incomplete | Pedido recomputed `entregue → produzindo`; history rows preserved; output availability reconciles |

### 7.6 Group 6 — permission and security (S45–S47, each a sweep over all 14)

| ID | Scenario | Expected |
|---|---|---|
| S45 | **Grant sweep.** For each of the 14 and each owner-only helper, `has_function_privilege` for `anon`, `service_role`, `authenticated`, plus **runtime** `SET LOCAL ROLE` calls | `authenticated` reaches exactly the 14; `anon` and `service_role` reach none; every owner-only helper reaches none from any client role; every refusal is `42501` at the **grant** layer, not a body-level message |
| S46 | **Wrong-role sweep.** Identity `C` against all 14; identity `B` against the 8 admin writers; identity `A` against the 3 supplier-bound RPCs | every one refused with its documented code |
| S47 | **Bypass sweep.** (a) direct table DML on `pedidos`, `ops`, `op_itens`, `expedicoes`, `entregas`, all 4 command stores and `saldo_fios_op` as `authenticated`/`anon`; (b) claim spoofing — set `request.jwt.claims` to an admin `sub` while `usuarios` says `cliente`; (c) `set_config('role','postgres')` attempts; (d) assert `_READ_ONLY_RPCS` contains no writer and `_P2_RPC_INVENTORY` is never unioned into it | every bypass denied; the claims-spoof case must fail because `is_admin()` reads `usuarios`, not the claim; old authorities (the `db/75`/`db/76` fence, `ordem_compra_cutover`) unchanged at the end of the run |

**Load-bearing security points.** (1) Denial must occur at the **grant** layer
for `anon`/`service_role` — a body-level message proves the grant is wrong even
if the outcome looks correct. (2) Owner-only helpers must be unreachable at
**runtime**, not merely absent from `proacl`. (3) The claims-spoofing negative is
the sharpest test: `is_admin()` derives authority from `public.usuarios`, so a
forged `sub` for a non-admin must not confer admin and a forged `"role":"admin"`
claim must be inert. (4) `_READ_ONLY_RPCS` must be asserted disjoint from
`_P2_RPC_INVENTORY.escrita` as a static source assertion, since a future union
there would open a production write path from localhost/preview.

## 8. P3/P4 boundary

**P3 proves:**

- the new frontend callers use the canonical RPCs;
- wrong identities are refused;
- owner-only helpers are unreachable from any client role;
- claim spoofing does not elevate authority;
- the read-only allowlist contains no writer;
- current pre-P4 legacy authority remains **unchanged**.

**P3 does NOT require:**

- `db/106` containment;
- final P4 direct-DML revocation;
- P4 `DELETE` revocation;
- final column-level authority restrictions;
- cutover;
- native receipt activation.

A legacy permission that is explicitly scheduled for P4 containment must be
classified as:

```
EXPECTED PRE-P4 LEGACY AUTHORITY — UNCHANGED BY P3
```

and **must not** be reported as a P3 defect.

## 9. S34 failure-injection rule

`S34`–`S36` require a **deterministic, data-only** finishing failure.

Not authorized: DDL; function replacement; trigger disable or manipulation;
constraint modification; mock writer; any database-code patch.

If no data-only mechanism exists, the executor stops with exactly:

```
P3_BLOCKED_RECOVERY_FAILURE_INJECTION
```

The mechanism is **not** fixed by this contract; it is discovered by the
execution order under the constraint above and recorded verbatim in the P3
report.

## 10. Required invariants

Asserted **after every scenario**:

```
ordem_compra_cutover.status = legacy_active
read_authority = flat
productive_receipt_started_at IS NULL
```

Preserved across the whole run:

- terminal migration `db/111` (`supabase_migrations` version `20260731204800`);
- no `db/103b`, no `db/104`, no `db/106`, no `db/110`;
- the five real TD1 `saldo_fios` rows unchanged (content hash
  `aa3986ffa0757c76390e43cadab8ea71`);
- `OC-001-3-26` and `OC-001-4-26` unchanged;
- every copied non-`P3F` production row unchanged — count **and** ordered
  content hash identical before and after;
- the function, policy, table-grant and column-grant catalogue unchanged (P3
  applies **no** DDL after restore);
- the `db/75`/`db/76` receipt-writer fence unchanged;
- production `ucrjtfswnfdlxwtmxnoo`: zero row delta, zero catalogue delta.

**Permitted delta surface (synthetic `P3F` rows only).** `pedidos`,
`pedido_itens`, `pedido_eventos`, `ops`, `op_itens`, `op_numeros`,
`pedido_identidade_numeros`, `saldo_fios_op`, `lotes`, `entregas` + items,
`expedicoes` + `expedicao_itens`, `ordem_compra` + `ordem_compra_item` +
`ordem_compra_item_alocacao`, `necessidade_compra_fio`,
`necessidade_compra_planejamento`, the four command/attempt stores
(`ordem_compra_aceite_comandos`, `entrega_cima_comandos`,
`op_acabamento_comandos`, `op_acabamento_tentativas`), plus the `P3F` rows of
`auth.users`, `usuarios`, `clientes`, `fornecedores` and `saldo_fios`.

**PONR marker.** `ponr` is **not** a stored column anywhere in the production
database; `productive_receipt_started_at` is the enforced PONR marker per
`db/75`/`db/76`. Recorded as `OSO-1`.

## 11. Evidence schema

Evidence **may live outside the repository** and currently does (section 12).

| Artifact | Content |
|---|---|
| `00-preflight.json` | Production identity, terminal migration, cutover row, row counts, `saldo_fios` hash, catalogue hashes — all read-only |
| `01-dump-manifest.json` | Dump command, `pg_dump` version, byte size, SHA-256 of the archive, start/end timestamps, production read-only session proof |
| `01b-post-dump-verify.json` | Re-measurement of everything in `00` immediately after the dump, diffed to zero |
| `01c-credential-cleanup.json` | Credential acquisition source and post-run clearance; never the secret |
| `02-cluster-boot.json` | Disposable `system_identifier`, PG version, port, data dir, the `<> 7642734024280108049` assertion |
| `03-restore-verify.json` | Post-restore catalogue hashes and row counts vs `00`; the 14-RPC signature/ACL re-verification inside the clone |
| `04-fixtures.json` | Every `P3F` id created, in creation order |
| `04b-productive-receipt-seed.json` | The seed lineage and the proved positive `oc_disponibilidade_op` result |
| `05-scenarios/S01.json` … `S47.json` | Per scenario: identity assertion (`current_user`, `auth.uid()`, `auth.role()`, `auth.jwt()`), command, verbatim result, delta query results, non-delta assertions, pass/fail |
| `06-isolation.json` | Before/after count + hash table for every copied production table, with the `P3F` exclusion applied |
| `07-teardown.json` | `{stopResult, portClosed, pidAbsent, dirAbsent}` plus independent `fs.access` failures for data dir and dump path |
| `08-production-untouched.json` | Post-run read-only re-measurement of everything in `00`, diffed to zero |
| `P3-REPORT.md` | Human-readable roll-up, scenario table, failures, stop conditions hit |

**Teardown is an acceptance criterion, not housekeeping.** If any teardown step
fails, the run is reported FAILED even if all 47 scenarios passed.

## 12. External execution root and predecessor state

```
external_execution_root:
  D:\p3-work\runs\p3-a0e2331-20260801T030008Z

external_evidence_root:
  D:\p3-work\evidence\p3\p3-a0e2331-20260801T030008Z

cluster_pointer:
  D:\p3-work\runs\p3-a0e2331-20260801T030008Z\scratch\cluster.json
```

Run id `p3-a0e2331-20260801T030008Z`.

**Phase 1 — production read-only dump: ACCEPTED FOR P3 ENTRY.** Production
identity proved by cluster `system_identifier 7642734024280108049` on
PostgreSQL 17.6 with terminal migration `20260731204800`; read-only posture
proved by two negative controls (`CREATE TABLE` and a real `UPDATE` both refused
with *cannot execute … in a read-only transaction*); schemas `public`, `auth`,
`supabase_migrations`; exit status 0; archive 1 767 578 bytes, SHA-256
`da2f5ead962eea2ee7b8eaef46b7f27d54be0da2f6147a472b6183098b16a6cf`; production
proved unchanged across the dump on all 66 tables, the catalogue, the cutover
row, both protected Purchase Orders and the five TD1 rows; no secret present in
any evidence file.

**Phase 2 — restore fidelity: ACCEPTED FOR P3 ENTRY.** Restored from the Phase 1
archive into a disposable PostgreSQL 18.4 cluster with
`system_identifier 7668905723812930636` (≠ production); terminal migration
`20260731204800` on both sides; all 14 RPCs match production including
`body_md5` and ACL, with zero drift; zero row-count drift and zero row-hash
drift across all 66 tables; all nine strict catalogue dimensions byte-equal
(functions 227, policies 88, table grants 1322, column grants 7603, strict RLS
67, triggers 75, columns 694, effective table privileges 268, effective function
privileges 908); cutover state matches production; no production mutation.

**Declared PostgreSQL 17 → 18 reconciliations.** (a) PG18 materialises `NOT NULL`
as `pg_constraint contype='n'` (415 rows) which PG17 does not; every production
constraint class matches exactly and `attnotnull` is proved independently by the
column fingerprint. (b) Dropped-column `attnum` gaps in `clientes`,
`fornecedores` and `ordem_compra` are compacted by `pg_restore`; column order is
proved by ordinal position among live columns. (c) Owner-only tables may carry an
explicit `relacl` in production and `NULL` in the clone; effective privileges are
compared instead and match exactly. (d) One CHECK constraint,
`ordem_compra.ordem_compra_codigo_formato`, deparses with one fewer redundant
parenthesis group under PG18; it is reconciled only because **both** hold —
token equivalence after stripping every parenthesis, and a seven-case
behavioural probe on the clone. A differing relation absent from the captured
production definitions is a hard stop, so that path cannot absorb an unexamined
difference.

**Cluster liveness is not assumed.** The execution order must re-verify the
clone by `systemIdentifier`, never by port alone, and must refuse any cluster
whose `systemIdentifier` is not `7668905723812930636`. A superseded rehearsal
cluster (`D:\p3-work\rehearsal-JhFKAI`, `systemIdentifier
7668897191668365016`) has been observed still listening; it is **not** a valid
P3 target and must not be used.

## 13. Provenance

The scenario matrix, identity model, fixture model, delta/non-delta surfaces and
evidence schema in this file are the canonicalisation of the reviewed
`P3 DIAGNOSIS AND EXECUTION PLANNING` report, sections 3, 5, 10, 11, 12, 13, 14
and 15. Section 9.9.Q of
`docs/architecture/PEDIDO_DERIVED_LIFECYCLE_RECOVERY_PLAN.md` remains the owner
of the authenticated acceptance intent; this file enumerates it and does not
override it.
