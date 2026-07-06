# Atualizacao 2026-07-06 - OP Create Requires Pedido Guard B

Fase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**

Brecha fechada no frontend/persistencia JS: criar OP sem Pedido pelo botao
`Nova OP`, por URL direta `#/ops/nova` ou por `persistirOP` sem `pedidoId`
deixa de ser permitido. O usuario deve iniciar pelo Pedido e usar a rota
`#/ops/nova?pedido_id=<uuid>`.

Resultado:

| Item | Estado |
|---|---|
| Botao avulso `Nova OP` | Orienta com toast e envia para `#/pedidos`. |
| URL direta `#/ops/nova` | Renderiza bloqueio com CTA `Ir para Pedidos`. |
| `persistirOP` sem Pedido | Retorna `pedido_required` antes de `op_numeros` ou writes. |
| OP com Pedido | Continua permitido e grava `lotes.pedido_id`. |
| Diagnostico staging | Novo script read-only retorna ALERTA para dados historicos orfaos. |

Novo item P1 de backlog tecnico:

| Campo | Valor |
|---|---|
| **Item** | `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C` |
| **Prioridade** | P1 |
| **Sintoma** | Mesmo com a UI bloqueada, RPCs como `gerar_op_latex` ainda precisam de guard backend explicito para impedir OP filha a partir de OP/lote sem Pedido. |
| **Arquivos provaveis** | migrations/RPCs `gerar_op_latex`, `gerar_op_latex_split` e diagnosticos relacionados. |
| **Criterio de aceite** | RPC rejeita origem sem `lotes.pedido_id` com erro controlado; diagnostico comprova que nao ha novo caminho de criacao orfa; sem afetar OPs validas com Pedido. |
| **Dependencias** | Autorizacao explicita para SQL/migration em fase separada. |

Dados historicos de staging continuam sem cleanup: `OPs com lote_id NULL: 0`,
`OPs cujo lote.pedido_id IS NULL: 11`, `Lotes com pedido_id IS NULL vinculados
a OPs: 9`. Qualquer backfill/correcao real deve ser fase propria, com script
revisado e autorizacao explicita.

# Atualizacao 2026-07-06 - OP Create Requires Pedido RPC Guard C

Fase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C`
Status: **STAGING APPLY OK — VERIFICADO / CLOSEOUT**

Item P1 `OP-LATEX-RPC-REQUIRES-PEDIDO-GUARD-C` preparado em
`db/33_op_latex_requires_pedido_guard.sql`.

| Item | Estado |
|---|---|
| `gerar_op_latex` | Guarda `ops.lote_id -> lotes.pedido_id` antes de numerar/criar OP. |
| `gerar_op_latex_split` | Mesma guarda antes de numerar/criar split. |
| OP origem sem lote/Pedido | Erro controlado; nenhuma OP filha criada. |
| OP origem com Pedido | Fluxo da `db/29` preservado. |
| Diagnostico de orfaos | Lista contexto individual e classificacao A/B/C/D, read-only. |
| Staging | Migration pronta; aplicacao ainda pendente. |

Dados historicos permanecem somente diagnosticados: `0` OPs com `lote_id NULL`,
`11` OPs cujo `lote.pedido_id IS NULL`, `9` lotes sem Pedido vinculados a OPs.
Classificacao desta rodada: A=6 (`op_id` 1,2,3,4,9,15), B=4 (`op_id`
5,6,7,8), C=0, D=1 (`op_id` 10). Sem cleanup/backfill, sem constraint global,
sem producao.

# Atualizacao 2026-07-06 - OP Operational Code Closeout C

# Atualizacao 2026-07-06 - OP Operational Code Admin Wide Expand D

Fase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-ADMIN-WIDE-EXPAND-D`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**

Expansao aplicada nas telas Admin operacionais com Pedido resolvivel:
`painel.js`, `ops-list.js`, `op-nova.js`, `op-tecelagem-producao-admin.js`,
`op-latex-admin.js` e `expedicao-admin.js`.

| Tela | OP -> Pedido | Siblings |
|---|---|---|
| `painel.js` | `lote_id -> lotes.pedido_id -> pedidos` ja carregados | `opsByPedido` em memoria, zero query nova |
| `ops-list.js` | SELECT aditivo `lote.pedido_id` + `pedido:pedido_id(id,numero,criado_em)` | lista completa de OPs carregada na tela |
| `op-nova.js` / `op-tecelagem-producao-admin.js` | `pedidoCtx` (`criadoEm` normalizado) | query leve `lotes do pedido -> ops desses lotes` |
| `op-latex-admin.js` | `op.lote.pedido_id`; sem pedido cai no legado | query leve Pedido + siblings quando houver `pedido_id` |
| `expedicao-admin.js` | `pedido:pedido_id(...,criado_em)` | query leve por lotes do Pedido |

Garantias: regra T/A/seq continua somente em `js/op-display.js`; legado aparece
como `Nº interno {numero}/{ano}` quando ha operacional e como fallback quando
nao ha contexto; sem SQL/migration/dados reais novos; sem alterar `ops.numero`,
`ops.ano`, `op_numeros`, RPCs, PDFs ou fornecedor/RLS.

Testes obrigatorios e diagnosticos staging read-only verdes. Validacao visual
do usuario pendente.

Fase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-CLOSEOUT-C`
Status: **OK VISUAL NO ESCOPO COM CONTEXTO DE PEDIDO** (closeout documental)

Aceite visual do usuario: a identificacao operacional
`OP {pedido}/{ano}-{tipo}{seq}` apareceu nos lugares principais e deu certo.
Aparecer "em poucos lugares" e esperado: o codigo so aparece onde ha contexto
confiavel de Pedido; sem contexto, mantem-se o legado `OP {numero}/{ano}`.
Nao ha meta de exibicao global agora.

Regra consolidada: `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}`
(`OP 25/2026-T01`); `T=Tecelagem`, `A=Acabamento/Latex`; `seq` por Pedido+Tipo
por `ops.criado_em`/`ops.id`; fallback `OP {numero}/{ano}`; formatacao unica em
`js/op-display.js`.

Escopo validado: Pedido Detail Admin (OPs vinculadas, OPs relacionadas, modais
das setas, hub, `tecPendingAcceptance`, `relatedOpsLabel`, docs/expedicao).
Legado por decisao: PDFs, fornecedor/RLS, toasts, logs, diagnosticos, telas sem
contexto (`ops-list`, `op-latex-admin`, `op-tecelagem-producao-admin`,
`op-nova`, `expedicao-admin`, `painel`).

Pendencia controlada: expandir a outras telas so quando (1) contexto confiavel
de Pedido; (2) necessidade visual clara; (3) sem migration; (4) sem query
pesada; (5) sem duplicar formatacao fora de `js/op-display.js`. Candidatos:
`painel.js`, `expedicao-admin.js`. Sem nova expansao funcional nesta fase.

Closeout documental: bateria funcional ja verde no commit `d7f57c4`
(op-display 20/20, pedido-detail 163/163, obrigatorio 337/337); revalidacao
minima desta fase em `op-display.smoke.js` + `pedido-detail.smoke.js`.

# Atualizacao 2026-07-06 - OP Operational Code Helper B

Fase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-HELPER-B`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**

Escopo: helper central de identificacao operacional de OP e uso desse display
nas telas com contexto de Pedido. Sem SQL, sem migration, sem alterar
dados/RPC/`op_numeros`/`ops.id/numero/ano`.

Contrato: `OP {pedido_numero}/{pedido_ano}-{tipo}{seq}` (ex.: `OP 21/2026-T01`,
`OP 21/2026-A02`). `pedido_ano = year(pedido.criado_em)`; `T=tecelagem`,
`A=latex/acabamento`; `seq` = 2 digitos por Pedido+Tipo, ordenado por
`ops.criado_em` asc, desempate `ops.id` asc. Fallback obrigatorio ao legado
`OP {numero}/{ano}` sem contexto confiavel de Pedido.

| Item | Resultado |
|---|---|
| Helper central | `js/op-display.js` -> `window.RAVATEX_OP_DISPLAY`; puro; carregado apos `js/badges.js`. |
| Pedido Detail | Display operacional em OPs vinculadas, OPs relacionadas, modais das setas, hub, `tecPendingAcceptance`, `relatedOpsLabel` e labels de documentos/expedicao. Numero/ano legado como referencia secundaria. |
| Dados | `pedido-detail-data.js` seleciona `ops.criado_em` (SELECT aditivo). |
| Legado mantido | PDFs, fornecedor/RLS, toasts globais, `ops-list`, `op-latex-admin`, `op-tecelagem-producao-admin`, `op-nova`, `expedicao-admin`, `painel`. |
| Proximo incremento | `painel.js` + `expedicao-admin.js` (tem contexto; so falta resolver OP->Pedido, sem query nova). |

Testes: novo `tests/op-display.smoke.js` (20/20) e 2 casos de integracao em
`tests/pedido-detail.smoke.js` (agora 163/163). Conjunto obrigatorio 337/337.
Diagnosticos staging read-only OK (0 violacoes/colisoes).

Garantias: sem SQL, sem migration, sem dados reais novos, sem alterar
`op_numeros`/RPC/`ops`, sem tocar producao, sem escrita em `origin`.

