# Estado pos-fase - Insumos Tecelagem UI Fix A

- Fase: `RAVATEX-TAPETES-INSUMOS-TECELAGEM-UI-FIX-A`.
- Status: **PATCH UI INSUMOS/TECELAGEM PRONTO — AGUARDANDO RETESTE DO USUARIO**.
- Branch/HEAD base: `work/app-next`,
  `2a492f08ee8c9d0b85f6a012f2ca84a767321338`; status inicial somente
  `?? supabase/.temp/`; `origin` somente leitura; producao intocada.
- Itens entregues (P0):
  1. **Alinhamento do bloco "Data do recebimento" + texto auxiliar**
     em `buildInsumosTransferForm`
     (`js/screens/pedido-detail-events.js`). Layout trocado de
     `display:grid;grid-template-columns:180px 1fr` (com texto auxiliar em
     `align-self:end` na segunda coluna) para bloco vertical empilhado com
     `margin-top:4px` no texto auxiliar. O auxiliar agora segue
     imediatamente abaixo do input de Data e mantem a mesma largura.
     Responsividade preservada; regra de negocio intocada.
  2. **Default state de "Manter pedido" e "Aceitar proposta"** no
     `buildTecAcceptanceProposalBlock`. Foi introduzido um snapshot
     `defaultMetrosOverride` (proposta proporcional canonica) e um helper
     `propostaDivergente()` que compara cada `metrosOverride` com o
     default. Regra do `recompute()` agora e
     `disabled = !divergente || algumExcede || aplicarRecalculoOP ausente`.
     - "Manter pedido" continua sempre ativo (sem mudanca).
     - "Aceitar proposta" inicia desabilitado e so habilita quando o
       usuario move o slider para um valor divergente do default.
     - "Voltar a proposta proporcional" reseta para o default e o botao
       volta a ser desabilitado.
     - O fluxo de `refreshPedidoTransitionModal` continua recriando o
       modal apos registrar recebimento, garantindo que a regra seja
       recalculada a cada frame.
     - Fonte do aceite preservada: `window.aplicarRecalculoOP` (helper
       canonico), sem write paralelo em `ops.status`.
  3. **Excluir Pedido + Excluir OPs relacionadas**:
     - Pedido Detail ja tinha "Excluir Pedido" no header
       (`handlers.buildDeleteButton` -> `excluirPedidoComFluxo`).
     - Foi adicionado botao "Excluir OP" no card de cada OP em
       `pedido-detail-render.js` `buildOpCard`. Botao condicional a
       `handlers.excluirOpRelacionada` e `summary.op.id`.
     - O handler canonico `excluirOpRelacionada` foi adicionado em
       `pedido-detail-events.js` e exportado. Ele chama
       `RAVATEX_DELETE.excluirOPComFluxo(op.id, ...)` e em sucesso
       recarrega + re-renderiza. Sem delete direto em Supabase, sem RPC
       nova, sem migration.
- Arquivos alterados:
  - `js/screens/pedido-detail-events.js`
    (alinhamento, snapshot default, `propostaDivergente()`, regra de
    disabled, `excluirOpRelacionada`, exposicao no retorno);
  - `js/screens/pedido-detail-render.js` (card de OP ganha botao
    "Excluir OP" condicional ao handler canonico);
  - `tests/pedido-detail.smoke.js` (8 novos casos para a fase).
- Testes focados verdes:
  - `pedido-detail.smoke.js` 171/171 (inclui os 8 novos casos
    `INSUMOS-TECELAGEM-UI-FIX-A`);
  - `controlled-delete.smoke.js` 32/32;
  - `ops-list.smoke.js` 1/1; `op-latex-admin.smoke.js` 55/55;
  - `pedido-detail-linked-ops.smoke.js` 7/7;
  - `tec-to-acabamento-flow.smoke.js` 39/39;
  - `expedicao-partial-flow.smoke.js` 12/12;
  - `expedicao-flow.smoke.js` 8/8;
  - `production-flow-invariants.smoke.js` 13/13.
  - Total focados: 338/338.
- Riscos / observacoes:
  - O botao "Excluir OP" novo no card depende de `handlers.excluirOpRelacionada`.
    Telas que nao passarão o handler (ex.: variante antiga de render) nao
    vao expor o botao (condicional explicita no source).
  - A regra de "Aceitar proposta" desabilitado por default muda o
    comportamento da OP em alguns smoke testes legados que clicavam no
    botao imediatamente; os testes novos cobrem o caminho via slider.
  - Validacao visual real contra staging ainda pendente (Browser
    navegacao real). Nao declarar OK visual.
- Proximo passo recomendado:
  `RAVATEX-TAPETES-INSUMOS-TECELAGEM-UI-FIX-B` (validacao visual real
  contra staging) e/ou outros polishes P1/P2 do backlog Admin/Pedido.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, sem
  SQL, sem migration, sem dados reais novos, sem `git add .`,
  `supabase/.temp/` fora do commit.

# Estado pos-fase - OP Create Requires Pedido RPC Guard C — Closeout

- Fase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C-CLOSEOUT`.
- Status: **STAGING APPLY OK — VERIFICADO / CLOSEOUT**.
- Branch/HEAD: `work/app-next`,
  `b976fbf7a43bee0156f483c7ca745db4d2308d2c`; status somente
  `?? scripts/staging/orphaned-ops-triage-diag.mjs` (fase D) e
  `?? supabase/.temp/`.
- Guarda RPC implementada em `db/33_op_latex_requires_pedido_guard.sql`
  (commit `95946d5`) e aplicada em staging pelo usuario (commit `a760158`).
- `gerar_op_latex(BIGINT)` — guarda em `db/33:127-135`, antes de
  `proximo_numero_op` (`db/33:139`).
- `gerar_op_latex_split(BIGINT, TEXT)` — guarda em `db/33:337-345`, antes de
  `proximo_numero_op` (`db/33:349`).
- Mensagem de erro: `Nao e possivel gerar OP de Acabamento/Latex: OP origem nao
  possui Pedido vinculado.`
- Comportamento valido com Pedido preservado; split valido preservado.
- Diagnosticos staging (5/5 OK): orfas=11 (ALERTA historico), fluxo OK,
  consolidacao OK, expedicao OK.
- Testes locais: `op-nova` 69/69, `op-persistir` 70/70, `op-display` 20/20,
  `op-latex-admin` 55/55, `production-flow-invariants` 13/13.
- Confirmacoes: sem backfill, sem constraint global, sem producao,
  sem alteracao de dados historicos, sem `git add .`.
- Proxima fase: `RAVATEX-TAPETES-OP-ORPHANED-HISTORICAL-TRIAGE-D` (script
  `orphaned-ops-triage-diag.mjs` ja criado, pendente commit).

# Estado pos-fase - OP Operational Code Admin Wide Expand D

- Fase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-ADMIN-WIDE-EXPAND-D`.
- Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**.
- Retomada apos bloqueio por limite de sessao.
- Branch/HEAD inicial: `work/app-next`, `6cc8e41`; status inicial:
  `M js/screens/painel.js` (inicio parcial preservado) e `?? supabase/.temp/`.
- Contrato aplicado: identificacao principal
  `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}` via
  `js/op-display.js`; legado como secundario/fallback (`Nº interno {numero}/{ano}`
  ou `OP {numero}/{ano}` sem contexto).
- Telas alteradas:
  - `painel.js`: OP->Pedido por `lotes.pedido_id` + `pedidoById`; siblings por
    `opsByPedido`; zero query nova.
  - `ops-list.js`: SELECT aditivo em `lote:lote_id(...)` com `pedido_id` e
    `pedido:pedido_id(id,numero,criado_em)`; siblings pela lista completa.
  - `op-nova.js`: normaliza `pedidoCtx.criadoEm`; busca leve
    `lotes do pedido -> ops desses lotes`; passa contexto para
    `op-tecelagem-producao-admin.js`.
  - `op-tecelagem-producao-admin.js`: breadcrumb, header e lineage via helper,
    com `Nº interno` visivel.
  - `op-latex-admin.js`: quando ha `lote.pedido_id`, consulta Pedido + siblings;
    sem Pedido cai no legado, preservando fixtures sem `pedido_id`.
  - `expedicao-admin.js`: SELECT aditivo de `pedido.criado_em` e
    `op.criado_em/lote_id`; siblings por lotes do Pedido.
- Mantidos em legado por regra: PDFs, fornecedor/RLS e qualquer tela/fixture sem
  Pedido resolvivel.
- Garantias: sem SQL/migration/dados reais novos; sem alterar `ops.numero`,
  `ops.ano`, `op_numeros`, RPCs; producao/origin intocados; `supabase/.temp/`
  nao deve ser commitado.
- Testes OK: `op-display`, `admin-dashboard`, `painel-screen`, `op-latex-admin`,
  `expedicao-flow`, `expedicao-partial-flow`, `router`, `pedido-detail`,
  `pedido-detail-linked-ops`, `production-flow-invariants`.
- Diagnosticos staging read-only OK: invariantes de fluxo, consolidacao Latex e
  expedicao parcial.
- Observacao: `tests/ops-list-screen.smoke.js` opcional foi executado e ainda
  falha por contratos antigos de script inline; nao e o teste obrigatorio desta
  fase e nao foi atualizado.

# Estado pos-fase - OP Operational Code Closeout C

- Fase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-CLOSEOUT-C`.
- Status: **OK VISUAL NO ESCOPO COM CONTEXTO DE PEDIDO**. Closeout
  documental/estado, sem patch funcional.
- Branch/HEAD: `work/app-next`, `d7f57c4`; status somente `?? supabase/.temp/`;
  remoto de escrita permitido: `staging/work/app-next`.
- Aceite visual do usuario: confirmou que a identificacao operacional
  `OP {pedido}/{ano}-{tipo}{seq}` apareceu nos lugares principais e deu certo;
  notou que ainda aparece em poucos lugares. Isso e ESPERADO: o codigo so
  aparece onde ha contexto confiavel de Pedido; sem contexto, mantem-se o legado
  `OP {numero}/{ano}`. Nao ha meta de exibicao global agora.
- Regra consolidada: display operacional principal com contexto de Pedido
  `OP {pedido_numero}/{year(pedido.criado_em)}-{tipo}{seq}` (`OP 25/2026-T01`);
  `T=Tecelagem`, `A=Acabamento/Latex`; `seq` por Pedido+Tipo por `ops.criado_em`
  e `ops.id`; fallback `OP {numero}/{ano}`. Formatacao unica em `js/op-display.js`.
- Escopo validado (aparece): Pedido Detail Admin - OPs vinculadas, OPs
  relacionadas, modais das setas, hub da etapa, `tecPendingAcceptance`,
  `relatedOpsLabel`, labels de documentos/expedicao.
- Mantido em legado por decisao: PDFs, fornecedor/RLS, toasts, logs,
  diagnosticos, telas sem contexto confiavel de Pedido (`ops-list`,
  `op-latex-admin`, `op-tecelagem-producao-admin`, `op-nova`, `expedicao-admin`,
  `painel`), e locais onde a expansao exigiria query/read model adicional sem
  necessidade validada.
- Pendencia controlada: expandir para outras telas SOMENTE quando (1) contexto
  confiavel de Pedido; (2) necessidade visual clara; (3) sem migration; (4) sem
  query pesada; (5) sem duplicar formatacao fora de `js/op-display.js`.
  Candidatos naturais: `painel.js`, `expedicao-admin.js`. Nesta fase NAO ha nova
  expansao funcional.
- Testes: closeout documental; bateria funcional ja verde no commit `d7f57c4`
  (op-display 20/20, pedido-detail 163/163, conjunto obrigatorio 337/337).
  Revalidacao minima: `op-display.smoke.js` + `pedido-detail.smoke.js` verdes.
  Nenhum arquivo funcional alterado nesta fase.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, sem SQL,
  sem migration, sem dados reais novos, sem alterar `op_numeros`/RPC/`ops.numero`/
  `ops.ano`, sem `git add .`, `supabase/.temp/` fora do commit.

# Estado pos-fase - OP Operational Code Helper B

- Fase: `RAVATEX-TAPETES-OP-OPERATIONAL-CODE-HELPER-B`.
- Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
- Branch/HEAD base: `work/app-next`,
  `e56746ee3c16340198db370d45bc8ddbcb192923`; status inicial somente
  `?? supabase/.temp/`; remoto de escrita permitido: `staging/work/app-next`.
- Contrato aprovado: `OP {pedido_numero}/{pedido_ano}-{tipo}{seq}`
  (`OP 21/2026-T01`, `OP 21/2026-A02`). `pedido_ano = year(pedido.criado_em)`;
  `T=tecelagem`, `A=latex/acabamento`; `seq` = 2 digitos por Pedido+Tipo,
  ordenado por `ops.criado_em` asc, desempate `ops.id` asc.
- Helper central: `js/op-display.js` -> `window.RAVATEX_OP_DISPLAY`
  (`getOpTypeLetter`, `getPedidoOperationalYear`, `buildOpOperationalSequence`,
  `formatOpOperationalCode`, `formatOpLegacyCode`). Puro (sem DOM/Supabase),
  carregado em `index.html` apos `js/badges.js`. Fallback obrigatorio ao legado
  `OP {numero}/{ano}` sem contexto confiavel de Pedido; consumidores tambem
  caem no legado se o helper nao estiver carregado.
- Regra de ano: `year(pedido.criado_em)` (Pedido nao tem coluna `ano`; `numero`
  e IDENTITY global). Regra T/A: `A` porque o fluxo do usuario chama a etapa de
  Acabamento (o `badgeTipo` tecnico ainda diz "Latex"). Estrategia: helper
  calculado (Opcao C), sem migration, sem coluna persistida.
- Telas alteradas (com contexto de Pedido): `pedido-detail-progress.js`
  (`computeViewModel`: `summary.label`/`legacyLabel`/`origemOpLabel`,
  `relatedOpsLabel`, labels de documentos e de expedicao),
  `pedido-detail-render.js` (origem via `summary.origemOpLabel` com fallback
  `ns.opLabel`), `pedido-detail-events.js` (finalizar OP, OPs relacionadas do
  modal da seta, modal Aceitar OP, botao Revisar e aceitar),
  `pedido-chain-state.js` (`tecPendingAcceptance.label`). Dados:
  `pedido-detail-data.js` passou a selecionar `ops.criado_em` (SELECT aditivo).
- Mantidos em legado (documentado): PDFs (`op-pdf.js`), telas de
  fornecedor/RLS (`fornecedor.js`), toasts globais/diagnosticos, `ops-list.js`
  (sem Pedido no SELECT), `op-latex-admin.js`, `op-tecelagem-producao-admin.js`,
  `op-nova.js`, `expedicao-admin.js` e o Dashboard `painel.js`. O numero/ano
  interno segue como referencia secundaria (linha "Numero/Ano" no modal).
  Proximo incremento recomendado: `painel.js` + `expedicao-admin.js` (tem
  contexto suficiente via `lotes.pedido_id` + OPs carregadas; so falta um
  resolver OP->Pedido, sem query nova).
- Testes: novo `tests/op-display.smoke.js` (20 casos do contrato + fallbacks +
  ordenacao). `tests/pedido-detail.smoke.js` recebeu `js/op-display.js` no
  bundle e 2 casos de integracao (codigo operacional com `criado_em`; fallback
  legado sem `criado_em`).
- Testes OK:
  - `node --test tests\op-display.smoke.js` = 20/20;
  - `node --test tests\pedido-detail.smoke.js` = 163/163;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` OK;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` OK;
  - `node --test tests\op-latex-admin.smoke.js` OK;
  - `node --test tests\expedicao-partial-flow.smoke.js` OK;
  - `node --test tests\expedicao-flow.smoke.js` OK;
  - `node --test tests\admin-dashboard.smoke.js` OK;
  - `node --test tests\painel-screen.smoke.js` OK;
  - `node --test tests\production-flow-invariants.smoke.js` OK;
  - conjunto obrigatorio = 337/337.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs` (0 violacoes,
    0 colisoes; tecelagem 1..24 e latex 1..16 em 2026 => numeros compartilhados
    por tipo, reforcando T/A);
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, sem SQL,
  sem migration, sem dados reais novos, sem alterar `op_numeros`/RPC/`ops.id`/
  `ops.numero`/`ops.ano`, sem `git add .`, `supabase/.temp/` fora do commit.
- Validacao visual pendente: abrir Pedido com OPs vinculadas e conferir os
  codigos `OP {pedido}/{ano}-{tipo}{seq}` em OPs vinculadas, OPs relacionadas,
  modais das setas e hub; conferir numero/ano legado como referencia secundaria.

# Estado pos-fase - Admin Dashboard Standalone Parity R1

- Fase: `RAVATEX-TAPETES-ADMIN-DASHBOARD-STANDALONE-PARITY-R1`.
- Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
- Branch/HEAD base: `work/app-next`,
  `963c96cfc358e8d55560f8bbc0c77ef40f355ad4`.
- Status inicial observado: somente `?? supabase/.temp/`.
- Standalone de referencia:
  `D:/OneDrive/Ravatex/Inttex/Mockups - nova interface/Admin/Admin - Dashboard - standalone.html`.
- Diagnostico obrigatorio:
  - `js/screens/painel.js` era placeholder do Admin Dashboard;
  - `js/screens/common.js` ja fornece shell/topbar/sidebar homologados e foi
    preservado;
  - `js/screens/cliente-dashboard.js`, `js/screens/pedidos-list.js`,
    `js/screens/ops-list.js` e `js/screens/pedido-detail-*` foram usados como
    referencias de padrao visual/contratos, sem alteracao;
  - `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` confirmou que fluxos
    Pedido/OP/Expedicao nao deveriam receber write paralelo.
- Patch aplicado:
  - `js/screens/painel.js`: substitui placeholder por dashboard admin com
    header, 5 KPIs, fila de acoes, alertas, cadeia produtiva e atividade
    recente, mantendo `screenPainel()` sincronico e `shellLayout(ADMIN_MENU)`;
  - leituras read-only em `pedidos`, `clientes`, `lotes`, `ops`,
    `expedicoes`, `expedicao_itens`, `pedido_cliente_eventos`;
  - `tests/admin-dashboard.smoke.js`: novo smoke de render, rota/admin,
    blocos principais, selects e ausencia de writes;
  - `tests/painel-screen.smoke.js`: atualizado para o dashboard atual e
    sandbox de boot limpo.
- Ajuste corretivo apos retorno do usuario:
  - miolo do dashboard reapertado contra o standalone por fonte;
  - KPIs com paleta/icones/pills revisados;
  - cards de acoes e alertas com headers, linhas flex, CTAs e tags laterais;
  - cadeia produtiva com setas entre etapas, cards internos e contadores;
  - atividade recente com layout de linha e link textual;
  - sem alteracao de dados, rotas ou fluxos Pedido/OP/Expedicao.
- Diferencas/pendencias visuais:
  - o shell global foi preservado por ser a versao homologada do app;
  - estados vazios sao reais, nao mockados permanentemente;
  - o Browser do Codex bloqueou `file://` para o standalone e `data:` para o
    harness temporario; por politica nao houve workaround. Validacao visual
    manual do usuario continua pendente. Nao declarar OK visual/identico.
- Testes OK:
  - `node --check js\screens\painel.js`;
  - `node --test tests\admin-dashboard.smoke.js` = 6/6;
  - `node --test tests\painel-screen.smoke.js` = 16/16;
  - `node --test tests\pedido-detail.smoke.js` = 161/161;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\router.smoke.js` = 43/43.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, sem SQL,
  sem migration, sem dados reais novos, sem writes no dashboard, sem fluxo
  Pedido/OP/Expedicao alterado, sem `git add .`, `supabase/.temp/` fora do
  patch. `docs/DOCUMENTATION_INDEX.md` nao foi alterado porque nenhum doc novo
  foi criado.

# Estado pos-fase - Pedido Flow UI Audit Fix R1

- Fase: `RAVATEX-TAPETES-PEDIDO-FLOW-UI-AUDIT-FIX-R1`.
- Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
- Branch/HEAD base: `work/app-next`,
  `faf11f421c4b4413bfc54607979f7e821213a864`.
- Status inicial observado: `?? AUDIT_REPORT.md` e `?? supabase/.temp/`.
  `AUDIT_REPORT.md` foi tratado como registro da auditoria; `supabase/.temp/`
  permanece fora do patch.
- Diagnostico obrigatorio antes do patch:
  1. labels das setas: definidos no `stage.transfer` montado por
     `js/screens/pedido-detail-progress.js`;
  2. titulos dos modais: consumidos de `stage.transfer.title` por
     `openMovementModal` em `js/screens/pedido-detail-events.js`;
  3. refresh ja existente: save principal do modal chama
     `refreshPedidoTransitionModal(...)`; proposta inline recebe
     `onAfterSuccess` com o mesmo helper;
  4. risco stale restante: labels nao estavam cobertos para todas as setas e
     precisava travar que carregar OP relacionada nao grava nada;
  5. C3-done: sobreposicao segura entre `adminStepper` e
     `applyFormalPendingStage`, sem conflito funcional nesta fase.
- Patch aplicado:
  - `js/screens/pedido-detail-progress.js`: adiciona `connectorLabel`,
    `allowWithoutOp` e `forceActionConnector` onde necessario; troca titulos
    do modal para o contrato (`Gerar primeira OP`, `Transferir para
    Acabamento`, `Movimentar para Expedicao`, `Registrar entrega`).
  - `js/screens/pedido-detail-render.js`: `buildConnectorVisual` passa a usar
    `stage.transfer.connectorLabel` para setas ativas, preservando
    `Aguardar`/`Concluido` para estados passivos; `allowWithoutOp` substitui
    o antigo special-case de expedicao.
  - `js/screens/pedido-detail-events.js`: CTA de Tecelagem -> Acabamento passa
    a `Transferir para Acabamento`; fallback sem OP usa `Gerar primeira OP`.
  - `tests/pedido-detail.smoke.js`: cobre runtime dos labels `Iniciar`,
    `Receber`, `Transferir`, `Movimentar`, `Entregar`, clique da seta
    `Iniciar`, refresh do modal e carga de OP relacionada sem write.
- B2-label final:
  - sem OP: `Iniciar` / `Gerar primeira OP`;
  - com OP: `Receber` / `Registrar recebimento de insumos`;
  - Tecelagem -> Acabamento: `Transferir` / `Transferir para Acabamento`;
  - Acabamento -> Expedicao: `Movimentar` /
    `Movimentar para Expedicao`;
  - Expedicao -> Entrega: `Entregar` / `Registrar entrega`.
- E2-E5: comprovado seguro/coberto. Writes do modal continuam canonicos
  (`registrarRecebimentoOrdemFio`, `salvarEntregaCima`,
  `liberar_expedicao_latex_parcial`, `registrar_entrega_expedicao`) e o save
  de sucesso re-renderiza o mesmo modal via `refreshPedidoTransitionModal`.
  Carregar OP relacionada apenas troca o contexto renderizado e nao chama RPC.
- C3-done: sem ajuste funcional; registrado como sobreposicao segura. Se
  virar refactor de centralizacao no futuro, tratar como P2 tecnico.
- D1/D3: mantidos como polish P2.
- Testes OK:
  - `node --test tests\pedido-detail.smoke.js` = 161/161;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 39/39;
  - `node --test tests\expedicao-partial-flow.smoke.js` = 12/12;
  - `node --test tests\expedicao-flow.smoke.js` = 8/8;
  - `node --test tests\op-latex-admin.smoke.js` = 55/55;
  - `node --test tests\production-flow-invariants.smoke.js` = 11/11.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, sem SQL,
  sem migration, sem dados reais novos, sem aceitar OP real, sem registrar
  recebimento real, sem movimentar saldo real, sem finalizar OP real, sem
  concluir pedido real, sem update direto em `ops.status`, sem write paralelo
  no Pedido, sem `git add .`, `supabase/.temp/` fora do patch.

# Estado pos-fase - Pedido Insumos Tecelagem Modal Parity And Refresh R1

- Fase: `RAVATEX-TAPETES-PEDIDO-INSUMOS-TECELAGEM-MODAL-PARITY-AND-REFRESH-R1`.
- Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
- Branch/HEAD base: `work/app-next`,
  `fae90337472d118f4f90b4223900af752d9d3757`; status inicial somente
  `?? supabase/.temp/`; remoto de escrita permitido: `staging/work/app-next`.
- Falha visual reaberta: a seta `Insumos -> Tecelagem` podia parecer uma
  operacao de `Registrar recebimento de insumos` mesmo quando o Pedido ainda
  nao tinha OP Tecelagem vinculada; alem disso, acoes feitas dentro do modal da
  seta nao atualizavam o proprio modal para o proximo estado canonico.
- Matriz de diagnostico:
  - Sem OP: `openMovementModal` era aberto pela seta; `transferInsumosToTecelagem`
    vinha bloqueado pelo chain-state, mas o titulo/detalhe ainda carregavam o
    vocabulario de recebimento. Nao havia OP de origem; agora o modal mostra
    bloqueio operacional, `Nao e possivel registrar material sem OP vinculada.`
    e CTA `Gerar primeira OP`, sem historico vazio.
  - OP aberta/aceite pendente: OP relacionada vem de
    `relatedOpsForTransition` e a proposta real vem de
    `buildTecAcceptanceProposalBlock`, com slider `input[type="range"]`,
    recalculo ao vivo e `aplicarRecalculoOP`. O patch passa
    `onAfterSuccess` para atualizar o modal apos aceitar.
  - Apos recebimento: `buildInsumosTransferForm` segue usando
    `registrarRecebimentoOrdemFio`; no sucesso agora chama
    `refreshPedidoTransitionModal`, nao fecha o modal. Quando o refresh gera
    estado de aceite pendente, o mesmo modal mostra `Proposta de aceite` e
    `Aceitar proposta`.
  - Paralelismo: Tecelagem -> Acabamento continua sendo a referencia
    operacional (`openMovementModal`, formulario antes de OPs relacionadas,
    `Transferir restante`, write canonico `salvarEntregaCima`). A diferenca
    permitida e Insumos sem OP mostrar criacao da primeira OP, pois sem OP nao
    existe material recebivel.
- Helper criado/reutilizado: `refreshPedidoTransitionModal(...)`, local a
  `openMovementModal`, executa `reload()`, recalcula `computeViewModel(state)`,
  localiza de novo a transicao no stepper e re-renderiza o mesmo modal.
- Arquivos alterados:
  - `js/screens/pedido-detail-events.js`;
  - `js/screens/pedido-detail-progress.js`;
  - `tests/pedido-detail.smoke.js`;
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`;
  - `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`.
- Testes OK:
  - `node --test tests\pedido-detail.smoke.js` = 160/160;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 39/39;
  - `node --test tests\expedicao-partial-flow.smoke.js` = 12/12;
  - `node --test tests\expedicao-flow.smoke.js` = 8/8;
  - `node --test tests\op-latex-admin.smoke.js` = 55/55;
  - `node --test tests\production-flow-invariants.smoke.js` = 11/11.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem aceitar OP
  real, sem registrar recebimento real, sem finalizar OP real, sem concluir
  pedido real, sem update direto em `ops.status`, sem write paralelo no Pedido,
  sem `git add .`, `supabase/.temp/` fora do commit, producao/origin intocados.
- Validacao visual pendente: abrir Pedido sem OP e clicar a seta
  `Insumos -> Tecelagem`; abrir Pedido com OP Tecelagem aberta e insumos
  recebidos para ver slider/proposta; registrar recebimento controlado somente
  com autorizacao explicita e conferir que o modal atualiza sem fechar.

# Estado pos-fase - Acabamento Expedicao Modal UX Parity R2

- Fase: `RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-MODAL-UX-PARITY-R2`.
- Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
- Branch/HEAD base: `work/app-next`,
  `bef41f0960ea6cd7c21eedeb1099d6a1ae21b7da`; status inicial somente
  `?? supabase/.temp/`; remoto de escrita permitido: `staging/work/app-next`.
- Reabertura: validacao visual do usuario apontou que a fase anterior corrigiu
  o gate tecnico, mas deixou Acabamento -> Expedicao fora do padrao validado de
  Tecelagem -> Acabamento.
- Diagnostico obrigatorio de paridade:
  Tecelagem -> Acabamento abre por `openMovementModal`, usa
  `buildTecelagemTransferForm`, reaproveita `buildEntregaInlineForm` com
  `layout: 'stacked'`, mostra `Produtos a transferir` e `Preencher restante`,
  e grava via `salvarEntregaCima`. Acabamento -> Expedicao abre pelo mesmo
  modal e grava via `liberar_expedicao_latex_parcial`, mas antes mostrava OPs
  relacionadas e historico antes do form e tinha acao solta `Movimentar`.
- Decisoes:
  diferenca de RPC/helper e justificada tecnicamente e foi preservada;
  divergencias de ordem visual, botao ambiguo e card de produtos nao tinham
  justificativa e foram alinhadas; nenhuma duvida de produto bloqueou.
- Correcoes:
  `openMovementModal` renderiza o formulario operacional como acao primaria,
  antes de OPs relacionadas/historico/documentos; `buildRelatedOpsSection`
  usa `Carregar nesta movimentacao` para selecionar outra OP de origem no
  proprio modal; `buildAcabamentoTransferForm` ganhou card `Produtos a
  transferir`, link `Preencher restante`, saldo/movimentado por produto e
  mantem o botao principal `Movimentar para Expedicao`.
- Provas cobertas em teste: OP carregada nao mostra `Movimentar`; OP relacionada
  com saldo mostra acao de carregar; carregar outra OP nao chama RPC; saldo,
  produto e OP de origem mudam no modal; o save posterior chama
  `liberar_expedicao_latex_parcial` com a OP selecionada.
- Testes OK:
  `node --test tests\pedido-detail.smoke.js` 156/156;
  `node --test tests\pedido-detail-linked-ops.smoke.js tests\expedicao-partial-flow.smoke.js tests\expedicao-flow.smoke.js tests\op-latex-admin.smoke.js tests\tec-to-acabamento-flow.smoke.js tests\production-flow-invariants.smoke.js`
  132/132.
- Diagnosticos staging read-only OK:
  `node scripts/staging/production-flow-invariants-diag.mjs`;
  `node scripts/staging/latex-consolidation-diag.mjs`;
  `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem mutacao real
  nao autorizada, sem finalizar OP Latex, sem aceitar OP real, sem concluir
  pedido, sem update direto em `ops.status`, sem write paralelo no Pedido, sem
  `git add .`, `supabase/.temp/` fora do commit, producao/origin intocados.
- Validacao visual pendente: conferir que a seta Acabamento -> Expedicao abre
  modal operacional com form principal primeiro; OP relacionada apenas carrega
  a origem; o save acontece pelo botao principal do formulario.

# Estado pos-fase - Pedido Acabamento Expedicao Modal Move R1

- Fase: `RAVATEX-TAPETES-PEDIDO-ACABAMENTO-EXPEDICAO-MODAL-MOVE-R1`.
- Status: CONCLUIDO. Patch validado localmente, diagnosticos staging read-only
  OK e push staging realizado.
- Branch/HEAD base: `work/app-next`,
  `76195b16d7a1a2bcc3ea849a2ce31724782f2387`; status inicial somente
  `?? supabase/.temp/`; remoto de escrita permitido: `staging/work/app-next`.
- Push staging realizado em `work/app-next`: `76195b1..fce09b1`.
- Requisito confirmado: a seta `Acabamento -> Expedicao` no Pedido Detail
  Admin deve permitir movimentar OP Acabamento/Latex `aberta` ou
  `em_producao` com saldo recebido diretamente no modal, sem exigir finalizar
  OP Latex.
- Causa raiz: o formulario parcial ja existia no modal, mas o chain-state
  bloqueava OP Latex `aberta`; assim `openMovementModal` caia em modo
  historico/read-only. A secao de OPs relacionadas repetia o gate restrito e
  podia renderizar "Nenhuma acao contextual..." ate para a OP carregada.
- Correcoes:
  `js/screens/pedido-chain-state.js` permite `aberta` em
  `acabPodeMovimentar` quando ha saldo liberavel;
  `js/screens/pedido-detail-progress.js` usa a OP indicada por
  `chainState.actions.releaseExpedicao.op`;
  `js/screens/pedido-detail-events.js` ajusta o gate de OPs relacionadas,
  identifica a OP carregada no modal, mostra `Movimentar` para OPs correlatas
  com saldo e adiciona `fillRemaining`/`hasRemaining` ao formulario de
  Acabamento -> Expedicao.
- Contrato canonico: o modal salva apenas via
  `liberar_expedicao_latex_parcial`, com `p_op_latex_id`,
  `p_itens[{ op_item_id, metros }]` e `p_observacao`; apos sucesso recarrega o
  estado e renderiza de novo. Nao houve update/insert/delete paralelo em
  `pedidos`, `pedido_itens`, `ops` ou `expedicoes`.
- Testes OK:
  `node --test tests\pedido-detail.smoke.js` 155/155;
  `node --test tests\pedido-detail-linked-ops.smoke.js tests\expedicao-partial-flow.smoke.js tests\expedicao-flow.smoke.js tests\op-latex-admin.smoke.js tests\tec-to-acabamento-flow.smoke.js tests\production-flow-invariants.smoke.js`
  132/132.
- Diagnosticos staging read-only OK:
  `node scripts/staging/production-flow-invariants-diag.mjs`;
  `node scripts/staging/latex-consolidation-diag.mjs`;
  `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados: `js/screens/pedido-chain-state.js`,
  `js/screens/pedido-detail-progress.js`,
  `js/screens/pedido-detail-events.js`, `tests/pedido-detail.smoke.js`,
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`,
  `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`.
- Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem finalizar
  OP Latex, sem aceitar OP real, sem transferencia real em staging, sem
  concluir pedido, sem alteracao de lifecycle, sem `git add .`,
  `supabase/.temp/` fora do commit, producao/origin intocados.
- Validacao visual recomendada: abrir um Pedido com OP Latex `aberta` e saldo
  recebido, clicar a seta `Acabamento -> Expedicao`, conferir o formulario com
  origem/saldo/produtos pendentes, usar `Transferir restante` apenas para
  preencher os inputs, e salvar com `Movimentar para Expedicao`.

# Estado pos-fase - Pedido Transition Modal Related Ops Actions R2

- Fase: `RAVATEX-TAPETES-PEDIDO-TRANSITION-MODAL-RELATED-OPS-ACTIONS-R2`.
- Status: PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO.
- Branch/HEAD base: `work/app-next`,
  `8cde96d91a525ae80a4106cfaac64090ae501dcd`; status inicial somente
  `?? supabase/.temp/`; remoto de escrita permitido: `staging/work/app-next`.
- Item reaberto: clique em seta de transicao do Pedido Detail Admin deve abrir
  modal de transicao/movimento, nao o hub da etapa. A bolinha/etapa continua
  sendo o ponto de entrada do hub. O erro anterior foi a seta `Aguardar`
  desviar para `openStageDetailModal`, copiando o comportamento da bolinha.
- Correcao em `js/screens/pedido-detail-render.js`: `buildTransferButton`
  chama `handlers.openMovementModal(stage.transfer)` para os conectores/setas
  renderizados. `buildStepper`/bolinhas continuam usando
  `openStageDetailModal(stage, view)`.
- Correcao em `js/screens/pedido-detail-events.js`: `openMovementModal`
  renderiza `OPs relacionadas` dentro do modal de seta, logo apos
  `Pendencias por produto`. A secao correlaciona OPs de Tecelagem,
  Acabamento/Latex e Expedicao conforme a transicao:
  `Insumos>Tecelagem`, `Tecelagem>Acabamento`, `Acabamento>Expedicao` e
  `Expedicao>Entrega`.
- Acoes da secao: `Abrir OP`, `Movimentar` quando ha saldo/etapa aplicavel,
  `Finalizar OP` quando cabivel via handler canonico, e proposta de aceite para
  OP Tecelagem `aberta`. O aceite nao e botao simples: replica a proposta com
  sliders/recalculo da OP real.
- Origem canonica do aceite: `js/screens/op-nova.js` (`buildProposta`) e
  `js/screens/op-recalculo.js` (`aplicarRecalculoOP`). O Pedido reutiliza os
  helpers globais (`recalcularOP`, `consumoPorOrdem`, `maxMetrosItem`,
  `fmtMetros`, `fmtKg`, `rotuloModelo`, `aplicarRecalculoOP`) e nao introduz
  write paralelo direto em `ops`.
- Testes OK:
  `node --check js\screens\pedido-detail-events.js`;
  `node --check js\screens\pedido-detail-render.js`;
  `node --test tests\pedido-detail.smoke.js` 150/150;
  `node --test tests\pedido-detail-linked-ops.smoke.js` 7/7;
  `node --test tests\tec-to-acabamento-flow.smoke.js` 37/37;
  `node --test tests\op-latex-admin.smoke.js` 55/55;
  `node --test tests\expedicao-partial-flow.smoke.js` 12/12;
  `node --test tests\expedicao-flow.smoke.js` 8/8;
  `node --test tests\production-flow-invariants.smoke.js` 11/11.
- Diagnosticos staging read-only OK:
  `node scripts/staging/production-flow-invariants-diag.mjs`;
  `node scripts/staging/latex-consolidation-diag.mjs`;
  `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados: `js/screens/pedido-detail-render.js`,
  `js/screens/pedido-detail-events.js`, `tests/pedido-detail.smoke.js`,
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`,
  `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`.
- Confirmacoes: sem SQL, sem migration, sem dados reais novos, sem aceitar OP
  real, sem finalizar OP real, sem transferencia, sem concluir pedido, sem
  mudanca de lifecycle, sem alteracao Acabamento -> Expedicao, sem write
  paralelo no Pedido, sem `git add .`, `supabase/.temp/` fora do commit,
  producao/origin intocados.
- Validacao visual pendente do usuario: testar Pedido #13 para OP Tecelagem
  aberta/aceite, Pedido #14 para Tecelagem -> Acabamento/movimento e Pedido
  #21 para fluxo apto geral. Esperado: bolinha abre hub; seta `Aguardar` ou
  `Transferir` abre modal de transicao com `OPs relacionadas`; nao deve haver
  copia do hub, botao simples de aceite, mutacao automatica ou erro de console.
- Backlog Admin/Pedido: NAO declarar zerado ate validacao visual do usuario.

# Estado pos-fase - Pedido Stage Hub R2 Real Staging

- Fase: `RAVATEX-TAPETES-PEDIDO-STAGE-HUB-R2-REAL-STAGING`.
- Status: OK. Itens reabertos do hub foram corrigidos e revalidados em
  staging/browser real.
- Branch/HEAD base: `work/app-next`,
  `b99233563667a54abbf34868cdeb35ace23ca29d`; status inicial somente
  `?? supabase/.temp/`; remoto `staging/work/app-next` no mesmo commit.
- Reproducao obrigatoria antes do patch: Pedido #13, etapa Tecelagem. Clique
  em `Ver detalhes da etapa TECELAGEM` quebrava com
  `TypeError: Failed to execute 'appendChild' on 'Node': parameter 1 is not of
  type 'Node'`, stack `js/ui.js:19` ->
  `js/screens/pedido-detail-events.js:1726` ->
  `buildStageDetailBody`.
- Causa raiz: `summary.docBanner` e objeto `{ tone, text }`; o hub passava o
  objeto inteiro para `window.el(...)`, e o DOM real tentava anexar esse
  objeto comum com `appendChild`. Os testes antigos nao pegaram porque o
  harness do modal aceitava filhos invalidos.
- Correcao: `js/screens/pedido-detail-events.js` ganhou `docBannerRow(...)`
  para converter o banner em texto/Node valido. `tests/pedido-detail.smoke.js`
  agora usa harness que rejeita objeto comum em `appendChild` e cobre o shape
  do Pedido #13/Tecelagem/Aguardar.
- Validacao real pos-patch: asset `pedido-detail-events.js?v=20260623-asset1`
  servido bate SHA-256 com o local corrigido. Browser contra Supabase staging
  `ucrjtfswnfdlxwtmxnoo`: Pedido #13 abre hub por bolinha Tecelagem e por seta
  `Aguardar`, sem erro no console/pageerror; modal mostra OP 10/2026, `Abrir
  OP`, `Aceitar OP`, motivo de pendencia e `Sem movimentacao para acabamento
  registrada ainda`.
- Itens fechados nesta R2: `PEDIDO-STAGE-ACTION-HUB-B`,
  `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`,
  `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B`,
  `PEDIDO-STAGE-RELATED-OPS-LINKS-R1`,
  `PEDIDO-STAGE-MODAL-WIDTH-R1` para o hub de etapa.
- Testes OK: `pedido-detail.smoke.js` 148/148,
  `pedido-detail-linked-ops.smoke.js` 7/7, `op-latex-admin.smoke.js` 55/55,
  `tec-to-acabamento-flow.smoke.js` 37/37,
  `expedicao-partial-flow.smoke.js` 12/12, `expedicao-flow.smoke.js` 8/8.
  Diagnosticos staging read-only OK: invariantes, consolidacao Latex e
  expedicao partial.
- Sem SQL, migration, dados reais novos, aceite de OP real, conclusao de
  pedido, transferencia, alteracao Acabamento -> Expedicao, alteracao de
  lifecycle de OP, write paralelo no Pedido ou `git add .`. Producao
  `bhgifjrfagkzubpyqpew` e `origin` continuam intocados.
- Backlog Admin/Pedido: os itens do hub foram zerados nesta R2; o backlog geral
  nao deve ser declarado zerado sem decidir o residuo estatico ja registrado em
  `js/screens/expedicao-admin.js:361`.

# Estado pos-fase - Admin Backlog Visual Closeout A

- Fase: `RAVATEX-TAPETES-ADMIN-BACKLOG-VISUAL-CLOSEOUT-A`.
- Status: BLOQUEADO. Backlog Admin/Pedido NAO zerado em staging real.
- Branch/HEAD: `work/app-next`,
  `57719298dcbd370cb7b1a0ca3ff1365c30ca8fb9`; remoto
  `staging/work/app-next` no mesmo commit; status inicial somente
  `?? supabase/.temp/`.
- Frontend auditado em `http://localhost:8765/` contra Supabase staging
  `ucrjtfswnfdlxwtmxnoo`; producao intocada. Cache mitigado com
  `?audit=...`; `pedido-detail-render.js` servido bate SHA-256 com o local
  e nao contem `disabled: ready ? null`.
- Resultado: Pedido #20 entregue/concluido OK; Pedido #21 apto mostra
  `Concluir pedido` habilitado e sem `disabled`; Pedido #13 quebra o hub de
  etapa Tecelagem/`Aguardar` com
  `TypeError: Failed to execute 'appendChild' on 'Node'` em
  `pedido-detail-events.js:1726` (`tecOps.map(...)` passado como array para
  `window.el(...)`).
- OK visual: `PEDIDO-CONCLUIR-ACTION-R1/R2`,
  `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1`,
  `OP-NOVA-METRAGEM-INPUT-FOCUS-R1`,
  `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1`,
  `LATEX-ADMIN-COMPACT-BUTTONS-R1`.
- Falhou/Reabrir R2: `PEDIDO-STAGE-ACTION-HUB-B`,
  `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`,
  `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B`.
- Parcial/Reabrir junto com hub: `PEDIDO-STAGE-MODAL-WIDTH-R1`,
  `PEDIDO-STAGE-RELATED-OPS-LINKS-R1`.
- Testes obrigatorios OK: `pedido-detail.smoke.js` 147/147,
  `pedido-detail-linked-ops.smoke.js` 7/7, `op-latex-admin.smoke.js` 55/55,
  `tec-to-acabamento-flow.smoke.js` 37/37,
  `expedicao-partial-flow.smoke.js` 12/12. Diagnosticos staging read-only OK:
  invariantes, consolidacao Latex e expedicao partial.
- Observacoes: `js/screens/expedicao-admin.js:361` ainda contem
  `disabled: ready ? null : 'disabled'` fora do Pedido Detail; Pedido #20 nao
  deve mais ser usado como rascunho/apto.
- Arquivos desta fase: `PROJECT_STATE.md`, `AGENT_HANDOFF.md`,
  `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`. Sem SQL, sem
  migration, sem dados reais novos, sem mutacao nao autorizada, sem
  `git add .`; `supabase/.temp/` fora do commit.

# Estado pos-fase - Latex Admin Compact Buttons R1

- Fase: `RAVATEX-TAPETES-LATEX-ADMIN-COMPACT-BUTTONS-R1`.
- Status: OK. Patch UI focado + testes; sem SQL, migration, producao,
  dados reais novos, payload novo, RPC nova ou mudanca de regra de negocio.
- Branch/HEAD base: `work/app-next`,
  `2ff4ab816ef491f1beed76f9e18fc45d2aebc7d5`.
- Validacao inicial:
  - branch correta;
  - HEAD esperado;
  - status inicial somente `?? supabase/.temp/`;
  - remoto `staging` confirmado;
  - `origin` nao usado para escrita.
- Arquivos lidos:
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`;
  - `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`;
  - `js/screens/op-latex-admin.js`;
  - `js/screens/pedido-detail-events.js`;
  - `js/screens/pedido-chain-state.js`;
  - `js/screens/pedido-detail-progress.js`;
  - `tests/op-latex-admin.smoke.js`;
  - `tests/expedicao-partial-flow.smoke.js`;
  - `tests/pedido-detail.smoke.js`.
- Diagnostico e ajustes:
  - `Confirmar entrada / iniciar acabamento` era texto longo e misturava
    explicacao com acao; a funcao real e confirmar recebimento vindo da
    Tecelagem e chamar `alterar_status_op` para `em_producao`.
  - Novo label: `Confirmar`; helper: `Confirma o recebimento do material
    vindo da Tecelagem.`.
  - `Movimentar para Expedicao` chama `liberar_expedicao_latex_parcial` e
    movimenta Acabamento -> Expedicao sem finalizar OP.
  - Novo label: `Movimentar`; helper: `Movimenta a quantidade disponivel do
    Acabamento para Expedicao.`.
  - `Liberar total para expedicao` preserva a RPC legada
    `liberar_expedicao`; novo label: `Liberar total`.
  - `Finalizar OP de latex`/dialogo longo virou `Finalizar OP`, mantendo
    `alterar_status_op` para `concluida`.
  - `Excluir OP de latex`/`Excluir OP de acabamento` virou `Excluir OP`,
    sem mudar handler.
  - `BTN_PRIMARY` recebeu `white-space:nowrap` para evitar quebra de linha.
- Garantias:
  - nao existe etapa obrigatoria `registrar acabamento`;
  - `finalizar acabamento` nao foi introduzido como etapa operacional;
  - Finalizar OP continua separado de movimentar;
  - movimentar para Expedicao nao exige OP terminal;
  - Acabamento -> Expedicao permanece via `liberar_expedicao_latex_parcial`;
  - calculo de saldo, split/consolidacao Latex, Cliente Detail/read model e
    lifecycle de OP nao foram alterados.
- Testes locais OK:
  - `node --check js\screens\op-latex-admin.js`;
  - `node --check tests\op-latex-admin.smoke.js`;
  - `node --check tests\expedicao-partial-flow.smoke.js`;
  - `node --check tests\expedicao-flow.smoke.js`;
  - `node --test tests\op-latex-admin.smoke.js` = 55/55;
  - `node --test tests\expedicao-partial-flow.smoke.js` = 12/12;
  - `node --test tests\pedido-detail.smoke.js` = 145/145;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 37/37;
  - `node --test tests\expedicao-flow.smoke.js` = 8/8;
  - `node --test tests\entrega-writes.smoke.js` = 70/70;
  - `node --test tests\op-latex-split.smoke.js` = 28/28;
  - `node --test tests\production-flow-invariants.smoke.js` = 11/11;
  - `node --test tests\latex-consolidation-schema.smoke.js` = 25/25.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados:
  - `js/screens/op-latex-admin.js`;
  - `tests/op-latex-admin.smoke.js`;
  - `tests/expedicao-partial-flow.smoke.js`;
  - `tests/expedicao-flow.smoke.js`;
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`.
- Arquivo extra justificado: `tests/expedicao-flow.smoke.js` foi atualizado
  porque a suite obrigatoria ainda dependia do texto longo antigo
  `Movimentar para Expedicao`.
- Proximo backlog recomendado: `PEDIDO-STAGE-MODAL-WIDTH-R1`.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, nenhum
  segredo impresso intencionalmente, sem `git add .`, sem reset/rebase/clean/
  stash e `supabase/.temp/` fora do commit.

# Estado pos-fase - Tec To Acabamento Modal Layout R1 Closeout

- Fase: `RAVATEX-TAPETES-TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1-CLOSEOUT`.
- Status: OK. Closeout de patch parcial retomado; executor anterior foi
  interrompido antes de testes, docs, commit e push.
- Branch/HEAD base: `work/app-next`,
  `2b2b4c008681eca153e1d404dab16ca96a9ef09e`.
- Validacao inicial:
  - status local tinha alteracoes em `js/screens/entrega-form.js`,
    `js/screens/pedido-detail-events.js` e
    `tests/tec-to-acabamento-flow.smoke.js`;
  - `supabase/.temp/` estava e continua fora do escopo;
  - nenhum reset, rebase, stash, clean ou `git add .` foi usado.
- Diagnostico do patch parcial:
  - `entrega-form.js` ja havia recebido a variante `layout: 'stacked'`;
  - o default historico ficou preservado como `layout = 'inline'`;
  - `pedido-detail-events.js` passava `layout: 'stacked'` somente em
    `buildTecelagemTransferForm`;
  - os testes ja cobriam opt-in, default e contrato basico;
  - foi necessario corrigir a ordem final do layout empilhado para bater com
    a fase: Nome do item; Data/Destino/Metros; Observacao.
- Arquivo real do modal: `js/screens/entrega-form.js`.
- Componente compartilhado: sim. Estrategia usada: default preservado e novo
  layout apenas opt-in no fluxo Tecelagem -> Acabamento do Pedido.
- Layout anterior do helper compartilhado:
  - bloco Data/Destino/Observacao da entrega;
  - depois linhas de item com Nome, Metros, defeito e Observacao.
- Layout final do modal alvo:
  - Nome do item;
  - Data, Destino e Metros na linha seguinte;
  - Observacao do item depois;
  - Observacao da entrega e split continuam preservados abaixo.
- Largura ajustada: sim, de `width:520px` para
  `width:100%;max-width:520px`, mantendo o maximo em 520px.
- Payload/handler preservado:
  - `buildTecelagemTransferForm` segue chamando `window.salvarEntregaCima`;
  - `payload: form.getPayload()` segue igual;
  - `form.getSplitOption()` segue separado do payload;
  - sem alteracao em validacao de metragem, criacao de entrega, saldo,
    persistencia ou Acabamento -> Expedicao.
- Testes locais OK:
  - `node --check js\screens\entrega-form.js`;
  - `node --check js\screens\pedido-detail-events.js`;
  - `node --check tests\tec-to-acabamento-flow.smoke.js`;
  - `node --test tests\pedido-detail.smoke.js` = 145/145;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 37/37;
  - `node --test tests\op-latex-admin.smoke.js` = 53/53;
  - `node --test tests\expedicao-partial-flow.smoke.js` = 12/12;
  - `node --test tests\expedicao-flow.smoke.js` = 8/8;
  - `node --test tests\entrega-writes.smoke.js` = 70/70;
  - `node --test tests\op-latex-split.smoke.js` = 28/28;
  - `node --test tests\production-flow-invariants.smoke.js` = 11/11.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados finais:
  - `js/screens/entrega-form.js`;
  - `js/screens/pedido-detail-events.js`;
  - `tests/tec-to-acabamento-flow.smoke.js`;
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`.
- Git: commit de fechamento `Reorder tecelagem transfer modal fields`; push
  somente para `staging/work/app-next`.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, nenhum
  segredo impresso intencionalmente, sem SQL, sem migration, sem dados reais
  novos, sem alteracao destrutiva, sem `git add .`, `supabase/.temp/` fora do
  commit.
- Proximo backlog recomendado: `LATEX-ADMIN-COMPACT-BUTTONS-R1`.

# Estado pos-fase - OP Nova Metragem Input Focus R1

- Fase: `RAVATEX-TAPETES-OP-NOVA-METRAGEM-INPUT-FOCUS-R1`.
- Status: OK. Bugfix UI focado + teste de regressao; sem SQL, migration,
  producao, dados novos, lifecycle de OP ou alteracao do fluxo
  Pedido -> OP -> Expedicao.
- Branch/HEAD base: `work/app-next`,
  `f368805fde9ed439c7639d0309ea7a622888a747`.
- Validacao inicial: branch correta, HEAD esperado, status inicial somente
  `?? supabase/.temp/`; remoto `staging` confirmado e `origin` nao usado para
  escrita.
- Diagnostico:
  - `op-nova.js` foi lido; o campo de metros da Nova OP atualiza o resumo
    lateral com `renderRight()` e nao reconstruiu a linha durante o input;
  - `op-nova-writes.js` nao existe no workspace e nao foi recriado;
  - o relato "abertura de pedido, item 1 ja listado" mapeou o bug real para
    `js/screens/pedido-form.js`, no item inline do Novo Pedido admin;
  - causa raiz: o handler `metrosInput.addEventListener('input', ...)`
    chamava `render()` a cada digito, disparando `container.replaceChildren`
    e recriando a tela inteira, inclusive o proprio input.
- Correcao aplicada (`js/screens/pedido-form.js`):
  - adicionado `updateItensSummary()` para atualizar localmente `Metragem
    total`, `Total de itens` e o resumo do card de salvamento;
  - os marcadores `data-pedido-total-metros`,
    `data-pedido-total-itens` e `data-pedido-checkout-summary` permitem
    atualizar os textos sem reconstruir a linha;
  - o handler de metragem agora faz apenas `item.metros = metrosInput.value`
    e `updateItensSummary()`, sem `render()`;
  - nenhum `setTimeout`, refocus bruto ou hack de selection foi usado.
- Comportamento validado:
  - digitacao continua `1 -> 10 -> 100 -> 1000` preserva o mesmo input no DOM;
  - foco/DOM ficam preservados porque o input nao e recriado;
  - valor final `1000` chega ao payload de `pedido_itens.metros`;
  - calculo derivado de metragem total continua atualizando ao vivo;
  - validacoes de modelo/metragem e persistencia do pedido permanecem iguais.
- Arquivo extra justificado: `pedido-form.js`/`tests/pedido-form.smoke.js`
  nao estavam na lista inicial, mas foram o componente real afetado. Pedido
  Detail/hub, OP Nova, OP Persistir, lifecycle de OP, expedicao, split e
  consolidacao Latex nao foram alterados.
- Testes locais OK:
  - `node --check js\screens\pedido-form.js`;
  - `node --check tests\pedido-form.smoke.js`;
  - `node --test tests\pedido-form.smoke.js` = 41/41;
  - `node --test tests\op-nova.smoke.js` = 69/69;
  - `node --test tests\op-persistir.smoke.js` = 69/69;
  - `node --test tests\pedido-detail.smoke.js` = 145/145;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 30/30.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados:
  - `js/screens/pedido-form.js`;
  - `tests/pedido-form.smoke.js`;
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`.
- Proximo backlog recomendado: `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1`.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, nenhum
  segredo impresso intencionalmente, sem SQL, sem migration, sem dados reais
  novos, sem alteracao destrutiva, sem `git add .`, `supabase/.temp/` fora do
  escopo.

# Estado pos-fase - Pedido First OP CTA Placement R1

- Fase: `RAVATEX-TAPETES-PEDIDO-FIRST-OP-CTA-PLACEMENT-R1`.
- Status: OK. Patch em JS + testes + docs; sem SQL, migration, producao,
  dados novos ou write paralelo no Pedido.
- Branch/HEAD base: `work/app-next`,
  `2790cc5f828538bdcf68e3837ac00991721f3185`.
- Validacao inicial: branch correta, HEAD esperado, status inicial somente
  `?? supabase/.temp/`; remoto `staging` confirmado e `origin` nao usado para
  escrita.
- Diagnostico:
  - o estado sem OP ja tinha rota canonica para criar OP:
    `navigateToNovaOp` -> `#/ops/nova?pedido_id=<id>`;
  - o hub contextual da etapa sem OP ja oferecia `Gerar primeira OP`;
  - no bloco principal `OPs vinculadas`, a chamada ficava pouco proeminente
    dentro do card vazio, depois do texto explicativo.
- Implementado (`js/screens/pedido-detail-render.js`):
  - `buildOps` agora calcula `semOps = view.opSummaries.length === 0 &&
    !state.opsLoadError`;
  - o helper `firstOpButton()` renderiza o CTA `Gerar primeira OP` com
    `onclick: handlers.navigateToNovaOp`;
  - o cabecalho do bloco `OPs vinculadas` passou a usar layout flex com o
    titulo a esquerda e o CTA a direita quando `semOps`;
  - o card vazio ficou explicativo: `Nenhuma OP vinculada ainda.` e `Proxima
    acao: gerar a primeira OP de Tecelagem...`;
  - o botao antigo dentro do card vazio foi removido para evitar CTA duplicado.
- Comportamento validado:
  - pedido sem OP mostra exatamente um CTA `Gerar primeira OP` na tela
    principal e delega para o handler canonico;
  - pedido com OP vinculada nao mostra CTA de primeira OP duplicada e segue
    exibindo os cards/acoes existentes, incluindo `Abrir OP`;
  - hub da etapa sem OP permanece como explicacao contextual complementar.
- Reuso canonico preservado: `handlers.navigateToNovaOp` ->
  `navigateToNovaOp()` -> `window.navigate('#/ops/nova?pedido_id=' +
  pedidoId)`.
- Garantias: sem insert/update/delete, sem RPC nova, sem update direto em
  `ops.status`, sem alteracao de lifecycle de OP, stepper, modais,
  expedicao, metragens, split ou consolidacao Latex.
- Testes locais OK:
  - `node --check js\screens\pedido-detail-render.js`;
  - `node --check tests\pedido-detail.smoke.js`;
  - `node --test tests\pedido-detail.smoke.js` = 145/145;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 30/30;
  - `node --test tests\op-latex-admin.smoke.js` = 53/53;
  - `node --test tests\expedicao-partial-flow.smoke.js` = 12/12;
  - `node --test tests\expedicao-flow.smoke.js` = 8/8.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados:
  - `js/screens/pedido-detail-render.js`;
  - `tests/pedido-detail.smoke.js`;
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`.
- Proximo backlog recomendado: `OP-NOVA-METRAGEM-INPUT-FOCUS-R1`; depois
  `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` se a validacao visual pedir ajuste de
  largura/layout do modal de transferencia.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, nenhum
  segredo impresso intencionalmente, sem SQL, sem migration, sem dados reais
  novos, sem alteracao destrutiva, sem `git add .`, `supabase/.temp/` fora do
  escopo.

# Estado pos-fase - Pedido Stage Blocker Explanation R1

- Fase: `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`.
- Status: OK local / push staging bloqueado por autenticacao GitHub. Patch
  leve em JS + testes + docs; sem SQL, migration, producao ou dados novos.
- Branch/HEAD base: `work/app-next`,
  `9d511ab7eb7006d75a1c45bcb2e8603b34b7dfea`.
- Validacao inicial: branch correta, HEAD esperado, status inicial somente
  `?? supabase/.temp/`; remoto `staging` confirmado e `origin` nao usado para
  escrita.
- Diagnostico:
  - bolinhas/etapas ja abriam `openStageDetailModal` e o hub contextual;
  - setas ativas/de historico ja abriam `openMovementModal`;
  - a seta `Aguardar` era visualmente passiva, gerando confusao sobre onde
    ver motivo, OP/expedicao envolvida e proxima acao.
- Regra final:
  - clique em etapa/bolinha: sempre abre o hub contextual da etapa;
  - clique em seta com acao direta ou historico (`Transferir`/`Concluido`):
    abre `openMovementModal(stage.transfer)`;
  - clique em seta bloqueada (`Aguardar`): abre o hub/explicacao da etapa;
  - setas continuam com texto curto; nenhuma explicacao longa entra na seta;
  - explicacoes, metricas e acoes aparecem no hub.
- Comportamento por etapa no hub:
  - Insumos/inicio: pedido sem OP explica o bloqueio e oferece `Gerar
    primeira OP`;
  - Tecelagem: OP aberta explica aceite pendente e oferece `Aceitar OP`;
    saldo disponivel oferece `Transferir`; saldo 0 em producao explica
    "Tecelagem entregue; finalizar OP" e oferece `Finalizar OP`;
  - Acabamento: saldo recebido nao movimentado oferece `Movimentar`; sem
    material recebido, OP ainda nao movivel ou tudo ja movimentado recebem
    motivo curto e proxima etapa; saldo 0 em producao oferece `Finalizar OP`;
  - Expedicao: saldo liberado oferece `Entregar`; sem expedicao liberada
    explica "Nenhuma quantidade movimentada para Expedicao";
  - Entrega: pedido apto oferece `Concluir`; pedido nao apto lista pendencias.
- Reuso canonico preservado: `openMovementModal`, `openTecAcceptanceModal`,
  `finalizarOp`/`alterar_status_op`, `concluirPedido`/
  `concluir_pedido_se_pronto`, `navigateToOp`, `navigateToExpedicao`,
  `navigateToNovaOp`.
- Garantias: sem write paralelo no Pedido, sem update direto em `ops.status`,
  sem finalizacao automatica de OP, sem alteracao do read model Cliente, sem
  alteracao de Acabamento -> Expedicao direta, sem mexer em split/
  consolidacao Latex.
- Testes locais obrigatorios OK:
  - `node --test tests\pedido-detail.smoke.js` = 142/142;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 30/30;
  - `node --test tests\op-latex-admin.smoke.js` = 53/53;
  - `node --test tests\expedicao-partial-flow.smoke.js` = 12/12;
  - `node --test tests\expedicao-flow.smoke.js` = 8/8;
  - `node --test tests\entrega-writes.smoke.js` = 70/70;
  - `node --test tests\op-latex-split.smoke.js` = 28/28;
  - total local: 350/350 OK.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados:
  - `js/screens/pedido-detail-render.js`;
  - `js/screens/pedido-detail-events.js`;
  - `tests/pedido-detail.smoke.js`;
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`.
- Proximo backlog recomendado: `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` (mantido
  fora desta fase), depois `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` se a validacao
  visual pedir ajuste de largura/layout do modal de transferencia.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, nenhum
  segredo impresso intencionalmente, sem SQL, sem migration, sem dados reais
  novos, sem alteracao destrutiva, sem `git add .`, `supabase/.temp/` fora do
  escopo.
- Commit local criado; push para `staging` tentou 3 vezes, travou no
  gerenciador de credenciais e a tentativa controlada sem prompt falhou por
  autenticacao ausente para GitHub.

# Estado pos-fase - Pedido Stage Action Hub B

- Fase: `RAVATEX-TAPETES-PEDIDO-STAGE-ACTION-HUB-B`.
- Status: OK. Patch em JS + testes + docs; sem SQL/migration/producao/dados
  novos.
- Branch/HEAD base: `work/app-next`,
  `a3936981783f7d673af3fb053dc08f3a67044da2`.
- Premissas registradas: (1) a tela do Pedido opera o fluxo comum sem obrigar
  a procurar a OP; (2) o modal de etapa e o hub contextual; (3) setas com
  texto curto; (4) explicacoes longas no modal/painel, nao na seta; (5) acoes
  reutilizam handlers/RPCs canonicos; (6) sem write paralelo no Pedido.
- Diagnostico: dois modais existem — o de etapa (bolinha do stepper):
  `openStageDetailModal` -> `buildStageDetailBody` (read-only por contrato
  `stepper-modals-B`); e o de seta: `openMovementModal` (forms de
  transferencia). O hub foi construido no modal de etapa DELEGANDO a handlers
  canonicos externos, mantendo o corpo do modal sem write/RPC inline.
- Implementado (`pedido-detail-events.js`):
  - novo handler `finalizarOp(op)`: confirmDialog +
    `alterar_status_op(..., 'concluida')` com guard de erro; sem update
    direto em `ops.status`; sem auto-finalizacao; exposto em handlers.
  - `buildStageDetailBody` ganhou acoes contextuais por OP/expedicao:
    - Insumos: "Gerar primeira OP" (sem OP) + "Aceitar OP" (Tec aberta);
    - Tecelagem: Abrir OP / Aceitar OP / Transferir (openMovementModal) /
      Finalizar OP (finalizarOp);
    - Acabamento: rotulos Recebido/Movimentado/Disponivel/Entregue; Abrir OP /
      Movimentar (openMovementModal, sem exigir terminal) / Finalizar OP;
    - Expedicao: Abrir Expedicao / Entregar (openMovementModal);
    - Entrega: "Concluir" quando apto (concluirPedido) ou lista pendencias.
  - motivos de bloqueio em texto auxiliar curto (reasonRow) no modal.
- Reuso canonico (sem duplicar logica de OP, sem write paralelo):
  `openTecAcceptanceModal`, `openMovementModal`, `finalizarOp`(alterar_status_op),
  `concluirPedido`(concluir_pedido_se_pronto), `navigateToOp/Expedicao/NovaOp`.
- Nao alterado: `openMovementModal`, telas de OP, `expedicao-admin.js`,
  fluxo Acabamento->Expedicao, consolidacao/split Latex, read model Cliente.
- Testes: 384/384 OK (10 novos em `pedido-detail.smoke.js`, estaticos +
  runtime que renderiza o corpo do modal e exercita as acoes; o contrato
  read-only-of-writes do corpo do modal permanece).
- Diagnosticos staging read-only OK: invariantes, consolidacao Latex,
  expedicao-partial (VEREDICTO OK; Pedido #20 rascunho apto).
- Impacto Pedido #20: sem write; no hub, a etapa Entrega ofereceria "Concluir"
  (apto) e a etapa Acabamento mostraria disponivel 0 / OP concluida.
- Nao tocado: producao, `origin` p/ escrita, db, read model Cliente.
- Proximo backlog: `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` (completo),
  `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1`.

# Estado pos-fase - Pedido Concluir Action R1

- Fase: `RAVATEX-TAPETES-PEDIDO-CONCLUIR-ACTION-R1`.
- Status: OK. Patch pequeno em JS + testes + docs; sem SQL/migration/
  producao/dados novos.
- Branch/HEAD base: `work/app-next`,
  `69b8e8c7e6a121ae0690451211b6eccb23b303ee`.
- Diagnostico (harness runtime + SELECTs read-only staging):
  1. Botao "Concluir pedido" existe no render (`buildConclusaoPedido` em
     `pedido-detail-render.js`, sempre renderizado);
  2. Handler `handlers.concluirPedido` registrado (`pedido-detail-events.js`,
     exportado) e ligado ao `onclick`; wiring correto;
  3. RPC `concluir_pedido_se_pronto(UUID)` e chamada com `p_pedido_id`;
  4. Pedido #20 (id ad988da1-df36-4441-afef-16d9172f5c01) esta APTO: OP
     Tecelagem 18/2026 concluida, OP Latex 11/2026 concluida, expedicao #3
     concluida (1000/1000), mas `pedidos.status='rascunho'`,
     `pedido_eventos` vazio -> botao habilitado (pronto=true);
  5. Botao habilitado/desabilitado corretamente conforme pendencias.
- Contrato RPC (db/23) confirmado e correto; NAO alterado (sem migration):
  admin-only, valida OPs terminais + expedicoes concluidas, grava
  `pedidos.status='entregue'` + `status_cliente_visual` + `pedido_eventos`,
  retorna JSONB {ok,...}/{ok:false,erro,pendencias}; nao bloqueia
  'rascunho', so 'cancelado'.
- Causa raiz: erro silencioso. `concluirPedido` nao tinha guard na RPC nem
  no pos-sucesso; se a RPC lancasse (rede/sessao) ou `reload()/render()`
  lancasse apos a conclusao, a rejeicao ficava sem tratamento (o onclick
  nao faz await/catch): sem toast e botao preso em "Concluindo...".
  Render-crash pos-sucesso podia induzir novo clique e duplicar
  `pedido_eventos`.
- Correcao (`pedido-detail-events.js`): try/catch na RPC com erro real
  acionavel + restauro do botao; pendencias reais preservadas; pos-sucesso
  isolado em try/catch (toast de sucesso, e em falha de render avisa
  "recarregue" e restaura o botao, sem parecer falha e sem novo clique).
  Sem catch generico que engula a mensagem.
- Mensagem de pendencia (`pedido-detail-progress.js`): quando
  `emAcabamento > 0`, adiciona "Ha saldo em acabamento (X) nao movimentado
  para expedicao" (reaproveita o calculo do fluxo Acabamento->Expedicao;
  nao afeta pedido apto).
- Comportamento apos correcao:
  - Pedido apto: botao habilitado -> chama RPC -> sucesso -> reload/render.
  - RPC com pendencias: toast de erro com a lista, botao restaurado.
  - RPC que lanca: toast de erro real, botao restaurado (nao morto).
  - Falha de render pos-sucesso: toast sucesso + info "recarregue", botao
    restaurado, sem duplicar evento.
  - Nao apto: botao desabilitado com pendencias explicadas.
- Testes: 374/374 OK (7 novos runtime em `pedido-detail.smoke.js`).
- Diagnosticos staging read-only OK: invariantes, consolidacao Latex e
  expedicao-partial-flow (contrato Acabamento->Expedicao intacto).
- Nao tocado: producao, `origin` p/ escrita, db/23, read model Cliente,
  fluxo Acabamento->Expedicao.
- Proximo backlog: `PEDIDO-STAGE-ACTION-HUB-B`,
  `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` (completo),
  `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1`.

# Estado pos-fase - Admin Flow Backlog Sync A

- Fase: `RAVATEX-TAPETES-ADMIN-FLOW-BACKLOG-SYNC-A`.
- Status: OK. Docs-only, read-only patch documental.
- Branch/HEAD base recebido: `work/app-next`,
  `153a45ea863bc5183f333cd2c4b795bd1bd8ee8b`.
- Objetivo: consolidar observacoes de validacao operacional do fluxo
  Admin como itens hierarquizados de backlog, sem implementar correcoes.
- Backlog Admin registrado em
  `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md` §9 com 10 itens:
  - `PEDIDO-CONCLUIR-ACTION-R1` (P1) — CTA explicito para concluir Pedido.
  - `PEDIDO-STAGE-ACTION-HUB-B` (P1) — hub central de acoes por etapa.
  - `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1` (P2, absorvido) — explicacao de
    bloqueios no hub, nao nas setas.
  - `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` (P1) — aceite/ajuste da OP
    Tecelagem inline no Pedido Detail.
  - `OP-NOVA-METRAGEM-INPUT-FOCUS-R1` (P2) — autofoco no campo metragem.
  - `PEDIDO-FIRST-OP-CTA-PLACEMENT-R1` (P1) — CTA "Criar OP" visivel
    quando Pedido sem OP.
  - `TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1` (P2) — layout responsivo no
    modal Tecelagem -> Acabamento.
  - `PEDIDO-STAGE-MODAL-WIDTH-R1` (P2) — largura minima de 640px nos
    modais de transicao.
  - `PEDIDO-STAGE-RELATED-OPS-LINKS-R1` (P2, absorvido) — links para OPs
    relacionadas no hub.
  - `LATEX-ADMIN-COMPACT-BUTTONS-R1` (P2) — compactar botoes/cards na
    tela de OP Latex Admin.
- `PEDIDO-STAGE-ACTION-HUB-B` (item 2) absorve:
  - `PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`
  - `PEDIDO-STAGE-RELATED-OPS-LINKS-R1`
  - parte de `TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B` (exposicao do CTA)
  - parte de `PEDIDO-STAGE-MODAL-WIDTH-R1` (hub usa painel, nao modal)
- Sequencia recomendada:
  1. PEDIDO-CONCLUIR-ACTION-R1
  2. PEDIDO-STAGE-ACTION-HUB-B
  3. TEC-ACCEPTANCE-IN-PEDIDO-MODAL-B
  4. OP-NOVA-METRAGEM-INPUT-FOCUS-R1
  5. PEDIDO-FIRST-OP-CTA-PLACEMENT-R1
  6. TEC-TO-ACABAMENTO-MODAL-LAYOUT-R1
  7. PEDIDO-STAGE-MODAL-WIDTH-R1
  8. LATEX-ADMIN-COMPACT-BUTTONS-R1
- Relacao com backlog de producao (§2 do mesmo arquivo):
  - §9 e complementar a §2. Itens de §2 ja implementados: A, C, D, E,
    F, G, H. Itens sobrepostos: §2.D ≈ §9.3, §2.B ≈ §9.2.
- Arquivos alterados nesta fase:
  - `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`
  - `PROJECT_STATE.md`
  - `AGENT_HANDOFF.md`
- Nao tocado: JS, testes, SQL, migration, producao
  `bhgifjrfagkzubpyqpew`, `origin/main`, `supabase/.temp/`.
- Push: staging `work/app-next`.
- Proximo passo: aguardar autorizacao do arquiteto para iniciar
  implementacao pelo item 1 (`PEDIDO-CONCLUIR-ACTION-R1`).

# Estado pos-fase - Acabamento Expedicao Flow Coherence C

- Fase: `RAVATEX-TAPETES-ACABAMENTO-EXPEDICAO-FLOW-COHERENCE-C`.
- Status: OK em staging.
- Branch/HEAD base recebido: `work/app-next`,
  `4fb655d19fb5c0e3a53951f0e4bec676ece8268e`.
- Premissa (decidida, nao aberta): Acabamento/Latex em paridade com
  Tecelagem; parcial e movimento/rastro; a OP continua aberta enquanto ha
  saldo; movimentar parcial NAO finaliza a OP; finalizar a OP e
  terminalidade do total; NAO existe etapa intermediaria obrigatoria
  "registrar acabamento"; o movimento Acabamento -> Expedicao e a propria
  declaracao de que a quantidade ficou acabada/liberada.
- Causa raiz: a db/31 (CONTRACT-B) calculava "acabado" liberavel a partir
  de `entregas.etapa='latex'` (etapa que so nasce no portal do fornecedor,
  ausente no fluxo admin), entao o saldo liberavel ficava 0 e a expedicao
  travava mesmo com material recebido da Tecelagem.
- Contrato depois:
  - recebido_no_acabamento = SUM(entrega_itens das entregas
    Tecelagem->Acabamento etapa='cima' vinculadas por op_latex_entregas,
    por modelo -> op_item da OP Latex) (== op_itens acumulados);
  - ja_movimentado = SUM(expedicao_itens.metros_liberados) por
    op_latex_id + op_item_id;
  - disponivel = saldo_em_acabamento = recebido - ja_movimentado.
- Migration criada e aplicada SOMENTE em staging `ucrjtfswnfdlxwtmxnoo`
  (producao `bhgifjrfagkzubpyqpew` intocada):
  `db/32_acabamento_expedicao_direct_movement.sql`. Aplicada via `pg`
  client com guarda anti-producao; transacao BEGIN/COMMIT concluida.
  Sobrescreve `consultar_saldo_expedicao_latex(BIGINT)` (retorna
  recebido/liberado/disponivel/entregue/saldo_em_acabamento totais e por
  item) e `liberar_expedicao_latex_parcial(BIGINT, JSONB, TEXT)` (guarda
  por recebido - ja_movimentado; aceita em_producao/concluida/finalizada;
  nao altera ops.status; cria/reusa expedicao; soma metros_liberados).
  Cria o indice `entrega_itens_entrega_idx`.
- RPC legada `liberar_expedicao(BIGINT)` (db/23) preservada como atalho de
  liberacao total terminal.
- Frontend:
  - `op-latex-admin.js`: resumo canonico (Recebido da Tecelagem / Ja
    movimentado para Expedicao / Disponivel para movimentar / Entregue ao
    Cliente / Saldo em Acabamento); CTA "Movimentar para Expedicao";
    "Finalizar OP" separado; removida a nocao de "registrar acabamento"
    ("Novo recebimento"); item table Recebido/Movimentado/Disponivel/
    Entregue; fallback para op_itens quando a RPC nao traz os novos campos.
  - `pedido-chain-state.js`: `acabLiberavel`/`acabLiberavelSummary` por
    recebido(op_itens) - movimentado, so para OP nao-aberta.
  - `pedido-detail-progress.js`: acab `done` = movido para expedicao;
    em_acabamento = recebido - movimentado; pronto_expedicao = saldo da
    expedicao (movimentado - entregue); por item usa liberado/entregue de
    expedicao_itens; fallback de rateio por op_itens (sem etapa=latex).
  - `pedido-detail-events.js`: modal Acabamento -> Expedicao e as
    metricas/tabela da transicao usam recebido - liberado; textos/CTA de
    "movimentar".
  - `expedicao-admin.js`: sem alteracao (ja limita entrega a liberado).
- Pedido #20 (id ad988da1-df36-4441-afef-16d9172f5c01): OP Acabamento
  11/2026 (id 30) em_producao; staging pos-fix confirma recebido=1000,
  movimentado=0, disponivel=1000, expedicao=nenhuma.
- Testes locais obrigatorios: 393/393 OK.
- Diagnosticos staging: `production-flow-invariants-diag` OK,
  `latex-consolidation-diag` OK (0 duplicidade, split 1 legitimo),
  `expedicao-partial-flow-diag` reescrito OK (4 OPs em_producao com saldo
  recebido movimentavel; invariantes de quantidade OK; catalogo confirma as
  2 RPCs e `entrega_itens_entrega_idx`).
- Backlog mantido:
  `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`.
- Nao tocado: producao, `origin` para escrita, db/23/db/25-db/29,
  read model Cliente, split/default Latex.

# Estado pos-fase - Acabamento Partial Expedition Contract B

- Fase: `RAVATEX-TAPETES-ACABAMENTO-PARTIAL-EXPEDITION-CONTRACT-B`.
- Status: OK em staging.
- Branch/HEAD base recebido: `work/app-next`,
  `b65f8d5e63603928c46080dc6c9b132087551657`.
- Esta fase resolve o bloqueio documentado na fase anterior
  `RAVATEX-TAPETES-ACABAMENTO-PARTIAL-EXPEDITION-PARITY-A-B`.
- Causa raiz: o backend canonico de Expedicao era somente a RPC legada
  `liberar_expedicao(BIGINT)`, que exige OP Latex `finalizada` ou
  `concluida`; UI de Acabamento e matriz do Pedido repetiam essa regra,
  impedindo liberar quantidade ja acabada enquanto a OP Latex seguia em
  `em_producao`.
- Fonte canonica adotada:
  - acabado/liberavel: `entregas.etapa='latex'` +
    `entrega_itens` sem defeito, por `op_item_id`;
  - ja liberado: `expedicao_itens.metros_liberados` somado por
    `expedicoes.op_latex_id` + `op_item_id`;
  - saldo: acabado acumulado menos liberado acumulado.
- Migration aplicada somente em staging `ucrjtfswnfdlxwtmxnoo`:
  `db/31_acabamento_partial_expedition_flow.sql`.
  Metodo: `npx.cmd supabase --workdir supabase db query --linked --file
  D:\OneDrive\Programacao\Ravatex\controle-tapetes\db\31_acabamento_partial_expedition_flow.sql`
  apos `supabase link --project-ref ucrjtfswnfdlxwtmxnoo`.
  Producao `bhgifjrfagkzubpyqpew` intocada.
- DB/31 cria:
  - indices `entrega_itens_op_item_idx` e `expedicao_itens_op_item_idx`;
  - RPC read-only `consultar_saldo_expedicao_latex(BIGINT)`;
  - RPC write admin-only `liberar_expedicao_latex_parcial(BIGINT, JSONB, TEXT)`.
- Contrato da RPC parcial:
  - aceita OP Latex `em_producao`, `concluida` ou `finalizada`;
  - valida item pertencente a OP e quantidade maior que zero;
  - bloqueia `metros` acima do saldo acabado disponivel;
  - trava OP, itens, movimentos de acabamento e itens de expedicao;
  - cria ou reusa `expedicoes`, soma em `expedicao_itens`, recalcula
    status da expedicao;
  - nao atualiza `public.ops` e nao finaliza OP automaticamente.
- Frontend:
  - `js/screens/op-latex-admin.js`: consulta saldo por RPC, mostra
    Acabado / Ja liberado / Disponivel, libera parcial por item e mantem
    o botao de finalizacao separado; fluxo legado total segue apenas para
    OP terminal sem saldo parcial;
  - `js/screens/pedido-chain-state.js`: etapa Expedicao passa a enxergar
    saldo acabado liberavel;
  - `js/screens/pedido-detail-progress.js`: progresso usa acabado menos
    liberado, sem exigir finalizacao da OP para o saldo parcial;
  - `js/screens/pedido-detail-events.js`: modal Acabamento -> Expedicao
    chama `liberar_expedicao_latex_parcial` com validacao local por
    saldo.
- Diagnostico staging:
  - `production-flow-invariants-diag` OK;
  - `latex-consolidation-diag` OK;
  - `expedicao-partial-flow-diag` OK;
  - catalogo remoto confirmou as 2 RPCs e os 2 indices da DB/31.
- Estado real observado em staging:
  - Pedido #19 segue explicavel: OP Latex 9/2026 `em_producao` e OP
    Latex 10/2026 `concluida`, sem movimento `entregas.etapa='latex'` e
    sem expedicao; portanto nao ha saldo parcial atual para liberar;
  - staging nao possui candidato atual de OP `em_producao` com saldo
    acabado; o contrato foi aplicado e validado por RPC/read model;
  - 3 itens de expedicao antiga foram classificados como fluxo terminal
    legado DB/23, sem movimento Latex, e nao como falha parcial.
- Testes locais obrigatorios: 391/391 OK nas suites
  `expedicao-partial-flow`, `op-latex-admin`, `expedicao-flow`,
  `pedido-detail`, `pedido-detail-linked-ops`, `tec-to-acabamento-flow`,
  `entrega-writes`, `op-latex-split`, `cliente-pedido-summary-readmodel`,
  `production-flow-invariants`, `production-flow-numbering-schema` e
  `latex-consolidation-schema`.
- Preservado: `liberar_expedicao` legado, db/25-db/29, split/default
  Latex, read model Cliente, `origin`, producao e dados reais de negocio.
- Backlog mantido:
  `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`.

# Estado pos-fase - Acabamento Partial Expedition Parity A-B

- Fase: `RAVATEX-TAPETES-ACABAMENTO-PARTIAL-EXPEDITION-PARITY-A-B`.
- Status: bloqueado para patch funcional nesta fase.
- Premissa registrada: Acabamento/Latex deve ter paridade conceitual com
  Tecelagem; OP e unidade produtiva, parcial e movimento/rastro, e
  finalizacao de OP e terminalidade do total.
- Classificacao principal: caso 2 - RPC exige OP concluida/finalizada.
- Evidencia:
  - `db/23_expedicao_entrega_flow.sql` e a definicao real em staging de
    `public.liberar_expedicao(BIGINT)` contem o gate
    `v_op.status NOT IN ('finalizada', 'concluida')`;
  - a RPC retorna "Finalize o acabamento antes de liberar expedicao" para
    OP Latex fora de status terminal;
  - `js/screens/op-latex-admin.js` replica a regra no card de Expedicao
    (`statusOk = finalizada || concluida`);
  - `js/screens/pedido-chain-state.js` habilita `releaseExpedicao` somente
    quando `acabFinished && !hasExpedicao`;
  - `js/screens/pedido-detail-events.js` chama a mesma RPC canonica, sem
    write alternativo.
- Dados staging somente leitura:
  - pedido analisado: #19
    `ecebc55a-03cc-486f-9b1d-dc63995894d1`;
  - OP Latex 9/2026 id `27`: `em_producao`, previsto 100,00 m, sem
    recebimento Latex e sem expedicao;
  - OP Latex 10/2026 id `28`: `concluida`, previsto 5000,00 m, sem
    recebimento Latex e sem expedicao;
  - no staging inteiro, OPs Latex em producao tambem nao possuem movimentos
    `entregas.etapa='latex'` que comprovem quantidade acabada parcial.
- Diagnostico de contrato: a quantidade liberada atual so existe depois da
  criacao de `expedicao_itens.metros_liberados`, e a RPC atual popula esse
  campo com o total de `op_itens`, nao com quantidade acabada parcial.
- Decisao: nao aplicar patch JS. Liberar o CTA em UI sem mudar a RPC
  continuaria falhando e poderia sugerir uma capacidade que o backend ainda
  nao tem.
- Proxima fase recomendada: criar fase de migration/RPC para liberacao
  parcial de Acabamento -> Expedicao, definindo fonte de quantidade
  acabada/liberavel por `entregas`/`entrega_itens` etapa `latex`,
  idempotencia por OP/item, saldo ja liberado em `expedicao_itens` e guard
  transacional contra excesso.
- Backlog registrado: `RAVATEX-TAPETES-PEDIDO-STAGE-BLOCKER-EXPLANATION-R1`.
  Manter texto de seta curto ("Aguarde" ou "Aguardando") e mostrar a
  explicacao em tooltip, modal, popover, painel ou lista auxiliar.
- Sem SQL mutavel, sem migration, sem dados reais novos, sem producao, sem
  origin e sem mudancas em Cliente/read model/Latex default/split.

# Estado pos-fase - Admin Tecelagem Finalize CTA R1

- Fase: `RAVATEX-TAPETES-ADMIN-TEC-FINALIZE-CTA-R1`.
- Objetivo: diagnosticar e corrigir a baixa visibilidade da acao de
  finalizacao formal da OP Tecelagem no Admin.
- Branch/HEAD base: `work/app-next`,
  `a46d8530aa2e46730edb11f197aa7d96964e898a`.
- Diagnostico staging somente leitura:
  - pedido mais recente analisado: #19
    `ecebc55a-03cc-486f-9b1d-dc63995894d1`, status `rascunho`;
  - OP Tecelagem: id `24`, OP `17/2026`, status `em_producao`;
  - item ajustado: 5100,00 m; entregas da OP: 100,00 m + 5000,00 m;
  - saldo produtivo: zero;
  - eventos: havia `aberta -> em_producao`, sem evento de finalizacao.
- Classificacao: caso 2. A OP estava com producao totalmente entregue e
  pendia apenas da conclusao formal.
- Causa raiz: UX P1. O fluxo tecnico estava correto (`alterar_status_op`
  para `concluida`, sem update direto em `ops`), mas o botao aparecia
  como acao secundaria generica `Concluir` no cabecalho.
- Patch:
  - `js/screens/op-tecelagem-producao-admin.js`: CTA habilitado passou a
    usar estilo destacado e rotulo `Finalizar OP Tecelagem`; a condicao
    continua `totalAjustado > 0 && saldo <= 0`;
  - `tests/tec-to-acabamento-flow.smoke.js`: teste protege saldo zerado,
    rotulo explicito, estilo destacado e chamada a `finalizarTecelagem`.
- Sem SQL, sem migration, sem producao, sem criacao/alteracao de dados
  reais e sem mudancas em Cliente/read model/Latex/default/split.

# Estado pos-fase - Cliente Order Summary Readmodel A-B

- Fase: `RAVATEX-TAPETES-CLIENTE-ORDER-SUMMARY-READMODEL-A-B`.
- Objetivo: resolver o P1 `CLIENTE-INTERNAL-CHAIN-READ-A`, impedindo
  que o detalhe do pedido no Portal Cliente leia diretamente tabelas
  operacionais internas.
- Branch/HEAD base: `work/app-next`,
  `2a0f7c9011d41b409e475ab8231aa6b9ac0328ea`.
- Causa raiz: `js/screens/cliente-pedido-detail.js` derivava a cadeia do
  pedido no frontend via `lotes`, `ops`, `op_itens`,
  `ordens_compra_fio`, `entrega_itens`, `entregas`, `expedicoes` e
  `expedicao_itens`. Isso expunha acoplamento operacional ao Cliente e
  contrariava a regra de evolucao simplificada do plano Pedido-OP.
- Camada escolhida: migration nova
  `db/30_cliente_pedido_summary_readmodel.sql`, ainda nao aplicada em
  Supabase. A RPC `public.cliente_pedido_summary(p_pedido_id UUID)`
  retorna JSONB publico, `SECURITY DEFINER`, `STABLE`,
  `search_path = public`, autorizada por admin ou cliente dono e com
  `GRANT EXECUTE` apenas para `authenticated`.
- Payload publico: `pedido`, `itens`, `parciais`, `timeline`,
  `entregas`, `pendencias`, `etapas`, `chain_state`,
  `status_label`, `mensagem` e `progresso_percentual`. Itens usam nomes
  (`modelo`, `cor_1`, `cor_2`) e nao IDs de catalogo; parciais e eventos
  filtram `visivel_cliente IS TRUE`.
- Campos internos proibidos validados como ausentes do payload:
  `op_id`, `op_numero`, `lote_id`, `fornecedor_id`,
  `fornecedor_nome`, `ordem_compra_id`, `romaneio`, `nf`, `custo`,
  `margem`, `motivo_separacao`, `origem_op_id`,
  `destino_fornecedor_id`, `modelo_id`, `cor_1_id`, `cor_2_id`,
  `expedicao_id`.
- Frontend:
  - `js/screens/cliente-pedido-detail.js` chama somente
    `supa.rpc('cliente_pedido_summary', { p_pedido_id })`; removeu
    `carregarCadeiaCliente` e nao tem mais `.from(...)` direto.
  - `js/screens/cliente-pedido-tracking.js` prioriza a mensagem publica
    de `chain_state.mensagem` no banner.
  - `js/screens/cliente-dashboard.js` ja estava seguro e nao foi
    alterado.
  - Admin/Pedido Detail ficou fora do escopo e nao foi alterado.
- Testes locais:
  - `cliente-pedido-detail`, `cliente-pedido-tracking`,
    `cliente-tracking-steps`, `cliente-tracking-schema`,
    `pedido-detail`, `pedido-detail-linked-ops`,
    `cliente-pedido-summary-readmodel`, `cliente-pedido-events` =
    265/265 OK.
  - `production-flow-invariants` + `latex-consolidation-schema` =
    36/36 OK.
- Diagnosticos staging read-only: OPs totais 25; Tecelagem 17; Latex 8;
  Latex default 7; split legitimo 1; duplicatas default 0; orfas 0;
  `op_latex_entregas` com 11 entregas e 0 em multiplas OPs; colisoes
  `tipo+numero+ano` 0; high-water Latex 8/8 e Tecelagem 17/17.
- Nao tocado: producao `bhgifjrfagkzubpyqpew`, `origin` para escrita,
  aplicacao de SQL em staging/producao, dados reais
  OP/pedido/entrega/expedicao, cleanup destrutivo.
- Residual permitido: `?? supabase/.temp/` fora do commit.
- Proximo P1 recomendado: `CLIENTE-ORDER-SUMMARY-READMODEL-APPLY-STAGING-A`
  - aplicar `db/30` em staging, validar o Portal Cliente real, e so entao
  discutir qualquer caminho para producao.

# Estado pos-fase - Latex Lifecycle Canonical A-B

- Fase: `RAVATEX-TAPETES-LATEX-LIFECYCLE-CANONICAL-A-B`.
- Objetivo: alinhar a finalizacao da OP Latex/Acabamento ao contrato
  canonico de lifecycle/status/evento ja validado na Tecelagem.
- Branch/HEAD base: `work/app-next`,
  `d0f7fb2a9e9ea69c3e60286d3a41d0bea8d95ff4`.
- Contrato encontrado:
  - `alterar_status_op(BIGINT, TEXT, TEXT)` existe em `db/21`;
  - e admin-only (`is_admin()`), `SECURITY DEFINER`;
  - aceita `em_producao -> concluida`;
  - `concluida` preenche `finalizada_em` no backend;
  - `trg_op_evento` registra `status_alterado` em `op_eventos`;
  - `finalizada` continua legado/compatibilidade.
- Causa raiz: `op-latex-admin.js` ainda fazia update direto em
  `ops.status='finalizada'` e `finalizada_em`, divergindo da
  terminalidade canonica usada em Tecelagem e deixando evento/auditoria
  dependentes de um fluxo legado.
- Patch aplicado:
  - `js/screens/op-latex-admin.js`: `finalizar` agora chama
    `supa.rpc('alterar_status_op', { p_op_id, p_novo_status:
    'concluida', p_observacao: 'Finalizacao da OP Latex pelo painel
    administrativo' })`; exibe erro real da RPC; recarrega no sucesso;
    sem update direto em `ops.status`; sem evento manual.
  - `tests/op-latex-admin.smoke.js`: cobre finalizacao por RPC canonica,
    ausencia de update direto em `ops`, preservacao de leitura legada e
    liberacao de expedicao tanto para `finalizada` quanto para `concluida`.
  - `tests/pedido-detail.smoke.js`: cobre `metrics.acabamento.terminal`,
    `adminStepper.acabamento=done` e `releaseExpedicao` para `concluida`
    canonico e `finalizada` legado.
- Preservado: `gerar_op_latex`, `gerar_op_latex_split`, regra default de
  consolidacao Latex, split opt-in, `liberar_expedicao`,
  `registrar_entrega_expedicao`, documentos placeholder e botao Pausar.
- Testes:
  - baseline pre-patch obrigatorio: 343/343 OK;
  - pos-patch obrigatorio: `op-latex-admin`, `op-latex-split`,
    `pedido-detail-linked-ops`, `tec-to-acabamento-flow`, `pedido-detail`,
    `entrega-writes`, `production-flow-invariants`,
    `latex-consolidation-schema` = 346/346 OK.
- Diagnosticos staging read-only:
  - OPs totais 25; Tecelagem 17; Latex 8;
  - Latex default 7; split legitimo 1;
  - duplicatas default 0; orfas 0;
  - `op_latex_entregas` N:1: 11 entregas, 0 em multiplas OPs;
  - colisoes `tipo+numero+ano` 0;
  - high-water Latex 8/8 e Tecelagem 17/17;
  - staging ainda tem OPs Latex antigas em `finalizada`, preservadas.
- Nao tocado: producao `bhgifjrfagkzubpyqpew`, `origin` para escrita,
  SQL, migration, db/25-db/29, OP real, split real, cleanup destrutivo.
- Residual permitido: `?? supabase/.temp/` fora do commit.
- Proximo P1 recomendado: `EXPEDICAO-ENTREGA-LIFECYCLE-AUDIT-A` -
  auditar Expedicao/Entrega para status/eventos canonicos e literais
  remanescentes depois que Tecelagem e Latex ficaram alinhados.

# Estado pos-fase - Tec Stage Finalization A-B

- Fase: `RAVATEX-TAPETES-TEC-STAGE-FINALIZATION-A-B`.
- Objetivo: resolver a pendencia P1 de finalizacao explicita da OP
  Tecelagem sem criar fluxo paralelo, sem schema novo e sem migration.
- Branch/HEAD base: `work/app-next`,
  `51b0e03d7a6d5aaaa05254f4ed2edfc99e76153f`.
- Contrato encontrado:
  - `alterar_status_op(BIGINT, TEXT, TEXT)` ja existe em `db/21`;
  - e admin-only (`is_admin()`), `SECURITY DEFINER`;
  - aceita `em_producao -> concluida`;
  - `concluida` preenche `finalizada_em`;
  - `trg_op_evento` registra `status_alterado` em `op_eventos`;
  - `finalizada` continua legado/compatibilidade.
- Causa raiz: o Pedido marcava Tecelagem como concluida pelo saldo
  (`tecRemaining <= 0`) mesmo quando a OP real ainda estava
  `em_producao`. Isso misturava progresso derivado com terminalidade
  canonica.
- Patch aplicado:
  - `js/screens/op-tecelagem-producao-admin.js`: botao `Concluir`
    habilitado somente com `totalAjustado > 0 && saldo <= 0`; chama
    `supa.rpc('alterar_status_op', { p_op_id, p_novo_status:
    'concluida', p_observacao })`; exibe erro real da RPC; recarrega a
    rota da OP no sucesso; sem update direto em `ops.status`.
  - `js/screens/pedido-chain-state.js`: separa
    `metrics.tecelagem.saldoEntregue` de `metrics.tecelagem.terminal`;
    `adminStepper.tecelagem` so vira `done` com status terminal
    (`concluida`/`finalizada`).
  - `js/screens/pedido-detail-progress.js`: sublabel do stepper passa a
    mostrar `entregue; finalizar OP` quando o saldo zerou mas falta
    terminalidade explicita. Arquivo extra justificado: e o view model do
    stepper, necessario para nao exibir `concluido` indevidamente.
  - `js/screens/pedido-detail-events.js`: modal da etapa Tecelagem explica
    a diferenca entre saldo entregue e finalizacao explicita.
  - Testes atualizados em `tests/pedido-detail.smoke.js` e
    `tests/tec-to-acabamento-flow.smoke.js`.
- Preservado: criacao de OP Tecelagem, aceite da OP, entrega parcial,
  `Transferir restante`, `salvarEntregaCima`, consolidacao Latex default,
  split Latex opt-in, OP Latex/Acabamento e Expedicao.
- Testes:
  - baseline pre-patch: pacote focado 390/390 OK;
  - pos-patch: `tec-to-acabamento-flow`, `pedido-detail`,
    `pedido-detail-linked-ops`, `op-nova`, `op-persistir`,
    `entrega-writes`, `op-latex-split`, `op-latex-admin` = 445/445 OK.
- Diagnosticos staging read-only:
  - OPs totais 25; Tecelagem 17; Latex 8;
  - Latex default 7; split legitimo 1;
  - duplicatas default 0; orfas 0;
  - `op_latex_entregas` N:1: 11 entregas, 0 em multiplas OPs;
  - colisoes `tipo+numero+ano` 0;
  - high-water Latex 8/8 e Tecelagem 17/17.
- Nao tocado: producao `bhgifjrfagkzubpyqpew`, `origin` para escrita,
  SQL, migration, db/25-db/29, dados reais em staging.
- Residual permitido: `?? supabase/.temp/` fora do commit.
- Proximo P1 recomendado: `LATEX-LIFECYCLE-CANONICAL-A` - alinhar a
  finalizacao da OP Latex/Acabamento ao mesmo contrato
  `alterar_status_op(..., 'concluida')`, preservando leitura de
  `finalizada` legado.

# Estado pos-fase - Staging Hardening R1

- Fase: `RAVATEX-TAPETES-STAGING-HARDENING-R1`.
- Objetivo: limpar 2 pendencias nao-fatais reveladas pelo E2E do split,
  sem tocar fluxo homologado.

- **Pendencia A — `parametros_largura.id` (42703):**
  `loadPedidoDetailData` (`js/screens/pedido-detail-data.js`) selecionava
  `id, largura, r_algoritmo_poliester, r_algoritmo_algodao`. Investigacao
  provou que **nenhuma** dessas 3 colunas alem de `largura` existe na
  tabela (`db/01_schema.sql`: PK e a propria `largura`; colunas reais sao
  `largura, peso_linear, algodao_por_ml, poliester_por_ml, valor_x,
  atualizado_em`). Confirmado por probe read-only direto no staging:
  removendo so `id` o erro 42703 apenas migra para
  `r_algoritmo_poliester`. O consumidor unico
  (`pedido-detail-events.js:641-644`, `openTecAcceptanceModal`) monta
  `parametrosByLargura` indexado por `largura` e NUNCA le nenhum outro
  campo do objeto (dead read, confirmado por grep no arquivo inteiro) —
  nao ha decisao de schema pendente. Patch: select reduzido para
  `'largura'` (unica coluna real e realmente usada). Nao e migration; nao
  adiciona nem renomeia coluna alguma.
- **Pendencia B — falso alerta RPC "INDISPONIVEL" via GET:** os 2
  diagnosticos sondavam `rpc/gerar_op_latex_split?select=...` via GET.
  PostgREST so aceita RPC via POST — GET sempre responde 404,
  independente da funcao existir/funcionar (o E2E anterior, fase
  `OP-PARTIAL-SPLIT-E2E-STAGING-C`, ja provou disponibilidade real: a RPC
  criou a OP latex 8/2026 via POST autenticado). Optei pela alternativa
  mais segura oferecida pelo brief (reclassificar em vez de sondar por
  POST negativo): ambos os scripts se autodocumentam como
  "SOMENTE SELECT via PostgREST. Nenhum write/RPC/DDL." — introduzir
  qualquer chamada RPC, mesmo negativa/sem efeito, quebraria esse
  contrato documentado e aumentaria a superficie de um script de
  diagnostico. Patch: a secao `[2.5c]` agora imprime
  "nao verificavel por GET (PostgREST so aceita RPC via POST).
  Disponibilidade confirmada por E2E autenticado" em vez de
  "INDISPONIVEL". Nenhuma chamada de rede nova foi adicionada.
- Arquivos alterados: `js/screens/pedido-detail-data.js`,
  `scripts/staging/production-flow-invariants-diag.mjs`,
  `scripts/staging/latex-consolidation-diag.mjs`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`. `tests/pedido-detail.smoke.js` e
  `tests/production-flow-invariants.smoke.js` **nao precisaram de
  alteracao** — nenhum teste fixava as colunas antigas nem o texto
  "INDISPONIVEL" (verificado antes do patch).
- Validado contra staging real (read-only + via helper real, sem escrita
  nova): `loadPedidoDetailData` no pedido usado no E2E (#12, tecelagem
  OP 11) retorna `loadingError=null`, zero linha de erro 42703 no log,
  `parametrosLargura=[{largura:1.4},{largura:2.1}]`, RENDER OK (9 nodes,
  3 opSummaries — ja incluindo as OPs 7/2026 e 8/2026 do E2E anterior).
- Testes locais: `pedido-detail`, `pedido-detail-linked-ops`, `op-nova`,
  `tec-to-acabamento-flow`, `entrega-writes`, `op-latex-split`,
  `production-flow-invariants`, `latex-consolidation-schema` —
  **357/357 OK**.
- Diagnosticos pos-patch (staging): latex default=7, split atuais=1
  (legitimo, rastro completo 1/1+1/1), duplicatas default=0, duplicidade
  materializada=0, orfas=0, `op_latex_entregas` N:1 (11 entregas, 0 em
  multiplas OPs), colisoes=0, high-water latex=8 e tecelagem=17 (ambos
  identicos ao fim da fase anterior — **nenhuma OP nova foi criada**),
  sem falso alerta de RPC.
- Nao tocado (fora de escopo, preservado): `gerar_op_latex`,
  `gerar_op_latex_split`, db/25-db/29, regra default de acumulacao,
  fluxo de split ja homologado.
- Producao intocada; `origin` nao usado para escrita; sem SQL/migration;
  sem cleanup destrutivo; sem OP split real adicional; sem `git add .`;
  residual permitido `supabase/.temp/`.

# Estado pos-fase - OP Partial Split E2E Staging C

- Fase: `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-E2E-STAGING-C`.
- Objetivo: validar o fluxo REAL de split parcial no staging
  (`ucrjtfswnfdlxwtmxnoo`), confirmando default=acumular e a opcao
  explicita "Criar nova OP para esta parcial".
- Part 0 (Pedido Detail abre com OP): CONFIRMADO. Driver executou o
  helper real `loadPedidoDetailData` + `computeViewModel` +
  `renderPedidoDetailScreen` contra dados reais (pedido #12, tecelagem
  OP 9/2026): `loadingError=null`, RENDER OK (9 nodes, 1 opSummary). A
  regressao `buildOpCard` (fase anterior) esta corrigida em runtime real.
- Metodo E2E: script controlado em Node dirigindo os helpers reais do
  app (`salvarEntregaCima` default e `salvarEntregaCima(..., {forceSplit,
  motivo})`) via shim PostgREST autenticado como admin. NAO chamou a RPC
  fora do fluxo do helper. Script mantido fora do repo (temp).
- Cenario (OP de homologacao, menor risco): tecelagem OP id 11
  (`9/2026`, em_producao, sem OP latex previa), destino Conitex (id 2),
  op_item 26 (modelo 3).
- IDs criados no staging (mantidos como evidencia — NAO apagar):
  - Pedido: `12c930e5-d7dc-47dd-8d3a-f07d3ccf147e` (#12)
  - OP Tecelagem origem: id 11 (`9/2026`)
  - Entrega default: id 10 (`TESTE SPLIT STAGING - entrega default`, 10 m)
  - Entrega split:   id 11 (`TESTE SPLIT STAGING - entrega split`, 7 m)
  - OP Latex default: id 25 = `7/2026` (motivo_separacao NULL)
  - OP Latex split:   id 26 = `8/2026`
    (motivo_separacao = "Teste controlado split staging")
  - Fornecedor destino: 2 (Conitex)
- Evidencias (14/14 asserts OK):
  - split.origem_op_id=11, destino=2, origem_entrega_id=11, motivo set;
  - default.motivo NULL, mesma origem_op_id=11 e destino=2;
  - `op_latex_entregas`: entrega 10->OP25, entrega 11->OP26, COUNT=1 cada
    (N:1, nenhuma entrega em 2 OPs);
  - `op_eventos`: OP 8 `criacao_split` + OP 11 `split_derivado`, payload
    {origem_op_id:11, entrega_id:11, nova_op_id:26, destino:2, motivo};
  - numeracao: split consumiu numero 8; `op_numeros` latex ultimo=8;
    usados [1..8] sem buracos; colisoes 0; high-water tecelagem 17=17.
- Diagnosticos pos-E2E:
  - split atuais = 1 (primeiro split real), listado como LEGITIMO;
  - duplicatas DEFAULT = 0; duplicidade materializada bugada = 0;
  - orfas = 0; `op_latex_entregas` N:1 OK; high-water latex 8=8 OK.
- Patch legitimo (permitido pelo brief): `[2.5]` do
  `production-flow-invariants-diag.mjs` era motivo-unaware e alarmava
  `!!! DUPLICADO` para o split legitimo. Agora classifica: alarme so
  para 2+ OPs DEFAULT na mesma (origem,destino); default+split e
  coexistencia esperada. Nenhuma alteracao de deteccao de bug real.
- `[2.5c]`/verdict ainda imprimem RPC `gerar_op_latex_split`
  "INDISPONIVEL" por sondagem GET (RPC nao e selecionavel por GET); o
  proprio E2E prova que a RPC funciona (criou `8/2026`). Cosmetico
  conhecido, fora do escopo.
- Testes locais: `pedido-detail`, `pedido-detail-linked-ops`,
  `tec-to-acabamento-flow`, `entrega-writes`, `op-latex-split`,
  `production-flow-invariants` — 263/263 OK.
- Residual (nao introduzido aqui, nao corrigido nesta fase): loader
  seleciona `parametros_largura.id` que nao existe no schema staging
  (erro 42703 nao-fatal; `state.parametrosLargura=[]`, pedido abre).
  Candidato a patch em fase de dados/schema, nao no E2E.
- Producao intocada; `origin` nao usado para escrita; sem SQL destrutivo;
  sem cleanup destrutivo; OP split real criada APENAS em staging; default
  acumulador preservado; split nao-automatico (opt-in); db/25-db/29
  intocadas; residual permitido `supabase/.temp/`.

# Estado pos-fase - Staging Flow Regression Audit A

- Fase: `RAVATEX-TAPETES-STAGING-FLOW-REGRESSION-AUDIT-A`.
- Sintoma reportado: Pedido recem-criado com OP recem-criada nao abre;
  alguns outros Pedidos tambem nao abrem. Pedidos sem OP abrem normal.
- Causa raiz (isolada): `buildOpCard` em
  `js/screens/pedido-detail-render.js` e funcao de modulo (irma de
  `buildOps`/`renderPedidoDetailScreen`) e NAO recebia `state`. A tira de
  linhagem adicionada em `977be36` le `state.pedido.numero`; sem `state`
  no escopo, renderizar QUALQUER Pedido com >=1 OP lanca
  `ReferenceError: state is not defined`, quebrando o render (tela nao
  abre). Pedido sem OP nao chama `buildOpCard` (retorno antecipado em
  `buildOps`), por isso abria.
- Reproduzido em runtime com harness DOM minimo: Pedido com 1 OP →
  CRASH `ReferenceError: state is not defined`; Pedido sem OP → RENDER OK.
  Pos-patch: ambos RENDER OK.
- Patch minimo aplicado (sem try/catch, sem remover UI, sem regra de
  negocio):
  - `buildOpCard(state, summary, handlers)` passa a receber `state`;
  - `buildOps` repassa `state` na chamada.
- Guarda de regressao adicionada em `tests/pedido-detail.smoke.js`:
  verifica que `buildOpCard` recebe `state` e que a chamada o repassa
  (a suite era 100% estatica por string-match, por isso nao pegava um
  erro de escopo em runtime).
- Testes locais pos-patch:
  - `node --test tests\pedido-detail.smoke.js` OK (119/119);
  - `node --test tests\pedido-detail-linked-ops.smoke.js` OK (7/7);
  - `node --test tests\production-flow-invariants.smoke.js` OK (11/11);
  - suite prioritaria Part D completa OK (490/490).
- Diagnosticos staging (READ-ONLY, staging ucrjtfswnfdlxwtmxnoo):
  duplicatas default=0, split atuais=0, duplicatas materializadas=0,
  orfas=0, `op_latex_entregas` N:1 (0 em multiplas OPs), colisoes
  tipo+numero+ano=0, high-water latex e tecelagem OK, `motivo_separacao`
  (db/28) presente. RPC `gerar_op_latex_split` "INDISPONIVEL" por GET
  (comportamento conhecido; responde por POST auth).
- Nota de infra (nao introduzido por esta fase): a suite completa
  (`node --test tests\*.js`) tem ~87 falhas PRE-EXISTENTES de testes de
  estrutura do `index.html` e de `http.server` em `:8765` (servidor nao
  iniciado). Confirmado identico em HEAD limpo, sem relacao com o patch.
- Producao intocada; `origin` nao usado para escrita; sem SQL/migration;
  sem OP split real; sem `git add .`; residual permitido `supabase/.temp/`;
  E2E de split segue suspenso ate a auditoria passar.
- db/25-db/29 intocadas.

# Estado pos-fase - OP Partial Split UI B

- Fase: `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-UI-B`.
- Escopo implementado: `js/screens/entrega-form.js`,
  `js/screens/pedido-detail-events.js`,
  `js/screens/op-tecelagem-producao-admin.js`,
  `tests/pedido-detail.smoke.js`,
  `tests/tec-to-acabamento-flow.smoke.js`,
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
- Contrato da UI:
  - `buildEntregaInlineForm` aceita `comOpcaoSplit` (default false);
  - quando true, renderiza select "Acumular" / "Criar nova OP" e campo
    motivo (visivel so com split selecionado);
  - retorna `getSplitOption()` → `{ forceSplit, motivo }`;
  - wire em `pedido-detail-events.js` (`buildTecelagemTransferForm`) e
    `op-tecelagem-producao-admin.js` (`+Nova entrega` onclick);
  - `abrirEdicaoAdmin` NAO passa `comOpcaoSplit`.
- Preservado: default acumula; split e opt-in; a UI chama apenas
  `salvarEntregaCima(args, { forceSplit, motivo })`, nunca a RPC
  diretamente; `gerar_op_latex` / `gerar_op_latex_split` intocadas;
  db/25-db/29 intocadas; sem SQL/migration; sem criacao real de OP
  split; "Transferir restante" preservado.
- Testes locais obrigatorios:
  - `node --test tests\pedido-detail.smoke.js` OK (118/118);
  - `node --test tests\tec-to-acabamento-flow.smoke.js` OK (28/28);
  - `node --test tests\entrega-writes.smoke.js` OK (70/70);
  - `node --test tests\op-latex-split.smoke.js` OK (28/28);
  - `node --test tests\production-flow-invariants.smoke.js` OK (11/11).
- Diagnosticos staging OK: 6 OPs Latex default, 0 splits, 0 duplicatas,
  0 orfas, high-water OK. RPC `gerar_op_latex_split` aparece como
  "INDISPONIVEL" por GET mas responde por POST auth (mesmo comportamento
  conhecido da fase anterior).
- Producao intocada; `origin` nao usado para escrita; sem update/delete
  ad hoc; sem `git add .`; residual permitido `supabase/.temp/`.

# Estado pos-fase - OP Partial Split DB29 RPC B

- Fase: `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-DB29-RPC-B`.
- Escopo implementado localmente: `db/29_op_latex_split_rpc.sql`,
  `tests/op-latex-split.smoke.js`,
  `tests/latex-consolidation-schema.smoke.js`,
  `tests/production-flow-invariants.smoke.js`,
  `scripts/staging/production-flow-invariants-diag.mjs`,
  `scripts/staging/latex-consolidation-diag.mjs`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Contrato da db/29:
  - `gerar_op_latex` atualizada: SELECT e ON CONFLICT filtram
    `motivo_separacao IS NULL`. OPs split ficam fora da busca default.
  - `gerar_op_latex_split(p_entrega_id BIGINT, p_motivo TEXT)` criada:
    exige motivo, admin-only, idempotente por entrega, registra
    `criacao_split` + `split_derivado` em `op_eventos`, usa
    `proximo_numero_op`, escreve `motivo_separacao`.
- Preservado: default acumula; split nao e automatico;
  cardinalidade default mantida; `db/25`-`db/28` intocadas; JS/UI
  intocados nesta fase.
- DB/28 permanece como pre-requisito (coluna + indices parciais).
- Testes locais obrigatorios: `node --test tests\op-latex-split.smoke.js`,
  `node --test tests\latex-consolidation-schema.smoke.js`,
  `node --test tests\production-flow-invariants.smoke.js`,
  `node --test tests\production-flow-numbering-schema.smoke.js`,
  `node --test tests\entrega-writes.smoke.js`.
- Aplicacao staging: bloqueada / pendente de credencial SQL.
- Producao intocada; `origin` nao usado para escrita; sem update/delete
  ad hoc; sem `git add .`; residual permitido `supabase/.temp/`.

# Estado pos-fase - OP Partial Split DB28 B (apply staging bloqueado)

- Fase: `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-DB28-B`.
- Escopo implementado localmente: `db/28_op_latex_split_discriminator.sql`,
  `tests/latex-consolidation-schema.smoke.js`,
  `tests/production-flow-numbering-schema.smoke.js`,
  `tests/production-flow-invariants.smoke.js`,
  `scripts/staging/production-flow-invariants-diag.mjs`,
  `scripts/staging/latex-consolidation-diag.mjs`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Contrato da db/28:
  - `ops.motivo_separacao TEXT NULL`;
  - OP Latex default = `motivo_separacao IS NULL`;
  - OP Latex split futura = `motivo_separacao IS NOT NULL`;
  - indice default unico:
    `(origem_op_id, destino_fornecedor_id) WHERE tipo='latex' AND motivo_separacao IS NULL`;
  - indice auxiliar `ops_latex_split_idx` para splits futuros;
  - hard-stop se ja houver duplicidade default antes de recriar o indice.
- Preservado: `gerar_op_latex` nao foi alterada; nao foi criada
  `gerar_op_latex_split`; nenhum JS/UI/select funcional foi implementado;
  `db/25`, `db/26` e `db/27` ficaram intocados.
- Testes locais obrigatorios:
  - `node --test tests\latex-consolidation-schema.smoke.js` OK (18/18);
  - `node --test tests\production-flow-numbering-schema.smoke.js` OK (14/14);
  - `node --test tests\production-flow-invariants.smoke.js` OK (7/7).
- Validacao SQL isolada: PGlite aplicou a db/28 sobre schema minimo,
  confirmou coluna `motivo_separacao`, predicado dos indices
  `ops_latex_origem_destino_uidx` e `ops_latex_split_idx`, permitiu 1
  default + 2 splits na mesma chave e abortou duplicidade default com
  `P0001`.
- BLOQUEIO operacional: a db/28 nao foi aplicada no Supabase staging
  nesta execucao. `npx supabase db push --linked --dry-run` falhou com
  `Cannot find project ref. Have you run supabase link?`. O arquivo
  `supabase/.temp/linked-project.json` aponta para
  `ucrjtfswnfdlxwtmxnoo`, mas a CLI nao reconheceu link utilizavel e
  nao havia `DB_URL`, senha SQL ou sessao Supabase CLI disponivel.
- Proximo passo obrigatorio: fornecer/linkar credencial SQL/CLI do
  staging `ucrjtfswnfdlxwtmxnoo`, aplicar somente a db/28, rodar os
  dois diagnosticos staging atualizados e validar coluna/indices:
  `motivo_separacao`, `ops_latex_origem_destino_uidx` com predicado
  `tipo='latex' AND motivo_separacao IS NULL`, `ops_latex_split_idx`,
  duplicatas default = 0 e splits atuais = 0.
- Alerta vinculante: db/29 deve ajustar o `ON CONFLICT` da RPC default
  `gerar_op_latex` para incluir `motivo_separacao IS NULL` antes de
  homologar criacao real de novas OPs Latex apos db/28.
- Producao intocada; `origin` nao usado para escrita; sem update/delete
  ad hoc; sem migration remota aplicada; sem `git add .`; residual
  permitido `supabase/.temp/` nao deve ser commitado.

# Estado pos-fase - Production Flow Backlog Register A

- Fase: `RAVATEX-TAPETES-PRODUCTION-BACKLOG-REGISTER-A` (docs-only, patch
  documental).
- Escopo fechado: `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`,
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`. Nenhum outro arquivo.
- Backlog funcional/arquitetural registrado permanentemente em
  `docs/architecture/PEDIDO_PRODUCTION_FLOW_BACKLOG.md`. Leitura obrigatoria
  antes de qualquer implementacao no fluxo produtivo do Pedido.
- 8 itens ordenados no backlog (A-H):
  A. ACTION-BUTTONS-R1 — corrigir botoes "Movimentar" ambiguos/anchors
  B. PEDIDO-TRANSITION-MODAL-GAPS-B — modais de seta com pendencias completas
  C. PEDIDO-TRANSFER-REMAINING-B — botao "Transferir restante"
  D. PEDIDO-TEC-ACCEPTANCE-B — aceite/ajuste da OP Tecelagem pelo Pedido
  E. LATEX-SPLIT-PARTIAL-POLICY-A — diagnostico de split parcial (Latex)
  F. PEDIDO-STEPPER-STAGE-MODALS-B — bolinhas do stepper clicaveis
  G. TEC-STAGE-FINALIZATION-A — finalizacao explicita da Tecelagem
  H. OP-PEDIDO-LINEAGE-UX-B — padronizar correlacao visual OP↔Pedido
- Ordem tecnica definida: A → B → C → F → H → D → E → G.
- Regras vinculantes registradas:
  - padrao de consolidacao Latex: acumular na mesma OP (find-or-accumulate)
  - excecao de split parcial: explicita por select, exige rastro/historico,
    nova chave de agrupamento, nao reintroduz automatico
  - modais de transicao: fonte de calculo canonica compartilhada
    (`derivePedidoChainState`), nao duplicada
  - uma fase por grupo de problema
  - diagnostico antes de codigo para itens de alto risco
  - testes/evidencia antes de fechamento
  - staging seletivo, sem `git add .`
  - producao intocada, origin nao usado para escrita
- Proximo passo: iniciar pelo item A (ACTION-BUTTONS-R1) quando autorizado.

# Estado pos-fase - OP Em Producao Acabamento (correcao pos-implementacao)

- Fase: `RAVATEX-TAPETES-OP-EM-PRODUCAO-ACABAMENTO-STANDALONE-B`, correcao
  aplicada em cima do commit `f675818` (mesma fase, achado ao verificar
  a paridade com o standalone proativamente, sem o arquiteto ter
  precisado apontar de novo).
- Escopo fechado: `js/screens/op-latex-admin.js`,
  `tests/op-latex-admin.smoke.js`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`. Nenhum outro arquivo.
- Achado 1 (icones): `Admin - PROD-OP-ACABAMENTO-standalone.html` e
  `Admin - PROD-OP-TECELAGEM- standalone.html` sao byte-a-byte o mesmo
  arquivo (confirmado por `diff`) — mesmo componente, so alternado pela
  prop `tipo`. Logo tem a mesma convencao: zero icones em titulo de
  bloco. `renderOPLatexProducao` (implementacao inicial) usava
  `sectionIcon`/`sectionHead` nos 7 cards, repetindo o mesmo erro ja
  corrigido em `op-nova.js` (fase R1 Visual Parity da Tecelagem).
  Corrigido: os 8 usos de icone dentro do renderer operacional foram
  removidos; `SVG_ICON_ARROW`, `SVG_DOC`, `SVG_CLOCK` (que so serviam
  a esses icones) foram removidas por ficarem sem uso. O ramo legado de
  preparacao (OP aberta) mantem seu icone original, sem alteracao.
- Achado 2 (layout, via preview real em navegador — nao so texto): Card
  1 "Dados da OP" tinha 8 campos com rotulos longos em grid de 2
  colunas — em ~800px, cada campo ficava com ~76px, quebrando e
  amontoando linhas adjacentes (mesmo bug ja corrigido no Card 1 da OP
  Em Producao Tecelagem). Corrigido para 1 coluna (campos empilhados).
  Os demais grids do renderer (Resumo, Material recebido, Finalizacao)
  foram checados e nao tem o mesmo risco (caixas com borda propria ou
  uma unica linha, sem adjacencia vertical).
- Testes: 2 novos (45, 46) travam ausencia de icone de secao e Card 1
  fora do grid de 2 colunas.
  `node --check js/screens/op-latex-admin.js` OK;
  `node --test tests/op-latex-admin.smoke.js` OK (46/46);
  `node --test tests/op-latex-admin.smoke.js tests/op-nova.smoke.js
  tests/op-persistir.smoke.js tests/boot.smoke.js
  tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK
  (310/310).
- Harness de preview usado so localmente e removido antes do commit.
- Licao reforcada: ao gerar um renderer operacional novo a partir de um
  standalone de referencia, verificar SEMPRE se esse standalone e
  realmente distinto do ja usado em fase anterior (aqui era o mesmo
  arquivo) e reconferir a convencao visual (icones, colunas) em vez de
  reaproveitar por habito o padrao do template antigo (Nova OP/OP
  Aberta).

# Estado pos-fase - OP Em Producao Tecelagem R1 Visual Parity (icones vs. standalone)

- Fase concluida no codigo: `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-R1-VISUAL-PARITY`
  (2a rodada, apos a rodada de bugs de layout).
- Escopo fechado: `js/screens/op-nova.js`, `tests/op-nova.smoke.js`,
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`. Nenhum outro arquivo.
- Achado: nenhum dos 7 blocos do standalone `Admin - PROD-OP-TECELAGEM-
  standalone.html` usa icone no titulo (confirmado card a card no
  markup de referencia) — titulos sao texto puro em todos. Os cards 3
  ("Recebimento de fios") e "Entregas tecelagem" sao funcoes
  reaproveitadas sem alteracao das fases anteriores e ainda carregavam
  o icone herdado do template Nova OP/OP Aberta, quebrando a
  consistencia visual com os outros 5 blocos ja redesenhados.
- Corrigido:
  `buildBlocoTecelagem` (so usada pela tela Em Producao) perdeu o
  icone incondicionalmente;
  `buildBlocoFios` (compartilhada com OP Aberta) ficou condicional por
  `op.status` — `aberta` mantem icone + "3. Recebimento de fios"
  (tela de preparacao, ja testada/aceita); `em_producao` usa "3.
  Insumos — recebimento de fios" sem icone, igual ao standalone;
  adicionada a confirmacao "Todos os fios desta OP ja foram
  recebidos." no branch `em_producao`, presente no standalone e antes
  ausente.
- Verificado visualmente via preview em navegador: OP Em Producao sem
  nenhum icone de secao; OP Aberta com o icone do Card 3 preservado.
- Testes: 4 novos (60-63) travam ausencia de icone em Em Producao,
  texto do Card 3, confirmacao de fios recebidos, e preservacao do
  icone em OP Aberta.
  `node --check js/screens/op-nova.js` OK;
  `node --test tests/op-nova.smoke.js` OK (63/63);
  `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
  tests/op-persistir.smoke.js tests/boot.smoke.js
  tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK
  (302/302).
- Harness de preview usado so localmente e removido antes do commit.
- Licao para fases futuras: ao reaproveitar funcoes de telas antigas
  ("preservar conteudo existente"), checar tambem se o estilo visual
  delas (icones, cores, espacamento) ainda bate com o NOVO standalone
  de referencia — reaproveitar logica/writes nao deveria significar
  reaproveitar decisões visuais do template antigo sem checar.

# Estado pos-fase - OP Em Producao Tecelagem R1 Visual Parity (bugs de layout reais)

- Fase concluida no codigo: `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-R1-VISUAL-PARITY`.
- Contexto: as rodadas anteriores validaram a tela só via extracao de
  texto (estilo jsdom), o que nao detecta layout/CSS quebrado. Isso foi
  apontado como falha de processo — corrigido nesta rodada usando um
  servidor estatico local + harness isolado (mock de `window.supa`, os
  mesmos modulos JS reais) para renderizar a tela de verdade num
  navegador via preview e inspecionar `getBoundingClientRect`/estilo
  computado em larguras realistas (800px e 1280px).
- Escopo fechado: `js/screens/op-nova.js`, `tests/op-nova.smoke.js`,
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`. Nenhum outro arquivo.
- Bugs de layout reais confirmados e corrigidos:
  (1) Card "1. Dados da OP" em grid de 3 colunas quebrava rotulos
  longos ("Fornecedor de tecelagem", "Item do pedido vinculado") uns
  sobre os outros em ~800px de largura (a coluna divide espaco com a
  lateral "Resumo desta OP" de 320px) — corrigido para 2 colunas, mesmo
  padrao ja usado em `op-latex-admin.js` `buildCardDados`;
  (2) Card "Entregas tecelagem" (colunas em px fixo) nao tinha wrapper
  de scroll — a coluna FALTA ficava cortada/escondida atras da borda da
  pagina em larguras estreitas — adicionado `overflow-x:auto` +
  `min-width`;
  (3) Bloco "5. Movimentacao" usava grid rigido de 3 colunas para as
  estatisticas, que dividem espaco com a coluna "6. Documentos da OP"
  (320px) — trocado para `repeat(auto-fit,minmax(120px,1fr))`;
  (4) Subtitulo do header nao mostrava "Aberta em DATA" (faltava
  `ops.criado_em` na query principal) — adicionado.
- Confirmado por inspecao real (nao so relato): breadcrumb, cadeia
  produtiva, "Abrir Pedido" e "Pedido vinculado" ja renderizavam
  corretamente nas rodadas anteriores — a duvida do arquiteto era um
  artefato de colagem de texto parcial, nao um bug.
- Pendencias reconhecidas como menor prioridade (o proprio arquiteto
  classificou como aceitavel/nao necessariamente bug): titulo/rodape do
  Card 3 nao e 1:1 com o standalone; historico de entregas em "5.
  Movimentacao" nao enriquece com numero da OP de Acabamento/romaneio.
  Ambos ficam como possivel polimento futuro.
- Testes: 4 novos (56-59) travam os 4 bugs de layout inspecionando o
  atributo `style` real da arvore renderizada (nao so texto) — helper
  `collectStyles` novo em `tests/op-nova.smoke.js`.
  `node --check js/screens/op-nova.js` OK;
  `node --test tests/op-nova.smoke.js` OK (59/59);
  `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
  tests/op-persistir.smoke.js tests/boot.smoke.js
  tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK
  (298/298).
- Harness de preview (`_visual_check_prod_op.html`, `.claude/launch.json`)
  usado só localmente e removido antes do commit — não faz parte do
  repositorio.
- Proxima recomendacao: se aceito, aplicar o mesmo habito de verificar
  em preview real (nao so texto) em toda fase visual futura, incluindo
  a proxima fase de OP Em Producao Acabamento/Latex standalone.

# Estado pos-fase - OP Em Producao Tecelagem Standalone B (ajuste fino visual)

- Fase concluida no codigo (continuacao/ajuste fino da mesma fase
  `RAVATEX-TAPETES-OP-EM-PRODUCAO-TECELAGEM-STANDALONE-B`, sem transformar
  nenhum placeholder em funcionalidade real).
- Escopo fechado:
  `js/screens/op-nova.js`, `tests/op-nova.smoke.js`,
  `tests/op-recalculo.smoke.js` (1 teste precisado — ver abaixo),
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
- O que foi ajustado nesta rodada (paridade estrutural mais fina com o
  standalone `Admin - PROD-OP-TECELAGEM- standalone.html`):
  breadcrumb "OPs / OP X/ANO" + botao Voltar;
  cadeia produtiva (lineage strip) para a OP de Acabamento/Latex gerada
  por entrega parcial (le dados ja carregados, sem write);
  nomenclatura alinhada ao standalone ("Entregue p/ acabamento" no
  resumo lateral, "Ja enviado" no bloco de Movimentacao);
  bloco novo `4. Capacidade e ajuste` (read-only, le `saldo_fios_op` —
  ja gravada por `aplicarRecalculoOP`/`op-recalculo.js`, nao alterado —
  cruzada com `ordens` para consumo/sobra real por fio; sem "fator
  proporcional" fabricado; fallback controlado sem dados);
  card "Entregas tecelagem" reposicionado apos o Bloco 4 e sem o
  numeral "4." no titulo (evita colisao — "4." passou a pertencer so
  ao Capacidade e ajuste);
  Documentos da OP com visual de lista (Romaneio/Nota fiscal de
  entrada/Nota fiscal de saida, pill neutro "Aguardando integracao"),
  continua placeholder controlado;
  Historico com visual de timeline (ponto + conector), mesma fonte de
  dados/fallback (`op_eventos`);
  tratamento visual de saldo negativo/excedente (entrega acima do
  ajustado) no Resumo lateral, bloco Movimentacao e nas colunas Falta
  dos Cards 2 e Entregas tecelagem — antes ficava escondido atras de
  "✅ completo".
- Ajuste de teste fora do escopo usual (justificado): `tests/op-recalculo.smoke.js`
  teste `12.` tinha uma regex que bloqueava qualquer
  `supa.from('saldo_fios_op')` em `op-nova.js`, mas seu proprio
  comentario ja dizia que a intencao era so bloquear writes (o write
  real fica em `op-recalculo.js`). A leitura read-only nova do Bloco 4
  precisou dessa precisao: a regra passou a bloquear especificamente
  insert/update/delete/upsert nessa tabela, preservando a garantia
  original sem impedir a leitura legitima.
- Testes: `node --check js/screens/op-nova.js` OK;
  `node --test tests/op-nova.smoke.js` OK (55/55);
  `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js
  tests/op-persistir.smoke.js tests/boot.smoke.js
  tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK (294/294).
- Regra absoluta desta fase (vinculante para fases futuras):
  OP Aberta != OP Em Producao;
  Nova OP != PROD-OP;
  Preparacao != Operacao;
  Pedido organiza != OP executa.
  OP Em Producao NAO e um incremento visual da OP Aberta — usa
  template proprio, baseado no standalone
  `Admin - PROD-OP-TECELAGEM- standalone.html`.
- Implementado:
  `buildScreen()` em `op-nova.js` bifurca para
  `buildScreenProducaoTecelagem()` quando `isOpEmProducaoTecelagem()`
  (status `em_producao`, tipo != `latex`);
  header operacional com badges Tecelagem + Em producao e acoes
  Abrir Pedido / Pausar (placeholder) / Movimentar (ancora) / Concluir
  (placeholder) / Documentos / Historico;
  Card 1 Dados da OP e Card 2 Itens da OP read-only (nao parecem
  formulario de preparacao);
  Card 3 Insumos reaproveita `buildBlocoFios` sem alteracao;
  Card 4 Entregas tecelagem reaproveita `buildBlocoTecelagem` sem
  alteracao (preserva `+ Nova entrega`, Editar, Excluir,
  `salvarEntregaCima`, `atualizarEntregaCima`, `excluirEntrega` e o
  best-effort de `gerar_op_latex`);
  Card 5 Movimentacao e bloco visual controlado que aponta (CTA
  "Transferir") para o card de entregas existente, sem gravacao nova;
  Card 6 Documentos da OP e placeholder controlado ("Documentos da OP
  serao integrados em fase propria"), sem schema/upload/gravacao;
  Card 7 Historico le `op_eventos` (read-only, tabela ja aplicada em
  staging por `db/21_op_lifecycle_status_eventos.sql`) com fallback
  controlado quando vazio/erro.
- Preservacoes obrigatorias confirmadas:
  OP Aberta/Nova OP nao foi redesenhada (buildHeader/buildCardDados/
  buildCardItens/buildRight inalterados);
  Acabamento/Latex nao foi tocado — `op.tipo === 'latex'` continua
  delegando para `js/screens/op-latex-admin.js`, sem template
  PROD-OP-TECELAGEM e sem o card `4. Entregas tecelagem`;
  nenhuma chamada a RPC de transicao de status;
  nenhum `ops.update({ status: ... })` novo;
  nenhum schema/tabela/coluna nova;
  sem SQL, sem Supabase, sem producao, sem push.
- Proximo gap (registrado, nao corrigido nesta fase):
  OP Em Producao Acabamento standalone (fase propria futura, mesmo
  padrao aplicado aqui para Tecelagem);
  ajuste futuro de `gerar_op_latex` para nascer em
  preparacao/entrada (`aberta`) em vez de `em_producao` direto;
  documentos reais da OP (schema/tabela/upload);
  lifecycle Pausar/Concluir via contrato proprio (RPC de transicao de
  status ja existe em `db/21_op_lifecycle_status_eventos.sql`, mas
  sem UI ainda).
- Testes do R1 inicial desta fase (48/48, 228/228) — ver contagem
  atualizada (55/55, 294/294) no topo deste registro, apos o ajuste
  fino visual.
- Residual preservado:
  `?? supabase/.temp/` permanece fora do stage/commit;
  104 falhas pre-existentes em `tests/*.smoke.js` (fora do pacote de
  regressao desta fase, relacionadas a ordem/estrutura de scripts em
  `index.html` e outras telas) ja existiam antes desta fase — confirmado
  via `git stash` + `node --test tests/*.smoke.js` no HEAD anterior.
- Proxima recomendacao:
  OP Em Producao Acabamento/Latex standalone, replicando esta mesma
  decisao arquitetural (template PROD-OP proprio, sem incrementar a
  tela de preparacao).

# Estado pos-fase - Nova OP Acabamento Standalone B R1

- Fase concluida no codigo:
  `RAVATEX-TAPETES-OP-NOVA-ACABAMENTO-STANDALONE-B-R1`.
- Escopo fechado:
  `js/screens/op-latex-admin.js`,
  `tests/op-latex-admin.smoke.js`,
  `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Regra vigente:
  Acabamento aberto = preparacao visual standalone;
  card 3 = `Material recebido da tecelagem`;
  item/card `4. Entregas tecelagem` fica fora da preparacao.
- Correcao de escopo aplicada:
  a transicao funcional indevida foi removida;
  nao existe `colocarEmProducao`;
  nao existe write de `ops.status = em_producao`;
  `Colocar em producao` permanece apenas como placeholder disabled
  com aviso de fase propria.
- Preservacoes obrigatorias confirmadas:
  OP Em Producao nao foi redesenhada nesta fase;
  fluxo legado de recebimento, editar enviado e finalizar foi mantido;
  sem SQL, sem Supabase, sem producao, sem lifecycle novo.
- Testes do R1:
  `node --check js/screens/op-latex-admin.js` OK;
  `node --check tests/op-latex-admin.smoke.js` OK;
  `node --test tests/op-latex-admin.smoke.js` OK (38/38);
  `node --test tests/op-nova.smoke.js tests/op-latex-admin.smoke.js` OK (77/77).
- Proxima recomendacao:
  closeout/push staging com remoto staging explicito.
# AGENT_HANDOFF.md Ã¢â‚¬â€ Controle de Tapetes

> Para uma nova sessÃƒÂ£o de IA continuar com seguranÃƒÂ§a. Leia junto:
> `PROJECT_STATE.md`, `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`
> e `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`.
> Regras vinculantes em `docs/architecture/CODE_HEALTH_RULES.md`.
> ÃƒÂndice de fontes canÃƒÂ´nicas vs. legadas em
> `docs/DOCUMENTATION_INDEX.md`.
> ConvenÃƒÂ§ÃƒÂ£o: **tudo em portuguÃƒÂªs brasileiro**.

#### Ãšltimo estado aceito

- Estado pos-fase - Nova OP Tecelagem Standalone B R1 Boot Smoke
- Fase concluida no codigo:
  `RAVATEX-TAPETES-OP-NOVA-TECELAGEM-STANDALONE-B-R1-BOOT-SMOKE`.
- Escopo do R1:
  nenhuma mudanca funcional na UI;
  ajuste focado em `tests/boot.smoke.js` para aceitar o call-site
  canonico de `#/ops/nova?pedido_id=<id>` e completar o sandbox do
  boot com `window.addEventListener`, `window.removeEventListener`
  e `document.getElementById('app')`.
- Resultado:
  o residual que bloqueava a fase B foi removido;
  `node --test tests/boot.smoke.js` fecha verde;
  `node --test tests/op-nova.smoke.js tests/op-persistir.smoke.js tests/boot.smoke.js tests/pedido-detail.smoke.js`
  fecha verde (`181/181`).
- Proximo passo recomendado:
  validacao visual / closeout final da Nova OP Tecelagem.

- Estado pos-fase - Nova OP Tecelagem Standalone B
- Fase concluida no codigo:
  `RAVATEX-TAPETES-OP-NOVA-TECELAGEM-STANDALONE-B`.
- Referencia visual obrigatoria usada:
  `Admin - NOVA-OP-TECELAGEM.html`.
- Arquivos alterados na fase:
  `js/screens/op-nova.js`,
  `tests/op-nova.smoke.js`,
  `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Resultado funcional:
  Nova OP de Tecelagem agora usa o template visual da referencia;
  quando houver `pedido_id`, o bloco principal passa a ser
  **Pedido vinculado** e o Cliente vira dado derivado do Pedido;
  o fluxo avulso sem pedido foi preservado;
  OP Aberta de Tecelagem usa linguagem de preparacao;
  `4. Entregas tecelagem` ficou fora da preparacao e segue apenas
  no comportamento atual de `em_producao`;
  OP Em Producao nao foi redesenhada nesta fase.
- Fora desta fase por decisao explicita:
  Nova OP Acabamento;
  item/card `4. Entregas tecelagem` como parte da futura tela de
  OP Em Producao;
  movimentacao;
  entrega produtiva;
  transicao de status / `alterar_status_op`;
  backend / SQL / Supabase / producao.
- Testes da fase:
  `node --check js/screens/op-nova.js` OK;
  `node --test tests/op-nova.smoke.js` OK (39/39).
- Check amplo exigido pela instrucao:
  `node --test tests/op-nova.smoke.js tests/op-persistir.smoke.js tests/boot.smoke.js tests/pedido-detail.smoke.js`
  ainda fecha com 1 falha residual fora do escopo desta fase:
  `tests/boot.smoke.js` teste 10, que nao aceita o render atual de
  `#/ops/nova` com parse de `pedido_id`.
- Proxima fase recomendada:
  validacao visual / closeout da Nova OP Tecelagem antes de abrir
  qualquer trabalho de OP Em Producao.

- HEAD 79eaab8
- migration 21 aplicada em staging
- evidencia do check consolidado
- producao nao tocada
- proximo passo recomendado: UI lifecycle OP, usando:
  - OP Aberta = Admin - Nova OP
  - OP Em producao = Admin - Detalhe da OP

- **Lifecycle de OP backend** (Fase L,
  `db/21_op_lifecycle_status_eventos.sql`, migration versionada,
  **APLICADA em staging**): `ops.status` CHECK expandido
  (`pausada`/`concluida`/`cancelada` + legado `finalizada`);
  `op_eventos` + trigger `trg_op_evento` + RPC
  `alterar_status_op`. `gerar_op_latex` e `op-latex-admin.js`
  intocados. Nenhum JS alterado. Proximo: UI de transicao de
  status na tela de OP.
- **R1 hardening** sobre a Fase L (mesmo arquivo db/21,
  aplicado em staging): (1) `alterar_status_op` agora
  **admin-only**
  (`is_admin()` no inicio, padrao `gerar_op_latex`) â€”
  fornecedor nao transita status nesta fase; (2) observacao
  vinculada determinicamente ao evento `status_alterado` de
  `status_novo = p_novo_status` (`criado_em DESC, id DESC`),
  sem segundo evento e sem `SET LOCAL` nesta fase. Docs
  atualizados (D-L03-R1 / D-L08-R1 / D-L09-R1).

- **Migration 20 aplicada em staging** (`ucrjtfswnfdlxwtmxnoo`):
  `op_itens.pedido_item_id` (uuid, nullable, FK -> pedido_itens,
  indice) confirmado. Producao `bhgifjrfagkzubpyqpew` intocada.

## Vinculo Pedido -> OP implementado (com R1)

- **Fase C concluida** (`RAVATEX-TAPETES-PEDIDO-OP-LINK-C-R1`):
  migration `db/20_op_itens_pedido_item_link.sql` criada;
  `persistirOP` preenche `lotes.pedido_id` e `op_itens.pedido_item_id`
  (via `item.pedidoItemId` explicito, sem map por modelo_id);
  `screenNovaOP(opId, pedidoId)` aceita pedido_id e pre-preenche
  itens; `#/ops/nova` suporta `?pedido_id=`. R1 removeu
  `itemPedidoMap` por modeloId (inseguro â€” modelo nao e chave
  unica no pedido). Teste 68/68 incluindo duplicidade de
  modelo_id. Proximo passo: **Fase D** â€” OPs vinculadas no
  detalhe do Pedido Admin.

## Vinculo Pedido -> OP implementado

- **Fase C concluida** (`RAVATEX-TAPETES-PEDIDO-OP-LINK-C`):
  migration `db/20_op_itens_pedido_item_link.sql` criada
  (`op_itens.pedido_item_id` UUID FK -> pedido_itens);
  `persistirOP` agora preenche `lotes.pedido_id` e
  `op_itens.pedido_item_id` quando contexto de pedido
  disponivel; `screenNovaOP(opId, pedidoId)` aceita
  pedido_id opcional e pre-preenche itens; `#/ops/nova`
  suporta `?pedido_id=` via query param. OP avulsa
  preservada. Proximo passo: **Fase D** â€” OPs vinculadas
  no detalhe do Pedido Admin.

## Contrato schema Pedido -> OP -> Movimentacao -> Documentos

- **Contrato tecnico registrado** em
  `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`
  na fase `RAVATEX-TAPETES-PEDIDO-OP-SCHEMA-CONTRACT-B` (docs-only),
  sobre o HEAD `04613ee`. O contrato valida 13 tabelas, 5 RPCs,
  4 triggers e RLS completa; confirma que `lotes.pedido_id` existe
  mas nunca e populado e que `op_itens.pedido_item_id` nao existe;
  estabelece contrato para Fase C (popular `lotes.pedido_id` +
  criar `op_itens.pedido_item_id`); desenha tabela
  `documentos_operacionais`; recomenda manter `entregas`/
  `entrega_itens` como fonte canonica de movimentacao; define
  5 etapas do stepper; e registra 8 decisoes tecnicas
  (D-B01 a D-B08). Proximo passo: Fase C. **O proximo chat DEVE
  consultar `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  e `docs/architecture/PEDIDO_OP_SCHEMA_CONTRACT.md`** antes de
  qualquer acao de implementacao.

## Plano persistente Pedido -> OP -> Movimentacao -> Documentos

- **Plano de arquitetura persistente registrado** em
  `docs/architecture/PEDIDO_OP_MOVIMENTACAO_DOCUMENTOS_PLANO.md`
  na fase `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A` (docs-only),
  sobre o HEAD `3e8e78f`. **O proximo chat DEVE consultar este plano**
  antes de qualquer acao na frente Pedido -> OP -> Movimentacao ->
  Documentos. O plano fixa: hierarquia de dominio, estrutura de OPs
  por etapa, stepper/preview produtivo, operacao canonica de
  movimentacao, parciais como camada comercial, documentos como
  pendencia nao bloqueante, modelo alvo, papeis das telas, 9 fases
  futuras (B a J), obrigacao permanente de consulta/atualizacao,
  riscos mapeados e template de evidencia por fase. Proximo passo:
  Fase B (contrato arquitetura/schema detalhado). Nenhum arquivo
  funcional alterado. `js/screens/pedidos-list.js` e
  `supabase/.temp/` preservados.

## Homologacao visual Admin Novo Pedido

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-NOVO-PEDIDO-MATCH-CLIENTE-NOVA-VIEW-A-R1`,
  com aceite visual explicito do dono para `#/pedidos/novo`.
- **HEAD de base da fase:** `4989727`.
- **Arquivo funcional alterado:** `js/screens/pedido-form.js`.
- **Referencia visual usada:** `js/screens/cliente-pedido-form.js`,
  mantendo Admin -> Novo Pedido na mesma base visual homologada de
  Cliente -> Novo Pedido.
- **Admin homologado:** header, cards, dados gerais, area de itens,
  modal/adicao de item, resumo e CTA final foram alinhados ao padrao do
  cliente, sem perder o fluxo administrativo.
- **Comportamento admin preservado:** selecao de cliente, status inicial
  em `rascunho`, payload real `pedidos` + `pedido_itens`, validacoes,
  compensacao em falha de itens, toast e navegacao final para
  `#/pedidos`.
- **Cliente intacto:** `js/screens/cliente-pedido-form.js` nao foi
  alterado nesta fase.
- **Correcao R1 registrada:** bloco `InstruÃ§Ãµes gerais` com titulo
  correto, `textarea` com `min-height: 40px` e recalculo de altura apos
  entrada no DOM para eliminar o corte visual.
- **Validacao real aceita:** pedido admin `#7` salvo no staging/local e
  exibido em `#/pedidos` como `Rascunho` para o cliente `Teste`.
- **Checks executados:** `node --check js/screens/pedido-form.js` OK;
  `git diff --check` OK com warnings LF/CRLF;
  `node --test tests/cliente-routing.smoke.js` OK `19/19`;
  `node --test tests/pedidos-list.smoke.js` OK;
  `node --test tests/pedido-form.smoke.js` com `34/35`.
- **Falha residual conhecida:** a unica falha restante em
  `tests/pedido-form.smoke.js` e externa/preexistente, causada pelo
  dirty diff de `js/screens/pedidos-list.js`, fora do escopo de
  `pedido-form.js`.
- **Residuos preservados fora do commit funcional da fase:**
  `M js/screens/pedidos-list.js` permanece fora do escopo e
  `?? supabase/.temp/` permanece como residual permitido.
- **Escopo preservado:** nenhum schema, SQL, Supabase estrutural,
  OP/Pedido/parciais estruturais, `common.js`, `index.html`, producao
  ou `origin/main` foi tocado.
- **Proximo passo recomendado:** abrir somente apos este closeout a fase
  `RAVATEX-TAPETES-PEDIDO-OP-MOVEMENT-PLAN-A`, para criar/registrar o
  plano persistente **Pedido â†” OP â†” Movimentacao â†” Documentos**.

## Estado atual aceito
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-CORES-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin -> Cores (`#/cadastros/cores`) foi alinhado
  visualmente ao HTML standalone de referencia (`Admin - Cores -
  standalone.html`). **Aceite visual explicito do dono do projeto em
  2026-06-30.** Arquivo funcional alterado:
  `js/screens/cadastros.js` (unico). Elementos homologados: botao
  `Nova cor`, busca, tabela/card, swatches, acoes e footer alinhados
  ao standalone; icones corrigidos com `SquarePen` para editar e
  lixeira para excluir; label `AÃ‡Ã•ES` centralizado; footer acoplado ao
  card da tabela no padrao do mockup. Shell/sidebar/topbar globais
  preservados; rota, acoes, validacoes e permissoes admin preservadas.
  Preview temporario `.codex-cores-visual-check.html` removido antes
  do fechamento e nao commitado. Pushed para `staging/main`. Producao
  e `origin/main` nao tocados.
- **Contrato preservado:** tela continua usando os dados reais de
  `cores`; leituras em `select('*').order('nome')`, edicao por
  `update(...).eq('id', ...)`, criacao por `insert(...)` e exclusao
  por `delete().eq('id', ...)`; sem schema, SQL, mutation Supabase
  nova, RPC nova ou alteracao de payload.
- **Teste focado conhecido:** `tests/cadastros-screens.smoke.js`
  continua verde para `screenCadastrosCores`; a unica falha
  remanescente fica fora do escopo desta fase, em `screenPainel`, por
  contagem esperada de itens do `ADMIN_MENU`.
-- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-PARAMETROS-CALCULO-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin -> Parametros de calculo
  (`#/cadastros/parametros`) foi alinhado visualmente ao HTML
  standalone de referencia (`Admin - Parametros - standalone.html`).
  **Aceite visual explicito do dono do projeto em 2026-06-30.**
  Arquivo funcional alterado: `js/screens/cadastros.js` (unico).
  Elementos homologados: header interno e espacamentos alinhados;
  callout azul com icone e bloco compacto; tabela convertida para grid
  no desenho do mockup; inputs, tooltips e rodape alinhados em
  radius, padding e tipografia; acoes `Cancelar alteracoes` e
  `Salvar parametros` no padrao visual esperado. Shell/sidebar/topbar
  globais preservados; rota, acoes, validacoes e permissoes admin
  preservadas. Preview temporario `.codex-parametros-visual-check.html`
  removido antes do fechamento e nao commitado. Pushed para
  `staging/main`. Producao e `origin/main` nao tocados.
- **Contrato preservado:** tela continua usando os dados reais de
  `parametros_largura`; leituras em `select('*').order('largura')` e
  salvamento por `update(...).eq('largura', ...)`; sem schema, SQL,
  mutation Supabase nova, RPC nova ou alteracao de payload.
- **Diferencas residuais conhecidas:** `Atualizado por` usa fallback
  seguro em `atualizado_por_nome`, `atualizado_por` ou
  `atualizado_por_email`; se ausentes, exibe `-`, sem inventar dado.
- **Teste focado conhecido:** `tests/cadastros-screens.smoke.js`
  continua verde para `screenCadastrosParametros`; a unica falha
  remanescente fica fora do escopo desta fase, em `screenPainel`, por
  contagem esperada de itens do `ADMIN_MENU`. **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-OPS-LIST-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin Ã¢â€ â€™ Lista de OPs (`#/ops`) foi alinhado
  visualmente ao HTML standalone de referencia (`Admin - Lista de
  OPs - standalone.html`). **Aceite visual explicito do dono do
  projeto em 2026-06-30.** Arquivo funcional principal alterado:
  `js/screens/ops-list.js`. Microfix pontual no shell global em
  `js/screens/common.js`, limitado a derivacao das iniciais do avatar
  para eliminar o bug visual `A(` no admin. Elementos homologados:
  header com botao `Nova OP` sem `+` textual duplicado; 4 KPIs
  corretos (Total / Em producao / Simuladas / Abertas); busca com
  icone inline; tabs `Todas / Tecelagem / Latex`; filtros/dropdowns
  `Cliente / Todos os clientes`, `Status / Todos` e `Criada em /
  Todos os periodos`; tabela 7 colunas (`OP / LOTE`, `TIPO`,
  `CLIENTE`, `STATUS`, `ENTREGUE`, `CRIADA EM`, `AÃƒâ€¡Ãƒâ€¢ES`) com label de
  `AÃƒâ€¡Ãƒâ€¢ES` centralizado, botoes `Visualizar`/`Mais` centralizados na
  celula, badges, progresso entregue e paginacao. Shell/sidebar/
  topbar globais preservados fora esse microfix de avatar; rota
  `#/ops`, navegacao para detalhe/novo, acoes e permissoes admin
  preservadas. Regra de acao preservada: OP simulada Ã¢â€ â€™ `Editar`;
  demais OPs Ã¢â€ â€™ `Visualizar`; botao `Mais` apenas visual/disabled.
  Pushed para `staging/main`. Producao e `origin/main` nao tocados.
- **Contrato preservado:** tela continua read-only; somente SELECTs em
  `ops` e `entrega_itens`; sem insert/update/delete/rpc/functions;
  sem schema, SQL ou mutation Supabase; sem alteracao em telas fora
  do escopo.
- **Diferencas residuais conhecidas:** KPIs/contagens/linhas seguem
  dinamicos conforme dados reais; filtro `Cliente` e derivado dos
  clientes presentes na lista; progresso `Entregue` continua vindo de
  `percentualEntregueOP(...)` sobre `op_itens` + `entrega_itens`, sem
  logica nova.
- **Teste focado conhecido:** `tests/ops-list-screen.smoke.js`
  continua desatualizado nesta branch por blocos estaticos antigos
  pre-`boot.js`/pre-querystring em `index.html`; se falhar, registrar
  como teste legado fora de sincronia, sem deformar o visual para
  tentar faze-lo passar.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-ADMIN-PEDIDOS-LIST-MATCH-STANDALONE-CLOSEOUT`.
  O miolo da tela Admin Ã¢â€ â€™ Lista de pedidos (`#/pedidos`) foi alinhado
  visualmente ao HTML standalone de referencia (`Admin - Lista de
  Pedidos - standalone.html`). **Aceite visual explicito do dono do
  projeto em 2026-06-30.** Arquivo funcional alterado:
  `js/screens/pedidos-list.js` (unico). Elementos homologados:
  header com botao "Novo pedido"; 5 KPIs (Abertos / Em producao /
  Parciais / Atrasados / Prontos); busca com icone inline; tabs com
  contagem; linha de filtros; tabela 9 colunas (Pedido / Cliente /
  Sit. interna / Visivel ao cliente / Parcial / Prazo / Recebimento /
  Atualizado / Acoes); badges; acao real `Visualizar`; paginacao.
  Shell/sidebar/topbar globais preservados; rota `#/pedidos`,
  acoes e permissoes admin preservadas. Coluna `Parcial` ligada a
  dados reais seguros via leitura read-only de `pedido_itens` e
  `pedido_parciais`, reaproveitando
  `buildPedidoAcompanhamentoParcial(..., { forCliente: false })`.
  O menu de "mais acoes" permanece apenas visual/disabled porque a
  unica acao real existente segue sendo `Visualizar`. Pushed para
  `staging/main`. Producao e `origin/main` nao tocados.
- **Contrato preservado:** tela continua read-only; somente SELECTs em
  `pedidos`, `clientes`, `pedido_itens` e `pedido_parciais`; sem
  insert/update/delete/rpc/functions; sem schema, SQL ou mutation
  Supabase; sem alteracao em `js/screens/common.js` ou `index.html`.
- **Diferencas residuais conhecidas:** KPIs/contagens/linhas sao
  dinamicos conforme dados reais; `tipo_recebimento` fica em fallback
  seguro "Ã¢â‚¬â€" quando ausente; "Visivel ao cliente" usa a taxonomia
  publicada em `status_cliente_visual` / `status_cliente_excecao`,
  podendo divergir do texto decorativo estatico do mockup.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PEDIDOS-LIST-MATCH-STANDALONE-CLAUDE-R1`. O
  miolo da tela "Meus pedidos" do Cliente (`#/cliente/pedidos`) foi
  alinhado visualmente ao HTML standalone de referÃƒÂªncia (`Cliente -
  Lista de Pedidos - standalone.html`). **Aceite visual explÃƒÂ­cito do
  dono do projeto em 2026-06-30.** Um patch anterior do agente
  GLM/ZCode para esta tela **nÃƒÂ£o foi aceito** (busca sem ÃƒÂ­cone dentro
  de card indevido, texto do botÃƒÂ£o trocado por causa de teste, ÃƒÂ­cones
  de aÃƒÂ§ÃƒÂ£o invisÃƒÂ­veis) e foi descartado via `git restore` antes desta
  implementaÃƒÂ§ÃƒÂ£o final. Arquivo alterado: `js/screens/cliente-pedidos
  -list.js` (ÃƒÂºnico). Elementos homologados: header com botÃƒÂ£o
  "Solicitar pedido"; busca com ÃƒÂ­cone de lupa inline (sem card
  duplicado) + 5 tabs com badge de contagem (Todos / Em produÃƒÂ§ÃƒÂ£o /
  Pronto p/ expediÃƒÂ§ÃƒÂ£o / Entregue / Cancelado); tabela 7 colunas
  (Pedido / SituaÃƒÂ§ÃƒÂ£o / AvanÃƒÂ§o / Prazo / Recebimento / Atualizado /
  AÃƒÂ§ÃƒÂ£o) com pill de situaÃƒÂ§ÃƒÂ£o, avanÃƒÂ§o "Parcial Ã‚Â· X / Y m" / "Total Ã‚Â·
  Y m" e botÃƒÂ£o olho visÃƒÂ­vel/funcional para o detalhe; rodapÃƒÂ© de
  paginaÃƒÂ§ÃƒÂ£o. Parciais preservadas via
  `buildPedidoAcompanhamentoParcial(..., { forCliente: true })` (mesma
  API do dashboard/detalhe). Shell/sidebar/topbar globais preservados.
  Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** SELECT de `pedidos` mantido idÃƒÂªntico ao jÃƒÂ¡
  travado pelos testes (nenhum campo novo, nenhum campo interno
  exposto); novos SELECTs em `pedido_itens`/`pedido_parciais` usam as
  mesmas colunas seguras jÃƒÂ¡ consultadas pelo dashboard/detalhe; RLS/
  schema intocados; nenhuma tela fora do escopo alterada.
- **DiferenÃƒÂ§as residuais conhecidas:** botÃƒÂ£o usa o texto do standalone
  "Solicitar pedido" em vez do literal "+ Novo pedido" exigido por um
  guard de teste desatualizado (`cliente-pedidos-list.smoke.js`,
  1 falha conhecida Ã¢â‚¬â€ nÃƒÂ£o corrigido para nÃƒÂ£o deformar o visual); coluna
  "Recebimento" exibe fallback seguro "Ã¢â‚¬â€" (campo `tipo_recebimento` jÃƒÂ¡
  existe no schema mas estÃƒÂ¡ fora do contrato de SELECT travado e nÃƒÂ£o ÃƒÂ©
  capturado hoje na criaÃƒÂ§ÃƒÂ£o do pedido Ã¢â‚¬â€ ver
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`); rÃƒÂ³tulos de situaÃƒÂ§ÃƒÂ£o
  usam a taxonomia compartilhada (`getClienteTrackingStatusLabel`), por
  isso "ExpediÃƒÂ§ÃƒÂ£o"/"Acabamento"/"Aguardando definicao" em vez do texto
  decorativo do mockup.
- **Gap fechado:** `Meus Pedidos` (lista) marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-STANDARD-SHELL-SIDEBAR-TOPSTRIP-A`. O chrome global
  (topbar 62px + sidebar 196px) foi alinhado visualmente aos HTMLs
  standalone (`Admin - Topbar` / `Admin - Sidebar`). **Aceite visual
  explÃƒÂ­cito do dono do projeto em 2026-06-30** (apÃƒÂ³s hard-refresh para
  descartar cache). ImplementaÃƒÂ§ÃƒÂ£o ÃƒÂºnica em `shellLayout` em
  `js/screens/common.js` Ã¢â‚¬â€ propaga para admin/fornecedor e (via
  `clienteShellLayout`) para cliente, sem duplicaÃƒÂ§ÃƒÂ£o. Arquivos
  alterados: `js/screens/common.js` (chrome em inline styles pixel
  -exatos, sem Tailwind arbitrary) + `index.html` (apenas bump do
  `?v=` do `common.js` para forÃƒÂ§ar re-fetch). Elementos homologados:
  topbar com brand "Inttex" + sectionLabel por perfil + sino + avatar
  com iniciais + nome + chevron; sidebar com nav-items iconizados,
  estado ativo por `window.location.hash` (novo Ã¢â‚¬â€ antes nÃƒÂ£o havia
  destaque), hover via JS, separador e "Sair" no rodapÃƒÂ©. Menus/rotas/
  privilÃƒÂ©gios de cada perfil intactos. Miolos das pÃƒÂ¡ginas nÃƒÂ£o
  redesenhados. Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main`
  nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto (o shell sÃƒÂ³ lÃƒÂª
  `nome`/`tipo` do `CURRENT_USER` e dispara `logout`); nenhum SELECT;
  RLS/schema intocados; nenhuma tela fora do escopo alterada.
- **Gap fechado:** `Shell/Menu cliente` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. ObservaÃƒÂ§ÃƒÂ£o operacional:
  ao mexer no shell no futuro, o cache-busting `?v=` do `common.js` em
  `index.html` deve ser bumped para o navegador re-buscar o arquivo.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-MATCH-STANDALONE-GLM`. O miolo da
  tela Dashboard do Cliente (`#/cliente/dashboard`) foi alinhado
  visualmente ao HTML standalone de referÃƒÂªncia (`Dashboard Cliente v3
  - standalone.html`). **Aceite visual explÃƒÂ­cito do dono do projeto em
  2026-06-29** (apÃƒÂ³s ajuste R1: coluna "Resumo" removida de "Pedidos
  em destaque" e largura/alinhamento do card "Resumo dos pedidos"
  corrigidos). Arquivo alterado: `js/screens/cliente-dashboard.js`
  (ÃƒÂºnico). Elementos homologados: header com botÃƒÂ£o "Novo pedido"; 4
  KPI cards (Meus pedidos / Em produÃƒÂ§ÃƒÂ£o / ConcluÃƒÂ­do / Atrasado) com
  ÃƒÂ­cone; "Pedidos em destaque" como tabela 6 colunas (Pedido Ã‚Â·
  SituaÃƒÂ§ÃƒÂ£o Ã‚Â· AvanÃƒÂ§o Ã‚Â· Atualizado Ã‚Â· Prazo previsto Ã‚Â· AÃƒÂ§ÃƒÂ£o) com badge de
  situaÃƒÂ§ÃƒÂ£o e avanÃƒÂ§o "Parcial Ã‚Â· X / Y m" / "Total Ã‚Â· Y m"; "Resumo dos
  pedidos" com donut SVG + legenda; "ÃƒÅ¡ltimas atualizaÃƒÂ§ÃƒÂµes" e "Prazos
  prÃƒÂ³ximos". Parciais preservadas via
  `buildPedidoAcompanhamentoParcial` (dados seguros, mesma API do
  detalhe). Shell/sidebar/topbar globais preservados. Pushed para
  `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto; SELECTs
  read-only mantidos; RLS intocada; schema nÃƒÂ£o alterado; nenhuma tela
  fora do escopo alterada; shell global nÃƒÂ£o redesenhado.
- **Gap fechado:** `Dashboard Cliente` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³ximos gaps
  remanescentes: Acompanhamento/Stepper (datas por etapa) e
  Shell/Menu cliente, este ÃƒÂºltimo de risco alto (componente
  compartilhado com admin/fornecedor).
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO-ADD-ITEM-MODAL`.
  O modal "Adicionar item" da tela `#/cliente/pedidos/novo` foi
  alinhado visualmente ao HTML standalone de referÃƒÂªncia
  (`Modal Adicionar Item - standalone.html`). **Aceite visual
  explÃƒÂ­cito do dono do projeto em 2026-06-29.** Arquivo alterado:
  `js/screens/cliente-pedido-form.js` (ÃƒÂºnico). Elementos homologados:
  overlay com backdrop; card 460px com radius/shadow; header
  (tÃƒÂ­tulo + subtÃƒÂ­tulo + botÃƒÂ£o fechar); campo Modelo (select real);
  Cor 1/Cor 2 derivadas do modelo selecionado (somente leitura,
  override por item deferido); Largura derivada + Metragem (input
  numÃƒÂ©rico); "ReferÃƒÂªncia visual" decorativa (gradiente/cÃƒÂ­rculo/borda
  tracejada); ObservaÃƒÂ§ÃƒÂ£o do item (textarea + contador "0/200");
  footer Cancelar/Adicionar item. Funcionalidade preservada: abertura
  via clique, inclusÃƒÂ£o real do item em `state.itens`, validaÃƒÂ§ÃƒÂµes de
  modelo e metragem > 0, fechamento por botÃƒÂ£o/overlay/Esc. DiferenÃƒÂ§as
  residuais documentadas: Metragem usa `type="number"` (nÃƒÂ£o `text`,
  para manter validaÃƒÂ§ÃƒÂ£o numÃƒÂ©rica) e placeholder de ObservaÃƒÂ§ÃƒÂ£o evita o
  termo interno "lote". Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o e
  `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto; RLS intocada;
  schema nÃƒÂ£o alterado; nenhuma tela fora do escopo alterada (dashboard
  nÃƒÂ£o tocado).
- **Gap fechado:** `Modal Adicionar Item` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³xima etapa:
  avaliar demais gaps (Dashboard, shell), com decisÃƒÂµes `OP-001` a
  `OP-012` respondidas antes de nova UI.
- **Estado atual aceito:** `work/app-next`, ponta da fase
  `RAVATEX-TAPETES-UI-MATCH-STANDALONE-NOVO-PEDIDO`.
  A tela `#/cliente/pedidos/novo` foi alinhada visualmente ao HTML
  standalone de referÃƒÂªncia (`Novo Pedido - standalone.html`). **Aceite
  visual explÃƒÂ­cito do dono do projeto em 2026-06-29.** Arquivo alterado:
  `js/screens/cliente-pedido-form.js` (ÃƒÂºnico). Elementos homologados:
  header back + tÃƒÂ­tulo 23px/800 + Cancelar; card "Dados gerais" 3 colunas;
  tabela de itens grid `60px 1.1fr 1.1fr .8fr 1.1fr 1.2fr 84px`;
  rodapÃƒÂ© de totais; seÃƒÂ§ÃƒÂ£o bottom grid 3fr/1fr com textarea auto-extensÃƒÂ­vel
  + card "Ir para checkout"; align-items:stretch. Funcionalidade de criaÃƒÂ§ÃƒÂ£o
  preservada (INSERT `pedidos` + `pedido_itens`, compensaÃƒÂ§ÃƒÂ£o, validaÃƒÂ§ÃƒÂµes).
  Campos `referencia`/`recebimento` em UI mas **nÃƒÂ£o enviados ao DB**.
  Modal "Adicionar item" deferido para fase posterior. Pushed para
  `staging/main`. ProduÃƒÂ§ÃƒÂ£o e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** nenhum campo interno exposto; RLS intocada;
  schema nÃƒÂ£o alterado; nenhuma tela fora do escopo alterada.
- **Gap fechado:** `Novo Pedido` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³xima etapa:
  avaliar demais gaps (Dashboard, Modal Adicionar Item, shell), com
  decisÃƒÂµes `OP-001` a `OP-012` respondidas antes de nova UI.
- **Estado atual aceito:** `work/app-next`, HEAD `8650bb5` ("Match
  cliente pedido detail to standalone reference"), ponta da fase
  `RAVATEX-TAPETES-CLIENTE-DETAIL-VISUAL-HOMOLOG-RECORD-A`
  (docs-only, registro de homologaÃƒÂ§ÃƒÂ£o visual). A tela
  `#/cliente/pedidos/<uuid>` foi alinhada visualmente ao HTML standalone
  de referÃƒÂªncia (`Detalhe do Pedido v2 - standalone.html`). **Aceite
  visual explÃƒÂ­cito do dono do projeto em 2026-06-29.** Elementos
  entregues e homologados: breadcrumb + tÃƒÂ­tulo inline + badge de status;
  meta card 3 colunas; stepper 42px conic-gradient two-tone
  (`#2563eb`/`#dbeafe`), check SVG nos concluÃƒÂ­dos, wrapper ÃƒÂ¢mbar para
  exceÃƒÂ§ÃƒÂ£o; preview com textura preservada; distribuiÃƒÂ§ÃƒÂ£o com barras;
  parciais em tabela 4 colunas; histÃƒÂ³rico com timeline vertical. 92/92
  testes passam. Pushed para `staging/main`. ProduÃƒÂ§ÃƒÂ£o `bhgifjrfagkzubpyqpew`
  e `origin/main` nÃƒÂ£o tocados.
- **Contrato preservado:** tela permanece 100% read-only; nenhum campo
  interno exposto (OP, lote, fornecedor, NF, romaneio, custo, margem,
  metadata, criado_por, origem, observacao_admin, token_acesso); RLS
  intocada; dashboard/lista/admin nÃƒÂ£o alterados.
- **Gap fechado:** `Detalhe do Pedido` marcado como resolvido em
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`. PrÃƒÂ³xima etapa:
  avaliar demais gaps (Dashboard, Novo Pedido, shell), com decisÃƒÂµes
  `OP-001` a `OP-012` respondidas antes de nova UI.
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-STATUS-VISUAL-LIST-A-R1` (frontend cliente
  read-only). `js/screens/cliente-pedidos-list.js` passou a consumir
  somente a taxonomia compartilhada de `window.RavatexPedidoTracking`
  para filtro e badge visual da lista `Meus pedidos`.
- **Contrato preservado:** lista continua read-only, com
  `from('pedidos')` e `select(...)` explicito; usa apenas campos
  seguros de status visual publicados ao cliente; sem `select('*')`,
  sem writes, sem RPC, sem Edge Function, sem admin e sem fornecedor.
- **Sem contaminaÃƒÂ§ÃƒÂ£o de escopo:** nenhuma alteracao em schema, SQL,
  Supabase ou helper/read-model parcial; nenhuma tela consumidora fora
  da lista foi alterada nesta fase.
- **Validacao registrada:** `tests/cliente-pedidos-list.smoke.js`,
  `tests/cliente-portal-visual.smoke.js`,
  `tests/cliente-dashboard.smoke.js` e
  `tests/cliente-routing.smoke.js` passaram.
- **Proximo estado esperado:** working tree limpo ao final desta fase.
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A` (docs-only,
  matriz operacional de decisoes para UI; sem codigo, sem schema, sem
  SQL, sem Supabase). Produzido
  `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md`, derivado do
  inventario `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`, para
  separar: decisoes ja consolidadas, decisoes pendentes do dono do
  projeto, recomendacoes tecnicas, impacto por tela e sequencia futura
  de implementacao. **Decisoes ja fechadas preservadas:** cliente nao
  ve OP/lote/fornecedor/NF-romaneio/custo-margem/metadata; portal
  cliente permanece read-only exceto criacao de pedido; status
  operacional e status visual continuam separados; admin publica
  status visual; fornecedor nao altera status visual diretamente nesta
  etapa; timeline cliente le apenas eventos visiveis; producao segue
  bloqueada. **Pendencias principais a responder antes de qualquer UI:**
  `OP-001` fluxo de novo pedido (1 etapa vs 2 etapas), `OP-002` inline
  vs modal para item, `OP-003` campos obrigatorios por item, `OP-004`
  exibir `tipo_recebimento`, `OP-005` uso de `referencia_cliente`,
  `OP-006` separar `prazo_desejado` de `prazo_entrega`, `OP-007`
  exibir ou nao `pedido.status` operacional ao cliente, `OP-008`
  acoes rapidas no dashboard, `OP-009` menu com 2 ou 4 itens,
  `OP-010` existencia de Suporte, `OP-011` upload/imagem por item,
  `OP-012` edicao/cancelamento pelo cliente. **A UI continua
  funcional, NAO final.** **A proxima etapa correta nao e implementar
  UI ainda**: primeiro o dono do projeto deve responder `OP-001` a
  `OP-012`; so depois entram `UI-GAP-FIX-NOVO-PEDIDO-A`,
  `UI-GAP-FIX-MODAL-ITEM-A`, `UI-GAP-FIX-DETALHE-A`,
  `UI-GAP-FIX-DASHBOARD-A` e por ultimo `UI-GAP-FIX-SHELL-A`
  (risco cross-role do `shellLayout`). `docs/ui/CLIENTE_PORTAL_UI_OPERATIONS_RULES.md`
  e documento diagnostico/operacional, nao-canonico, indexado em
  `docs/DOCUMENTATION_INDEX.md` Ã‚Â§1b.
- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A` (docs-only,
  inventÃƒÂ¡rio de gaps de UI, read-only/diagnÃƒÂ³stico Ã¢â‚¬â€ sem cÃƒÂ³digo, sem
  schema, sem SQL, sem Supabase). HEAD: ver `git log -1` (commit desta
  fase, mensagem `"Inventory cliente portal UI gaps"`). Supabase
  staging: `ucrjtfswnfdlxwtmxnoo` (nÃƒÂ£o acessado nesta fase Ã¢â‚¬â€ sÃƒÂ³
  leitura de arquivos locais). ProduÃƒÂ§ÃƒÂ£o/original
  `bhgifjrfagkzubpyqpew` e `origin/main` **intocados**.
- **InventÃƒÂ¡rio de gaps de UI do Portal Cliente B2B** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-GAP-INVENTORY-A`, esta, docs-only).
  Produzido `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`, comparando os
  5 mockups aprovados (localizados fora do repo em
  `D:\OneDrive\Ravatex\Inttex\Mockups - nova interface\`: Dashboard
  Cliente, Novo Pedido, Modal Adicionar Item, Detalhe do Pedido,
  Admin-Cliente-Acompanhamento B2B) contra as 6 telas/ÃƒÂ¡reas do portal
  cliente atual (Dashboard, Novo Pedido, Modal Adicionar Item, Detalhe
  do Pedido, Acompanhamento/Stepper/Timeline, Shell/Menu). Gaps
  principais: KPIs do dashboard com semÃƒÂ¢ntica diferente do mockup;
  fluxo de novo pedido em 1 etapa/itens inline em vez de tabela+modal+
  checkout em 2 etapas; campos jÃƒÂ¡ existentes no schema
  (`referencia_cliente`, `tipo_recebimento`, `cor_1_id`/`cor_2_id`/
  `largura` por item) nÃƒÂ£o capturados na criaÃƒÂ§ÃƒÂ£o; exibiÃƒÂ§ÃƒÂ£o simultÃƒÂ¢nea
  do status operacional (`pedidoStatusBadge`) e do status visual no
  detalhe; stepper sem datas por etapa; shell/menu cliente com 2 itens
  (faltam "Novo pedido" e "Suporte") e sem identidade visual prÃƒÂ³pria,
  usando `shellLayout` **compartilhado com admin/fornecedor** (risco
  alto para qualquer correÃƒÂ§ÃƒÂ£o futura). Particularidades operacionais
  registradas como **TBD explÃƒÂ­cito** (sem inventar regra): obrigaÃƒÂ§ÃƒÂ£o
  ou nÃƒÂ£o de "tipo de recebimento"; checkout em 1 ou 2 etapas; manter
  ou nÃƒÂ£o o status operacional visÃƒÂ­vel ao cliente; campos obrigatÃƒÂ³rios
  do formulÃƒÂ¡rio; regras futuras de ediÃƒÂ§ÃƒÂ£o/cancelamento pelo cliente.
  Proposta de 6 fases futuras no documento (`UI-GAP-FIX-DASHBOARD-A`,
  `UI-GAP-FIX-NOVO-PEDIDO-A`, `UI-GAP-FIX-MODAL-ITEM-A`,
  `UI-GAP-FIX-DETALHE-A`, `UI-GAP-FIX-SHELL-A`,
  `UI-OPERATIONS-RULES-A`), com `UI-OPERATIONS-RULES-A` recomendada
  como **primeira** (resolve os TBDs antes do cÃƒÂ³digo) e
  `UI-GAP-FIX-SHELL-A` como **ÃƒÂºltima** (maior risco, cross-role).
  **A UI permanece funcional, NÃƒÆ’O final.** **ProduÃƒÂ§ÃƒÂ£o permanece
  bloqueada.** Sem cÃƒÂ³digo, sem schema, sem SQL, sem Supabase, sem Edge
  Function, sem frontend, sem testes de app (apenas verificaÃƒÂ§ÃƒÂ£o Git).
  Senha, token e credencial **nÃƒÂ£o foram registrados**.
  `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md` ÃƒÂ© diagnÃƒÂ³stico/nÃƒÂ£o-
  canÃƒÂ´nico, indexado em `docs/DOCUMENTATION_INDEX.md` Ã‚Â§1b.
- **Estado anterior:** fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A` (docs-only,
  closeout do marco funcional do portal cliente em staging Ã¢â‚¬â€ sem
  schema/SQL/Supabase). HEAD fechado: `23286ae`. `staging/main`:
  `23286ae`. Supabase staging: `ucrjtfswnfdlxwtmxnoo`. ProduÃƒÂ§ÃƒÂ£o/
  original `bhgifjrfagkzubpyqpew` e `origin/main` **intocados**.
- **Closeout funcional de staging do Portal Cliente B2B** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-STAGING-CLOSEOUT-A`, esta,
  docs-only). O portal cliente esta **funcionalmente homologado em
  staging**: perfil cliente, login cliente, criacao/lista/detalhe de
  pedido cliente, dashboard cliente read-only, status visual publicado
  pelo admin, stepper/acompanhamento, timeline read-only, policy
  cliente para eventos visiveis, provisionamento cliente em staging
  via `admin-create-user` validado, ausencia de exposicao de dados
  internos, portal 100% read-only para o cliente (exceto criacao de
  pedido) e polimento visual inicial. **A UI NAO esta marcada como
  final** Ã¢â‚¬â€ o dono do projeto confirmou que a apresentacao atual ainda
  diverge dos HTMLs/mockups pedidos e que havera nova rodada de
  refinamento visual e ajustes para particularidades operacionais.
  **Producao permanece bloqueada**: nenhuma autorizacao de merge ou
  deploy para `origin/main` foi dada nesta fase. Sem codigo, sem
  schema, sem SQL, sem Supabase, sem Edge Function, sem frontend, sem
  testes (apenas verificacao Git). Senha, token e credencial **nao
  foram registrados**. Proxima fase recomendada: inventario de gaps de
  UI (mockups/HTMLs vs. implementacao atual) antes de qualquer nova
  implementacao ou decisao de promocao para producao.
- **Estado anterior:** fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A` (docs-only,
  registro de homologacao visual aprovada Ã¢â‚¬â€ sem schema/SQL/Supabase).
  HEAD homologado: `3b0f8e4`.
- **HomologaÃƒÂ§ÃƒÂ£o visual do portal cliente APROVADA** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A`, esta,
  docs-only). ValidaÃƒÂ§ÃƒÂ£o manual/controlada pelo dono do projeto, no HEAD
  `3b0f8e4`, em ambiente conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`, **sem tocar produÃƒÂ§ÃƒÂ£o/original**
  `bhgifjrfagkzubpyqpew`. Aprovados: **Dashboard Cliente**, **Meus
  pedidos**, **Detalhe do pedido**, **Stepper/Acompanhamento** e
  **Timeline de atualizaÃƒÂ§ÃƒÂµes** Ã¢â‚¬â€ as 5 telas refinadas na fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`. **Responsividade
  bÃƒÂ¡sica** aprovada (desktop e largura menor, sem sobreposiÃƒÂ§ÃƒÂ£o
  grosseira, tabelas com rolagem horizontal quando necessÃƒÂ¡rio, menu
  permanece utilizÃƒÂ¡vel). **Nenhum dado interno**
  (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
  origem/token_acesso) exposto ao cliente. Portal cliente **permanece
  read-only** Ã¢â‚¬â€ sem editar pedido, cancelar pedido, atualizar status,
  publicar evento ou mexer em fornecedor. **Nenhuma regressÃƒÂ£o
  funcional reportada**. **Sem** cÃƒÂ³digo/schema/SQL/Supabase/frontend/
  teste nesta fase. Senha, token e qualquer credencial **nÃƒÂ£o foram
  registrados**.
- **Polish visual do portal cliente** (fase
  `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A`, esta): refinada a
  camada de apresentaÃƒÂ§ÃƒÂ£o das 5 telas do portal cliente sem alterar
  nenhum comportamento homologado. `cliente-dashboard.js` ganhou
  cards/KPIs com borda de cor, grade de 2 colunas (desktop) entre
  "Pedidos recentes" e "ÃƒÅ¡ltimas atualizaÃƒÂ§ÃƒÂµes", e badges com tom de
  cor derivado da exceÃƒÂ§ÃƒÂ£o (mesma paleta do stepper, antes fixo em
  azul). `cliente-pedidos-list.js` ganhou contador de resultados,
  rolagem horizontal na tabela e renomeou a aÃƒÂ§ÃƒÂ£o "Visualizar" para
  "Ver pedido" (consistÃƒÂªncia com o Dashboard) Ã¢â‚¬â€ **select de pedidos
  inalterado**. `cliente-pedido-detail.js` reorganizou o resumo em
  grade de 3 colunas e deu ÃƒÂ  timeline "AtualizaÃƒÂ§ÃƒÂµes do pedido" um
  indicador visual de linha do tempo (ponto + conector) Ã¢â‚¬â€ **selects
  de pedidos/pedido_itens/pedido_cliente_eventos inalterados**.
  `cliente-pedido-tracking.js` recebeu apenas ajustes de classe
  (cantos, sombra, tamanho de cÃƒÂ­rculo); taxonomia, exceÃƒÂ§ÃƒÂµes,
  "cancelado" como exceÃƒÂ§ÃƒÂ£o terminal e mensagem personalizada
  permanecem intactos; continua sem consultar Supabase.
  `cliente-common.js` **nÃƒÂ£o foi alterado** (menu "InÃƒÂ­cio"/"Meus
  pedidos" jÃƒÂ¡ atendia ao padrÃƒÂ£o). Novo teste cruzado
  `tests/cliente-portal-visual.smoke.js` (49 casos) garante, num sÃƒÂ³
  lugar, que nenhuma das 5 telas ganhou exposiÃƒÂ§ÃƒÂ£o de
  metadata/criado_por/origem/`pedido_eventos`/OP/lote/fornecedor/NF/
  romaneio/custo/margem/token_acesso nem aÃƒÂ§ÃƒÂ£o de escrita, e que os
  SELECTs de dados permanecem **literalmente idÃƒÂªnticos** aos de antes
  da fase (guarda anti-regressÃƒÂ£o por comparaÃƒÂ§ÃƒÂ£o de string exata).
  VerificaÃƒÂ§ÃƒÂ£o visual manual feita em app local conectado ao staging
  `ucrjtfswnfdlxwtmxnoo` (usuÃƒÂ¡rio `cliente@teste.com`): Dashboard,
  Detalhe e Meus pedidos renderizam sem erro de console, com o tom de
  cor e o layout em 2 colunas funcionando como esperado. **Admin e
  fornecedor nÃƒÂ£o foram tocados. Sem schema/SQL/Supabase nesta fase.**
  Testes: lista obrigatÃƒÂ³ria da fase + `cliente-pedidos-list` +
  `cliente-portal-visual` (novo, com 49 casos) = 265 testes, todos
  passando.
- **HomologaÃƒÂ§ÃƒÂ£o Dashboard Cliente APROVADA** (fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-HOMOLOG-RECORD-A`, esta,
  docs-only). ValidaÃƒÂ§ÃƒÂ£o manual/controlada feita em **app local
  (`http://localhost:8765/`) conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`** (runtime confirmou `APP_ENV=staging` e
  `SUPABASE_URL` Ã¢â€ â€™ `ucrjtfswnfdlxwtmxnoo`), no HEAD `54fabfa`, **sem
  tocar produÃƒÂ§ÃƒÂ£o/original `bhgifjrfagkzubpyqpew`**. Confirmado: login
  cliente cai em `#/cliente/dashboard`; menu "InÃƒÂ­cio" + "Meus pedidos"
  funcionais; dashboard sem erro de console; KPIs coerentes (em aberto
  2, em andamento 2, prontos/concluidos 0, atualizacoes recentes 3);
  pedidos recentes (#3 excecao "Aguardando insumo", #2 "Acabamento");
  ultimas atualizacoes exibidas; "Ver pedido" abre o detalhe correto
  com **stepper + timeline** preservados; navegacao
  dashboardÃ¢â€ â€™detalheÃ¢â€ â€™Meus pedidosÃ¢â€ â€™dashboard OK; **sem** dados internos
  (OP/lote/fornecedor/NF/romaneio/custo/margem/metadata/criado_por/
  origem/token_acesso) e **sem** acoes de escrita (read-only). Cliente
  de teste usado: `cliente@teste.com`, `tipo=cliente`, `cliente_id=3`,
  nome "Teste" (**senha nÃƒÂ£o registrada**). Observacao nao bloqueante:
  evento cujo `titulo` = status pode repetir o texto no titulo e no
  badge Ã¢â‚¬â€ dado do evento, nao defeito. **Sem** codigo/schema/SQL/
  Supabase/frontend/teste nesta fase.
- **Dashboard Cliente read-only** (fase
  `RAVATEX-TAPETES-CLIENTE-DASHBOARD-A`, esta): novo modulo
  `js/screens/cliente-dashboard.js` (`screenClienteDashboard`) servindo
  de pagina inicial do portal B2B em `#/cliente/dashboard`
  (`roles: ['cliente']`, registrada em `js/boot.js`). `routeAfterLogin`
  (em `js/router.js`) passa a levar o cliente para `#/cliente/dashboard`
  apos login; `#/cliente/pedidos`, `#/cliente/pedidos/novo` e
  `#/cliente/pedidos/<uuid>` continuam funcionando. Menu cliente
  (`CLIENTE_MENU` em `cliente-common.js`) ganha **"InÃƒÂ­cio"** preservando
  **"Meus pedidos"**. Dashboard mostra cards/KPIs (em aberto, em
  andamento, prontos/concluidos, atualizacoes recentes) derivados
  localmente; ate 5 pedidos recentes com label visual via
  `window.RavatexPedidoTracking` e botao "Ver pedido"; e as ultimas
  atualizacoes (ate 8) lidas de `pedido_cliente_eventos`, com empty
  state "Suas atualizaÃƒÂ§ÃƒÂµes aparecerÃƒÂ£o aqui.". **Pedidos** lidos com
  SELECT explicito apenas dos campos seguros (`id, numero, status,
  status_cliente_visual, status_cliente_excecao,
  status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega,
  prazo_desejado, tipo_recebimento, criado_em, atualizado_em`).
  **Eventos** lidos com SELECT explicito (`id, pedido_id, status,
  titulo, mensagem, criado_em`), `order('criado_em', desc)`, erro
  isolado em `state.eventosError` sem quebrar o resto. **Sem**
  `metadata`/`criado_por`/`origem`, **sem** `select('*')`, **sem**
  `pedido_eventos`, **sem** `OP`/`lote`/`fornecedor`/`NF`/`romaneio`/
  `custo`/`margem`/`token_acesso`. Read-only: sem insert/update/delete/
  rpc/`functions.invoke`/`service_role`. **Admin e fornecedor
  intocados. Sem schema/SQL/Supabase. Producao `bhgifjrfagkzubpyqpew`
  intocada.** Testes: `tests/cliente-dashboard.smoke.js` novo (32/32);
  `tests/boot.smoke.js`, `tests/cliente-routing.smoke.js` atualizados
  para a nova contagem de rotas (20) e o novo destino pos-login.
  Proxima fase recomendada: homologacao manual do dashboard em staging
  ou refinamento visual do portal cliente.
- **HEAD aceito de entrada desta fase:** `fc7843c`
  (fase TRACKING-CLIENTE-EVENTS-A tecnicamente aceita, timeline
  read-only entregue no frontend; esta fase apenas registra a
  homologaÃƒÂ§ÃƒÂ£o manual feita sobre esse HEAD, sem alterar cÃƒÂ³digo).
- **HEAD homologado em staging:** `fc7843c`.
- **Working tree:** limpo apÃƒÂ³s commit.
- **origin/main:** `1047181eba888242c6428de366cbd9fda2f1c72c` Ã¢â‚¬â€ intocado
- **PR #2:** intocado
- **Ã¢Å¡Â Ã¯Â¸Â NÃƒÆ’O CHAMAR `ucrjtfswnfdlxwtmxnoo` DE "PRODUÃƒâ€¡ÃƒÆ’O ORIGINAL".**
  Ãƒâ€° o ambiente paralelo. O app original online estÃƒÂ¡ em
  `bhgifjrfagkzubpyqpew` + Vercel e **nÃƒÂ£o deve ser tocado**.
- **Ã¢Å¡Â Ã¯Â¸Â NÃƒÆ’O TOCAR `bhgifjrfagkzubpyqpew`.**
- **Ã¢Å¡Â Ã¯Â¸Â NÃƒÆ’O TOCAR Vercel original.**
- **Schema Pedidos** `db/13_pedidos_schema.sql` aplicado em
  `ucrjtfswnfdlxwtmxnoo`: tabelas `pedidos`, `pedido_itens`,
  `pedido_eventos` e `lotes.pedido_id` (nullable). RLS admin-only.
  Sem policy pÃƒÂºblica. Sem `pedidos.op_id`.
- **Schema Cliente Perfil** `db/14_cliente_perfil_schema.sql`
  **aplicado em staging** `ucrjtfswnfdlxwtmxnoo` via Management API
  (fase B2). Role `cliente`, `usuarios.cliente_id`, `meu_cliente_id()`
  e 5 policies cliente SELECT/INSERT operacionais. Sem UPDATE/DELETE
  cliente. Sem token pÃƒÂºblico. `pedido_eventos` admin-only.
- **Schema Tracking Visual** `db/15_status_cliente_visual.sql`
  **aplicado e validado em staging** `ucrjtfswnfdlxwtmxnoo` em
  `2026-06-26`, sem tocar o projeto original/producao
  `bhgifjrfagkzubpyqpew`. Adiciona em `public.pedidos`:
  `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem`, `status_cliente_atualizado_em`,
  `referencia_cliente`, `prazo_desejado`, `tipo_recebimento`; cria a
  tabela `public.pedido_cliente_eventos`; aplica RLS admin-only nessa
  tabela via policy `pedido_cliente_eventos_admin_all`; cria trigger
  guard de INSERT para zerar campos visuais quando o autor nao for
  admin; e cria trigger de touch para
  `status_cliente_atualizado_em` em UPDATE visual. Validacoes
  estruturais concluidas: 7 colunas em `pedidos`, 10 colunas em
  `pedido_cliente_eventos`, 4 constraints esperadas, 2 triggers,
  2 funcoes, 1 indice `(pedido_id, criado_em DESC)` e
  `pedido_cliente_eventos = 0`. Validado tambem por
  `tests/cliente-tracking-schema.smoke.js`. **Sem frontend.**
  **Sem dropdown admin.** **Sem policy cliente na nova tabela.**
- **Policy Cliente Eventos** `db/16_pedido_cliente_eventos_cliente_select.sql`
  **aplicada e validada em staging** `ucrjtfswnfdlxwtmxnoo` em
  `2026-06-27` (fase EVENTS-RLS-B), aplicada manualmente por HMNlead no
  Dashboard SQL Editor, exatamente como versionado, sem tocar
  `bhgifjrfagkzubpyqpew`. Cria de forma idempotente a policy
  `pedido_cliente_eventos_cliente_select` em
  `public.pedido_cliente_eventos`, limitada a `FOR SELECT`, exigindo
  `visivel_cliente = true` e ownership via `public.pedidos`
  (`p.id = pedido_cliente_eventos.pedido_id` e
  `p.cliente_id = public.meu_cliente_id()`). Preserva
  `pedido_cliente_eventos_admin_all`, nao cria INSERT/UPDATE/DELETE de
  cliente, nao altera frontend e nao libera timeline ainda. Validacao
  pos-aplicacao: 2 policies na tabela (`admin_all` cmd `ALL`,
  `cliente_select` cmd `SELECT`); `qual` da policy cliente confirma
  `visivel_cliente = true` + `EXISTS` + `pedidos` + `meu_cliente_id()`;
  RLS habilitada (`relrowsecurity = true`); 10 colunas preservadas;
  `count(*) = 0`. Validado por `tests/cliente-events-rls-schema.smoke.js`
  (13/13).
- **Timeline cliente de eventos** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-EVENTS-A`, esta):
  `js/screens/cliente-pedido-detail.js` consulta
  `public.pedido_cliente_eventos` com SELECT explicito
  (`id, pedido_id, status, titulo, mensagem, criado_em`), filtro
  `.eq('pedido_id', pedidoId)` e `.order('criado_em', { ascending:
  false })`, usando a policy `pedido_cliente_eventos_cliente_select`.
  Renderiza secao "Atualizacoes do pedido" apos os itens (card branco
  no padrao visual existente). Empty state: "Assim que houver novas
  atualizacoes, elas aparecerao aqui." Erro de leitura isolado em
  `state.eventosError`, sem afetar `loadingError` nem o resto do
  detalhe. **Sem** `metadata`/`criado_por`/`origem` no SELECT, sem
  `select('*')`, sem `pedido_eventos`, sem writes/rpc/
  `functions.invoke`/`service_role`/`token_acesso`. **Sem** schema/SQL
  nesta fase. Admin continua o unico publicador (via
  `pedido-tracking-admin.js`, fase anterior). Fornecedor nao participa.
  Testes: `tests/cliente-pedido-events.smoke.js` novo (19/19);
  `tests/cliente-pedido-detail.smoke.js` atualizado (46/46).
- **HomologaÃƒÂ§ÃƒÂ£o manual E2E aprovada** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-E2E-HOMOLOG-RECORD-A`,
  esta, docs-only). HMNlead validou manualmente em staging
  `ucrjtfswnfdlxwtmxnoo`, no HEAD `fc7843c`, sem tocar
  `bhgifjrfagkzubpyqpew`: admin publicou `status_cliente_visual =
  acabamento` com mensagem personalizada via
  `pedido-tracking-admin.js`; `pedidos.status_cliente_*` foram
  gravados; `pedido_cliente_eventos` recebeu o evento correspondente
  (`origem = manual`, `visivel_cliente = true`); cliente visualizou o
  stepper na etapa "Acabamento" com mensagem e data de atualizaÃƒÂ§ÃƒÂ£o; a
  seÃƒÂ§ÃƒÂ£o "AtualizaÃƒÂ§ÃƒÂµes do pedido" exibiu o evento. Excecao visual
  (`status_cliente_excecao = aguardando_insumo`) tambem foi testada e
  exibida corretamente, sem quebrar o stepper, com novo evento na
  timeline. `metadata`, `criado_por` e `origem` nao apareceram ao
  cliente; nenhum dado de OP/lote/fornecedor/NF/romaneio/custo/margem
  foi exposto. **Cancelado nao foi testado** (pedido usado nao era
  seguro para esse teste). **DecisÃƒÂ£o: fluxo aprovado** para avanÃƒÂ§ar ao
  Dashboard Cliente read-only ou refinamento visual do portal cliente.
  **Sem** alteraÃƒÂ§ÃƒÂ£o de cÃƒÂ³digo/schema/SQL/Supabase/frontend nesta fase.
- **Provisionamento cliente** (fase PROV-A): `admin-create-user`
  aceita `cliente` (valida `cliente_id` em `public.clientes`, rejeita
  `fornecedor_id` simultÃƒÂ¢neo). UI `#/cadastros/usuarios` com tipo
  Cliente + select de cliente. `loadCurrentUser()` carrega
  `cliente_id` e `cliente_nome`. `isCliente()` disponÃƒÂ­vel.
  **CorreÃƒÂ§ÃƒÂ£o 2026-06-27 (HOMOLOG-RECORD-A):** jÃƒÂ¡ **existe um cliente
  de teste funcional em staging** (`cliente@teste.com`, `cliente_id=3`,
  nome "Teste"), com login validado e dashboard homologado.
  **CONFIRMADO 2026-06-27 (PROVISIONING-STAGING-VERIFY-A):** o **deploy
  da versÃƒÂ£o de `admin-create-user` que aceita `tipo=cliente` estÃƒÂ¡ ATIVO
  em staging** `ucrjtfswnfdlxwtmxnoo`. Verificado por probe nÃƒÂ£o
  destrutivo: admin (`admin@tapetes.test`) invocou
  `functions.invoke('admin-create-user', { body: { tipo: 'cliente',
  cliente_id: 999999, ... } })` e recebeu HTTP 400 `VALIDATION_ERROR
  "cliente_id nÃƒÂ£o existe em public.clientes."` Ã¢â‚¬â€ mensagem exclusiva do
  ramo `cliente` da funÃƒÂ§ÃƒÂ£o; a versÃƒÂ£o antiga teria barrado antes no gate
  de `tipo`. **Nenhum usuÃƒÂ¡rio real foi criado** (a validaÃƒÂ§ÃƒÂ£o de
  `cliente_id` ocorre antes de `createUser`). Senha/token **nÃƒÂ£o
  registrados**; produÃƒÂ§ÃƒÂ£o `bhgifjrfagkzubpyqpew` **nÃƒÂ£o tocada**. A
  lacuna "provisionamento self-service via Edge Function em staging =
  a confirmar" estÃƒÂ¡ **resolvida**.
- **Frontend Pedidos cliente entregue (UI-A + CREATE-A):**
  shell mÃƒÂ­nimo (`js/screens/cliente-common.js` com `CLIENTE_MENU`:
  "Meus pedidos" apenas), listagem read-only com botÃƒÂ£o
  "+ Novo pedido" (`js/screens/cliente-pedidos-list.js`,
  `#/cliente/pedidos`, `screenClientePedidosLista`, confia na
  RLS), detalhe sanitizado (`js/screens/cliente-pedido-detail.js`,
  `#/cliente/pedidos/<uuid>`, `screenClientePedidoDetalhe`,
  sem editar/cancelar, sem expor OP/lote/fornecedor/
  token/eventos), formulÃƒÂ¡rio de criaÃƒÂ§ÃƒÂ£o
  (`js/screens/cliente-pedido-form.js`,
  `#/cliente/pedidos/novo`, `screenClientePedidoNovo`,
  `cliente_id` de `CURRENT_USER.cliente_id`, status inicial
  `recebido`, sem select de cliente, sem editar/cancelar,
  sem expor OP/lote/fornecedor/token/eventos). Roteamento:
  `routeAfterLogin` direciona cliente para `#/cliente/pedidos`,
  `matchRoute` resolve `#/cliente/pedidos/<uuid>` com
  `roles: ['cliente']`, `boot.js` registra `#/cliente/pedidos`
  e `#/cliente/pedidos/novo`. **Sem** editar/cancelar pedido.
  **Sem** schema, SQL, Edge Function, service_role,
  functions.invoke.
- **Admin Pedidos completo (C1-C3C3):** listagem, formulÃƒÂ¡rio,
  detalhe, aÃƒÂ§ÃƒÂµes de status, ediÃƒÂ§ÃƒÂ£o de dados gerais e itens.
- **GovernanÃƒÂ§a obrigatÃƒÂ³ria antes da prÃƒÂ³xima implementaÃƒÂ§ÃƒÂ£o:**
  `docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md` fixa os
  limites da frente Portal B2B/Pedidos. **NÃƒÂ£o iniciar**
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A` sem
  respeitar esse documento. Em especial: separar cliente,
  admin e fornecedor; separar status operacional de
  `status_cliente_visual`; nÃƒÂ£o colar HTML standalone no app;
  reaproveitar componentes comuns; manter SPA estÃƒÂ¡tico + JS
  clÃƒÂ¡ssico + `window.*`; quebrar prÃƒÂ³ximas entregas em fases
  pequenas (schema, staging SQL, admin UI, cliente UI,
  dashboard, redesign shell, fornecedor, automaÃƒÂ§ÃƒÂ£o).
- **Sketch de acompanhamento visual no detalhe cliente
  (fase TRACKING-UI-A, esta):** novo mÃƒÂ³dulo
  `js/screens/cliente-pedido-tracking.js`
  (`buildClientePedidoTrackingCard(pedido)`) Ã¢â‚¬â€ componente puro
  de apresentaÃƒÂ§ÃƒÂ£o (sem Supabase, sem writes), com stepper de 6
  etapas (Recebido/Confirmado/Em produÃƒÂ§ÃƒÂ£o/Em acabamento/Pronto
  para entrega/Entregue) + banner de situaÃƒÂ§ÃƒÂ£o atual.
  `cliente-pedido-detail.js` chama o componente no topo do
  detalhe via `buildTracking()`. Etapa ÃƒÂ© DERIVADA de
  `pedido.status` (`statusParaEtapaCliente`): `rascunho`/
  `recebido` Ã¢â€ â€™ "Recebido", `confirmado` Ã¢â€ â€™ "Confirmado", demais
  status (`produzindo`, `entregue`) ficam neutros (sem etapa
  marcada) por nÃƒÂ£o terem transiÃƒÂ§ÃƒÂ£o alcanÃƒÂ§ÃƒÂ¡vel nesta fase nem
  correspondÃƒÂªncia 1:1 com um ÃƒÂºnico nÃƒÂ³ do stepper. `cancelado`
  substitui o stepper por um aviso calmo. **Sem** campo
  `status_cliente_visual` real ainda no frontend, **sem** tabela de
  eventos visivel ainda, **sem** dropdown admin, **sem**
  schema/SQL/Edge Function na fase TRACKING-UI-A, **sem**
  dados internos sensÃƒÂ­veis. Script carregado em `index.html`
  entre `cliente-pedidos-list.js` e `cliente-pedido-detail.js`.
- **Taxonomia compartilhada de tracking visual** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-STEPS-A`, esta):
  novo modulo `js/pedido-tracking-ui.js`, carregado em `index.html`
  logo apos `js/pedido-ui.js`. Exposicoes:
  `window.RavatexPedidoTracking` e
  `window.RAVATEX_PEDIDO_UI.CLIENTE_TRACKING`. Conteudo:
  8 etapas principais (`recebido`, `confirmado`, `insumos`,
  `tecelagem`, `acabamento`, `expedicao`, `transporte`,
  `concluido`), 4 excecoes (`aguardando_definicao`,
  `aguardando_insumo`, `pausado`, `cancelado`) e helpers puros
  `getClienteTrackingStep`, `getClienteTrackingException`,
  `getClienteTrackingStatusLabel`, `getClienteTrackingMensagem`,
  `getClienteTrackingProgress`. Regras fixadas: excecao prioriza
  label/mensagem; `status_cliente_mensagem` sobrescreve a frase
  padrao; `cancelado` e terminal fora da etapa principal;
  `insumos` e `transporte` sao pulaveis; fallback para
  `status_cliente_visual` nulo/desconhecido = `recebido`.
  **Importante:** a camada foi criada sem acoplar admin/cliente/
  fornecedor, sem writes, sem Supabase, e sem substituir ainda o
  tracking funcional atual do cliente.
- **Tracking visual do cliente agora lendo o status real**
  (fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-CLIENTE-A`, esta):
  `js/screens/cliente-pedido-detail.js` passou a selecionar
  `status_cliente_visual`, `status_cliente_excecao`,
  `status_cliente_mensagem` e `status_cliente_atualizado_em` em
  `pedidos`, mantendo SELECT explicito e sanitizado. O modulo
  `js/screens/cliente-pedido-tracking.js`
  (`buildClientePedidoTrackingCard(pedido)`) continua sendo puro
  (sem Supabase, sem writes), mas deixou de usar o stepper local
  antigo de 6 etapas. Agora usa a taxonomia compartilhada de
  `js/pedido-tracking-ui.js`, com 8 etapas principais, 4 excecoes,
  prioridade para `status_cliente_excecao`, depois
  `status_cliente_visual`, depois fallback seguro para `recebido`
  quando ainda nao houver status visual publicado. `cancelado`
  virou excecao terminal com aviso calmo, sem renderizar o progresso
  comum. Mensagem personalizada publicada pelo admin sobrescreve a
  frase padrao. `status_cliente_atualizado_em` aparece no card quando
  existir. **O cliente ainda nao le `pedido_cliente_eventos`.**
  **Nao ha timeline/historico nesta fase.** **Dashboard cliente ainda
  nao existe.** **Status operacional continua separado do status
  visual.**
- **Controle admin de publish do tracking visual** (fase
  `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-ADMIN-A`, esta):
  novo modulo `js/screens/pedido-tracking-admin.js`, carregado em
  `index.html` antes de `js/screens/pedido-detail.js`. Exposicoes:
  `window.buildPedidoTrackingAdminCard` e
  `window.RAVATEX_SCREENS.pedidoTrackingAdmin`.
  `pedido-detail.js` agora integra o card "Situacao visivel ao
  cliente" no detalhe admin, sem mexer no controle de
  `pedidos.status` operacional. O card aparece apenas para
  `CURRENT_USER.tipo === 'admin'`, usa a taxonomia compartilhada
  (`CLIENTE_TRACKING_STEPS` e `CLIENTE_TRACKING_EXCECOES`), permite
  selecionar `status_cliente_visual`, selecionar/limpar
  `status_cliente_excecao`, editar `status_cliente_mensagem`, ver
  preview read-only e salvar. Writes: `update` em `public.pedidos`
  para `status_cliente_visual`, `status_cliente_excecao` e
  `status_cliente_mensagem`; depois `insert` em
  `public.pedido_cliente_eventos` com `pedido_id`, `status`,
  `titulo`, `mensagem`, `origem = 'manual'`, `visivel_cliente = true`,
  `criado_por = CURRENT_USER.id` e `metadata = null`. Regras de erro:
  falha em `pedidos` aborta o historico; falha no historico apos o
  update fica explicita ao admin. **O cliente ainda nao le
  `pedido_cliente_eventos`.** **Status operacional continua separado.**
  **Fornecedor nao participa.**

## Estado operacional atual
- `index.html` estÃƒÂ¡ declarativo, sem script inline final, com
  cache-busting `?v=20260623-asset1` em 26 assets locais
  (23 originais + `js/screens/pedido-detail.js` adicionado em C3A).
- `js/boot.js` ÃƒÂ© o entrypoint oficial; respeita DOM ready
  (`startApp` aguarda `DOMContentLoaded` se
  `document.readyState === 'loading'`).
- `js/router.js` ÃƒÂ© engine genÃƒÂ©rica e nÃƒÂ£o foi alterado no ciclo.
- `js/ui.js` faz lookup lazy do root `#app` via `getAppRoot()` Ã¢â‚¬â€
  `replaceChildren null` foi eliminado apÃƒÂ³s cache limpo.
- `js/screens/op-pdf.js` foi extraÃƒÂ­do de `op-nova.js` em
  `7f3c6da` (`RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A`).
- `run-local.bat` ÃƒÂ© o tooling local para servir o app em
  `http://localhost:8765/`.

## DecisÃƒÂ£o arquitetural vigente
**REFATORAÃƒâ€¡ÃƒÆ’O ARQUITETURAL CONGELADA.**

PrÃƒÂ³xima fase esperada ÃƒÂ© **homologaÃƒÂ§ÃƒÂ£o / release**, **nÃƒÂ£o** nova
extraÃƒÂ§ÃƒÂ£o em `op-nova.js`. Em particular, **NÃƒÆ’O iniciar** novas fases
como `RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`,
`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A` ou
`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A` sem nova instruÃƒÂ§ÃƒÂ£o
explÃƒÂ­cita do dono do projeto: o refactor estÃƒÂ¡ fechado e essas
sugestÃƒÂµes sÃƒÂ£o **opcionais** (vide `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`
seÃƒÂ§ÃƒÂ£o 9).

## Comandos de verificaÃƒÂ§ÃƒÂ£o (rodar antes de qualquer patch)

```bash
cd "D:\OneDrive\ProgramaÃƒÂ§ÃƒÂ£o\Ravatex\controle-tapetes"

git status --short
git branch --show-current
git rev-parse --short HEAD
git remote -v
git ls-remote --heads staging main
git ls-remote --heads origin main
```

Abortar e revisar o escopo se:
- branch != `work/app-next`;
- HEAD nÃƒÂ£o estiver no commit `247b8ca` ou commit posterior
  da fase `RAVATEX-TAPETES-PEDIDOS-CLIENTE-SCHEMA-RLS-B1`
  (commit "Add cliente perfil schema and RLS" no topo);
- working tree nÃƒÂ£o estiver limpo;
- `staging/main` nÃƒÂ£o tiver sido atualizado para o commit
  desta fase (antes do push era `247b8ca`);
- `origin/main` != `1047181eba888242c6428de366cbd9fda2f1c72c`
  (qualquer mudanÃƒÂ§a em `origin/main` ÃƒÂ© regressÃƒÂ£o grave).

## Regras (NÃƒÆ’O renegocia)

1. **Push autorizado somente para `staging`**, salvo ordem explÃƒÂ­cita
   futura. Nunca `git push origin` em `work/app-next:main`.
2. **NÃƒÂ£o tocar `origin/main` oficial.**
3. **NÃƒÂ£o tocar PR #2.**
4. **NÃƒÂ£o acessar Supabase real** em refactors/testes mockados. Toda
   validaÃƒÂ§ÃƒÂ£o de chain de Supabase usa `fakeSupa` em `vm.Context`.
5. **NÃƒÂ£o registrar** em relatÃƒÂ³rio ou doc: `service_role`, senha,
   `JWT secret`, connection string com senha, anon key completa.
6. **Testes focados** por fase (`node --test <arquivo>.smoke.js`).
   NÃƒÂ£o rodar suÃƒÂ­te completa por padrÃƒÂ£o.
7. **Fase schema-only atual**: sÃƒÂ³ `db/15_status_cliente_visual.sql`,
   `tests/cliente-tracking-schema.smoke.js`, `PROJECT_STATE.md`,
   `AGENT_HANDOFF.md` e `docs/DOCUMENTATION_INDEX.md` podem ser
   criados/alterados. Qualquer diff fora desses 5 arquivos reprova.
8. **NÃƒÂ£o mexer** em `aplicarRecalculoOP` ou `persistirOP` sem
   nova fase explÃƒÂ­cita.
9. **NÃƒÂ£o fazer docs + cÃƒÂ³digo na mesma fase.**
10. **NÃƒÂ£o iniciar nova extraÃƒÂ§ÃƒÂ£o em `op-nova.js`** (refactor
    congelado). PrÃƒÂ³xima aÃƒÂ§ÃƒÂ£o ÃƒÂ© homologaÃƒÂ§ÃƒÂ£o/release, nÃƒÂ£o refactor.

## MÃƒÂ³dulos principais e responsabilidades

### `boot.js` (RAVATEX-TAPETES-ROUTES-BOOT-MODULE-A + 87d4559)
- Registra rotas via `window.RAVATEX_ROUTER.setRoutes` (15 rotas).
- Executa `main()` via `startApp()` (que aguarda `DOMContentLoaded`
  se `document.readyState === 'loading'`).
- Registra `hashchange` listener.
- Carrega usuÃƒÂ¡rio atual via `window.loadCurrentUser`.
- Direciona para `navigate('#/login')`, `handleRoute()` ou
  `routeAfterLogin()`.
- Captura erro de boot via `main().catch()` + `toast('Erro ao iniciar o app', 'error')`.

### `op-nova.js` (RAVATEX-TAPETES-SCREENNOVAOP-MODULE-A)
- `screenNovaOP` (closure inteira com `~20` subfunÃƒÂ§ÃƒÂµes aninhadas).
- UI/estado da Nova OP.
- Proposta, blocos de fios, tecelagem, wrappers de
  persistÃƒÂªncia/recÃƒÂ¡lculo.
- Call-site de PDF: `window.gerarPdfCompraFios({ op, ordens })`.
- **NÃƒÆ’O** contÃƒÂ©m mais a funÃƒÂ§ÃƒÂ£o `gerarPdfCompraFios` (extraÃƒÂ­da em
  `7f3c6da`).
- MantÃƒÂ©m read-only em Supabase (apenas `.select()`).
- Writes delegados: `window.persistirOP`, `window.aplicarRecalculoOP`,
  `window.registrarRecebimentoOrdemFio`,
  `window.atribuirFornecedorFioOp`, `window.renderOPLatexAdmin`.

### `op-pdf.js` (RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A)
- `gerarPdfCompraFios({ op, ordens })` Ã¢â‚¬â€ helper puro, sem closure.
- Usa `window.jspdf.jsPDF` (CDN) e `window.agruparOrdensCompraFio`
  (de `calculo-op.js`).
- Fallback `toast` quando jsPDF ausente.
- Exports: `window.gerarPdfCompraFios` e
  `window.RAVATEX_SCREENS.opPdf.gerarPdfCompraFios`.
- NÃƒÂ£o toca Supabase, nÃƒÂ£o muta DOM.

### `op-persistir.js` (RAVATEX-TAPETES-OP-PERSISTIR-MODULE-A)
- Helpers puros de persistÃƒÂªncia: `itensValidosOP`,
  `montarPayloadItensOP`, `montarPayloadFornecedoresOP`,
  `montarPayloadOP`, `montarPayloadLote`.
- Write helper: `persistirOP` Ã¢â‚¬â€ executa 8 writes da persistÃƒÂªncia
  (ops, lotes, op_itens, op_fornecedores, ordens_compra_fio).
  Retorna envelope `{ error, step, partial, opId }`.

### `op-recalculo.js` (RAVATEX-TAPETES-OP-RECALCULO-MODULE-A)
- Helpers puros: `maxMetrosItem`, `normalizarChaveSaldo`.
- Write helper: `aplicarRecalculoOP` Ã¢â‚¬â€ executa 4 writes do recÃƒÂ¡lculo
  (`op_itens.update`, `saldo_fios_op.insert`, `saldo_fios`
  select/update/insert, `ops.update status='em_producao'`).
  Retorna envelope `{ error, step, partial }`.

### `ui.js` (87d4559 + e0dbfcd)
- `el`, `toast`, `pageHeader`, `textInput`, `selectInput`,
  `formField`, `dataTable`, `modal`, `confirmDialog`, `shellLayout`,
  `ADMIN_MENU`.
- `getAppRoot()` Ã¢â‚¬â€ lookup lazy do root `#app`.

## PrÃƒÂ³xima recomendaÃƒÂ§ÃƒÂ£o operacional

**GovernanÃƒÂ§a Portal B2B/Pedidos registrada (fase GOV-A, esta).**
Antes de retomar o schema de tracking do cliente, o projeto agora tem
um documento curto e vinculante de limites arquiteturais em
`docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md`.

**Schema visual do cliente ja aplicado em staging (fase atual).**
`db/15_status_cliente_visual.sql` ja criou a base futura do tracking
visual sem reaproveitar `pedido_eventos` e sem depender de
`pedidos.status` como fonte definitiva da comunicacao externa.

**Camada compartilhada da taxonomia visual ja criada.**
`js/pedido-tracking-ui.js` centraliza etapas, excecoes e helpers
puros para admin/cliente/dashboard futuros, sem integrar ainda as
telas ao `status_cliente_visual` real.

**Aplicado:** `db/16_pedido_cliente_eventos_cliente_select.sql` ja foi
aplicado e validado no Supabase staging `ucrjtfswnfdlxwtmxnoo`
(fase EVENTS-RLS-B).

**Atualizacao:** o detalhe cliente ja passou a ler
`status_cliente_visual` real nesta fase.

**Entregue (fase TRACKING-CLIENTE-EVENTS-A):** o cliente ja le
`pedido_cliente_eventos` em uma timeline read-only no detalhe do
proprio pedido. Admin continua o unico publicador de eventos.
Fornecedor, dashboard cliente e automacao continuam fora do escopo.

**Homologado (fase E2E-HOMOLOG-RECORD-A, esta):** o fluxo completo
admin Ã¢â€ â€™ cliente (status visual + excecao + timeline) foi validado
manualmente em staging `ucrjtfswnfdlxwtmxnoo`, no HEAD `fc7843c`, e
**aprovado** pelo dono do projeto. Cancelado nao foi testado (fica
para fase futura com pedido de teste dedicado, se necessario).

**Proxima fase recomendada:** Dashboard Cliente read-only ou
refinamento visual do portal cliente, conforme decisao do dono do
projeto.

**Sequencia recomendada depois desta fase:** dashboard cliente;
redesign de shell/componentes comuns; e so depois fornecedor/automacao.

**Homologado (fase `RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-HOMOLOG-RECORD-A`,
esta):** a homologaÃƒÂ§ÃƒÂ£o visual manual do portal cliente B2B (Dashboard,
Meus pedidos, Detalhe, Stepper/Acompanhamento, Timeline), pÃƒÂ³s
refinamento visual da fase POLISH-A, foi validada e **aprovada** pelo
dono do projeto, no HEAD `3b0f8e4`, em ambiente conectado ao Supabase
staging `ucrjtfswnfdlxwtmxnoo`, sem tocar `bhgifjrfagkzubpyqpew`.

**Proxima fase recomendada (atualizada):** decidir, com o dono do
projeto, entre preparaÃƒÂ§ÃƒÂ£o para produÃƒÂ§ÃƒÂ£o/staging closeout do portal
cliente ou avanÃƒÂ§o para o prÃƒÂ³ximo bloco funcional.

**NÃƒÂ£o iniciar execuÃƒÂ§ÃƒÂ£o sem autorizaÃƒÂ§ÃƒÂ£o explÃƒÂ­cita.**
**NÃƒÆ’O tocar `bhgifjrfagkzubpyqpew`, Vercel original, ou `origin/main`.**

## Fases de implementaÃƒÂ§ÃƒÂ£o do design Auth (aprovadas para execuÃƒÂ§ÃƒÂ£o)

Design concluÃƒÂ­do em `docs/architecture/AUTH_PROVISIONING_EDGE_DESIGN.md`.
Fases, em ordem:

1. **`RAVATEX-TAPETES-AUTH-EDGE-FUNCTION-A`** Ã¢â‚¬â€ criar/implementar a
   Edge Function `admin-create-user` (sem UI ainda). **ConcluÃƒÂ­da
   localmente (sem deploy).**
2. **`RAVATEX-TAPETES-AUTH-EDGE-STAGING-DEPLOY-A`** Ã¢â‚¬â€ deploy controlado
   em staging e validaÃƒÂ§ÃƒÂ£o de permissÃƒÂµes. **ConcluÃƒÂ­da em staging.**
3. **`RAVATEX-TAPETES-AUTH-ADMIN-UI-A`** Ã¢â‚¬â€ adaptar
   `screenCadastrosUsuarios` para chamar a Edge Function. **ConcluÃƒÂ­da.**
4. **`RAVATEX-TAPETES-AUTH-PROVISIONING-DOCS-A`** Ã¢â‚¬â€ documentar operaÃƒÂ§ÃƒÂ£o
   final (runbook). **ConcluÃƒÂ­da.**
5. **`RAVATEX-TAPETES-AUTH-DELETE-USER-DESIGN-A`** Ã¢â‚¬â€ decidir
   exclusÃƒÂ£o/desativaÃƒÂ§ÃƒÂ£o de usuÃƒÂ¡rios pelo app. **ConcluÃƒÂ­da.**
   RecomendaÃƒÂ§ÃƒÂ£o: desativar (soft delete + ban Auth), nÃƒÂ£o deletar.
   Design em `docs/architecture/AUTH_DELETE_USER_DESIGN.md`.
6. **`RAVATEX-TAPETES-AUTH-DELETE-UI-GUARD-A`** Ã¢â‚¬â€ contenÃƒÂ§ÃƒÂ£o
   imediata: remover `.from('usuarios').delete()` do front-end e
   substituir botÃƒÂ£o "Excluir vÃƒÂ­nculo" por placeholder "Em breve".
   **ConcluÃƒÂ­da.** Nenhum write Supabase exposto; nenhum `auth.admin`
   no front; smoke tests 48/48 verdes.
7. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-A`** Ã¢â‚¬â€ schema
   versionado para desativaÃƒÂ§ÃƒÂ£o (colunas + recriaÃƒÂ§ÃƒÂ£o de funÃƒÂ§ÃƒÂµes e
   policies RLS em `public.usuarios`). **ConcluÃƒÂ­da.** Migration em
   `db/12_auth_user_disable_schema.sql`; testes 20/20 em
   `tests/auth-disable-user-schema.smoke.js`. **Aplicada em staging**
   (ver item 8b).
8. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-A`** Ã¢â‚¬â€ aplicar
   a migration em staging. **ConcluÃƒÂ­da como docs-only (commit
   `8fa924a`).** OrientaÃƒÂ§ÃƒÂ£o e validaÃƒÂ§ÃƒÂ£o local para aplicaÃƒÂ§ÃƒÂ£o em
   staging; smoke 20/20 e regressÃƒÂµes 65/65 verdes; SQL limpo
   (sem DELETE/DROP/TRUNCATE/secrets). A execuÃƒÂ§ÃƒÂ£o real do SQL
   ficou pendente de HMNlead e foi registrada na fase 8b.
8b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-SCHEMA-APPLY-EVIDENCE-A`**
    *(esta fase, docs-only)* Ã¢â‚¬â€ registro da **aplicaÃƒÂ§ÃƒÂ£o real** de
    `db/12_auth_user_disable_schema.sql` no Supabase **staging**
    `ucrjtfswnfdlxwtmxnoo`, feita manualmente pelo HMNlead no
    SQL Editor do Dashboard. EvidÃƒÂªncias: 4 colunas novas em
    `public.usuarios`; funÃƒÂ§ÃƒÂµes `is_admin`/`meu_fornecedor_id`
    recriadas com checagem de `ativo`; policies
    `usuarios_select`/`usuarios_admin_all`/`usuarios_self_update`
    recriadas; contagem `ativo = true, total = 3`,
    `auth_users_total = 3`, `public_usuarios_total = 3`,
    `auth_sem_perfil = 0`, `perfil_sem_auth = 0`. Nenhum usuÃƒÂ¡rio
    foi criado, excluÃƒÂ­do ou desativado. `db/10_reset_producao.sql`
    e `db/11_reset_ops.sql` nÃƒÂ£o foram rodados. ProduÃƒÂ§ÃƒÂ£o
    `bhgifjrfagkzubpyqpew` nÃƒÂ£o foi tocada. App validado
    manualmente em staging: login OK, `#/cadastros/usuarios`
    carrega, `+ Novo usuÃƒÂ¡rio` visÃƒÂ­vel, exclusÃƒÂ£o insegura segue
    bloqueada como `Em breve`, sem erros crÃƒÂ­ticos de Auth/RLS
    no console. Warnings nÃƒÂ£o bloqueantes: Tailwind CDN,
    `favicon.ico` 404.
9. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-A`** Ã¢â‚¬â€ Edge Function
   `admin-disable-user` (soft delete no perfil + ban Auth).
   **ConcluÃƒÂ­da localmente (sem deploy).** ImplementaÃƒÂ§ÃƒÂ£o em
   `supabase/functions/admin-disable-user/index.ts` (mesmos
   `_shared/cors.ts` e `_shared/response.ts` de `admin-create-user`).
   ValidaÃƒÂ§ÃƒÂµes: JWT no header `Authorization` + `tipo = 'admin' AND
   ativo IS TRUE` em `public.usuarios` server-side; UUID regex
   para `user_id`; `reason` Ã¢â€°Â¤ 500 chars (trim, opcional);
   `SELF_DISABLE_FORBIDDEN` quando `target_id === caller_id`;
   `LAST_ADMIN_FORBIDDEN` quando alvo ÃƒÂ© o ÃƒÂºnico admin ativo;
   idempotÃƒÂªncia (`already_disabled: true`) se alvo jÃƒÂ¡ estÃƒÂ¡ inativo;
   soft delete via `.update({ ativo: false, desativado_em, desativado_por,
   motivo_desativacao })`; ban Auth via
   `auth.admin.updateUserById(target_id, { ban_duration: '876000h' })`;
   compensaÃƒÂ§ÃƒÂ£o (reverte `ativo = true` e limpa campos) se ban
   falhar; `COMPENSATION_FAILED` se a reversÃƒÂ£o tambÃƒÂ©m falhar.
   **Sem `auth.admin.deleteUser` e sem `.delete()`** Ã¢â‚¬â€ apenas soft
   delete. Smoke `tests/admin-disable-user.smoke.js` 39/39 verde.
   RegressÃƒÂµes preservadas: `admin-create-user` 17/17,
   `auth-disable-user-schema` 20/20, `cadastros-usuarios-auth-ui`
   16/16, `cadastros-screens` 32/32. **Sem deploy nesta fase.**
   Deploy e validaÃƒÂ§ÃƒÂ£o E2E em staging:
   `RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`
   (prÃƒÂ³xima fase).
10. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-EDGE-STAGING-DEPLOY-A`**
    *(prÃƒÂ³xima Ã¢â‚¬â€ separada da fase atual)* Ã¢â‚¬â€ deploy controlado de
    `admin-disable-user` em staging e validaÃƒÂ§ÃƒÂ£o manual. A fase
    E2E-AUTO-RUNNER-A abaixo jÃƒÂ¡ cria o runner que automatiza a
    validaÃƒÂ§ÃƒÂ£o E2E.
 11. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-AUTO-RUNNER-A`**
     *(em andamento, fase atual, repo-only)* Ã¢â‚¬â€ runner local
     automatizado em `scripts/staging/admin-disable-user-e2e.mjs`
     com comandos `setup` (coleta admin_email/admin_password uma
     ÃƒÂºnica vez; detecta staging de `js/config.js`; salva em
     `.ravatex-local/admin-disable-user-e2e.config.json`,
     gitignored) e `run` (carrega config; aborta se URL nÃƒÂ£o for
     `ucrjtfswnfdlxwtmxnoo` ou se for `bhgifjrfagkzubpyqpew`;
     login admin; valida `tipo=admin AND ativo=true`; resolve
     `fornecedor_id` config/autodetect; cria fornecedor descartÃƒÂ¡vel
     via `admin-create-user`; tenta desativar admin como fornecedor
     esperando `FORBIDDEN`; revalida admin; desativa descartÃƒÂ¡vel
     esperando `auth_banned=true`; valida `desativado_em`/
     `desativado_por`/`motivo_desativacao`; tenta login do
     desativado esperando falha; re-desativa esperando
     `already_disabled=true`; tenta self-disable esperando
     `SELF_DISABLE_FORBIDDEN`; imprime resumo sanitizado).
     Smoke estÃƒÂ¡tico
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (apÃƒÂ³s `E2E-RUNNER-FIX-A`).
     `.gitignore` agora ignora `.ravatex-local/`. **E2E real
     nÃƒÂ£o foi rerodado apÃƒÂ³s o fix** Ã¢â‚¬â€ fica para a prÃƒÂ³xima
     (`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-A` ou similar).
 11b. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-E2E-RUNNER-FIX-A`**
     *(esta fase, repo-only)* Ã¢â‚¬â€ correÃƒÂ§ÃƒÂ£o do bug do runner no
     passo `login_blocked`. ExecuÃƒÂ§ÃƒÂ£o real do runner em staging
     avanÃƒÂ§ou atÃƒÂ© `profile_inactive` e falhou com
     `HTTP 400 User is banned` tratado como erro fatal, porque
     `supabaseLogin` chamava `die()`/`process.exit` em qualquer
     HTTP 4xx e usava mensagem hardcoded "Login admin falhou"
     (rÃƒÂ³tulo incorreto para o usuÃƒÂ¡rio descartÃƒÂ¡vel desativado).
     CorreÃƒÂ§ÃƒÂ£o: helpers separados `loginExpectSuccess(...)` (fatal,
     rÃƒÂ³tulo parametrizado: `admin_login failed`,
     `test_user_login failed`, `admin_relogin failed`) e
     `loginExpectFailure(...)` (nÃƒÂ£o-fatal; aceita HTTP 4xx com
     `User is banned`/`banned`/`Banned user`/`User is already
     registered` como falha esperada; retorna
     `{ ok, unexpected, status, detail }` para o caller decidir).
     Camada HTTP crua em `postSupabaseLogin(...)` (sem `die()`).
     Passo `login_blocked` agora imprime `login_blocked: OK` e
     continua para `idempotency` e `self_disable_blocked`. Smoke
     estÃƒÂ¡tico
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 verde
     (4 testes novos: login bloqueado esperado, fluxo continua,
     loginExpectSuccess nos 3 logins, loginExpectFailure com
     substrings banned, loginExpectFailure retorna controle).
     RegressÃƒÂ£o `admin-disable-user.smoke.js` 39/39. **E2E real
     nÃƒÂ£o foi rerodado nesta fase** Ã¢â‚¬â€ sÃƒÂ³ apÃƒÂ³s autorizaÃƒÂ§ÃƒÂ£o do
     HMNlead. **Sem deploy, sem Supabase real, sem SQL, sem
     alteraÃƒÂ§ÃƒÂ£o de UI, sem produÃƒÂ§ÃƒÂ£o, sem origin/main, sem PR
     #2.**
 11c. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(esta
     fase, repo-only)* Ã¢â‚¬â€ integraÃƒÂ§ÃƒÂ£o da tela
     `#/cadastros/usuarios` com a Edge Function
     `admin-disable-user` (jÃƒÂ¡ deployada em staging
     `ucrjtfswnfdlxwtmxnoo`). BotÃƒÂ£o `Desativar` substitui o
     placeholder `Em breve`; chama
     `window.supa.functions.invoke('admin-disable-user', {
     body: { user_id: usr.id, reason } })`; modal de
     confirmaÃƒÂ§ÃƒÂ£o com campo de motivo opcional (Ã¢â€°Â¤ 500 chars,
     default `"DesativaÃƒÂ§ÃƒÂ£o via UI"`); mapeia 8 cÃƒÂ³digos de erro
     (`FORBIDDEN`/`SELF_DISABLE_FORBIDDEN`/
     `LAST_ADMIN_FORBIDDEN`/`NOT_FOUND`/`AUTH_BAN_FAILED`/
     `COMPENSATION_FAILED`/`VALIDATION_ERROR`/`UNAUTHORIZED`)
     para mensagens PT-BR; guarda de UX para o prÃƒÂ³prio usuÃƒÂ¡rio
     logado e para usuÃƒÂ¡rios jÃƒÂ¡ inativos (proteÃƒÂ§ÃƒÂ£o visual, nÃƒÂ£o
     substitui server-side); coluna `Status` na listagem
     (`Ativo`/`Inativo`). Helper top-level
     `friendlyDisableMessage(code, fallback)` no
     `js/screens/cadastros.js`. Preserva `+ Novo usuÃƒÂ¡rio` e a
     chamada `admin-create-user`. **Sem deploy, sem Supabase
     real, sem SQL, sem produÃƒÂ§ÃƒÂ£o, sem origin/main, sem PR
     #2, sem E2E real nesta fase.** E2E real do runner jÃƒÂ¡
     havia passado em `result: PASS` em staging ANTES desta
     fase (evidÃƒÂªncia sanitizada em LEDGER Ã‚Â§5k). Smoke
     `tests/cadastros-usuarios-auth-ui.smoke.js` 23/23 verde
     (+7 testes novos para a fase UI-A: botÃƒÂ£o `Desativar`
     substitui `Em breve`, chamada `admin-disable-user` com
     payload `user_id`+`reason`, leitura de
     `error.context.json`, tratamento dos 8 cÃƒÂ³digos, guarda
     de UX para self e inativo, coluna Status, preservaÃƒÂ§ÃƒÂ£o
     de `+ Novo usuÃƒÂ¡rio` e `admin-create-user`); regressÃƒÂµes
     focais `tests/cadastros-screens.smoke.js` 32/32,
     `tests/admin-disable-user.smoke.js` 39/39,
     `tests/admin-create-user.smoke.js` 17/17,
     `tests/admin-disable-user-e2e-runner.smoke.js` 32/32 Ã¢â‚¬â€
     todas verdes.
12. **`RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A`** *(futura)* Ã¢â‚¬â€ restaurar
    botÃƒÂ£o "Desativar" na UI quando Edge Function estiver
    deployada e validada em staging.

## PossÃƒÂ­veis fases futuras opcionais (NÃƒÆ’O obrigatÃƒÂ³rias)

Estas fases **nÃƒÂ£o** fazem parte do fechamento do refactor e **nÃƒÂ£o**
sÃƒÂ£o bloqueadas pelo design Auth. SÃƒÂ£o sugestÃƒÂµes para trabalho futuro,
se houver benefÃƒÂ­cio prÃƒÂ¡tico **e** autorizaÃƒÂ§ÃƒÂ£o explÃƒÂ­cita do dono do
projeto:

- **`RAVATEX-TAPETES-OP-BLOCO-FIOS-DIAG-A`** Ã¢â‚¬â€ diagnosticar
  `buildBlocoFios` (montagem do bloco de recebimento de fios).
- **`RAVATEX-TAPETES-OP-PROPOSTA-DIAG-A`** Ã¢â‚¬â€ diagnosticar
  `buildProposta` / `recompute` / `onAceitar` (UI de proposta +
  interaÃƒÂ§ÃƒÂ£o com recÃƒÂ¡lculo).
- **`RAVATEX-TAPETES-TRANSACTION-RISK-DIAG-A`** Ã¢â‚¬â€ avaliar uso de
  RPC/transaÃƒÂ§ÃƒÂµes Supabase para `persistirOP` e `aplicarRecalculoOP`
  (risco de produto/dados, nÃƒÂ£o de refactor).

> **Nota:** `RAVATEX-TAPETES-OP-PDF-MODULE-A` foi **executada** em
> `7f3c6da`; nÃƒÂ£o estÃƒÂ¡ mais em backlog.

## ProibiÃƒÂ§ÃƒÂµes operacionais

- **NÃƒÂ£o tocar `origin/main` nem PR #2 sem autorizaÃƒÂ§ÃƒÂ£o explÃƒÂ­cita.**
- **NÃƒÂ£o mexer em `persistirOP` ou `aplicarRecalculoOP` sem fase
  especÃƒÂ­fica** (risco transacional residual, documentado em
  `PROJECT_STATE.md` e no LEDGER).
- **NÃƒÂ£o fazer docs + cÃƒÂ³digo na mesma fase.**
- **NÃƒÂ£o tratar cortes opcionais como obrigatÃƒÂ³rios** (sugestÃƒÂµes acima
  sÃƒÂ£o apenas para futuro).
- **NÃƒÂ£o iniciar nova extraÃƒÂ§ÃƒÂ£o em `op-nova.js`** (refactor
  congelado em `7f3c6da`).
- **NÃƒÂ£o remover o cache-busting `?v=20260623-asset1`** de `index.html`
  (proteÃƒÂ§ÃƒÂ£o contra navegador servindo JS antigo).
- **NÃƒÂ£o remover `getAppRoot()`** de `js/ui.js` (proteÃƒÂ§ÃƒÂ£o contra
  `replaceChildren null` no boot).

## Resumo do refactor (24 mÃƒÂ³dulos extraÃƒÂ­dos)

| # | MÃƒÂ³dulo | Commit | Fase |
|---|---|---|---|
| 1 | `js/config.js` | `5547e27` | CONFIG-MODULE-A |
| 2 | `js/supabase-client.js` | `6d50d08` | SUPABASE-CLIENT-MODULE-A |
| 3 | `js/environment-banner.js` | `1f3238d` | ENV-BANNER-MODULE-A |
| 4 | `js/auth.js` | `1b56571` | AUTH-MODULE-A |
| 5 | `js/router.js` | `6bb203f` | ROUTER-MODULE-A |
| 6 | `js/screens/system-screens.js` | `786f6b4` | SYSTEM-SCREENS-MODULE-A |
| 7 | `js/screens/common.js` | `ed8e75c` | SCREENS-COMMON-MODULE-A |
| 8 | `js/screens/cadastros.js` | `dd24365` | CADASTROS-SCREENS-MODULE-A |
| 9 | `js/screens/ops-list.js` | `d7a8d25` | OPS-LIST-SCREEN-MODULE-A |
| 10 | `js/screens/entrega-form.js` | `958f244` | ENTREGA-FORM-HELPER-MODULE-A |
| 11 | `js/screens/entrega-writes.js` | `7ec1721` (+ `e190022`, `70635aa`) | ENTREGA-WRITES-MODULE-A (+ LATEX, + CIMA) |
| 12 | `js/screens/fornecedor.js` | `4b9ca12` | FORNECEDOR-SCREENS-MODULE-A |
| 13 | `js/screens/op-form-helpers.js` | `c480324` | OP-FORM-HELPERS-MODULE-A |
| 14 | `js/screens/op-writes.js` | `ab79f1c` (+ `1429950`) | OP-ORDER-WRITE-MODULE-A (+ OP-FORNECEDOR-WRITE-MODULE-A) |
| 15 | `js/screens/op-latex-admin.js` | `69c0036` | OP-LATEX-ADMIN-SCREEN-MODULE-A |
| 16 | `js/screens/painel.js` | `065a796` | SCREENPAINEL-MODULE-A |
| 17 | `js/screens/op-recalculo.js` | `c599c21` (+ `4ce5080`) | OP-RECALCULO-HELPERS-MODULE-A (+ OP-RECALCULO-WRITES-MODULE-A) |
| 18 | `js/screens/op-persistir.js` | `8fd4dd2` (+ `cac20f9`) | OP-PERSISTIR-HELPERS-MODULE-A (+ OP-PERSISTIR-WRITES-MODULE-A) |
| 19 | `js/screens/op-nova.js` | `ce3dd14` | SCREENNOVAOP-MODULE-A |
| 20 | `js/boot.js` | `4c18fe7` | ROUTES-BOOT-MODULE-A |
| 21 | `js/screens/op-pdf.js` | `7f3c6da` | RAVATEX-TAPETES-OP-NOVA-PDF-MODULE-A |
| 22 | `js/screens/pedidos-list.js` | `bf960f8` | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C1 |
| 23 | `js/screens/pedido-form.js` | `62a9f9a` (+ `2de595c`) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C2 (+ C2-R1) |
| 24 | `js/screens/pedido-detail.js` | `7184388` + `d2b5a6a` + (commit desta fase) | RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A (+ C3B: aÃƒÂ§ÃƒÂµes reais de status + C3C1: Editar funcional por status) |
| 25 | `js/screens/pedido-edit.js` | `2d36077` C3C1: ediÃƒÂ§ÃƒÂ£o admin dos dados gerais do Pedido |
| 26 | `js/screens/pedido-itens-edit.js` | `acc96c3` C3C2B: ediÃƒÂ§ÃƒÂ£o admin de itens existentes (update 3 chaves) + `fd1a9a3` C3C2C1: tambÃƒÂ©m ADICIONAR novos itens (insert 5 chaves, `isNew`, `Descartar novo item`) + `bd3aedc` C3C2C2: tambÃƒÂ©m REMOVER itens existentes (delete em `pedido_itens` com `.eq('id').eq('pedido_id')`, `markedForDeletion`, `window.confirmDialog`, "Desfazer remoÃƒÂ§ÃƒÂ£o", mÃƒÂ­nimo 1) + (commit desta fase) C3C2C3: tambÃƒÂ©m NORMALIZAR `ordem` automaticamente no `salvar()` (loop `activeItems[i].ordem = i` por posiÃƒÂ§ÃƒÂ£o final; update com 4 chaves incluindo `ordem`; insert com `ordem: it.ordem`; sem drag/setas/reordenar) |

## Testes recentes (focados passando)
- `cliente-pedido-tracking.smoke.js` Ã¢â‚¬â€ novo (fase TRACKING-UI-A).
- `cliente-pedido-detail.smoke.js` Ã¢â‚¬â€ atualizado (fase TRACKING-UI-A).
- `cliente-perfil-schema.smoke.js` Ã¢â‚¬â€ 49/49
- `pedido-itens-edit.smoke.js` Ã¢â‚¬â€ 64/64
- `pedido-edit.smoke.js` Ã¢â‚¬â€ 35/35
- `pedido-detail.smoke.js` Ã¢â‚¬â€ 43/43
- `pedido-form.smoke.js` Ã¢â‚¬â€ 35/35
- `pedido-ui.test.js` Ã¢â‚¬â€ 18/18
- `pedidos-list.smoke.js` Ã¢â‚¬â€ 29/29
- `pedidos-schema.smoke.js` Ã¢â‚¬â€ 41/41
- `boot.smoke.js` Ã¢â‚¬â€ 28/28
- `router.smoke.js` Ã¢â‚¬â€ 41/41
- **Total Pedidos (C1+C2+C2-R1+C3A+C3B+C3C1+C3C2B+C3C2C1+C3C2C2+C3C2C3): 334/334** (todos os focados
  passam).

Focados do refactor (mantidos verdes):
- `op-pdf.smoke.js` Ã¢â‚¬â€ 20/20
- `op-nova.smoke.js` Ã¢â‚¬â€ 30/30
- `op-recalculo.smoke.js` Ã¢â‚¬â€ 59/59
- `op-persistir.smoke.js` Ã¢â‚¬â€ 65/65
- `op-writes.smoke.js` Ã¢â‚¬â€ 49/49
- `op-latex-admin.smoke.js` Ã¢â‚¬â€ 30/30
- `op-form-helpers.smoke.js` Ã¢â‚¬â€ 36/36
- `painel-screen.smoke.js` Ã¢â‚¬â€ 16/16
- `fornecedor-screens.smoke.js` Ã¢â‚¬â€ 35/35

PrÃƒÂ©-existentes dependentes de `http.server :8765`: 6 falhas em
`tests/index-inline.smoke.js` e 17 em `tests/write-guard.smoke.js`
Ã¢â‚¬â€ nÃƒÂ£o relacionadas ao refactor; exigem servidor local
(`.\run-local.bat` ou `python -m http.server 8765`).
Falhas prÃƒÂ©-existentes em `tests/ops-list-screen.smoke.js` (10/30)
sÃƒÂ£o de testes do refactor monolÃƒÂ­tico antigo, **fora do escopo**
da fase `RAVATEX-TAPETES-PEDIDOS-UI-ADMIN-C3A`.

## Comandos seguros por fase

```bash
# ApÃƒÂ³s mudanÃƒÂ§a em js/screens/<X>.js:
node --check js/screens/<X>.js
node --test tests/<X>.smoke.js

# ValidaÃƒÂ§ÃƒÂ£o focada de regressÃƒÂ£o completa:
node --test tests/boot.smoke.js \
              tests/router.smoke.js \
              tests/op-nova.smoke.js \
              tests/op-pdf.smoke.js \
              tests/op-persistir.smoke.js \
              tests/op-recalculo.smoke.js \
              tests/op-writes.smoke.js \
              tests/op-form-helpers.smoke.js \
              tests/op-latex-admin.smoke.js \
              tests/painel-screen.smoke.js \
              tests/fornecedor-screens.smoke.js
```

## O que um agente NÃƒÆ’O deve fazer

- Editar `index.html`, `js/**`, `tests/**` em fase docs-only.
- Rodar `db/10_*`/`db/11_*` (resets destrutivos de produÃƒÂ§ÃƒÂ£o).
- Fazer push em `origin/main`.
- Acessar Supabase real em testes/refactors.
- Registrar `service_role`, senha, `JWT secret`, connection string
  com senha ou anon key completa em qualquer doc/relatÃƒÂ³rio.
- Mexer em `persistirOP` ou `aplicarRecalculoOP` sem nova fase
  explÃƒÂ­cita.
- Tentar mover `renderOPLatexAdmin` para outro mÃƒÂ³dulo (jÃƒÂ¡ estÃƒÂ¡
  isolada em `op-latex-admin.js`).
- Tentar mover `screenPainel` (jÃƒÂ¡ estÃƒÂ¡ isolada em `painel.js`).
- Tentar mover `gerarPdfCompraFios` (jÃƒÂ¡ estÃƒÂ¡ isolada em `op-pdf.js`).
- Rodar `git add .` (sempre stage seletivo por arquivo).
- Mexer no PR #2.
- Tratar fases opcionais (bloco fios, proposta, transaction risk)
  como obrigatÃƒÂ³rias.
- Iniciar nova extraÃƒÂ§ÃƒÂ£o em `op-nova.js` (refactor congelado).
- Remover cache-busting `?v=20260623-asset1` de `index.html`.
- Remover `getAppRoot()` de `js/ui.js`.
- Tratar `docs/superpowers/plans/*.md` como playbook executÃƒÂ¡vel
  (esses planos foram escritos para o monÃƒÂ³lito prÃƒÂ©-refactor e
  instruem a modificar `index.html` diretamente; devem ser
  adaptados ÃƒÂ  arquitetura atual antes de qualquer uso).
- Tratar `docs/qa/*.md` como especificaÃƒÂ§ÃƒÂ£o tÃƒÂ©cnica atual
  (checklists histÃƒÂ³ricos; ver `docs/qa/README.md`).
## Registro documental de schema versionado

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-DOCS-R1` (docs-only,
  fechamento documental). A fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-A-R1` fica aceita com
  **ressalva documental** por registrar, apos o fato, o commit
  publicado `0a02f6a Ã¢â‚¬â€ Add pedido parciais schema`.
- **Escopo publicado no commit `0a02f6a`:**
  `db/17_pedido_parciais_schema.sql` +
  `tests/pedido-parciais-schema.smoke.js`.
- **Validacao registrada:** smoke estatico `16/16`; SQL **nao
  aplicado** em Supabase; producao/original **intocados**; nenhum
  frontend/helper/read-model/lista entrou no commit.
- **Residuos locais preservados para fases futuras:** helper/read-model
  de parciais, lista cliente/status visual e seus testes dedicados
  permaneceram fora deste fechamento documental.
- **Proxima sequencia recomendada:**
  1. helper/read-model de parciais;
  2. lista cliente/status visual;
  3. apply controlado de `db/17_pedido_parciais_schema.sql` em
     staging, somente quando houver autorizacao explicita.

## Registro documental de helper de parciais

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HELPER-A` (helper/read-model puro,
  sem telas consumidoras). O arquivo `js/pedido-tracking-ui.js`
  recebeu somente helpers puros de acompanhamento parcial:
  catalogo `CLIENTE_PARCIAL_SITUACOES`, distribuicao por situacao,
  calculo percentual, DTO seguro de parciais e builder
  `buildPedidoAcompanhamentoParcial`.
- **Compatibilidade preservada:** `window.RavatexPedidoTracking`,
  `CLIENTE_TRACKING_STEPS`, `CLIENTE_TRACKING_EXCECOES` e helpers
  antigos de status visual permanecem disponiveis e com semantica
  preservada; nenhuma tela cliente/admin/fornecedor passou a consumir
  parciais nesta fase.
- **Validacao registrada:** `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/cliente-tracking-steps.smoke.js` e
  `tests/cliente-pedido-tracking.smoke.js` passaram. Sem Supabase, sem
  query real, sem writes, sem apply do `db/17`.
- **Residuos fora de escopo preservados:** lista cliente/status visual
  e seus testes dedicados continuam para fase separada.
- **Proxima decisao recomendada:** ou fechar a fase de lista
  cliente/status visual, ou fazer apply controlado de
  `db/17_pedido_parciais_schema.sql` em staging quando houver
  autorizacao explicita.

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-SCHEMA-APPLY-STAGING-A`
  (aplicacao controlada em staging). O arquivo versionado
  `db/17_pedido_parciais_schema.sql` foi aplicado exatamente como
  publicado no projeto Supabase paralelo/staging
  `ucrjtfswnfdlxwtmxnoo`, via Supabase CLI/Management API, sem tocar
  producao/original `bhgifjrfagkzubpyqpew`.
- **Validacao estrutural registrada:** colunas
  `parcial_habilitado`, `parcial_atualizado_em`, `metros_total` em
  `public.pedidos`; tabelas `pedido_parciais` e
  `pedido_parcial_itens`; RLS habilitada nas duas; policies admin +
  cliente SELECT; funcoes
  `recalcular_pedido_metros_total`,
  `sincronizar_pedido_parciais_resumo`,
  `touch_pedido_parciais_updated_at`,
  `pedido_parciais_after_change`,
  `pedido_itens_sync_parciais_after_change`; triggers
  `pedido_parciais_touch_updated_at`,
  `pedido_parciais_after_change_trigger`,
  `pedido_itens_sync_parciais_after_change_trigger`; constraints
  esperadas presentes, incluindo UNIQUE
  `pedido_parcial_itens_parcial_item_key`.
- **Dados e escopo preservados:** contagens `pedido_parciais = 0` e
  `pedido_parcial_itens = 0`; nenhum dado de negocio foi inserido;
  nenhum frontend foi alterado; parciais ainda nao foram ligadas a
  tela consumidora real nesta fase.
- **Testes locais registrados:** `tests/pedido-parciais-schema.smoke.js`,
  `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/cliente-pedidos-list.smoke.js` e
  `tests/cliente-portal-visual.smoke.js` passaram.
- **Proxima decisao recomendada:** escolher entre ativacao controlada
  da leitura parcial em detalhe/lista ou homologacao tecnica dos
  dados reais de parciais.

## Registro documental de controle admin de parciais

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-CONTROL-A`
  (controle manual admin no detalhe do pedido, sem leitura cliente).
- **Escopo publicado:** novo modulo
  `js/screens/pedido-parciais-admin.js`, integracao em
  `js/screens/pedido-detail.js`, carregamento em `index.html` e smoke
  dedicado `tests/pedido-parciais-admin-control.smoke.js`.
- **Comportamento entregue:** admin lista parciais existentes em
  `pedido_parciais` com SELECT explicito (`id`, `pedido_id`,
  `sequencia`, `situacao`, `metros`, `data_referencia`, `titulo`,
  `mensagem_cliente`, `visivel_cliente`, `criado_em`,
  `atualizado_em`) e pode cadastrar novas parciais manuais via insert
  controlado em `pedido_parciais`, usando `origem = 'manual'`,
  `criado_por` quando `window.CURRENT_USER.id` estiver disponivel e
  `visivel_cliente` default `false`. O formulario reaproveita o
  catalogo compartilhado
  `window.RavatexPedidoTracking.CLIENTE_PARCIAL_SITUACOES` e mostra
  preview tecnico simples com `buildPedidoAcompanhamentoParcial`,
  tolerando `pedidos.metros_total` nulo.
- **Escopo preservado:** cliente ainda nao le `pedido_parciais`;
  lista/dashboard/detalhe/tracking cliente permanecem sem alteracao;
  `pedido_parcial_itens` continua fora do MVP; nenhuma policy, schema,
  SQL, Supabase apply ou producao/original foi tocado.
- **Validacao registrada:** `tests/pedido-parciais-admin-control.smoke.js`,
  `tests/pedido-parciais-schema.smoke.js`,
  `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/cliente-pedido-detail.smoke.js`,
  `tests/cliente-pedidos-list.smoke.js` e
  `tests/cliente-dashboard.smoke.js` passaram.
- **Proxima fase recomendada:** homologacao tecnica do fluxo admin
  criando parciais reais em staging, ou leitura read-only de parciais
  no detalhe cliente depois de haver dados controlados suficientes.

## Registro documental de homologacao admin de parciais

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-ADMIN-HOMOLOG-RECORD-A`
  (docs-only). Homologacao tecnica controlada da UI admin de
  parciais aprovada no HEAD `e2b8723`.
- **Ambiente homologado:** app local conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
  `bhgifjrfagkzubpyqpew`.
- **Pedido e parcial homologados:** pedido `#2`
  (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`) recebeu parcial real criada
  via UI admin, sem SQL manual, com id
  `3966fb1f-c333-4024-92f9-7fabdaa4e532`, `sequencia = 1`,
  `situacao = em_acabamento`, `metros = 2500`,
  `data_referencia = 2026-06-29`, titulo `Parcial em acabamento`,
  mensagem cliente `Parte do pedido esta em etapa de acabamento.`,
  `visivel_cliente = true`, `origem = manual`, `metadata = {}` e
  `criado_por` preenchido (valor nao registrado).
- **Validacao read-only registrada:** `pedido_parciais` gravou o
  registro corretamente; `pedidos` sincronizou
  `parcial_habilitado = true`,
  `parcial_atualizado_em = 2026-06-29T12:39:43.739178+00:00` e
  `metros_total = 10000.00`; `status` permaneceu `recebido`;
  `status_cliente_visual` permaneceu `acabamento`;
  `status_cliente_excecao` permaneceu `null`.
- **Escopo preservado:** `pedido_parcial_itens` continua fora do MVP e
  nao foi usado; cliente ainda nao le `pedido_parciais`; nenhuma tela
  cliente foi alterada; nenhum dado interno foi exposto ao cliente.
- **Restricoes preservadas:** sem schema, sem SQL, sem Supabase
  mutation adicional, sem alteracao de codigo, sem commit de frontend
  novo nesta fase docs-only.
- **Proxima fase recomendada:** leitura read-only de parciais no
  detalhe cliente.

## Registro de leitura cliente de parciais no detalhe

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-CLIENTE-DETAIL-A`
  (frontend cliente read-only apenas no detalhe do pedido).
- **Escopo publicado:** `js/screens/cliente-pedido-detail.js` passou a
  ler `public.pedido_parciais` com SELECT explicito e sanitizado
  (`id`, `pedido_id`, `sequencia`, `situacao`, `metros`,
  `data_referencia`, `titulo`, `mensagem_cliente`, `criado_em`,
  `atualizado_em`), filtro por `pedido_id` e ordenacao por
  `sequencia asc`, `criado_em asc`. O render do detalhe cliente agora
  exibe a secao `Parciais do pedido`, reaproveitando
  `window.RavatexPedidoTracking.buildPedidoAcompanhamentoParcial` para
  taxonomia e labels compartilhados.
- **Escopo preservado:** leitura estritamente read-only; sem
  insert/update/delete/rpc/functions/service role; sem
  `pedido_parcial_itens`; sem alteracao em
  `js/screens/cliente-pedidos-list.js`,
  `js/screens/cliente-dashboard.js`,
  `js/screens/pedido-detail.js`,
  `js/screens/pedido-parciais-admin.js`, fornecedor, schema ou
  Supabase. Tracking, resumo, itens e timeline continuam funcionando
  mesmo se a consulta de parciais falhar, com aviso discreto.
- **Seguranca preservada:** nenhum campo interno/administrativo foi
  exposto ao cliente; fora do SELECT ficaram `metadata`, `criado_por`,
  `origem`, `observacao_admin`, `visivel_cliente`, alem de dados como
  `OP`, `lote`, `fornecedor`, `NF`, `romaneio`, `custo`, `margem` e
  `token_acesso`.
- **Validacao focada registrada:** `tests/cliente-pedido-detail.smoke.js`,
  `tests/pedido-acompanhamento-parcial.smoke.js`,
  `tests/pedido-parciais-admin-control.smoke.js`,
  `tests/cliente-pedidos-list.smoke.js` e
  `tests/cliente-dashboard.smoke.js`.
- **Proxima fase recomendada:** homologacao E2E admin -> cliente das
  parciais em staging, antes de qualquer resumo em lista/dashboard.

## Registro documental da homologacao cliente de parciais com ressalva visual

- **Estado atual aceito:** `work/app-next` na ponta da fase
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-HOMOLOG-RECORD-A`
  (docs-only). A decisao de entrada
  `RAVATEX-TAPETES-CLIENTE-PARCIAIS-E2E-HOMOLOG-R1` fica aceita como
  **APROVADA COM RESSALVA VISUAL** no HEAD `91f7159`.
- **Ambiente homologado:** app local conectado ao Supabase staging
  `ucrjtfswnfdlxwtmxnoo`, sem tocar producao/original
  `bhgifjrfagkzubpyqpew`.
- **Fluxo funcional minimo homologado:** o cliente dono do pedido `#2`
  (`ee62b4aa-aa97-46b9-a44f-3b7d992dcdcb`) visualizou no detalhe do
  proprio pedido a secao `Parciais do pedido`, com a parcial visivel
  ja homologada (`sequencia = 1`, situacao amigavel
  `Em acabamento`, `metros = 2500`, `data_referencia = 2026-06-29`,
  titulo `Parcial em acabamento`, mensagem
  `Parte do pedido esta em etapa de acabamento.`). Tracking, resumo,
  itens e timeline permaneceram operacionais no fluxo validado.
- **Seguranca funcional preservada:** a leitura cliente permaneceu
  read-only e sem exposicao de `metadata`, `criado_por`, `origem`,
  `observacao_admin`, `OP`, `lote`, `fornecedor`, `NF`, `romaneio`,
  `custo`, `margem`, `token_acesso` ou `service_role`.
- **Escopo preservado:** lista e dashboard cliente continuam sem
  resumo/bloco de parciais nesta entrega funcional minima; nenhum
  codigo, schema, SQL, Supabase mutation ou alteracao visual foi
  realizado nesta fase documental.
- **Ressalva registrada:** o acabamento visual do detalhe cliente
  ainda esta distante do HTML de referencia. Essa lacuna nao bloqueia
  a aprovacao funcional minima da leitura de parciais, mas deve seguir
  como frente separada de polish visual.
- **Proxima fase recomendada:** abrir frente dedicada de acabamento
  visual do detalhe cliente, separada da funcionalidade de parciais.

## Homologacao visual da tela Admin Nova OP

- **Estado atual aceito:** `work/app-next` no HEAD `9495918`, fase
  `RAVATEX-TAPETES-ADMIN-NOVA-OP-MATCH-STANDALONE-CLOSEOUT`. Fica
  aceita como **APROVADA** a homologacao visual da tela Admin Ã¢â€ â€™
  Nova OP, com aceite visual explicito do dono do projeto em app
  local (`run-local.bat`).
- **Escopo publicado:** `js/screens/op-nova.js` (rota `#/ops/nova` e
  edicao `#/ops/:id`) foi redesenhado para igualar ao HTML standalone
  `Admin - Nova OP - standalone.html` Ã¢â‚¬â€ header com subtitulo e botao
  Voltar, card "1. Dados da OP", card "2. Itens da OP", card
  "3. Recebimento de fios" (pendentes, recebidas, proposta por
  sliders), card "4. Entregas tecelagem", coluna lateral "Resumo da
  OP" e barra inferior informativa. Unico arquivo funcional alterado.
- **Shell preservado:** `js/screens/common.js`, `index.html`,
  sidebar e topbar nao foram tocados (shell ja homologado em
  `1afdce8`).
- **Acoes/validacoes/writes preservados:** rota, validacoes de
  numero/ano/cliente/itens/fornecedor, toasts e os call-sites de
  `window.persistirOP`, `window.aplicarRecalculoOP`,
  `window.registrarRecebimentoOrdemFio`,
  `window.atribuirFornecedorFioOp`, `window.renderOPLatexAdmin`
  permanecem identicos; nenhum payload, RPC ou query foi alterado.
- **Diferenca residual deferida:** as colunas Quantidade e
  Observacao por item, presentes no standalone, nao existem em
  `op_itens` (`db/01_schema.sql` so tem `modelo_id` e
  `metros_pedidos`) e exigiriam schema/logica nova Ã¢â‚¬â€ a tabela real
  usa apenas Modelo/Metros/Acoes; decisao de adicionar esses campos
  fica para fase futura.
- **Seguranca/escopo preservados:** nenhum schema, SQL, Supabase
  mutation, producao ou `origin/main` foi tocado nesta fase.
- **Validacao focada registrada:** `node --check js/screens/op-nova.js`,
  `tests/op-nova.smoke.js` (30/30) e `git diff --check` verdes.
  Suite opcional de nao-regressao do fluxo OP
  (`tests/op-persistir.smoke.js`, `tests/op-recalculo.smoke.js`,
  `tests/op-writes.smoke.js`, `tests/op-form-helpers.smoke.js`,
  `tests/op-pdf.smoke.js`, `tests/op-latex-admin.smoke.js`) tambem
  executada: 2 falhas pre-existentes e nao relacionadas
  (`screenPainel ... 9 itens do ADMIN_MENU`, ja presentes no HEAD
  `9495918` antes desta fase, confirmadas via `git stash`) Ã¢â‚¬â€ nao
  corrigidas por estarem fora do escopo desta fase.
- **Proxima fase recomendada:** avaliar, em frente separada, se vale
  criar campos de quantidade/observacao por item de OP (exige
  schema).

## Homologacao visual Admin Fornecedores + campos opcionais de contato

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-FORNECEDORES-MATCH-STANDALONE-AND-CONTACT-FIELDS-CLOSEOUT`,
  com aceite visual/funcional explicito do dono no HEAD `1fdc54b`.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Escopo homologado em Fornecedores:** a tela Admin ->
  `#/cadastros/fornecedores` ficou alinhada visualmente ao standalone
  em header, busca, tabela/card, coluna `EMAIL (opcional)`, acoes,
  modal e footer, preservando o CRUD real e as permissoes admin.
- **Campos opcionais homologados:** a migration
  `db/18_fornecedores_clientes_optional_contact_fields.sql` foi
  versionada para registrar a ampliacao de schema ja aplicada somente
  no Supabase staging `ucrjtfswnfdlxwtmxnoo`, sem tocar producao nem
  `origin/main`.
- **Campos adicionados por tabela:** `fornecedores.email`,
  `fornecedores.telefone`, `clientes.contato`,
  `clientes.telefone`.
- **Validacao funcional em staging:** Fornecedores carregou lista,
  exibiu `EMAIL (opcional)`, permitiu criar sem email/telefone,
  permitiu editar com email/telefone e manteve registros antigos sem
  quebra. Clientes carregou lista, exibiu `Contato` e `Telefone` no
  modal, permitiu criar/editar com os novos campos e manteve registros
  antigos funcionando. Registros temporarios de validacao foram
  removidos ao final.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  outras telas fora de `cadastros`.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permanece em 31/32 por uma unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** producao e `origin/main` nao foram tocados;
  `supabase/.temp/` permanece fora do stage/commit.

## Homologacao visual Admin Cadastros Clientes + Precos + Usuarios

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-CADASTROS-CLIENTES-PRECOS-USUARIOS-CLOSEOUT`,
  com aceite visual explicito do dono sobre as tres telas do pacote.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Clientes homologado:** `#/cadastros/clientes` foi alinhado ao
  padrao visual homologado de Cadastros com header, botao principal,
  busca full-width, tabela/card, footer e acoes centralizadas,
  preservando CRUD, rota, validacoes e os campos opcionais
  `contato`/`telefone`.
- **Precos homologado:** `#/cadastros/precos` foi alinhado ao mesmo
  padrao visual com busca, tabela/card, footer e acoes, preservando
  modais, validacoes e writes reais do cadastro de precos de
  terceirizadas.
- **Usuarios homologado:** `#/cadastros/usuarios` foi alinhado ao
  mesmo padrao visual com busca, toggle de inativos, tabela/card,
  badges de status e acoes administrativas, preservando rotas,
  validacoes, permissoes e os fluxos reais de editar, desativar e
  excluir usuario.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  outras telas fora deste pacote.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** nenhum schema, SQL, Supabase, producao ou
  `origin/main` foi tocado nesta fase; `supabase/.temp/` permanece
  fora do stage/commit.

## Persistencia real de Observacoes nos Cadastros Admin

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-CADASTROS-MODALS-SCHEMA-PERSISTENCE-CLOSEOUT`,
  com aceite funcional do pacote de persistencia de `observacoes`.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Migration versionada:** `db/19_cadastros_observacoes.sql`.
- **Migration aplicada apenas em staging:** projeto Supabase
  `ucrjtfswnfdlxwtmxnoo`, sem tocar producao
  `bhgifjrfagkzubpyqpew`.
- **Colunas confirmadas em staging:** `cores.observacoes`,
  `clientes.observacoes`, `modelos.observacoes`,
  `fornecedores.observacoes`, `precos_terceirizada.observacoes` e
  `usuarios.observacoes`, todas `text` nullable.
- **Persistencia homologada:** `ObservaÃ§Ãµes` agora persiste de verdade
  nos 6 cadastros admin, preservando compatibilidade por
  `detectOptionalColumns` em ambientes sem a migration.
- **CRUD/payloads preservados:** os fluxos existentes foram mantidos,
  com acrescimo opcional de `observacoes`; em `Usuarios`, a criacao
  segue pela Edge Function `admin-create-user` e recebe update
  posterior de `observacoes` quando aplicavel.
- **Validacao funcional aceita:** `Cores`, `Clientes`, `Modelos` e
  `Fornecedores` passaram por criar/reload/reabrir/editar/reconfirmar
  persistencia, com remocao dos registros temporarios; `Precos` e
  `Usuarios` foram aceitos como validados manualmente pelo dono; nao
  restaram marcadores `RAVATEX_TEST%` nas 6 tabelas.
- **Decisao sobre imagem de Modelos:** nenhuma persistencia real de
  imagem foi implementada. Nao ha infraestrutura atual de Supabase
  Storage, bucket, policy, upload helper ou `imagem_url` no repo; a UI
  de preview local segue homologada e a persistencia real de imagem
  fica deferida para uma fase propria de Storage. Nao foi salvo base64
  em tabela.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  outras telas fora de `cadastros`.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** producao e `origin/main` permaneceram
  intocados; `supabase/.temp/` segue fora do stage/commit.

## Homologacao visual Admin Cadastros Modais

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-CADASTROS-MODALS-VISUAL-FINALIZE-A`, com
  aceite visual explicito do dono para os modais de Cadastros Admin.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Escopo homologado:** modais novo/editar de `Cores`, `Clientes`,
  `Modelos`, `Fornecedores`, `Precos` e `Usuarios` foram alinhados ao
  mesmo padrao visual homologado de Cadastros, com header, overlay,
  campos, footer, botoes, radius e espacamento consistentes.
- **Helpers preservados e limpos:** os helpers visuais de modal
  permaneceram no arquivo e a fase removeu duplicacoes, funcoes mortas
  e blocos intermediarios, deixando uma unica implementacao final de
  `openModal` por tela.
- **Observacoes mantido:** o ultimo campo visual `ObservaÃ§Ãµes` foi
  mantido nos modais ajustados, sem alterar payloads persistidos nesta
  fase.
- **Modelos preservado:** a area de imagem/preview visual de
  `Modelos` foi mantida no modal, junto com o layout ajustado para os
  campos de cor e largura.
- **Precos limpo:** a sobra intermediaria do modal de `Precos` foi
  removida e ficou apenas uma construcao final legivel do body, no
  layout homologado de duas linhas.
- **Funcionalidade preservada:** CRUD anterior, payloads existentes,
  validacoes e permissoes admin dos campos ja persistidos permaneceram
  intactos; nao houve alteracao de schema, SQL, Supabase nem regras de
  negocio.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  telas fora de `cadastros`.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** nenhum schema, SQL, Supabase, producao ou
  `origin/main` foi tocado nesta fase; `supabase/.temp/` permanece
  fora do stage/commit.

## Homologacao visual Admin Modelos

- **Estado atual aceito:** `work/app-next` na fase
  `RAVATEX-TAPETES-ADMIN-MODELOS-MATCH-STANDALONE-CLOSEOUT`, com
  aceite visual explicito do dono para `#/cadastros/modelos`.
- **Arquivo funcional alterado:** `js/screens/cadastros.js`.
- **Modelos homologado:** a tela foi alinhada ao padrao visual
  homologado de Cadastros com header, botao principal, busca
  full-width, card/tabela e footer.
- **Preview sintetico registrado:** cada modelo agora exibe preview
  sintetico construido a partir de `cor_1`, `cor_2`, `largura` e
  nome, sem uso de imagem real, storage ou alteracao de schema.
- **Representacao visual homologada:** nome como coluna principal com
  ID secundario, swatches lado a lado para `cor_1`/`cor_2` e acoes com
  icones `SquarePen` e `Trash`.
- **CRUD e regras preservados:** carregamento real, criacao, edicao,
  exclusao, payloads, validacoes, permissoes admin e schema atual
  permaneceram intactos.
- **Correcao runtime registrada:** Modelos passou a abrir normalmente
  com helper local de swatch, sem depender do escopo de Cores.
- **Hotfix visual em Usuarios:** o icone de excluir foi mantido em
  vermelho, com botao neutro, sem alterar fluxos administrativos.
- **Shell preservado:** sidebar, topbar e shell global permaneceram
  intactos; nao houve alteracoes em `common.js`, `index.html` ou em
  qualquer arquivo fora do escopo.
- **Checks executados:** `node --check js/screens/cadastros.js`,
  `tests/cadastros-screens.smoke.js` e `git diff --check`. O smoke de
  cadastros permaneceu em 31/32 pela unica falha conhecida e fora do
  escopo: `screenPainel` espera 9 itens de `ADMIN_MENU` e renderiza
  10.
- **Escopo preservado:** nenhum schema, SQL, Supabase, producao ou
  `origin/main` foi tocado nesta fase; `supabase/.temp/` permanece
  fora do stage/commit.
## Fechamento R1 do Detalhe do Pedido + Cleanup B da Lista Admin

- **Estado atual pos-R1 + Cleanup B:** branch `work/app-next`,
  commit HEAD atual (patch `RAVATEX-TAPETES-PEDIDOS-LIST-ADMIN-VISUAL-CLEANUP-B`
  aplicado sobre `e88b218`).
- **Refatoracao modular do Detalhe concluida (R1):** o antigo monolito de
  `js/screens/pedido-detail.js` foi extraido para
  `js/screens/pedido-detail.js`,
  `js/screens/pedido-detail-data.js`,
  `js/screens/pedido-detail-render.js`,
  `js/screens/pedido-detail-progress.js` e
  `js/screens/pedido-detail-events.js`, preservando o visual/fluxo do
  standalone e mantendo `index.html` apenas como loader dos modulos.
- **Residual da lista admin resolvido (Cleanup B):**
  `js/screens/pedidos-list.js` recebeu patch proprio com extracao de
  constantes, refatoracao de estado visivel e ajustes visuais da lista
  admin `#/pedidos`.
- **Validacao registrada:** testes focados do pacote Detail R1 fecharam
  em `177/177`; `tests/pedidos-list.smoke.js` verde.
- **Residual restante:** `supabase/.temp/` continua fora do stage/commit.
- **Proximo passo recomendado:** Modal Movimentar Producao, somente
  com worktree limpo exceto `supabase/.temp/`.

## Closeout do Modal Movimentar Producao B

- **Estado atual aceito:** branch `work/app-next`, fase
  `RAVATEX-TAPETES-MOVIMENTAR-PRODUCAO-MODAL-B`, validada sobre o HEAD
  base `583f90a`.
- **Arquivos alterados nesta fase:** `js/screens/pedido-detail-events.js`
  e `tests/pedido-detail.smoke.js`.
- **Entrega publicada nesta fase:** o Detalhe do Pedido passou a abrir
  um modal de Movimentar Producao **pre-carregado e readonly** a partir
  dos atalhos `Transferir`/`Movimentar`, com origem, destino, OP de
  origem, itens envolvidos, saldo/restante calculado, documentos
  esperados e CTA para abrir a OP de origem.
- **Regra preservada:** o Pedido continua sendo apenas **visao
  consolidada**. A movimentacao canonica continua na OP/cadeia
  produtiva; o modal nao cria lancamento paralelo no Pedido nem estado
  concorrente.
- **Escopo explicitamente preservado:** nenhuma gravacao operacional foi
  implementada; nao houve chamadas a `salvarEntregaCima`,
  `salvarEntregaLatex`, `gerar_op_latex` ou `alterar_status_op`; nenhum
  SQL/schema/OP lifecycle/Supabase/producao foi tocado.
- **Validacao registrada:** `node --check
  js/screens/pedido-detail-events.js`, `node --test
  tests/pedido-detail.smoke.js` e o pacote de closeout
  `node --test tests/pedido-detail.smoke.js tests/pedido-edit.smoke.js
  tests/pedido-itens-edit.smoke.js
  tests/admin-pedido-tracking-control.smoke.js
  tests/pedido-parciais-admin-control.smoke.js`, com
  `pedido-detail.smoke.js` em `46/46` e o agregado em `180/180`.
- **Residual preservado:** `?? supabase/.temp/` permanece fora do
  stage/commit.
- **Proximo passo recomendado:** abrir a frente de telas de OP,
  comecando por **OP Aberta** baseada em **Admin -> Nova OP**, para
  levar a movimentacao canonica ao fluxo operacional proprio da OP.
# Estado pos-fase - OP Em Producao Acabamento Standalone B

- Fase concluida no codigo: `RAVATEX-TAPETES-OP-EM-PRODUCAO-ACABAMENTO-STANDALONE-B`.
- Regra absoluta preservada:
  OP Aberta != OP Em Producao;
  Nova OP != PROD-OP;
  Preparacao != Operacao;
  Pedido organiza != OP executa.
- Escopo alterado: `js/screens/op-latex-admin.js`,
  `tests/op-latex-admin.smoke.js`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`. Nenhum SQL/db, Supabase config, producao ou push.
- Implementado um renderer proprio para OP Acabamento/Latex em producao:
  `renderOPLatexProducao`, aplicado somente para
  `op.status === 'em_producao'`. OP aberta/preparacao de acabamento foi
  preservada no template anterior; finalizada/legado segue no fallback
  legado.
- Tela nova de producao de acabamento:
  header operacional com badges "Acabamento/Latex" e "Em producao";
  cadeia produtiva com OP de tecelagem vinculada quando houver;
  Card 1 Dados da OP;
  resumo operacional;
  Card 2 Itens da OP com enviado pela tecelagem, recebido/acabado,
  falta e excedente quando houver;
  Card 3 Material recebido da tecelagem;
  Card 4 Recebimentos/acabamento;
  Card 5 Finalizacao/liberar para proxima etapa;
  Card 6 Documentos da OP placeholder controlado;
  Card 7 Historico com fallback "Nenhum evento registrado para esta OP.".
- Preservado:
  `salvarEntregaLatex`, `atualizarEntregaLatex`, `excluirEntrega`,
  `editarEnviado`, `finalizar`, `excluirOpLatex`, `gerar_op_latex`,
  OP Aberta/Nova OP e OP Em Producao Tecelagem. O modulo `op-nova.js`
  nao foi alterado.
- Proibicoes confirmadas:
  nao foi copiado card "Entregas tecelagem" para Acabamento;
  nao foi chamado `alterar_status_op`;
  nao foi criado update novo de `ops.status = em_producao`;
  nao foi criado schema;
  nao houve upload/documentos reais;
  nao foi implementada expedicao gravavel;
  nao houve Supabase apply, producao ou push.
- Testes:
  `node --check js/screens/op-latex-admin.js` OK;
  `node --check tests/op-latex-admin.smoke.js` OK;
  `node --test tests/op-latex-admin.smoke.js` OK (44/44);
  `node --test tests/op-latex-admin.smoke.js tests/op-nova.smoke.js
  tests/op-persistir.smoke.js tests/boot.smoke.js
  tests/pedido-detail.smoke.js tests/op-recalculo.smoke.js` OK (308/308).
- Busca de seguranca:
  `alterar_status_op` ausente;
  `gerar_op_latex` ausente;
  write novo para `em_producao` ausente;
  `salvarEntregaLatex` / `atualizarEntregaLatex` / `excluirEntrega`
  aparecem apenas como fluxo legado preservado;
  `Colocar em producao` permanece no ramo de OP aberta/preparacao, nao
  no renderer operacional `em_producao`.
- Gaps futuros:
  ajustar `gerar_op_latex` para fluxo preparacao/entrada em fase propria;
  documentos reais;
  lifecycle Pausar/Concluir;
  expedicao/cliente como etapa operacional apenas quando houver backend
  ou fonte real.
# Estado pos-fase - OP Producao Structure Closeout Push

- Fase: `RAVATEX-TAPETES-OP-PRODUCAO-STRUCTURE-CLOSEOUT-PUSH`.
- Branch alvo: `work/app-next`.
- Escopo fechado:
  `js/screens/op-tecelagem-producao-admin.js`,
  `js/screens/op-nova.js`,
  `js/screens/op-latex-admin.js`,
  `index.html`,
  `tests/op-nova.smoke.js`,
  `tests/op-latex-admin.smoke.js`,
  `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Decisao estrutural:
  OP Em Producao Tecelagem tem renderer ativo dedicado em
  `js/screens/op-tecelagem-producao-admin.js`.
  `js/screens/op-nova.js` nao carrega mais o renderer operacional antigo;
  ele so prepara contexto e delega para
  `window.renderOPTecelagemProducaoAdmin(ctx)` quando
  `status === 'em_producao' && tipo !== 'latex'`.
  `index.html` carrega o modulo dedicado antes de `op-nova.js`.
- Correcoes de auditoria:
  movimentacao da ultima entrega ignora itens com defeito;
  `reloadEntregasCima` recarrega numero/ano das OPs de Latex para a
  cadeia produtiva sem reload completo;
  acao "Movimentar" da Tecelagem em producao nao fica como link morto
  quando nao ha fornecedor/card de entregas.
- Acabamento/Latex:
  ajustes pendentes ja presentes no estado coerente atual foram
  mantidos e cobertos por `tests/op-latex-admin.smoke.js`;
  nao houve SQL/schema/Supabase.
- Divida conhecida:
  fluxo legado `gerar_op_latex` ainda pode criar OP de
  Latex/Acabamento direto em `em_producao`. Produto correto exige:
  transferencia da Tecelagem abre/vincula OP Acabamento aguardando
  entrada; Acabamento confirma recebimento; so depois entra em
  producao. Tratar em fase propria de lifecycle, nao por mascara de UI.
- Testes executados nesta rodada:
  `node --check js/screens/op-tecelagem-producao-admin.js`;
  `node --check js/screens/op-nova.js`;
  `node --check js/screens/op-latex-admin.js`;
  `node --check tests/op-nova.smoke.js`;
  `node --check tests/op-latex-admin.smoke.js`;
  `node --test tests/op-nova.smoke.js`;
  `node --test tests/op-latex-admin.smoke.js`;
  `node --test tests/boot.smoke.js`;
  `node --test tests/router.smoke.js`;
  `node --test tests/op-recalculo.smoke.js`;
  `node --test tests/painel-screen.smoke.js`.
  Todos OK. `router` e `painel-screen` imprimem mensagens esperadas do
  sandbox sobre `window.addEventListener`, mas passam com exit code 0.
# Estado pos-fase - OP Latex Entry Gate B

- Fase concluida localmente: `RAVATEX-TAPETES-OP-LATEX-ENTRY-GATE-B`.
- Branch base da fase: `work/app-next`, HEAD inicial
  `cc4c5e08092d2a58612fc671551b700cea2ef150`.
- Escopo fechado:
  `db/22_latex_entry_gate.sql`,
  `js/screens/op-latex-admin.js`,
  `js/screens/op-nova.js`,
  `js/screens/op-tecelagem-producao-admin.js`,
  `tests/op-latex-admin.smoke.js`,
  `tests/op-nova.smoke.js`,
  `tests/fornecedor-screens.smoke.js`,
  `tests/latex-entry-gate-schema.smoke.js`,
  `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Contrato SQL versionado, nao aplicado nesta fase:
  `gerar_op_latex(p_entrega_id BIGINT)` preserva assinatura e vinculos
  existentes, mas agora cria OP Latex/Acabamento com `status = 'aberta'`
  em vez de `em_producao`.
- UI:
  OP Latex aberta passa a ser o gate de entrada no Acabamento.
  O CTA "Confirmar entrada / iniciar acabamento" chama
  `alterar_status_op` com observacao "Entrada no acabamento confirmada"
  e recarrega a OP apos sucesso.
- Tecelagem:
  a cadeia produtiva continua sem filtro por status e passa a exibir
  "Aguardando entrada" para OP de Acabamento aberta.
- Fornecedor Latex:
  a tela de producao do fornecedor continua mostrando apenas OPs
  `em_producao`; OP aberta nao aparece como producao.
- Preservado fora de escopo:
  Pedido, Expedicao, finalizacao de Latex, recalculo, entrega/coleta,
  Supabase remoto e producao.
- Proxima etapa recomendada:
  aplicar `db/22_latex_entry_gate.sql` em staging se a fase B for aceita,
  depois homologar o caminho Tecelagem transfere -> OP Acabamento aberta
  -> confirmar entrada -> OP em producao.
- Gaps futuros:
  Expedicao operacional e regra de conclusao do Pedido seguem pendentes
  em fase propria.
# Estado pos-fase - End-to-End Production Flow B

- Fase: `RAVATEX-TAPETES-END-TO-END-PRODUCTION-FLOW-B`.
- Escopo: preparar staging para testar o fluxo operacional completo ate
  Expedicao, entrega/coleta e conclusao persistida do Pedido.
- Migration nova: `db/23_expedicao_entrega_flow.sql`, criando as tabelas
  `expedicoes`, `expedicao_itens`, `expedicao_movimentos` e
  `expedicao_movimento_itens`, com RLS/admin e indices basicos.
- RPCs novas: `liberar_expedicao(p_op_latex_id BIGINT)`,
  `registrar_entrega_expedicao(...)`, `recalcular_status_expedicao(...)` e
  `concluir_pedido_se_pronto(p_pedido_id UUID)`.
- UI nova: `js/screens/expedicao-admin.js`, carregada em `index.html` e
  acessada pela rota dinamica `#/expedicoes/:id` em `js/router.js`.
- Acabamento/Latex: OP finalizada mostra bloco de Expedicao com acao
  "Liberar para expedicao"; se a Expedicao ja existir, mostra link para abrir.
  A tela nao conclui Pedido diretamente.
- Pedido Detail: agora carrega Expedicoes e movimentos, mostra saldos de
  Expedicao, lista pendencias para conclusao e chama
  `concluir_pedido_se_pronto` para persistir `pedidos.status = 'entregue'`
  quando a cadeia esta pronta.
- Contrato preservado: `gerar_op_latex` nao foi alterada nesta fase; OP Latex
  continua nascendo `aberta` pelo gate B. Fornecedor Latex segue vendo apenas
  OPs em producao.
- Gaps conhecidos: NF/romaneio/anexos reais continuam placeholder; nao houve
  integracao externa; producao permanece intocada.
- Operacao pendente desta fase: depois do commit e push em `staging`, aplicar
  somente `db/23_expedicao_entrega_flow.sql` no Supabase staging
  `ucrjtfswnfdlxwtmxnoo` e validar tabelas/RPCs.

# Estado pos-fase - Pedido Post Save First OP CTA B

- Fase concluida localmente:
  `RAVATEX-TAPETES-PEDIDO-POST-SAVE-FIRST-OP-CTA-B`.
- Branch base da fase: `work/app-next`, HEAD inicial
  `c428134e1475fcc1dffa6164efd668a9978de3b8`.
- Escopo fechado:
  `js/screens/pedido-form.js`,
  `js/screens/cliente-pedido-form.js`,
  `js/screens/pedido-detail-render.js`,
  `tests/pedido-form.smoke.js`,
  `tests/cliente-pedido-form.smoke.js`,
  `tests/pedido-detail.smoke.js`,
  `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Admin pos-save:
  apos salvar pedido, a tela renderiza resumo "Pedido salvo com sucesso"
  com cliente, numero/id, quantidade de itens e metragem total, mantendo
  acoes "Ver pedido", "Novo pedido" e CTA primario
  "Abrir OP de Tecelagem" no bloco de acoes alinhado a direita.
- Rota da OP:
  o CTA admin usa hash route por `window.location.hash =
  '#/ops/nova?pedido_id=' + pedido.id`; nao usa rota fisica `/ops/nova`.
- Cliente pos-save:
  apos enviar pedido, a tela renderiza resumo "Pedido enviado", proximos
  passos e acoes "Ver meus pedidos" / "Criar novo pedido"; nenhuma acao de
  OP aparece para cliente.
- Detalhe do Pedido:
  o primeiro CTA operacional agora aparece como "Gerar primeira OP" e
  continua chamando `navigateToNovaOp`, que usa
  `#/ops/nova?pedido_id=<pedido_id>`. Quando `view.opSummaries.length > 0`,
  a tela renderiza cards de OP existentes com "Abrir OP" e nao sugere gerar
  outra primeira OP.
- Preservado fora de escopo:
  SQL, Supabase remoto/producao, `gerar_op_latex`, expedicao,
  entrega/coleta e `concluir_pedido_se_pronto`.
- Testes/checks executados com sucesso:
  `node --check js/screens/pedido-form.js`;
  `node --check js/screens/cliente-pedido-form.js`;
  `node --check js/screens/pedido-detail-events.js`;
  `node --check js/screens/pedido-detail-render.js`;
  `node --test tests/pedido-form.smoke.js`;
  `node --test tests/cliente-pedido-form.smoke.js`;
  `node --test tests/pedido-detail.smoke.js`;
  `node --test tests/boot.smoke.js`;
  `node --test tests/router.smoke.js`;
  `node --test tests/op-nova.smoke.js`.
- Observacoes:
  `tests/pedido-novo.smoke.js` nao existe. `tests/router.smoke.js` imprime
  diagnosticos esperados do sandbox sobre `window.addEventListener`, mas
  passa com exit code 0. Busca de seguranca por `href=.*\/ops\/nova`,
  `location.href.*ops/nova` e `location.assign.*ops/nova` nao retornou
  ocorrencias. Residual permitido preservado: `?? supabase/.temp/`.

# Estado pos-fase - Tecelagem Producao Movimentacao Card R1

- Fase: `RAVATEX-TAPETES-TECELAGEM-PRODUCAO-MOVIMENTACAO-CARD-R1`.
- Escopo fechado localmente: `js/screens/op-tecelagem-producao-admin.js`,
  `tests/op-nova.smoke.js`, `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
- Corrigido: `Entregas tecelagem` nao e mais card solto entre `4.
  Capacidade e ajuste` e `5. Movimentacao - enviar para acabamento`.
  A tabela/historico de entregas agora fica dentro do Card 5, com
  resumo Disponivel/Ja enviado/Total ajustado no topo e acoes
  `Transferir`, `+ Nova entrega`, `Editar`, `Excluir` e `Ver OP de latex`
  preservadas.
- Card 4 ficou restrito a capacidade/ajuste/sobras. Headers `STATUS` e
  `FALTA` seguem alinhados a esquerda por teste.
- Nao alterado: lifecycle, `salvarEntregaCima`, `atualizarEntregaCima`,
  `excluirEntrega`, `gerar_op_latex`, Acabamento/Latex, SQL, Supabase,
  producao ou push.

# Estado pos-fase - Login Standalone UI B

- Fase concluida localmente:
  `RAVATEX-TAPETES-LOGIN-STANDALONE-UI-B`.
- Escopo fechado:
  `js/screens/system-screens.js`, `tests/system-screens.smoke.js`,
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md`.
- Login visual atualizado conforme referencia `Login-standalone.html`:
  fundo cinza claro, card central branco, borda/sombra sutil, cantos
  discretos, marca Inttex, titulo "Inttex OptiControl", subtitulo
  "Entre com seu e-mail e senha", campos E-mail/Senha com icones, botao
  de mostrar/ocultar senha, link "Esqueceu a senha?", checkbox
  "Lembrar-me neste dispositivo", botao "Entrar" e rodape
  "© 2026 Inttex · Controle de Tapetes".
- Auth preservado:
  submit continua chamando `window.login(emailInput.value.trim(),
  senhaInput.value)`, sucesso continua exibindo toast "Login OK" e
  chamando `window.routeAfterLogin()`, erro continua exibindo
  "E-mail ou senha incorretos", e o loading/disabled do botao Entrar
  foi mantido.
- Recuperacao de senha:
  continua placeholder controlado; clique em "Esqueceu a senha?" mostra
  toast "Recuperação de senha ainda não configurada.". Nao foi
  implementado reset de senha nesta fase.
- Lembrar-me:
  checkbox apenas visual; nao foi criado `localStorage` nem alterada
  politica de sessao/persistencia do Supabase.
- Nao mexer no auth client:
  `js/auth.js`, `js/supabase-client.js`, Supabase config, RLS, SQL,
  producao, Pedido, OP e Expedicao permaneceram fora do escopo.
- Testes:
  `tests/system-screens.smoke.js` cobre titulo/subtitulo, campos,
  botao Entrar, lembrar-me, esqueceu senha, submit, erro, loading,
  toggle de senha e ausencia de chamadas Supabase no modulo.

# Estado pos-fase - Pedido Post Save OP CTA Route R1

- Fase concluida localmente:
  `RAVATEX-TAPETES-PEDIDO-POST-SAVE-OP-CTA-ROUTE-R1`.
- Branch base da fase: `work/app-next`, HEAD inicial
  `8fd9d08ec6494cfb2a37678c82a7e239aa6a49fd`.
- Causa encontrada:
  `js/router.js` fazia match exato com a hash completa
  `#/ops/nova?pedido_id=<uuid>`, mas a rota registrada pelo boot e
  `#/ops/nova`. Resultado: `handleRoute` recebia `null` de `matchRoute`
  e renderizava o 404 interno (`screenNotFound`). O 404 de `favicon.ico`
  no log HTTP nao era a causa.
- Correcao:
  `matchRoute` agora calcula `routeHash` removendo a query apenas para o
  match exato. A hash completa permanece em `window.location.hash`, entao
  o render de `#/ops/nova` em `js/boot.js` continua extraindo
  `pedido_id` via `URLSearchParams` e chamando
  `window.screenNovaOP(null, pid)`.
- UUID preservado:
  `screenNovaOP` recebe `pedidoId` como string e usa esse valor em
  `.eq('id', targetPedidoId)` / `.eq('pedido_id', pedidoId)`, sem
  `Number` ou `parseInt`. A regex numerica existente em `router.js`
  permanece restrita aos legados `#/ops/:id` e `#/expedicoes/:id`.
- CTAs:
  o pos-save admin continua usando
  `window.location.hash = '#/ops/nova?pedido_id=' + pedido.id`; o detalhe
  do Pedido continua usando `window.navigate('#/ops/nova?pedido_id=' +
  pedidoId)`. Nenhuma rota fisica `/ops/nova` foi criada.
- Erro de Pedido inexistente:
  `js/screens/op-nova.js` mostra "Pedido não encontrado" no toast e na tela,
  evitando confusao com 404 generico do router.
- Texto admin:
  texto do pos-save nao foi alterado nesta fase; apenas a mensagem de erro
  de Pedido inexistente recebeu acento.
- Testes/checks executados com sucesso:
  `node --check js/router.js`;
  `node --check js/screens/op-nova.js`;
  `node --test tests/pedido-form.smoke.js`;
  `node --test tests/pedido-detail.smoke.js`;
  `node --test tests/op-nova.smoke.js`;
  `node --test tests/boot.smoke.js`;
  `node --test tests/router.smoke.js`.
- Preservado fora de escopo:
  nenhuma OP automatica, nenhum SQL, nenhum Supabase remoto/producao,
  nenhum lifecycle de OP, nenhuma alteracao de `gerar_op_latex`,
  expedicao, auth/login ou push. Residual permitido preservado:
  `?? supabase/.temp/`.
- Fase R3 concluida no codigo:
  `RAVATEX-TAPETES-PEDIDO-PROGRESS-CONNECTORS-R3-FIX-MISSING-LAST-CONNECTOR`.
- Diagnostico: a ultima transicao `EXPEDICAO -> ENTREGA` tinha
  `stage.transfer`, mas sua action `registerDelivery` vem como
  `hidden` quando a entrega/coleta ainda nao esta liberada. O render
  antigo retornava uma celula vazia para `action.mode === 'hidden'`,
  apagando visualmente o quarto conector.
- Correcao: `hidden` agora entra no mapeamento visual como
  `Aguardar`, estatico e sem handler. Assim o pipeline de 5 etapas
  sempre renderiza 4 conectores. Quando `registerDelivery` vier
  `enabled`, a seta final vira `Transferir` e chama
  `openMovementModal(stage.transfer)`; quando vier `view`/concluido,
  vira `Concluido` estatico.
- Garantias: nenhum label `Entregar`, `Ver` ou `Editar` em conectores;
  matriz/gates/`derivePedidoChainState` preservados; sem SQL,
  Supabase, producao, lifecycle ou writes.
- Testes: `node --check` nos dois arquivos OK;
  `node --test tests/pedido-detail.smoke.js` OK (58/58);
  `node --test tests/boot.smoke.js` OK (29/29);
  `node --test tests/router.smoke.js` OK (43/43; aviso conhecido de
  sandbox sobre `window.addEventListener`, exit code 0).

- Complemento R2 final alinhado a
  `Setas de transicao - referencia.html`: conectores do
  `Progresso produtivo` aceitam somente `Concluido`, `Transferir` e
  `Aguardar` como texto visivel. `Ver`, `Editar`, `Entregar` e textos
  longos/contextuais nao aparecem dentro das setas.
- `Concluido` e `Aguardar` sao elementos estaticos sem handler;
  somente `Transferir` e botao/clicavel e continua chamando
  `openMovementModal(stage.transfer)` quando o gate permite. Shape
  solido com `clip-path`, `min-width:100px`, sem borda quebrada e sem
  pilula solta.
- Testes finais desta correcao: `node --check` nos dois arquivos OK;
  `node --test tests/pedido-detail.smoke.js` OK (56/56);
  `node --test tests/boot.smoke.js` OK (29/29);
  `node --test tests/router.smoke.js` OK (43/43; aviso conhecido de
  sandbox sobre `window.addEventListener`, exit code 0).

- Fase R2 concluida no codigo: `RAVATEX-TAPETES-PEDIDO-PROGRESS-CONNECTORS-R2`.
- Escopo fechado: `js/screens/pedido-detail-render.js`,
  `tests/pedido-detail.smoke.js`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Correcao sobre a R1: labels curtos preservados, mas a apresentacao
  voltou a ser seta/chevron integrada entre etapas. Removido o helper
  de linha/badge passivo; todos os estados usam `buildConnectorStyle`
  com `clip-path` de chevron e largura fixa.
- Estados visuais: `Concluído` discreto verde/neutral; `Transferir`
  azul e clicavel quando o gate permite; `Aguardar` cinza/muted sem
  clique; `Ver`/`Editar` curtos e integrados. Contexto completo segue
  em `title`/`aria-label`.
- Garantias preservadas: sem alteracao de `derivePedidoChainState`,
  gates, operacao canonica, SQL, Supabase, producao, lifecycle ou
  writes. `Transferir` pelo Pedido continua chamando
  `openMovementModal(stage.transfer)` quando permitido.
- Testes executados:
  `node --check js/screens/pedido-detail-render.js` OK;
  `node --check tests/pedido-detail.smoke.js` OK;
  `node --test tests/pedido-detail.smoke.js` OK (55/55);
  `node --test tests/boot.smoke.js` OK (29/29);
  `node --test tests/router.smoke.js` OK (43/43; imprime o aviso
  conhecido de sandbox sobre `window.addEventListener`, mas termina com
  exit code 0 e todos os subtestes passam).

# Estado pos-fase - Pedido Progress Connectors R1

- Fase concluida no codigo: `RAVATEX-TAPETES-PEDIDO-PROGRESS-CONNECTORS-R1`.
- Escopo fechado: `js/screens/pedido-detail-render.js`,
  `tests/pedido-detail.smoke.js`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Diagnostico: os conectores do bloco `Progresso produtivo` eram
  renderizados por `buildTransferButton` em
  `js/screens/pedido-detail-render.js`. Os labels longos vinham de
  `stage.transfer.action.label`, derivados da matriz
  `derivePedidoChainState` em `js/screens/pedido-chain-state.js`
  (`Insumos concluidos`, `Aguardando acabamento`, etc.). O conector
  usava CSS inline no proprio render, incluindo o `clip-path` de
  chevron.
- Correcao: a matriz/gates nao foi alterada. O render passou a mapear
  visualmente as acoes para labels curtos: `Concluido`, `Transferir`,
  `Aguardar`, `Ver` ou `Editar`. Concluido/aguardando renderizam como
  linha/badge passivo; ativo mantem botao/chevron azul `Transferir`;
  view/edit usam label curto e continuam abrindo o modal de contexto
  quando permitido.
- Garantias preservadas: sem SQL, Supabase, producao, lifecycle ou
  writes novos; sem alteracao de operacao canonica; `Transferir` pelo
  Pedido continua disponivel quando o gate permite.
- Testes:
  `node --check js/screens/pedido-detail-render.js` OK;
  `node --check tests/pedido-detail.smoke.js` OK;
  `node --test tests/pedido-detail.smoke.js` OK (54/54);
  `node --test tests/boot.smoke.js` OK (29/29);
  `node --test tests/router.smoke.js` OK (43/43; imprime o aviso
  conhecido de sandbox sobre `window.addEventListener`, mas termina com
  exit code 0 e todos os subtestes passam).
# Estado pos-fase - Pedido Transition Actions B

- Fase: `RAVATEX-TAPETES-PEDIDO-TRANSITION-ACTIONS-B`.
- Escopo local: setas/conectores do bloco `Progresso produtivo` no
  Pedido Admin. Sem SQL, sem aplicacao Supabase remota, sem producao e
  sem push.
- Causa corrigida: `openMovementModal(stage.transfer)` abria contexto,
  mas o modal era explicitamente somente leitura e o botao principal
  redirecionava para `#/ops/<id>` como caminho de movimentacao. Assim a
  seta `Transferir` nao era a interface da transicao.
- Corrigido: `Transferir` abre modal operacional no Pedido e reutiliza
  operacoes canonicas (`registrarRecebimentoOrdemFio`,
  `salvarEntregaCima`, `liberar_expedicao`,
  `registrar_entrega_expedicao`); `Concluido` virou seta clicavel para
  historico/parciais; `Aguardar` continua conector muted sem handler;
  as 5 etapas e 4 conectores foram preservados.
- Historico/parciais: o modal lista recebimentos de fio, entregas de
  Tecelagem -> Acabamento, liberacoes de Expedicao e movimentos de
  entrega/coleta ja carregados no detalhe do Pedido. Movimentos feitos
  pela OP aparecem ali porque sao lidos das tabelas canonicas, nao de
  estado paralelo do Pedido.
- Arquivo extra justificado: `js/screens/pedido-detail-data.js` passou a
  carregar fornecedores Latex em leitura para alimentar
  `buildEntregaInlineForm` no fluxo canonico Tecelagem -> Acabamento.
# Estado pos-fase - OP Partial Split DB29 Staging Validation R1

- Fase: `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-DB29-STAGING-VALIDATION-R1`.
- Estado canonico confirmado:
  - branch `work/app-next`;
  - HEAD inicial/final da validacao `1563a65b0b93604f1d8223e3639409faceac23d3`;
  - residual permitido apenas `?? supabase/.temp/`;
  - staging validado: `ucrjtfswnfdlxwtmxnoo`;
  - producao `bhgifjrfagkzubpyqpew` nao usada.
- Confirmacao de apply staging:
  - o usuario informou apply manual da `db/29`;
  - os diagnosticos staging read-only rodaram sobre
    `ucrjtfswnfdlxwtmxnoo` sem regressao;
  - `POST /rest/v1/rpc/gerar_op_latex_split` com
    `{ p_entrega_id: null, p_motivo: null }` respondeu
    `P0001: Motivo de separacao e obrigatorio...`, provando
    disponibilidade da funcao no schema cache sem write real;
  - `POST /rest/v1/rpc/gerar_op_latex` com `{ p_entrega_id: null }`
    respondeu `P0001: Entrega <NULL> nao encontrada`, provando
    disponibilidade da RPC default no staging.
- Confirmacao operacional da db/29:
  - `gerar_op_latex_split` disponivel em staging;
  - `gerar_op_latex` disponivel em staging;
  - como ambas sao definidas na mesma `db/29`, a aplicacao manual foi
    considerada efetivamente ativa;
  - catalogo `information_schema` / `pg_proc` nao ficou acessivel via
    PostgREST, entao a checagem textual da definicao foi registrada como
    indisponivel por catalogo.
- Resultado dos diagnosticos staging:
  - 6 OPs Latex default;
  - 0 OPs split atuais;
  - duplicatas default = 0;
  - duplicatas materializadas = 0;
  - orfas = 0;
  - colisoes `tipo+numero+ano` = 0;
  - high-water latex OK (`ultimo_numero=6`);
  - high-water tecelagem OK (`ultimo_numero=16`);
  - `op_latex_entregas` preservada sem entrega em multiplas OPs;
  - cardinalidade default preservada.
- Testes locais obrigatorios nesta validacao:
  - `node --test tests\op-latex-split.smoke.js` OK (28/28);
  - `node --test tests\latex-consolidation-schema.smoke.js` OK (25/25);
  - `node --test tests\production-flow-numbering-schema.smoke.js` OK (14/14);
  - `node --test tests\production-flow-invariants.smoke.js` OK (11/11);
  - `node --test tests\entrega-writes.smoke.js` OK (67/67).
- Closeout:
  - fase DB29 pode ser considerada fechada em staging;
  - proxima decisao do arquiteto: helper JS
    `salvarEntregaCima({ forceSplit, motivo })` sem UI definitiva ou
    implementacao do select/UI de split explicito;
  - producao continua pendente e intocada.
- Confirmacoes:
  - sem SQL novo;
  - sem apply adicional;
  - sem JS/UI;
  - sem select/UI novo;
  - sem criacao real de OP split;
  - sem update/delete ad hoc;
  - sem `git add .`;
  - `supabase/.temp/` nao deve ser commitado.

# Estado pos-fase - OP Partial Split Helper B

- Fase: `RAVATEX-TAPETES-OP-PARTIAL-SPLIT-HELPER-B`.
- Escopo implementado localmente: `js/screens/entrega-writes.js`,
  `tests/entrega-writes.smoke.js`, `PROJECT_STATE.md`,
  `AGENT_HANDOFF.md`.
- Contrato do helper:
  - chamada legado/default preservada:
    `salvarEntregaCima({ fornecedorId, opId, payload })`;
  - chamada split opt-in:
    `salvarEntregaCima(args, { forceSplit: true, motivo })`;
  - motivo e trimado e motivo vazio bloqueia antes de qualquer Supabase
    write;
  - default chama `gerar_op_latex` com `{ p_entrega_id }`;
  - split chama `gerar_op_latex_split` com
    `{ p_entrega_id, p_motivo }`;
  - retorno split criado usa mensagem propria; retorno
    `already_linked`/`erro` nao afirma criacao.
- Preservado: UI/select e `buildEntregaInlineForm` intocados; split nao
  e automatico; default continua acumulando; `created`,
  `accumulated` e `already_linked` preservados; `gerar_op_latex`
  intocada nesta fase; db/25-db/29 intocadas; sem migration/SQL.
- Testes locais:
  - `node --test tests\entrega-writes.smoke.js` OK (70/70);
  - `node --test tests\op-latex-split.smoke.js` OK (28/28);
  - `node --test tests\tec-to-acabamento-flow.smoke.js` OK (12/12);
  - `node --test tests\pedido-detail.smoke.js` OK (111/111);
  - `node --test tests\production-flow-invariants.smoke.js` OK (11/11).
- Diagnosticos staging read-only em `ucrjtfswnfdlxwtmxnoo`: 6 OPs Latex
  default, 0 splits atuais, 0 duplicatas default/materializadas, 0 orfas,
  0 colisoes de numeracao, high-water latex=6 e tecelagem=16.
- Observacao staging: os diagnosticos legados consultam
  `GET /rpc/gerar_op_latex_split` e ainda imprimem "INDISPONIVEL".
  Chamada controlada por `POST` autenticado com entrega inexistente
  retornou `P0001: Entrega -999999 nao encontrada`, confirmando funcao
  ativa e sem criar OP real.
- Producao intocada; `origin` nao usado para escrita; sem `git add .`;
  residual permitido `supabase/.temp/` nao deve ser commitado.
# Estado pos-fase - Pedido Concluir Action R2 Real Staging

- Fase: `RAVATEX-TAPETES-PEDIDO-CONCLUIR-ACTION-R2-REAL-STAGING`.
- Status: OK. R1 reaberto corretamente: a validacao visual real do Arquiteto
  prevalece sobre o relatorio anterior.
- Branch/HEAD base: `work/app-next`,
  `0867cf48a652c3b428e5d781d33649ebc2e9b95f`.
- Status inicial: somente `?? supabase/.temp/`.
- Staging/remoto:
  - `staging/work/app-next` confirmado em
    `0867cf48a652c3b428e5d781d33649ebc2e9b95f`;
  - `staging/main` estava em `49897275ee46702e66807c914c6b9ecc11bbecb2`;
  - URLs publicas obvias de GitHub Pages staging deram 404;
  - reproducao real feita em `http://localhost:8765/` conectado ao Supabase
    staging `ucrjtfswnfdlxwtmxnoo`;
  - asset servido verificado com o patch e sem `disabled: ready ? null`;
  - nao ha service worker no codigo do app.
- Reproducao real no Pedido #20
  (`ad988da1-df36-4441-afef-16d9172f5c01`):
  - antes do patch, tela mostrava cadeia pronta e botao verde
    `Concluir pedido`;
  - DOM do botao: `disabledProp=true`, `disabledAttr="null"`,
    cursor `pointer`;
  - `onclick` property vazio porque o helper registra eventos via
    `addEventListener`;
  - sem overlay cobrindo o centro do botao;
  - console sem erro;
  - clique visual por automacao disparou a RPC e toast `Pedido concluido.`;
  - o Pedido #20 ficou `entregue` no staging durante a reproducao. Nao houve
    dado real novo, SQL ou migration, mas houve alteracao real de status
    desse pedido.
- Causa raiz:
  - `buildConclusaoPedido` renderizava `disabled: ready ? null : 'disabled'`;
  - `window.el(...)` faz `setAttribute(k, v)` e, no browser, atributo
    `disabled` presente desabilita o botao mesmo com valor `"null"`;
  - `buildFooterAction` tinha a mesma armadilha para acoes do Pedido Detail.
- Por que R1 nao pegou:
  - o harness fake tratava `disabled: null` como habilitado, diferente do DOM
    real;
  - os testes validavam o handler/RPC, mas nao validavam o atributo renderizado
    pelo helper real.
- Correcao aplicada:
  - `js/screens/pedido-detail-render.js`: atributos dos botoes agora sao
    montados condicionalmente. Apto = `onclick` + sem `disabled`; bloqueado ou
    concluido = `disabled="disabled"` + sem handler silencioso.
  - `tests/pedido-detail.smoke.js`: runtime fake passou a seguir
    `setAttribute` real e cobre pedido apto, nao apto e ja concluido.
- Comportamento depois:
  - Pedido #20 recarrega como `Concluido` / `Comercial: Entregue`;
  - botao final mostra `Pedido concluido`, cinza, `disabled="disabled"`,
    cursor `not-allowed`;
  - sem toast pendente e sem erro de console.
- Testes locais OK:
  - `node --test tests\pedido-detail.smoke.js` = 147/147;
  - `node --test tests\pedido-detail-linked-ops.smoke.js` = 7/7;
  - `node --test tests\expedicao-flow.smoke.js` = 8/8;
  - `node --test tests\expedicao-partial-flow.smoke.js` = 12/12;
  - `node --test tests\tec-to-acabamento-flow.smoke.js` = 37/37;
  - `node --test tests\op-latex-admin.smoke.js` = 55/55.
- Diagnosticos staging read-only OK:
  - `node scripts/staging/production-flow-invariants-diag.mjs`;
  - `node scripts/staging/latex-consolidation-diag.mjs`;
  - `node scripts/staging/expedicao-partial-flow-diag.mjs`.
- Arquivos alterados:
  - `js/screens/pedido-detail-render.js`;
  - `tests/pedido-detail.smoke.js`;
  - `PROJECT_STATE.md`;
  - `AGENT_HANDOFF.md`.
- Commit/push de fechamento: `Fix real pedido completion click`, somente para
  `staging/work/app-next`.
- Confirmacoes: producao intocada, `origin` nao usado para escrita, nenhum
  segredo impresso intencionalmente, sem SQL, sem migration, sem dados reais
  novos, sem alteracao destrutiva, sem `git add .`, sem reset/rebase/clean/
  stash e `supabase/.temp/` fora do commit.
# Estado pos-fase - OP Create Requires Pedido Guard B

- Fase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-GUARD-B`.
- Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO VISUAL DO USUARIO**.
- Branch/HEAD inicial: `work/app-next`,
  `9478ebe9cddb2748fe1b0ebb842d8906b903412b`; status inicial somente
  `?? supabase/.temp/`.
- Regra aplicada: OP nova so pode nascer a partir de Pedido. `#/ops/nova`
  avulso vira estado bloqueado/orientativo; `#/ops/nova?pedido_id=<uuid>`
  continua sendo a rota canonica.
- UI:
  - `js/screens/ops-list.js`: botao `Nova OP` mostra toast
    `Crie a OP a partir de um Pedido.` e navega para `#/pedidos`.
  - `js/boot.js`: acesso direto a `#/ops/nova` sem `pedido_id` tambem orienta
    por toast antes de chamar a tela.
  - `js/screens/op-nova.js`: sem Pedido e sem OP existente renderiza bloqueio
    com CTA `Ir para Pedidos`; salvar simulacao/abrir OP tambem validam
    `pedidoIdState`.
- Persistencia:
  - `js/screens/op-persistir.js`: `persistirOP` sem `pedidoId` valido retorna
    `step: 'pedido_required'` antes de qualquer leitura de proximo numero ou
    write em `ops`/`lotes`/itens.
  - Com Pedido valido, `lotes.pedido_id` e sempre preenchido com o `pedidoId`.
- Diagnostico staging read-only criado:
  `scripts/staging/ops-without-pedido-diag.mjs`. Resultado atual:
  `STATUS ALERTA`; `OPs com lote_id NULL: 0`; `OPs cujo lote.pedido_id IS NULL:
  11`; `Lotes com pedido_id IS NULL vinculados a OPs: 9`. Nao corrige dados.
- Testes verdes: `op-nova` 69/69, `op-persistir` 70/70, `ops-list` 1/1,
  `boot` 30/30, `router` 43/43, `pedido-detail` 163/163,
  `production-flow-invariants` 12/12, `op-display` 20/20.
- Diagnosticos staging complementares: invariantes de fluxo OK, consolidacao
  Latex OK e expedicao parcial OK. O novo diagnostico de orfaos retorna ALERTA
  por dados historicos ja existentes.
- Pendencia proxima: fase C/RPC para guard backend em `gerar_op_latex` e
  split/derivados, impedindo propagacao de OP filha a partir de origem sem
  Pedido. Tambem fica pendente decisao de cleanup/backfill dos orfaos de
  staging, em fase propria e com autorizacao explicita.
- Confirmacoes: sem SQL, sem migration, sem producao, sem dados reais novos,
  sem push para `origin`, sem `git add .`, `supabase/.temp/` fora do commit.
# Estado pos-fase - OP Create Requires Pedido RPC Guard C

- Fase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C`.
- Status: **PATCH TECNICO PRONTO - AGUARDANDO VALIDACAO TECNICA/STAGING**.
- Branch/HEAD inicial: `work/app-next`,
  `0245fc771158527954c91bc158f63396d96e4cad`; status inicial somente
  `?? supabase/.temp/`.
- RPCs auditadas: historicas `db/08`, `db/09`, `db/22`, `db/26`; efetivas para
  esta frente `db/29_op_latex_split_rpc.sql` (`gerar_op_latex` e
  `gerar_op_latex_split`). Scripts auditados: `latex-consolidation-diag` e
  `ops-without-pedido-diag`. Testes relacionados: `production-flow-invariants`,
  `op-latex-split`, `latex-consolidation-schema`, `op-latex-admin`.
- Migration criada: `db/33_op_latex_requires_pedido_guard.sql`. Ela redefine
  `gerar_op_latex(BIGINT)` e `gerar_op_latex_split(BIGINT, TEXT)` preservando o
  contrato da `db/29`, mas adicionando guarda da OP origem:
  `ops.lote_id -> lotes.pedido_id` precisa existir. Caso contrario, aborta com
  `Nao e possivel gerar OP de Acabamento/Latex: OP origem nao possui Pedido
  vinculado.` antes de chamar `proximo_numero_op`.
- Diagnostico ampliado: `scripts/staging/ops-without-pedido-diag.mjs` lista as
  OPs orfas com contexto de entregas, `op_latex_entregas`,
  expedicoes/`expedicao_itens`, possivel Pedido inferivel por
  `op_itens.pedido_item_id -> pedido_itens.pedido_id` e classificacao
  preliminar A/B/C/D. Continua apenas SELECT e bloqueia producao.
- Dados historicos conhecidos em staging continuam sem cleanup:
  `OPs com lote_id NULL: 0`; `OPs cujo lote.pedido_id IS NULL: 11`;
  `Lotes com pedido_id IS NULL vinculados a OPs: 9`. Classificacao desta
  rodada: A=6 (`op_id` 1,2,3,4,9,15), B=4 (`op_id` 5,6,7,8), C=0, D=1
  (`op_id` 10).
- Testes locais verdes: bateria obrigatoria (`op-nova`, `op-persistir`,
  `op-display`, `op-latex-admin`, `production-flow-invariants`) mais
  `op-latex-requires-pedido-guard`, `op-latex-split` e
  `latex-consolidation-schema`.
- Aplicacao staging: **nao aplicada nesta etapa**. Pendente aplicar/validar em
  staging `ucrjtfswnfdlxwtmxnoo` se o fluxo tecnico autorizar.
- Confirmacoes: producao intocada; `origin` nao usado para escrita; sem
  cleanup/backfill; sem constraint global; sem alteracao de dados reais; sem
  RLS; sem fornecedor/PDF; sem alterar identificacao OP; sem `git add .`;
  `supabase/.temp/` fora do patch.
# Estado pos-fase - OP Create Requires Pedido RPC Guard C Staging Apply

- Fase: `RAVATEX-TAPETES-OP-CREATE-REQUIRES-PEDIDO-RPC-GUARD-C-STAGING-APPLY`.
- Status: **STAGING APPLY OK**.
- Branch/HEAD inicial antes do registro: `work/app-next`,
  `95946d5f4026fa927c41be486eefecb68a01100c`; status inicial somente
  `?? supabase/.temp/`.
- Migration aplicada: `db/33_op_latex_requires_pedido_guard.sql`.
- Ambiente alvo: Supabase staging `ucrjtfswnfdlxwtmxnoo`.
- Metodo: aplicacao manual informada pelo usuario no SQL Editor do Supabase
  staging. Producao `bhgifjrfagkzubpyqpew` nao usada. Supabase CLI nao esta
  instalado neste ambiente. Apos o usuario fornecer a URL SQL do staging,
  catalogo PostgreSQL consultado via Node/`pg` com `pg_get_functiondef`.
- Confirmacao de catalogo: `gerar_op_latex(p_entrega_id bigint)` e
  `gerar_op_latex_split(p_entrega_id bigint, p_motivo text)` retornaram
  `guard=true` e `guard_before_number=true`; a guarda
  `ops.lote_id -> lotes.pedido_id` esta aplicada antes de
  `public.proximo_numero_op`.
- Validacao pos-aplicacao:
  - `ops-without-pedido-diag`: ALERTA historico esperado; `0` OPs com
    `lote_id NULL`, `11` OPs cujo `lote.pedido_id IS NULL`, `9` lotes sem
    Pedido vinculados a OPs. Classificacao: A=6 (`op_id` 1,2,3,4,9,15), B=4
    (`op_id` 5,6,7,8), C=0, D=1 (`op_id` 10).
  - `production-flow-invariants-diag`: OK; 0 duplicatas default; `op_numeros`
    OK (`latex::2026=16`, `tecelagem::2026=25`).
  - `latex-consolidation-diag`: OK; 0 duplicidades default; 1 split atual com
    `criacao_split` e `split_derivado` completos.
  - `expedicao-partial-flow-diag`: OK; saldos, status e limites coerentes.
- Testes locais verdes: `op-latex-requires-pedido-guard`, `op-latex-split`,
  `latex-consolidation-schema`, `production-flow-invariants`, `op-nova`,
  `op-persistir`.
- Pendencias posteriores: triagem das 11 orfas historicas; backfill/cleanup e
  constraint global somente apos decisao de produto/tecnica.
- Confirmacoes: producao intocada; `origin` nao usado para escrita; sem
  cleanup/backfill; sem constraint global; sem dados reais novos; sem alterar
  RLS/PDF/fornecedor/identificacao OP; sem alterar `op_numeros`; usar staging
  seletivo se houver commit; `supabase/.temp/` fora do patch.
# Estado pos-fase - Pedido/OP Controlled Delete B

- Fase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-B`.
- Status: **STAGING APPLY OK - AGUARDANDO VALIDACAO VISUAL/TECNICA DO USUARIO**.
- Migration nova: `db/34_controlled_delete_pedido_op.sql`.
- Aplicada somente em staging `ucrjtfswnfdlxwtmxnoo` via
  `npx.cmd supabase --workdir supabase db query --linked --file ...`.
  Producao `bhgifjrfagkzubpyqpew` intocada.
- RPCs: `diagnosticar_impacto_pedido(UUID)`,
  `diagnosticar_impacto_op(BIGINT)`, `remover_pedido(UUID, TEXT)`,
  `remover_op(BIGINT, TEXT)`.
- Politica implementada: exclusao fisica temporaria apenas para testes/admin;
  Pedido sem cadeia produtiva e seguro; Pedido com OP sem movimento exige
  `EXCLUIR`; Pedido/OP com entrega ou expedicao bloqueia; OP Tecelagem com OP
  de Acabamento filha bloqueia na remocao individual e orienta excluir a filha
  primeiro.
- Helper central: `js/delete-helpers.js` exposto como `window.RAVATEX_DELETE`.
- Telas alteradas: `pedidos-list`, `pedido-detail`, `ops-list`, `op-nova`,
  `op-tecelagem-producao-admin`, `op-latex-admin`.
- `excluirOpLatex` foi substituido internamente: nao faz mais
  `supa.from('ops').delete()`, delega ao helper/RPC central.
- Script staging read-only: `scripts/staging/delete-impact-diag.mjs`.
- Validacao staging pos-apply: catalogo confirmou as 4 RPCs; diagnostico
  targeted confirmou Pedido #27 como `requires_confirmation` e OP 5/2026 como
  `blocked` por entrega. Diagnosticos read-only da malha continuam coerentes;
  alerta historico preservado: 11 OPs/lotes orfaos sem Pedido em staging.
- Testes locais verdes: checks JS, `controlled-delete`, `pedidos-list`,
  `ops-list`, `pedido-detail`, `op-nova`, `op-latex-admin` e
  `production-flow-invariants`.
- Garantias: sem alterar `op_numeros`, sem renumerar OPs, sem soft-delete,
  sem senha admin nesta fase, sem producao, sem push/escrita em `origin`, sem
  exclusao real em staging sem ID autorizado explicitamente.
- Futuro: senha/admin forte + soft-delete/auditoria permanente antes de
  qualquer uso em producao.
# Estado pos-fase - Pedido/OP Controlled Delete Policy Fix C

- Fase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-POLICY-FIX-C`.
- Status: **PATCH CORRETIVO TECNICO**.
- Problema corrigido: trigger legado `ops_numeradas_no_delete` da `db/26`
  bloqueava delete fisico de OP numerada antes das RPCs controladas concluirem.
- Ajuste: `db/34_controlled_delete_pedido_op.sql` agora derruba
  `ops_numeradas_no_delete` e `ops_numeradas_no_delete_fn()` para o modo
  staging/teste de exclusao controlada.
- Politica atual: OP numerada sem entrega, sem expedicao e sem OP filha pode
  ser removida fisicamente com confirmacao `EXCLUIR` quando exigida; Pedido com
  OP numerada sem bloqueadores reais tambem pode remover a cadeia vinculada.
- Preservado: entrega/expedicao/filha continuam `blocked`; `op_numeros` nao e
  alterado; OPs restantes nao sao renumeradas; numeros nao sao reciclados;
  nenhuma exclusao real em staging sem ID autorizado pelo usuario.
# Estado pos-fase - Pedido/OP Controlled Delete Cascade Test D

- Fase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-CASCADE-TEST-D`.
- Status: **PATCH TECNICO PRONTO - AGUARDANDO RETESTE DO USUARIO**.
- Migration nova: `db/35_controlled_delete_test_cascade.sql`.
- A `db/35` redefine `diagnosticar_impacto_pedido`,
  `diagnosticar_impacto_op`, `remover_pedido` e `remover_op`.
- Nova classificacao: `requires_cascade_confirmation` com
  `cascade_required=true`, `cascade_reason` e
  `confirmation_required='EXCLUIR TUDO'`.
- Politica: entrega/OP filha sem expedicao pode ser removida em cascata
  controlada no ambiente de teste; expedição permanece `blocked`.
- Helper `js/delete-helpers.js` agora mostra aviso de cascata e exige
  `EXCLUIR TUDO` quando `cascade_required=true`.
- Preservado: sem producao, sem delete real automatico, sem alterar
  `op_numeros`, sem renumerar OP e sem reciclar numeros.
# Estado pos-fase - Pedido/OP Controlled Delete FK Order Fix E

- Fase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-FK-ORDER-FIX-E`.
- Status: **PATCH VALIDADO COM DELETE SINTETICO EM STAGING - AGUARDANDO RETESTE DO USUARIO**.
- Migration nova: `db/36_controlled_delete_fk_order_fix.sql`, aplicada somente
  em staging `ucrjtfswnfdlxwtmxnoo`.
- Causa raiz confirmada: `db/35` nao limpava todos os caminhos FK de
  `entrega_itens` (`op_id` e `op_item_id`) antes de `DELETE FROM ops`; alem
  disso, os guards de `entregas`/`entrega_itens` retornavam `NEW` em `DELETE`,
  cancelando deletes autorizados. A `db/36` corrige os guards para retornar
  `OLD` em DELETE.
- Ordem da RPC: montar `target_ops`, `target_op_itens`, `target_entregas`,
  `target_op_latex_links`, `target_child_ops`, `target_child_op_itens`;
  bloquear expedicao; apagar `op_latex_entregas`; apagar `entrega_itens` por
  `op_id` ou `op_item_id`; apagar entregas vazias; verificar zero
  `entrega_itens` remanescente; apagar OPs filhas antes das raizes; apagar
  lotes/pedido quando aplicavel.
- Teste sintetico real em staging: Pedido #29
  `e9b43072-2c7b-4a16-8d4a-9f9e66ec7415`, lote 27, OP Tecelagem 45, OP Latex
  46, itens 68/69, entrega 21, entrega_item 23, link `op_latex_entregas` 21.
  `remover_pedido(..., 'EXCLUIR TUDO')` retornou `ok=true`; remanescentes
  todos 0; `op_numeros` antes/depois identico (`latex::2026=16`,
  `tecelagem::2026=25`).
- Testes: `controlled-delete`, `pedidos-list`, `ops-list`,
  `op-latex-admin`, `production-flow-invariants` OK. Diagnosticos staging:
  `delete-impact`, `production-flow-invariants`, `latex-consolidation`,
  `expedicao-partial-flow` OK.
- Garantias: producao intocada, `origin` nao usado para escrita, sem
  renumerar OP, sem reciclar numero, sem alterar `op_numeros`, sem
  `git add .`, `supabase/.temp` fora do patch.
# Estado pos-fase - Pedido/OP Controlled Delete Expedicao Cascade E2

- Fase: `RAVATEX-TAPETES-PEDIDO-OP-CONTROLLED-DELETE-EXPEDICAO-CASCADE-E2`.
- Status: **PATCH VALIDADO COM DELETE SINTETICO COM EXPEDICAO EM STAGING - AGUARDANDO RETESTE DO USUARIO**.
- Migration nova: `db/37_controlled_delete_expedicao_cascade.sql`, aplicada
  somente em staging `ucrjtfswnfdlxwtmxnoo`.
- Causa raiz: a `db/36` ainda classificava expedição como `blocked` e a UI
  orientava excluir a expedição antes. Para staging/teste, a regra atual e
  cascata fisica controlada da cadeia inteira quando o usuario confirma
  `EXCLUIR TUDO`.
- Mapeamento FK confirmado em staging: `expedicoes` referencia Pedido/OP;
  `expedicao_itens` referencia `expedicoes` e `op_itens`;
  `expedicao_movimentos` referencia `expedicoes`; e
  `expedicao_movimento_itens` referencia movimentos e itens de expedição.
  Nao havia triggers nas tabelas de expedicao inspecionadas.
- Nova politica: expedição vinculada nao fica `blocked` em staging/teste;
  diagnostico retorna `requires_cascade_confirmation`,
  `cascade_required=true`, `confirmation_required='EXCLUIR TUDO'` e
  `cascade_includes_expedicao=true`. O texto antigo "Exclua a expedição
  antes" foi removido do helper.
- Ordem da RPC: montar alvos de Pedido/OP; apagar
  `expedicao_movimento_itens`; apagar `expedicao_movimentos`; apagar
  `expedicao_itens`; apagar `expedicoes`; apagar `op_latex_entregas`;
  apagar `entrega_itens` por `op_id` ou `op_item_id`; apagar entregas vazias;
  verificar zero remanescente de entrega/expedição; apagar OPs filhas antes
  das raizes; apagar lotes/pedido quando aplicavel.
- Teste sintetico real em staging via REST/RPC: Pedido #30
  `1803e2d3-39f4-47c2-a60e-e7629cb69810`, lote 28, OP Tecelagem 47, OP Latex
  48, itens 70/71, entrega 22, entrega_item 24, link `op_latex_entregas` 22,
  expedicao 5, expedicao_item 10, expedicao_movimento 5,
  expedicao_movimento_item 7. Pre-diagnostico:
  `requires_cascade_confirmation`, `blocked=false`, expedicao inclu�da na
  cascata. `remover_pedido(..., 'EXCLUIR TUDO')` retornou `ok=true`;
  remanescentes todos 0, inclusive expedi��o/movimentos/itens e origem
  quebrada.
- `op_numeros` antes/depois identico: `latex::2026=16`,
  `tecelagem::2026=25`. Nao renumerar OP e nao reciclar numero.
- Testes locais verdes: `controlled-delete`, `pedidos-list`, `ops-list`,
  `op-latex-admin`, `production-flow-invariants`.
- Garantias: producao intocada; `origin` nao usado para escrita; sem delete
  real nao autorizado; sem alterar `op_numeros`; sem `git add .`;
  `supabase/.temp` fora do patch.
- Risco remanescente: politica fisica limitada a staging/teste. Producao
  ainda precisa de senha/admin forte, soft-delete e auditoria permanente antes
  de qualquer caminho equivalente.

# Estado pos-fase - NO-PARALLEL-LOAD-ACTION-B

- Fase: `RAVATEX-TAPETES-PEDIDO-NO-PARALLEL-LOAD-ACTION-B`.
- Prioridade: P0.
- Tipo: PATCH pequeno com diagnostico obrigatorio.
- Branch: `work/app-next`.
- HEAD inicial: `04cc445c05c35ff9a86203343236481a763fe993`.
- HEAD final: a definir apos commit.
- Status: `supabase/.temp` (untracked) — limpo no resto.

## Problema

No modal do Pedido, durante a transicao `Tecelagem → Acabamento`, aparecia
o botao `Carregar nesta movimentacao` na OP de Acabamento/Latex relacionada.
Isso estava errado — nao existe paralelismo nesse fluxo; a OP ativa da
movimentacao e determinada pelo estagio do Pedido.

## Diagnostico

- O botao e renderizado em `buildRelatedOpsSection` dentro de
  `js/screens/pedido-detail-events.js:1221`.
- A condicao que permite aparecer e `!opCarregada && podeMovimentar`, onde
  `podeMovimentar` vem de `canMove(op, summary)` (linha 1171).
- `canMove` para acabamento retorna `true` se a OP estiver em `aberta`,
  `em_producao` ou terminal com `remaining > 0`, SEM considerar o contexto
  da transicao.
- No fluxo `Acabamento>Expedicao`, essa acao e valida (trocar a OP de
  origem). No fluxo `Tecelagem>Acabamento`, nao e — a origem e sempre a
  OP de tecelagem.

## Correcao

1. `canMove()` agora verifica `transitionKey(ctxMovement)`:
   se for `Tecelagem>Acabamento`, retorna `false` para acabamento.
2. A mensagem "Sem saldo disponivel para carregar nesta movimentacao" e
   suprimida no mesmo contexto (`Tecelagem>Acabamento` + acabamento),
   pois a ausencia de acao e por restricao de transicao e nao por falta
   de saldo real.
3. Teste smoke `NO-PARALLEL-LOAD-B` adicionado ao
   `tests/pedido-detail.smoke.js`, validando:
   - OP acabamento NAO mostra "Carregar nesta movimentacao"
   - OP acabamento mantem "Abrir OP"
   - Nao ha mensagem enganosa de saldo

## Arquivos alterados

- `js/screens/pedido-detail-events.js`: +4 linhas em `canMove` (gate
  `transitionKey`), +2 linhas no bloco de mensagem vazia.
- `tests/pedido-detail.smoke.js`: +1 teste runtime.
- `PROJECT_STATE.md`: atualizado.
- `AGENT_HANDOFF.md`: este bloco.

## Testes

- `node --test tests/pedido-detail.smoke.js` — 172/172 OK.
- `node --test tests/pedido-detail-linked-ops.smoke.js` — 7/7 OK.

## Garantias

- Producao intocada.
- `origin` nao usado para escrita.
- Sem `git add .`.
- `supabase/.temp` fora do commit.
- `Abrir OP` e demais acoes validas preservadas.
- Fluxo `Acabamento>Expedicao` (com `Carregar nesta movimentacao` valido)
  inalterado.