# Atualizacao 2026-07-06 - Pedido Flow UI Audit Fix R1

Fase: `RAVATEX-TAPETES-PEDIDO-FLOW-UI-AUDIT-FIX-R1`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**

Escopo desta correcao: tratar os desalinhamentos medios da auditoria
read-only da faixa de fluxo do Pedido sem reformular UX nem alterar regra de
produto.

Resultado por item:

| Item | Resultado |
|---|---|
| B2-label | Corrigido. Setas ativas agora usam labels especificos e curtos: `Iniciar`, `Receber`, `Transferir`, `Movimentar`, `Entregar`. Modais/CTAs usam os textos explicativos do contrato. |
| E2-E5 | Comprovado/coberto. Writes do modal da seta continuam canonicos e o sucesso re-renderiza o proprio modal via `refreshPedidoTransitionModal(...)`. |
| C3-done | Sem conflito funcional; registrado como sobreposicao segura. `adminStepper` e `applyFormalPendingStage` preservam a regra: `concluido` so sem saldo operacional relevante e sem OP pendente relevante. Refactor de centralizacao fica como P2 tecnico se voltar a aparecer. |
| D1/D3 | Mantidos como polish P2, fora do patch principal. |

Labels finais da faixa:

- `Insumos -> Tecelagem` sem OP: seta `Iniciar`; modal/CTA `Gerar primeira OP`.
- `Insumos -> Tecelagem` com OP: seta `Receber`; modal
  `Registrar recebimento de insumos`.
- `Tecelagem -> Acabamento`: seta `Transferir`; modal/CTA
  `Transferir para Acabamento`.
- `Acabamento -> Expedicao`: seta `Movimentar`; modal/CTA
  `Movimentar para Expedicao`.
- `Expedicao -> Entrega`: seta `Entregar`; modal `Registrar entrega`.

Garantias preservadas: sem SQL, sem migration, sem dados reais novos, sem
write paralelo no Pedido, sem update direto em `ops.status`, sem tocar
producao e sem escrita em `origin`.

Testes obrigatorios OK: `pedido-detail` 161/161, `pedido-detail-linked-ops`
7/7, `tec-to-acabamento-flow` 39/39, `expedicao-partial-flow` 12/12,
`expedicao-flow` 8/8, `op-latex-admin` 55/55,
`production-flow-invariants` 11/11. Diagnosticos staging read-only OK:
invariantes de fluxo, consolidacao Latex e expedicao parcial.

# Atualizacao 2026-07-05 - Pedido Insumos Tecelagem Modal Parity And Refresh R1

Fase: `RAVATEX-TAPETES-PEDIDO-INSUMOS-TECELAGEM-MODAL-PARITY-AND-REFRESH-R1`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**

Reabertura: validacao visual mostrou que a seta `Insumos -> Tecelagem` ainda
nao respeitava o contrato "sem OP, sem material" e que acoes executadas dentro
do modal da seta podiam deixar o conteudo stale ou fechar antes do proximo
estado operacional.

Contrato de paralelismo aplicado:

| Eixo | Referencia obrigatoria | Decisao aplicada |
|---|---|---|
| Modal operacional de transicao | Tecelagem -> Acabamento | O modal da seta continua sendo o lugar da proxima acao, com formulario quando ha operacao real e contexto auxiliar depois. |
| Sem OP | Regra de produto "sem OP, sem material" | Insumos -> Tecelagem sem OP nao mostra recebimento, nao mostra historico vazio e oferece `Gerar primeira OP`. |
| Aceite/proposta | Tela OP Tecelagem | OP aberta com insumos recebidos mostra proposta real com slider e `Aceitar proposta`, usando `aplicarRecalculoOP`. |
| Pos-acao | Fluxo continuo no mesmo modal | Recebimento e aceite chamam refresh/re-render do proprio modal, sem exigir fechar/reabrir. |

Matriz de diagnostico:

| Caso | Antes | Depois |
|---|---|---|
| Insumos -> Tecelagem sem OP | `pedido-detail-progress.js` mantinha titulo `Registrar recebimento de insumos` mesmo sem OP; o modal caia em estado de contexto/historico e podia induzir operacao inexistente. | Titulo/detalhe sem OP viram criacao da primeira OP; `openMovementModal` renderiza bloqueio claro, `Nao e possivel registrar material sem OP vinculada.` e CTA `Gerar primeira OP`; `buildInsumosTransferForm` tem guard defensivo sem OP. |
| OP Tecelagem pendente de aceite | `buildRelatedOpsSection` ja resolvia OP relacionada e `buildTecAcceptanceProposalBlock` ja renderizava slider/proposta, mas o sucesso do aceite nao atualizava o modal da seta. | A proposta recebe `onAfterSuccess` e usa `refreshPedidoTransitionModal`, mantendo handler/RPC canonico e removendo slider/botao stale apos sucesso. |
| Apos registrar recebimento | `registrarRecebimentoOrdemFio` era canonico, mas o modal fechava depois do sucesso. | O sucesso chama `refreshPedidoTransitionModal`, recarrega Pedido/OPs/chain-state e mostra o proximo estado no mesmo modal. |
| Paralelismo Tecelagem -> Acabamento | Fluxo validado ja tinha formulario primeiro, OPs relacionadas auxiliares, `Transferir restante` e `salvarEntregaCima`. | Padrao preservado; diferenca tecnica: sem OP inicial nao tem formulario porque ainda nao ha OP de origem nem ordens recebiveis. |

Arquivos funcionais: `js/screens/pedido-detail-events.js`,
`js/screens/pedido-detail-progress.js`. Testes: `tests/pedido-detail.smoke.js`
ganhou cobertura runtime para sem OP, OP aberta com slider/proposta, aceite com
refresh do modal e recebimento com refresh para proposta.

Resultados: testes obrigatorios OK (`pedido-detail` 160/160,
`pedido-detail-linked-ops` 7/7, `tec-to-acabamento-flow` 39/39,
`expedicao-partial-flow` 12/12, `expedicao-flow` 8/8,
`op-latex-admin` 55/55, `production-flow-invariants` 11/11). Diagnosticos
staging read-only OK: invariantes de fluxo, consolidacao Latex e expedicao
parcial.

Confirmacoes: sem write paralelo no Pedido, sem update direto em `ops.status`,
sem SQL, sem migration, sem dados reais novos, sem aceitar OP real, sem
registrar recebimento real, sem finalizar OP real, sem concluir pedido,
producao/origin intocados e `supabase/.temp/` fora do commit. Validacao visual
do usuario segue pendente; nao declarar backlog zerado por esta fase.

# Atualizacao 2026-07-05 - Acabamento Expedicao Modal UX Parity R2

Fase: `RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-MODAL-UX-PARITY-R2`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**

Reabertura: a validacao visual mostrou que o gate operacional estava correto,
mas a experiencia do modal Acabamento -> Expedicao nao seguia o padrao ja
validado para Tecelagem -> Acabamento.

Diagnostico de paridade:

| Item | Tecelagem -> Acabamento validado | Acabamento -> Expedicao antes | Decisao |
|---|---|---|---|
| Form principal | `buildEntregaInlineForm` em `layout: 'stacked'` | form proprio abaixo de contexto/historico | alinhar ordem visual |
| Produtos | card `Produtos a transferir` + `Preencher restante` | grid compacto sem mesmo peso visual | alinhar por paridade |
| OPs relacionadas | contexto auxiliar | botao solto `Movimentar` | trocar por selecao/carregamento |
| Write canonico | `salvarEntregaCima` | `liberar_expedicao_latex_parcial` | diferenca justificada, manter |
| Lifecycle | finalizacao separada | finalizacao separada | manter |

Correcao: o formulario operacional agora aparece como centro do modal e antes
de OPs relacionadas, itens, historico e documentos. OP relacionada com saldo
usa `Carregar nesta movimentacao`, atualiza OP de origem/saldo/produtos no
proprio modal e nao chama RPC automaticamente. A movimentacao continua pelo
botao principal `Movimentar para Expedicao`, usando
`liberar_expedicao_latex_parcial`.

Diferencas remanescentes e justificativa: o helper/form nao e o mesmo de
Tecelagem porque o contrato de dados e outro (`salvarEntregaCima` cria entrega
de cima e possivel OP Latex; Acabamento -> Expedicao libera saldo para
expedicao por RPC parcial). A diferenca tecnica foi documentada e preservada;
as divergencias puramente visuais foram alinhadas.

Testes: `pedido-detail.smoke.js` 156/156 e bateria obrigatoria complementar
132/132. Diagnosticos staging read-only OK: invariantes de fluxo, consolidacao
Latex e expedicao parcial. Sem SQL, sem migration, sem dados reais novos, sem
write paralelo no Pedido, sem exigir finalizar OP Latex e sem uso de `origin`.

# Atualizacao 2026-07-05 - Acabamento Expedicao Modal Move R1

Fase: `RAVATEX-TAPETES-PEDIDO-ACABAMENTO-EXPEDICAO-MODAL-MOVE-R1`
Status: **CONCLUIDO - PATCH VALIDADO LOCALMENTE, DIAGNOSTICOS STAGING READ-ONLY OK E PUSH STAGING REALIZADO**

Item reaberto: a seta `Acabamento -> Expedicao` no Pedido Detail Admin deve
permitir movimentar OP Acabamento/Latex com saldo recebido diretamente no
modal da seta, inclusive quando a OP Latex esta `aberta`. Finalizar OP Latex
continua sendo acao separada e nao e pre-requisito para liberar saldo para
Expedicao.

Push staging realizado em `work/app-next`: `76195b1..fce09b1`.

Causa raiz: `openMovementModal` so entrava em modo de transferencia quando
`chainState.actions.releaseExpedicao.mode` era `enabled`. Esse gate nao
considerava OP Latex `aberta` como movimentavel, mesmo havendo saldo recebido;
por isso o modal caia em historico/read-only. A lista de OPs relacionadas tinha
filtro semelhante e podia exibir "Nenhuma acao contextual..." na OP carregada.

Escopo entregue:

- `js/screens/pedido-chain-state.js`: OP Latex `aberta` passa no gate de
  movimentacao quando existe saldo recebido/liberavel.
- `js/screens/pedido-detail-progress.js`: a transferencia de Acabamento usa a
  OP selecionada por `releaseExpedicao`, nao necessariamente a primeira OP da
  lista.
- `js/screens/pedido-detail-events.js`: o modal mostra OP de origem, saldo,
  produtos pendentes, inputs por produto, botao `Transferir restante` e acao
  efetiva `Movimentar para Expedicao`; OPs relacionadas com saldo recebem
  `Movimentar`; a OP ja carregada deixa de cair no texto generico de nenhuma
  acao.
- `tests/pedido-detail.smoke.js`: cobre OP Latex `aberta` com saldo,
  acionamento pelo modal da seta, payload parcial para
  `liberar_expedicao_latex_parcial`, reload/render apos sucesso e bloqueio de
  OP `simulada`.

Contrato preservado:

- Escrita de movimento somente pela RPC canonica
  `liberar_expedicao_latex_parcial`.
- Sem write paralelo no Pedido, sem exigir `concluida`/`finalizada`, sem
  finalizar OP Latex implicitamente e sem criar OP/Expedicao fora do fluxo
  canonico.
- A leitura read-only canonica da tela OP Latex continua em
  `consultar_saldo_expedicao_latex`; o Pedido usa seu estado consolidado para
  renderizar o modal e recarrega apos salvar.

Testes e diagnosticos:

- `node --test tests\pedido-detail.smoke.js` = 155/155
- `node --test tests\pedido-detail-linked-ops.smoke.js tests\expedicao-partial-flow.smoke.js tests\expedicao-flow.smoke.js tests\op-latex-admin.smoke.js tests\tec-to-acabamento-flow.smoke.js tests\production-flow-invariants.smoke.js` = 132/132
- Staging read-only OK: `production-flow-invariants-diag`,
  `latex-consolidation-diag`, `expedicao-partial-flow-diag`

Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem aceitar OP
real, sem finalizar OP real, sem transferencia real em staging, sem concluir
pedido, sem alterar lifecycle de OP, sem `git add .`, `supabase/.temp/` fora
do commit, producao/origin intocados. Backlog Admin/Pedido ainda nao deve ser
declarado zerado sem validacao visual do usuario.

# Atualizacao 2026-07-05 - Transition Modal Related Ops Actions R2

Fase: `RAVATEX-TAPETES-PEDIDO-TRANSITION-MODAL-RELATED-OPS-ACTIONS-R2`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**

Item reaberto: o comportamento correto das setas do Pedido Detail Admin e
abrir o modal de transicao/movimento. A bolinha da etapa abre o hub da etapa.
A falha anterior foi desviar a seta `Aguardar` para o hub (`openStageDetailModal`),
copiando o comportamento da bolinha e quebrando o requisito original de manter
a experiencia de transicao no modal de seta.

Escopo entregue:

- `js/screens/pedido-detail-render.js`: setas/conectores renderizados chamam
  `openMovementModal(stage.transfer)`; bolinhas continuam chamando
  `openStageDetailModal(stage, view)`.
- `js/screens/pedido-detail-events.js`: `openMovementModal` recebeu a secao
  `OPs relacionadas`, com OPs de Tecelagem, Acabamento/Latex e Expedicao
  relacionadas a transicao corrente.
- Acoes contextuais no modal de seta: `Abrir OP`, `Movimentar` quando ha saldo
  aplicavel, `Finalizar OP` via handler canonico, e proposta de aceite para OP
  Tecelagem `aberta`.
- Aceite Tecelagem: nao foi implementado como botao simples. A UI real de
  aceite/proposta fica em `js/screens/op-nova.js` (`buildProposta`) e o write
  canonico em `js/screens/op-recalculo.js` (`aplicarRecalculoOP`). O Pedido
  reaproveita os helpers globais de proposta, sliders e recalculo, sem criar
  `.from('ops').update` paralelo.

Testes e diagnosticos:

- `node --check js\screens\pedido-detail-events.js`
- `node --check js\screens\pedido-detail-render.js`
- `node --test tests\pedido-detail.smoke.js` = 150/150
- `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7
- `node --test tests\tec-to-acabamento-flow.smoke.js` = 37/37
- `node --test tests\op-latex-admin.smoke.js` = 55/55
- `node --test tests\expedicao-partial-flow.smoke.js` = 12/12
- `node --test tests\expedicao-flow.smoke.js` = 8/8
- `node --test tests\production-flow-invariants.smoke.js` = 11/11
- Staging read-only OK: `production-flow-invariants-diag`,
  `latex-consolidation-diag`, `expedicao-partial-flow-diag`

Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem aceitar OP
real, sem finalizar OP real, sem transferencia, sem concluir pedido, sem
alterar lifecycle de OP, sem alterar Acabamento -> Expedicao, sem write
paralelo no Pedido, sem `git add .`, `supabase/.temp/` fora do commit,
producao/origin intocados.

Criterio visual pendente: Pedido #13 deve mostrar seta `Aguardar` abrindo o
modal de transicao com `OPs relacionadas` e proposta real de aceite quando a OP
Tecelagem estiver aberta; bolinha Tecelagem deve continuar abrindo o hub.
Pedido #14 deve validar Tecelagem -> Acabamento; Pedido #21 pode ser usado como
fluxo apto geral. Nao declarar backlog Admin/Pedido zerado antes dessa
validacao visual.

# Backlog Funcional/Arquitetural do Fluxo Produtivo — Pedido

Fase: `RAVATEX-TAPETES-PRODUCTION-BACKLOG-REGISTER-A`
Data: 2026-07-04
Base: branch `work/app-next`, HEAD `26bf4a14e60c33ce905ebf9b37ff21486ddd87bc`
Fase anterior fechada: `RAVATEX-TAPETES-PRODUCTION-FLOW-UI-MAP-A`

---

## 1. Estado operacional atual comprovado

### 1.1 Caminho real para concluir um Pedido

O fluxo produtivo completo do Pedido é operacional. As 5 etapas do stepper
(`recebido → confirmado → insumos → tecelagem → acabamento → expedicao → transporte → concluido`,
com `insumos` e `transporte` puláveis) são cobertas por transições reais:

1. **Insumos** — `registrarRecebimentoOrdemFio` (`js/screens/op-writes.js:29`):
   registra kg recebidos na ordem de fio vinculada à OP de tecelagem. Chamada
   canônica também acessível via modal do Pedido Detail
   (`js/screens/pedido-detail-events.js:647`).

2. **Tecelagem → Acabamento** — `salvarEntregaCima` (`js/screens/entrega-writes.js:212`):
   grava entrega `etapa='cima'` + itens + chama RPC `gerar_op_latex` (find-or-accumulate).
   O formulário canônico é `buildEntregaInlineForm` (`js/screens/entrega-form.js:61`).
   O Pedido Detail chama o modal via `openMovementModal` (`js/screens/pedido-detail-events.js:814`).

3. **Acabamento → Expedição** — `liberar_expedicao` (RPC Supabase):
   chamada em `js/screens/op-latex-admin.js:236`. Cria expedição vinculada à OP
   de látex finalizada.

4. **Expedição → Entrega** — `registrar_entrega_expedicao` (RPC Supabase):
   chamada em `js/screens/expedicao-admin.js:272` e
   `js/screens/pedido-detail-events.js:787`. Registra entrega/coleta parcial ou
   total; `concluir_pedido_se_pronto` persiste a conclusão quando sem saldo.

### 1.2 Rotas/telas principais

| Rota | Tela | Função |
|---|---|---|
| `#/pedidos` | Admin — Lista de Pedidos | `pedidos-list.js` |
| `#/pedidos/<uuid>` | Admin — Detalhe do Pedido | `pedido-detail.js` |
| `#/ops` | Admin — Lista de OPs | `ops-list.js` |
| `#/ops/nova?pedido_id=<id>` | Admin — Nova OP via Pedido | `op-nova.js` |
| `#/ops/<id>` | Admin — Detalhe OP | `op-nova.js` / `op-latex-admin.js` |
| `#/expedicoes/<id>` | Admin — Expedição | `expedicao-admin.js` |

### 1.3 Etapas que permitem parcial

- **Tecelagem**: entregas parciais via `salvarEntregaCima` (múltiplas entregas
  para a mesma OP de tecelagem), cada uma acumulando na OP de acabamento
  consolidada.
- **Expedição**: `registrar_entrega_expedicao` aceita entrega parcial com
  rastreamento de saldo.

### 1.4 Ações manuais de finalização/conclusão

- **Acabamento finalizado**: botão "Finalizar" na tela de OP Látex
  (`js/screens/op-latex-admin.js`).
- **Liberar expedição**: botão "Liberar expedição" na tela de OP Látex.
- **Concluir Pedido**: `concluir_pedido_se_pronto` (RPC) — chamado ao
  registrar entrega de expedição quando não há saldo pendente.

### 1.5 Lacunas comprovadas pelo mapa UI (fase `PRODUCTION-FLOW-UI-MAP-A`)

| Lacuna | Detalhe |
|---|---|
| Botões "Movimentar" ambíguos | Na OP Látex e Tecelagem, "Movimentar" é anchor/atalho para o card de entregas, não uma ação de transição real. |
| Modais de seta não mostram pendências | Os modais abertos pelas setas do stepper no Pedido não exibem o que falta concluir entre etapas. |
| "Transferir restante" não existe | Não há ação/botão dedicado para transferir o saldo restante de uma etapa. |
| Aceite/ajuste da OP Tecelagem pelo Pedido não existe | O Pedido não oferece interface para revisar/aceitar a OP de tecelagem antes de entrar em produção. |
| Stepper não é clicável | As bolinhas do stepper no Pedido Detail não são clicáveis — apenas as setas entre etapas têm handlers. |
| Finalização explícita de Tecelagem não existe | Não há ação dedicada para marcar a Tecelagem como concluída. |
| Correlação visual OP↔Pedido parcial | O lineage strip existe (cadeia produtiva na OP de Tecelagem), mas a visualização no Pedido dos vínculos com OPs é limitada. |
| Novo requisito: split parcial | Permitir excepcionalmente criar OP separada para uma parcial, via select, mantendo acumular como padrão. |

---

## 2. Backlog ordenado

### A. ACTION-BUTTONS-R1
**Corrigir botões "Movimentar" ambíguos/anchors**

- **Problema**: Botões "Movimentar" na OP Em Produção Tecelagem e OP Látex
  funcionam como âncoras visuais para o card de entregas/movimentação, não como
  ações de transição. Isso confunde: o usuário clica esperando abrir um modal
  de movimentação e é rolado para outro card.
- **Escopo**: `js/screens/op-tecelagem-producao-admin.js`,
  `js/screens/op-latex-admin.js`.
- **Proposta**: Renomear âncoras para rótulo explícito (ex.: "Ir para
  movimentação") ou substituir por CTA que abre o modal canônico de transição
  (`openMovementModal`) diretamente, sem scroll.
- **Risco**: Baixo — alteração de label/comportamento local, sem writes novos.
- **Critério de aceite**: Botão "Movimentar" na OP Tecelagem e OP Látex não
  é mais âncora; abre modal de transição ou tem label que deixa claro que é
  navegação interna.

### B. PEDIDO-TRANSITION-MODAL-GAPS-B
**Modais de seta devem mostrar pendências completas entre steppers**

- **Problema**: As setas entre etapas do stepper no Pedido Detail abrem modais
  de transição (`openMovementModal`), mas esses modais não mostram o panorama
  completo de pendências — totais por produto, já movimentado, faltante, OPs
  relacionadas, bloqueios e próxima ação.
- **Escopo**: `js/screens/pedido-detail-events.js` (render do modal de
  transição), possivelmente `pedido-detail-render.js`.
- **Proposta**: Enriquecer cada modal com sumário de pendências calculado a
  partir da mesma fonte canônica (`derivePedidoChainState` em
  `pedido-chain-state.js`), não duplicada.
- **Ver §4** para requisito detalhado.
- **Risco**: Médio — requer nova UI em cada modal, mas sem novos writes.
- **Critério de aceite**: Cada modal de seta exibe: totais por produto, já
  movimentado, faltante, OPs relacionadas, bloqueios (se houver) e CTA da
  próxima ação.

### C. PEDIDO-TRANSFER-REMAINING-B
**Botão/ação "Transferir restante"**

- **Problema**: Quando uma transferência parcial já foi feita, não há ação
  explícita para transferir o saldo restante de uma vez. O usuário precisa
  criar outra entrega manualmente.
- **Escopo**: `js/screens/pedido-detail-events.js` (novo handler no modal de
  transição), possivelmente reutilizando `salvarEntregaCima` com payload
  calculado do saldo.
- **Proposta**: Adicionar CTA "Transferir restante" no modal de transição que
  pré-preenche o formulário com o saldo pendente de cada item.
- **Risco**: Médio — write real, mas reutiliza operação canônica existente.
- **Critério de aceite**: Botão "Transferir restante" visível quando há saldo
  pendente; ao clicar, pré-preenche formulário com o saldo e executa a
  operação canônica.

### D. PEDIDO-TEC-ACCEPTANCE-B
**Aceite/ajuste da OP Tecelagem pelo Pedido**

- **Problema**: A OP de tecelagem, quando criada a partir do Pedido, não passa
  por uma etapa de revisão/aceite no contexto do Pedido. O admin precisa
  navegar até a tela de OP para ajustar.
- **Escopo**: Novo componente/modal no `pedido-detail.js` que permita revisar
  os itens da OP de tecelagem vinculada, ajustar quantidades (dentro do saldo
  do pedido) e confirmar o início da produção.
- **Risco**: Alto — envolve validação de consistência Pedido↔OP e possível
  write em `op_itens`.
- **Critério de aceite**: Admin consegue revisar e ajustar a OP de tecelagem
  vinculada diretamente do detalhe do Pedido, sem navegar para a tela de OP.

### E. LATEX-SPLIT-PARTIAL-POLICY-A
**Diagnóstico/arquitetura para select de split parcial**

- **Problema**: A regra atual é sempre acumular na OP de látex existente
  (`gerar_op_latex` com find-or-accumulate). O novo requisito exige permitir,
  excepcionalmente, criar uma OP separada para uma parcial específica.
- **Escopo**: Diagnóstico de schema, índices, RPC `gerar_op_latex`, tabelas
  `ops`, `entregas`, `entrega_itens`.
- **Ver §3** para requisito detalhado.
- **Risco**: Alto — altera a regra de consolidação; exige nova chave de
  agrupamento, rastro/histórico e não pode reintroduzir "uma OP por parcial"
  automático.
- **Critério de aceite**: Diagnóstico documentado com: tabelas afetadas,
  índices existentes, assinatura atual da RPC, proposta de nova chave de
  agrupamento, impacto em RLS, e contrato de UI para o select.

### F. PEDIDO-STEPPER-STAGE-MODALS-B
**Bolinhas do stepper clicáveis e modais por etapa**

- **Problema**: As bolinhas do stepper no Pedido Detail (8 etapas:
  recebido/confirmado/insumos/tecelagem/acabamento/expedicao/transporte/
  concluido) não são clicáveis. Apenas as setas entre etapas abrem modais de
  transição.
- **Escopo**: `js/screens/pedido-detail-render.js` (render do stepper),
  `js/screens/pedido-detail-progress.js` (lógica de estado).
- **Proposta**: Tornar cada bolinha clicável, abrindo um modal informativo
  com o estado daquela etapa: dados agregados, OPs vinculadas, progresso,
  eventos/histórico.
- **Risco**: Baixo — read-only, sem writes novos.
- **Critério de aceite**: Cada bolinha do stepper é clicável e abre um modal
  com informações da etapa correspondente.

### G. TEC-STAGE-FINALIZATION-A
**Decisão/implementação de finalização explícita da Tecelagem**

- **Problema**: Não existe ação explícita para marcar a etapa de Tecelagem
  como concluída. A transição para Acabamento acontece via entrega
  (`salvarEntregaCima`), mas a OP de tecelagem em si não tem um estado
  terminal explícito ("concluída") separado da última entrega.
- **Escopo**: Decisão arquitetural primeiro: a Tecelagem é concluída
  automaticamente quando todo o saldo foi transferido, ou exige ação
  explícita? Depois, implementação na UI (OP Tecelagem e/ou Pedido Detail).
- **Risco**: Médio — envolve decisão de lifecycle de OP e possível uso de
  `alterar_status_op`.
- **Critério de aceite**: Decisão documentada; se ação explícita, botão
  "Concluir Tecelagem" visível e funcional; se automática, indicador claro
  de que a etapa foi concluída.

### H. OP-PEDIDO-LINEAGE-UX-B
**Padronizar correlação visual Pedido↔OP**

- **Problema**: A correlação visual entre Pedido e OPs vinculadas é parcial.
  O lineage strip existe na OP de Tecelagem (mostra a OP de Acabamento
  consolidada), mas no Pedido Detail a listagem de OPs vinculadas é básica
  e não mostra a cadeia completa.
- **Escopo**: `js/screens/pedido-detail-render.js` (bloco de OPs vinculadas),
  `pedido-detail-progress.js` (dados agregados).
- **Proposta**: Criar visualização de lineage no Pedido Detail: cards/linha
  do tempo mostrando OP Tecelagem → OP Acabamento → Expedição, com status,
  progresso e ações rápidas.
- **Risco**: Médio — read-only, mas requer UI nova com dados já carregados.
- **Critério de aceite**: No detalhe do Pedido, a seção de OPs mostra a
  cadeia produtiva completa com status, progresso e navegação para cada OP.

---

## 3. Novo requisito de split parcial (LATEX-SPLIT-PARTIAL-POLICY-A)

### 3.1 Regra padrão (não alterar)

- **Acumular na mesma OP** quando coincidirem: mesma OP de tecelagem de
  origem (`origem_op_id`) + mesmo fornecedor de látex
  (`destino_fornecedor_id`).
- A RPC `gerar_op_latex` implementa find-or-accumulate: se já existe OP de
  látex `aberta` ou `em_producao` para essa combinação, acumula os itens da
  nova entrega nela; senão, cria uma nova.
- Este comportamento é o padrão e **não deve ser alterado**.

### 3.2 Exceção (novo requisito)

- Permitir, **explicitamente e por select**, criar uma **nova OP de látex
  separada** para uma entrega parcial específica, mesmo quando já existe uma
  OP de látex consolidada para a mesma combinação origem+fornecedor.
- A exceção **não deve ser o padrão** — o padrão continua sendo acumular.
- A exceção **deve ser explícita** via select/binário no formulário de
  entrega (`buildEntregaInlineForm`) ou no momento de chamar
  `salvarEntregaCima`.
- A exceção **deve exigir rastro/histórico**: a nova OP deve registrar
  `origem_entrega_id` específica e o motivo da separação.

### 3.3 Restrições absolutas

- **NÃO** reintroduzir "uma OP por parcial" como comportamento automático.
- **NÃO** quebrar a idempotência de `gerar_op_latex` para o caso padrão.
- **NÃO** criar migration ou alterar schema nesta fase de diagnóstico
  (`LATEX-SPLIT-PARTIAL-POLICY-A` é diagnóstico/arquitetura, não
  implementação).

### 3.4 Diagnóstico necessário (antes de implementar)

1. **Mapear `gerar_op_latex`**: assinatura atual, parâmetros, lógica de
   find-or-accumulate, retorno.
2. **Mapear tabelas afetadas**: `ops`, `op_itens`, `entregas`,
   `entrega_itens`, `lotes`.
3. **Mapear índices existentes**: `ops.origem_op_id`, `ops.origem_entrega_id`,
   `ops.tipo`, `ops.status`.
4. **Definir nova chave de agrupamento**: como a RPC decide se acumula ou
   cria? A chave atual é `(origem_op_id, destino_fornecedor_id, tipo='latex')`.
   A exceção precisa de um novo discriminador (ex.: flag `forcar_nova_op`
   passada como parâmetro).
5. **Definir contrato de UI**: onde e como o select/binário aparece no
   formulário de entrega.
6. **Avaliar impacto em RLS**: a nova OP herda as mesmas policies de `ops`
   com `tipo='latex'`.

---

## 4. Requisito de modais de transição (PEDIDO-TRANSITION-MODAL-GAPS-B)

### 4.1 Conteúdo obrigatório de cada modal

Cada modal aberto pelas setas do stepper no Pedido Detail deve exibir:

| Informação | Fonte |
|---|---|
| Totais por produto (metros pedido) | `pedido_itens` |
| Já movimentado na etapa atual | `entrega_itens` agregado por `op_item_id` |
| Faltante para concluir a transição | `total - movimentado` |
| OPs relacionadas à etapa | `ops` vinculadas ao pedido (via `lotes.pedido_id`) |
| Bloqueios (se houver) | Ex.: OP de destino não confirmada, fornecedor pendente |
| Próxima ação (CTA) | "Transferir", "Transferir restante", "Liberar expedição", etc. |

### 4.2 Fonte de cálculo canônica

- A fonte de cálculo **deve ser compartilhada**, não duplicada por modal.
- A matriz `derivePedidoChainState` (`js/screens/pedido-chain-state.js:146`)
  já calcula o estado de cada etapa com gates e ações.
- Os modais devem consumir essa mesma matriz, complementada com dados
  granulares (por item) quando necessário.
- **Proibido**: cada modal recalcular totais independentemente com lógica
  própria.

### 4.3 Estados visuais

- **Ativo (azul)**: label "Transferir", seta clicável → abre modal de
  transição.
- **Concluído (verde/neutral)**: label "Concluído", seta clicável → abre
  histórico da transição com parciais.
- **Aguardando (cinza/muted)**: label "Aguardar", seta não clicável.
- **View/Edit**: label curto integrado, abre contexto quando permitido.

---

## 5. Critérios gerais de implementação

1. **Uma fase por grupo de problema**: cada item do backlog (A-H) é uma fase
   independente. Não agrupar múltiplos itens em uma fase só.
2. **Nenhum patch grande sem diagnóstico**: itens marcados como
   "diagnóstico/arquitetura primeiro" (E, G) exigem documento de design antes
   de código.
3. **Nenhum fechamento sem testes/evidência**: cada fase deve ter smoke test
   dedicado ou evidência visual documentada.
4. **Preservar produção intocada**: `bhgifjrfagkzubpyqpew` e `origin/main`
   nunca são alvo de push.
5. **Staging seletivo**: `git add` apenas os arquivos da fase; nunca
   `git add .`.
6. **Atualizar `AGENT_HANDOFF.md` ao fim** de cada fase, registrando estado
   pós-fase, arquivos alterados, testes e próximo passo.
7. **Push somente para `staging`**: `git push staging work/app-next`.
8. **Branch**: sempre `work/app-next`.
9. **Residual permitido**: `?? supabase/.temp/` — nunca commitado.

---

## 6. Ordem técnica de implementação

| # | Item | Dependências | Risco | Tipo |
|---|---|---|---|---|
| 1 | A. ACTION-BUTTONS-R1 | Nenhuma | Baixo | UI |
| 2 | B. PEDIDO-TRANSITION-MODAL-GAPS-B | Nenhuma | Médio | UI |
| 3 | C. PEDIDO-TRANSFER-REMAINING-B | B (reusa modal) | Médio | UI + Write |
| 4 | F. PEDIDO-STEPPER-STAGE-MODALS-B | Nenhuma | Baixo | UI |
| 5 | H. OP-PEDIDO-LINEAGE-UX-B | Nenhuma | Médio | UI |
| 6 | D. PEDIDO-TEC-ACCEPTANCE-B | H (lineage) | Alto | UI + Write |
| 7 | E. LATEX-SPLIT-PARTIAL-POLICY-A | Nenhuma (diagnóstico) | Alto | Arquitetura |
| 8 | G. TEC-STAGE-FINALIZATION-A | D, E (decisões de lifecycle) | Médio | Arquitetura + UI |

### Justificativa da ordem

1. **A** primeiro: correção simples, baixo risco, remove confusão imediata.
2. **B** em seguida: enriquece os modais existentes sem alterar writes.
3. **C** depende de B: o botão "Transferir restante" vive no modal
   enriquecido.
4. **F** é independente e de baixo risco: só UI read-only.
5. **H** é independente e melhora a experiência de navegação.
6. **D** depende de H para o contexto visual de lineage; é o primeiro item
   que envolve writes novos.
7. **E** é diagnóstico puro: não altera código, só documenta o caminho para
   implementar o split parcial.
8. **G** é o último: depende das decisões de D (ciclo de vida da Tecelagem) e
   E (política de split) para definir se a finalização é automática ou
   explícita.

---

## 7. Riscos mapeados

| Risco | Itens afetados | Mitigação |
|---|---|---|
| Regra de consolidação Látex quebrada | E | Diagnóstico antes de código; não alterar `gerar_op_latex` sem teste de regressão. |
| Write inconsistente entre Pedido e OP | C, D | Reutilizar operações canônicas (`salvarEntregaCima`, `alterar_status_op`); nunca write direto. |
| Divergência de totais entre modais | B | Fonte única: `derivePedidoChainState` + `entrega_itens`. |
| Stepper dessincronizado | F, G | Consumir `chainState` da matriz canônica, não recalcular. |
| "Uma OP por parcial" reintroduzido | E | Restrição absoluta documentada; review obrigatório. |

---

## 8. Referências

- `js/screens/pedido-chain-state.js` — Matriz canônica de estado (`derivePedidoChainState`)
- `js/screens/pedido-detail-progress.js` — Render do bloco `Progresso produtivo`
- `js/screens/pedido-detail-render.js` — Render do stepper e conectores
- `js/screens/pedido-detail-events.js` — Handlers dos modais de transição (`openMovementModal`)
- `js/screens/entrega-writes.js` — `salvarEntregaCima` (write canônico Tecelagem→Acabamento)
- `js/screens/entrega-form.js` — `buildEntregaInlineForm` (formulário canônico de entrega)
- `js/screens/op-tecelagem-producao-admin.js` — Tela OP Em Produção Tecelagem
- `js/screens/op-latex-admin.js` — Tela OP Látex/Acabamento
- `js/screens/expedicao-admin.js` — Tela de Expedição
- `tests/production-flow-invariants.smoke.js` — Invariantes do fluxo produtivo
- `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md` — Plano arquitetural
- `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md` — Contrato de schema
- `PROJECT_STATE.md` — Histórico completo de fases
- `AGENT_HANDOFF.md` — Estado atual e regras vinculantes

---

## 9. Backlog Admin — Validação operacional

Fase: `RAVATEX-TAPETES-ADMIN-FLOW-BACKLOG-SYNC-A`
Data: 2026-07-05
Tipo: docs-only, read-only patch documental. Consolida observações de
validação do fluxo Admin sem implementar UI, JS, SQL ou migration.

### 9.1 Itens registrados (ordem recomendada)

#### 1. PEDIDO-CONCLUIR-ACTION-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P1 |
| **Sintoma** | A ação de concluir/concluir Pedido via `concluir_pedido_se_pronto` não tem CTA explícito visível no cabeçalho do Pedido Detail Admin quando todas as condições de conclusão são satisfeitas. O usuário depende de efeito colateral de entrega de expedição para disparar a conclusão. |
| **Fluxo afetado** | Pedido Detail Admin — conclusão do Pedido |
| **Causa provável** | O CTA de conclusão ficou acoplado ao fluxo Expedição → Entrega (`registrar_entrega_expedicao`). Quando não existe expedição pendente mas o Pedido está pronto por outros critérios, não há CTA visível. |
| **Arquivos prováveis** | `js/screens/pedido-detail.js`, `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js` |
| **Critério de aceite** | Botão "Concluir Pedido" visível no cabeçalho/ações do Pedido Detail quando `concluir_pedido_se_pronto` é elegível; confirmação antes do write; feedback de sucesso/erro. |
| **Dependências** | Nenhuma (a RPC `concluir_pedido_se_pronto` já existe em db/23). |
| **Fase recomendada** | `ADMIN-PEDIDO-CONCLUIR-CTA-R1` |
| **Ordem** | 1 |

#### 2. PEDIDO-STAGE-ACTION-HUB-B

| Campo | Valor |
|---|---|
| **Prioridade** | P1 |
| **Sintoma** | As setas do stepper são o único ponto de ação de transição no Pedido Detail. Não existe um hub/centro unificado que agregue todas as ações pendentes por etapa, com explicações de bloqueio e links para OPs relacionadas. |
| **Fluxo afetado** | Pedido Detail Admin — todas as transições de etapa |
| **Causa provável** | Os modais de seta foram enriquecidos incrementalmente (fases B/C), mas cada um ainda é isolado. Falta um painel/hub que consolide: o que está bloqueado em cada etapa, por quê, quais OPs estão envolvidas e o que fazer. |
| **Arquivos prováveis** | `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js`, `js/screens/pedido-chain-state.js`, `js/screens/pedido-detail-progress.js` |
| **Critério de aceite** | Hub/centro de ações no Pedido Detail que, para cada etapa ativa/bloqueada: exibe status, bloqueios com explicação curta + detalhe expansível, OPs relacionadas com links, CTA da próxima ação canônica. Fonte única: `derivePedidoChainState`. |
| **Dependências** | Nenhuma (usa dados já carregados + `derivePedidoChainState`). |
| **Fase recomendada** | `ADMIN-PEDIDO-STAGE-ACTION-HUB-B` |
| **Ordem** | 2 |

**Itens absorvidos por PEDIDO-STAGE-ACTION-HUB-B:**

| Item absorvido | Como é absorvido |
|---|---|
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | A explicação textual de cada bloqueio passa a residir no hub, com texto curto visível e detalhe em tooltip/expansão. A seta mantém label curto; o hub concentra a explicação. |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | Os links para OPs relacionadas a cada etapa passam a ser exibidos no hub, não como texto inline nas setas. |
| Parte de `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | O hub exibe se a OP Tecelagem vinculada ainda precisa de aceite/ajuste, com CTA para o modal de aceite. O modal de aceite em si é implementado separadamente (item 3). |
| Parte de `PEDIDO-STAGE-MODAL-WIDTH-R1` | O hub usa largura expandida por padrão (não modal estreito), resolvendo o problema de truncamento de informações densas. |

#### 3. TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B

| Campo | Valor |
|---|---|
| **Prioridade** | P1 |
| **Sintoma** | O aceite/ajuste da OP Tecelagem exige navegar para a tela de OP (`#/ops/<id>`). O Pedido Detail não oferece interface inline para revisar e aceitar a OP de tecelagem vinculada. |
| **Fluxo afetado** | Pedido Detail Admin — transição Insumos → Tecelagem ou Tecelagem → Acabamento |
| **Causa provável** | A criação de OP Tecelagem a partir do Pedido (Fase C) populou `lotes.pedido_id` e `op_itens.pedido_item_id`, mas o ciclo de aceite/ajuste ainda não tem tela no contexto do Pedido. O modal de transição atual só sabe abrir a OP. |
| **Arquivos prováveis** | `js/screens/pedido-detail-events.js`, `js/screens/pedido-detail-render.js`, `js/screens/pedido-chain-state.js` |
| **Critério de aceite** | Modal inline no Pedido Detail que: lista itens da OP Tecelagem com quantidades ajustadas vs pedidas, permite ajustes dentro do saldo do pedido, mostra parâmetros de largura, exibe status da OP e tem CTA "Confirmar e iniciar produção" que chama `alterar_status_op(..., 'em_producao')`. |
| **Dependências** | `PEDIDO-STAGE-ACTION-HUB-B` (o hub expõe o CTA para este modal). |
| **Fase recomendada** | `ADMIN-TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` |
| **Ordem** | 3 |

#### 4. OP-NOVA-METRAGEM-INPUT-FOCUS-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P2 |
| **Sintoma** | Ao adicionar itens na tela de Nova OP (Tecelagem ou Acabamento), o foco não vai automaticamente para o campo de metragem após selecionar o modelo, obrigando clique ou Tab manual. |
| **Fluxo afetado** | Admin — Nova OP (`#/ops/nova`) |
| **Causa provável** | O select de modelo dispara `onchange` que atualiza o estado do item (cores, largura derivada), mas não há `focus()` programático no input de metragem após a seleção. |
| **Arquivos prováveis** | `js/screens/op-nova.js` |
| **Critério de aceite** | Ao selecionar um modelo no select de item da Nova OP, o foco move-se automaticamente para o campo de metragem correspondente. |
| **Dependências** | Nenhuma. |
| **Fase recomendada** | `ADMIN-OP-NOVA-METRAGEM-FOCUS-R1` |
| **Ordem** | 4 |

#### 5. PEDIDO-FIRST-OP-CTA-PLACEMENT-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P1 |
| **Sintoma** | Quando um Pedido não tem nenhuma OP vinculada, o CTA "Criar OP" / "Lançar produção" está ausente ou posicionado de forma não proeminente no Pedido Detail. O usuário precisa saber que deve navegar manualmente para `#/ops/nova?pedido_id=<id>`. |
| **Fluxo afetado** | Pedido Detail Admin — Pedido sem OP |
| **Causa provável** | O bloco de OPs vinculadas no Pedido Detail só aparece quando há OPs. O estado "sem OP" não tem um CTA contextual visível para criar a primeira OP a partir do Pedido. |
| **Arquivos prováveis** | `js/screens/pedido-detail-render.js`, `js/screens/pedido-detail.js` |
| **Critério de aceite** | No Pedido Detail sem OPs, bloco visível com CTA destacado "Criar OP de produção" que navega para `#/ops/nova?pedido_id=<id>` com pré-preenchimento dos itens do pedido. |
| **Dependências** | Nenhuma (rota `#/ops/nova?pedido_id=` já existe desde a Fase C). |
| **Fase recomendada** | `ADMIN-PEDIDO-FIRST-OP-CTA-R1` |
| **Ordem** | 5 |

#### 6. TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P2 |
| **Sintoma** | O modal de transição Tecelagem → Acabamento (`openMovementModal`) exibe o formulário de entrega (`buildEntregaInlineForm`) com layout que pode ficar comprimido em resoluções menores, especialmente o select de split e o campo de motivo. |
| **Fluxo afetado** | Pedido Detail Admin — seta Tecelagem → Acabamento |
| **Causa provável** | O `buildEntregaInlineForm` foi projetado para a tela de OP (largura total), mas no modal do Pedido Detail a largura disponível é menor (~520px), comprimindo campos, select de split e aviso ambar. |
| **Arquivos prováveis** | `js/screens/pedido-detail-events.js`, `js/screens/entrega-form.js` |
| **Critério de aceite** | Modal Tecelagem → Acabamento com layout responsivo: campos em grid flexível, select de split e motivo com largura adequada, aviso ambar legível e tabela de pendências sem truncamento horizontal. |
| **Dependências** | `PEDIDO-STAGE-MODAL-WIDTH-R1` (largura base do modal padronizada beneficia este também). |
| **Fase recomendada** | `ADMIN-TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` |
| **Ordem** | 6 |

#### 7. PEDIDO-STAGE-MODAL-WIDTH-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P2 |
| **Sintoma** | Os modais de transição entre etapas do stepper usam largura fixa estreita (~520px), truncando informações de totais, tabelas de pendências e listas de OPs relacionadas. |
| **Fluxo afetado** | Pedido Detail Admin — todos os modais de seta |
| **Causa provável** | Largura fixa herdada de modais simples; os modais foram enriquecidos com mais dados ao longo das fases, mas a largura base não foi ajustada. |
| **Arquivos prováveis** | `js/screens/pedido-detail-events.js` |
| **Critério de aceite** | Modais de transição com largura mínima de 640px (ou responsiva `min(90vw, 720px)`); tabelas internas sem scroll horizontal forçado; informações de totais e OPs relacionadas totalmente visíveis. |
| **Dependências** | Nenhuma. Parcialmente absorvido por `PEDIDO-STAGE-ACTION-HUB-B` (o hub usa painel expandido, não modal estreito). |
| **Fase recomendada** | `ADMIN-PEDIDO-STAGE-MODAL-WIDTH-R1` |
| **Ordem** | 7 |

#### 8. LATEX-ADMIN-COMPACT-BUTTONS-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P2 |
| **Sintoma** | Na tela de OP Latex Admin (`op-latex-admin.js`), os botões de ação (Movimentar para Expedição, Finalizar OP) e os cards de resumo ocupam espaço vertical excessivo, exigindo scroll frequente em OPs com muitos itens. |
| **Fluxo afetado** | Admin — OP Latex/Acabamento (`#/ops/<id>` com tipo=latex) |
| **Causa provável** | Layout herdado do standalone com cards e botões em tamanho generoso; com os novos cards de resumo canônico (Recebido/Movimentado/Disponível/Entregue/Saldo) e a tabela de itens, a densidade vertical aumentou mas os botões não foram compactados proporcionalmente. |
| **Arquivos prováveis** | `js/screens/op-latex-admin.js` |
| **Critério de aceite** | Botões de ação e cards de resumo com altura reduzida (padding/margem compactos); CTA "Movimentar para Expedição" e "Finalizar OP" visíveis sem scroll na maioria das OPs; tabela de itens preservada. |
| **Dependências** | Nenhuma. |
| **Fase recomendada** | `ADMIN-LATEX-COMPACT-BUTTONS-R1` |
| **Ordem** | 8 |

### 9.2 Itens absorvidos (não implementar isoladamente)

Estes itens são resolvidos como parte de `PEDIDO-STAGE-ACTION-HUB-B` (item 2 acima):

#### PEDIDO-STAGE-BLOCKER-EXPLANATION-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P2 (absorvido) |
| **Sintoma** | As setas do stepper no Pedido Detail mostram apenas label curto ("Aguardar", "Transferir", "Concluído") sem explicar o motivo do bloqueio quando uma etapa está em "Aguardar". |
| **Fluxo afetado** | Pedido Detail Admin — stepper entre etapas |
| **Causa provável** | Decisão de produto: labels curtos nas setas para evitar poluição visual. A explicação do bloqueio precisa de um local separado. |
| **Critério de aceite** | Bloqueios explicados no hub de ações (`PEDIDO-STAGE-ACTION-HUB-B`), com texto curto visível + detalhe expansível. Setas mantêm labels curtos. |
| **Dependências** | `PEDIDO-STAGE-ACTION-HUB-B`. |
| **Fase recomendada** | Absorvido por `ADMIN-PEDIDO-STAGE-ACTION-HUB-B`. |

#### PEDIDO-STAGE-RELATED-OPS-LINKS-R1

| Campo | Valor |
|---|---|
| **Prioridade** | P2 (absorvido) |
| **Sintoma** | Os modais de transição não exibem links diretos para as OPs relacionadas à etapa. O usuário precisa sair do modal, encontrar o bloco de OPs vinculadas e clicar lá. |
| **Fluxo afetado** | Pedido Detail Admin — modais de transição |
| **Causa provável** | Os modais foram evoluídos para mostrar totais e pendências, mas não links de navegação para as OPs. |
| **Critério de aceite** | O hub de ações (`PEDIDO-STAGE-ACTION-HUB-B`) exibe, para cada etapa, links clicáveis para as OPs relacionadas (`#/ops/<id>`). |
| **Dependências** | `PEDIDO-STAGE-ACTION-HUB-B`. |
| **Fase recomendada** | Absorvido por `ADMIN-PEDIDO-STAGE-ACTION-HUB-B`. |

### 9.3 Sequência de implementação recomendada

| # | Item | Absorve | Risco |
|---|---|---|---|
| 1 | PEDIDO-CONCLUIR-ACTION-R1 | — | Baixo |
| 2 | PEDIDO-STAGE-ACTION-HUB-B | BLOCKER-EXPLANATION-R1, RELATED-OPS-LINKS-R1, parte de TEC-ACCEPTANCE, parte de MODAL-WIDTH | Médio |
| 3 | TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B | — | Médio |
| 4 | OP-NOVA-METRAGEM-INPUT-FOCUS-R1 | — | Baixo |
| 5 | PEDIDO-FIRST-OP-CTA-PLACEMENT-R1 | — | Baixo |
| 6 | TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1 | — | Baixo |
| 7 | PEDIDO-STAGE-MODAL-WIDTH-R1 | — | Baixo |
| 8 | LATEX-ADMIN-COMPACT-BUTTONS-R1 | — | Baixo |

### 9.4 Relação com backlog de produção (§2)

O backlog Admin (§9) é complementar ao backlog de fluxo produtivo (§2).
Os itens de §2 (A-H) cobrem a mecânica de transição e a cadeia
produtiva; os itens de §9 cobrem usabilidade, clareza de ações e
organização visual da interface Admin já existente.

Sobreposições resolvidas:
- §2 item D (`PEDIDO-TEC-ACCEPTANCE-B`) ≈ §9 item 3 (`TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B`): o item §9.3 detalha o aceite inline no Pedido. Ambos convergem na mesma implementação.
- §2 item B (`PEDIDO-TRANSITION-MODAL-GAPS-B`) ≈ §9 item 2 (`PEDIDO-STAGE-ACTION-HUB-B`): o hub de ações é a evolução natural dos modais de seta enriquecidos.
- §9 itens 6 e 7 (`TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1`, `PEDIDO-STAGE-MODAL-WIDTH-R1`) são ajustes de layout que beneficiam os modais de §2.B.

Itens de §2 já implementados e fora do backlog Admin: C, F, H, A, G, E (todos resolvidos em fases anteriores conforme `PROJECT_STATE.md`).

### 9.5 Regras vinculantes

1. **Não implementar isoladamente itens absorvidos.** `BLOCKER-EXPLANATION-R1`
   e `RELATED-OPS-LINKS-R1` só fazem sentido dentro do hub.
2. **Fonte de cálculo canônica:** `derivePedidoChainState` para qualquer
   dado de etapa, bloqueio ou progresso. Não duplicar lógica.
3. **Writes somente via operações canônicas existentes:** `alterar_status_op`,
   `salvarEntregaCima`, `liberar_expedicao_latex_parcial`,
   `concluir_pedido_se_pronto`. Nunca write direto em tabelas.
4. **Uma fase por item.** Não agrupar múltiplos itens em uma fase só.
5. **Staging seletivo.** `git add` apenas os arquivos da fase.
6. **Produção intocada.** `bhgifjrfagkzubpyqpew` e `origin/main` nunca
   são alvo de push.

### 9.6 Closeout visual Admin/Pedido - 2026-07-05

Fase: `RAVATEX-TAPETES-ADMIN-BACKLOG-VISUAL-CLOSEOUT-A`

Status: **BLOQUEADO**. O backlog Admin/Pedido **nao esta zerado** no staging
real.

Premissa vinculante: relatorio tecnico e teste local nao bastam para fechar
backlog de UX/fluxo. Cada item precisa ser classificado por comportamento real
em staging: OK visual, Parcial, Falhou, Reabrir R2 ou Nao validavel sem acao
manual.

Ambiente auditado:

| Campo | Valor |
|---|---|
| Branch | `work/app-next` |
| HEAD inicial | `57719298dcbd370cb7b1a0ca3ff1365c30ca8fb9` |
| Staging remoto | `staging/work/app-next` no mesmo commit |
| Frontend visual | `http://localhost:8765/` com `APP_ENV=staging` |
| Supabase staging | `ucrjtfswnfdlxwtmxnoo` |
| Producao | `bhgifjrfagkzubpyqpew` intocada |
| Cache/assets | cache mitigado com `?audit=...`; `pedido-detail-render.js` servido bate SHA-256 com o local |

Tabela de closeout:

| Item | Status reportado anteriormente | Status visual real | Evidencia | Decisao | Proxima fase |
|---|---|---|---|---|---|
| `PEDIDO-CONCLUIR-ACTION-R1/R2` | OK por R2/testes | OK visual | Pedido #20 aparece `Concluido` / `Comercial: Entregue`, botao `Pedido concluido` com `disabled="disabled"`; Pedido #21 apto mostra `Concluir pedido` habilitado, sem `disabled`; nenhum `disabled="null"` nos botoes do Pedido Detail. | Fechado no Pedido Detail. | Nenhuma para Pedido Detail; avaliar residuo estatico em `expedicao-admin.js` se entrar no escopo. |
| `PEDIDO-STAGE-ACTION-HUB-B` | OK por teste/harness | Falhou | Pedido #21 abre hub de Entrega, mas Pedido #13 com OP Tecelagem aberta crasha ao clicar etapa/seta: `TypeError: Failed to execute 'appendChild' on 'Node'` em `pedido-detail-events.js:1726`. | Reabrir R2. | Corrigir hub e revalidar em browser real. |
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | OK/absorvido pelo hub | Falhou | Setas mantem texto curto `Aguardar`, mas o clique no Pedido #13 nao abre explicacao por causa do crash do hub. | Reabrir R2. | Mesmo R2 do hub. |
| `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` | OK | OK visual | Pedido #1 sem OP mostra `Gerar primeira OP` destacado a direita no bloco `OPs vinculadas`; card vazio e explicativo. | Fechado. | Nenhuma. |
| `OP-NOVA-METRAGEM-INPUT-FOCUS-R1` | OK | OK visual | Nova OP aberta a partir do Pedido #1; campo `metros` vazio aceitou `1000` continuamente e manteve foco; nenhuma OP salva. | Fechado. | Nenhuma. |
| `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` | OK | OK visual | Pedido #14 abriu modal Tecelagem -> Acabamento; ordem visual: nome do item, Data/Destino/Metros, Observacao; `Itens envolvidos` legivel; nenhuma transferencia salva. | Fechado. | Nenhuma. |
| `LATEX-ADMIN-COMPACT-BUTTONS-R1` | OK | OK visual | OP Latex #27 / OP 9/2026 em producao mostra botoes curtos `Finalizar OP` e `Movimentar`, separados; nao mostra `Confirmar entrada / iniciar acabamento`. | Fechado. | Nenhuma. |
| `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | OK por teste/harness | Falhou | Pedido #13 tem OP Tecelagem aberta (OP 10/2026), mas o hub de Tecelagem crasha antes de exibir `Aceitar OP`; card principal nao expoe aceite. | Reabrir R2. | Corrigir hub e validar `Aceitar OP` sem aceitar OP real. |
| `PEDIDO-STAGE-MODAL-WIDTH-R1` | OK/parcial por hub | Parcial | Modal de movimento do Pedido #14 esta legivel e nao esmaga `Itens envolvidos`; hub de etapa nao pode ser validado em Tecelagem por crash. | Revalidar apos R2. | Reteste visual do hub corrigido. |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | OK/absorvido pelo hub | Parcial / Reabrir R2 | Cards principais mostram `Abrir OP`; expedicoes mostram `Abrir expedicao`; links dentro do hub de Tecelagem nao sao validaveis porque o hub crasha. | Reabrir junto com hub. | Reteste visual do hub corrigido. |

Observacoes obrigatorias:

- Pedido #20 foi concluido anteriormente em staging e agora deve aparecer como
  entregue/concluido. Nao usar Pedido #20 como pedido rascunho/apto.
- Pedido #21 foi apenas inspecionado como pedido apto; nenhum clique em
  `Concluir pedido` foi executado.
- Nenhum pedido novo foi criado; nenhuma OP real foi aceita; nenhuma
  transferencia foi salva; nenhuma OP Nova foi salva.
- Busca estatica encontrou `disabled: ready ? null : 'disabled'` em
  `js/screens/expedicao-admin.js:361`. O Pedido Detail servido, porem, nao
  contem o padrao antigo e nao renderizou `disabled="null"` nos casos auditados.

Testes/diagnosticos desta auditoria:

| Tipo | Resultado |
|---|---|
| `node --test tests\pedido-detail.smoke.js` | OK, 147/147 |
| `node --test tests\pedido-detail-linked-ops.smoke.js` | OK, 7/7 |
| `node --test tests\op-latex-admin.smoke.js` | OK, 55/55 |
| `node --test tests\tec-to-acabamento-flow.smoke.js` | OK, 37/37 |
| `node --test tests\expedicao-partial-flow.smoke.js` | OK, 12/12 |
| `node scripts/staging/production-flow-invariants-diag.mjs` | OK |
| `node scripts/staging/latex-consolidation-diag.mjs` | OK |
| `node scripts/staging/expedicao-partial-flow-diag.mjs` | OK |

### 9.7 R2 real do hub de etapa - 2026-07-05

Fase: `RAVATEX-TAPETES-PEDIDO-STAGE-HUB-R2-REAL-STAGING`

Status: **OK** para os itens reabertos do hub.

Motivo da R2: a auditoria visual real de `2026-07-05` reabriu o hub porque
Pedido #13, etapa Tecelagem, quebrava no clique da bolinha/`Aguardar` com:

`TypeError: Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'`

Stack observado no browser real: `js/ui.js:19` ->
`js/screens/pedido-detail-events.js:1726` -> `buildStageDetailBody` ->
`openStageDetailModal`.

Diagnostico:

| Campo | Resultado |
|---|---|
| Pedido de reproducao | Pedido #13 |
| Etapa | Tecelagem |
| OP relacionada | OP 10/2026, tipo `tecelagem`, status `aberta` |
| Valor invalido | Objeto comum `summary.docBanner` (`{ tone, text }`) |
| Causa raiz | O hub passava o objeto inteiro como filho de `window.el(...)`; o DOM real tentava anexar o objeto via `appendChild`. |
| Por que o teste anterior nao pegou | O harness runtime aceitava filhos invalidos e achatava listas de forma mais permissiva que `js/ui.js`. |

Correcao aplicada:

- `js/screens/pedido-detail-events.js`: `docBannerRow(...)` converte o banner
  documental em texto/Node valido antes de chamar `window.el(...)`.
- `tests/pedido-detail.smoke.js`: o harness runtime agora rejeita objeto comum
  em `appendChild`, imitando o DOM real, e inclui caso equivalente ao Pedido
  #13/Tecelagem/Aguardar.

Validacao real pos-correcao:

| Clique | Resultado |
|---|---|
| `Ver detalhes da etapa TECELAGEM` | Hub abre sem erro; mostra OP 10/2026, `Abrir OP`, `Aceitar OP`, motivo e `Sem movimentacao para acabamento registrada ainda`. |
| `Movimentar Tecelagem -> Acabamento` / `Aguardar` | Hub abre com o mesmo conteudo, sem erro no console/pageerror. |

Classificacao pos-R2:

| Item | Status |
|---|---|
| `PEDIDO-STAGE-ACTION-HUB-B` | Fechado |
| `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` | Fechado |
| `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` | Fechado |
| `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` | Fechado |
| `PEDIDO-STAGE-MODAL-WIDTH-R1` | Fechado para o hub validado |

Testes/diagnosticos:

| Tipo | Resultado |
|---|---|
| `node --test tests\pedido-detail.smoke.js` | OK, 148/148 |
| `node --test tests\pedido-detail-linked-ops.smoke.js` | OK, 7/7 |
| `node --test tests\op-latex-admin.smoke.js` | OK, 55/55 |
| `node --test tests\tec-to-acabamento-flow.smoke.js` | OK, 37/37 |
| `node --test tests\expedicao-partial-flow.smoke.js` | OK, 12/12 |
| `node --test tests\expedicao-flow.smoke.js` | OK, 8/8 |
| `node scripts/staging/production-flow-invariants-diag.mjs` | OK |
| `node scripts/staging/latex-consolidation-diag.mjs` | OK |
| `node scripts/staging/expedicao-partial-flow-diag.mjs` | OK |

Confirmacoes: producao `bhgifjrfagkzubpyqpew` intocada; sem SQL, sem
migration, sem dados reais novos, sem aceitar OP real, sem concluir pedido
real, sem transferencia real, sem write paralelo no Pedido e sem alteracao do
fluxo Acabamento -> Expedicao ou lifecycle de OP.

Nota de backlog: os itens reabertos do hub estao zerados nesta R2. O backlog
Admin/Pedido geral nao deve ser declarado zerado sem tratar ou explicitamente
retirar de escopo o residuo estatico `disabled: ready ? null : 'disabled'` em
`js/screens/expedicao-admin.js:361`.
# Atualizacao 2026-07-06 - Pedido/OP Controlled Delete B

Fase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B`
Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL/TECNICA DO USUARIO**

Patch tecnico para limpeza de dados de validacao em ambiente de testes:
`db/34_controlled_delete_pedido_op.sql` cria diagnosticos e remocao
transacional; `js/delete-helpers.js` concentra o fluxo visual e impede delete
direto em telas.

Politica atual: excluir Pedido/OP sem entrega/expedicao; exigir `EXCLUIR`
quando houver OP/dependencias nao bloqueadoras; bloquear entrega, expedicao e
OP filha; nao alterar `op_numeros`, nao renumerar OPs e nao reciclar numeros.
Futuro de producao: senha/admin forte, soft-delete e auditoria permanente.

Backlog residual:

| Item | Prioridade | Descricao |
|---|---|---|
| `DELETE-PROD-GUARD-A` | P1 futuro | Trocar exclusao fisica temporaria por fluxo produtivo com senha admin, soft-delete e auditoria permanente antes de liberar em producao. |
| `DELETE-AUDIT-LOG-A` | P2 futuro | Registrar solicitante, impacto aprovado e resultado final em trilha auditavel. |

## Atualizacao 2026-07-06 - Controlled Delete Policy Fix C

Fase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-POLICY-FIX-C`

- Em staging/teste, a exclusao fisica controlada precisa sobrepor a politica
  futura da `db/26` que bloqueava qualquer OP numerada.
- `db/34_controlled_delete_pedido_op.sql` remove o trigger/função
  `ops_numeradas_no_delete` para permitir OP numerada sem bloqueadores reais.
- Producao futura ainda deve voltar para politica auditada: soft-delete,
  trilha permanente e autorizacao forte antes de qualquer exclusao real.
- `op_numeros` permanece high-water; nao reduzir, nao reciclar e nao renumerar
  OPs.
