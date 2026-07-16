# Cliente Portal UI - Operational Rules Matrix

> **Fase:** `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A`
> **Tipo:** diagnostico/documentacao de regras operacionais para UI.
> **Escopo:** docs-only. Sem implementacao. Sem alteracao de UI.
> **Producao:** permanece bloqueada.

## 1. Estado base

- **HEAD analisado:** `a5377fc`.
- **Branch:** `work/app-next`.
- **Origem deste documento:** `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`.
- **Staging:** funcional para o Portal Cliente B2B.
- **UI:** funcional, mas **nao final**.
- **Producao/original:** bloqueada; este documento nao autoriza merge,
  deploy, promocao de ambiente ou mudanca funcional.

## 2. Decisoes ja consolidadas

As regras abaixo ja estao fechadas e devem ser preservadas em qualquer
fase futura:

- cliente nao ve OP;
- cliente nao ve lote;
- cliente nao ve fornecedor;
- cliente nao ve NF/romaneio;
- cliente nao ve custo/margem;
- cliente nao ve metadata/criado_por/origem;
- portal cliente e read-only exceto criacao de pedido;
- status operacional e status visual sao separados;
- admin publica status visual;
- fornecedor nao altera status visual diretamente nesta etapa;
- timeline cliente le apenas eventos visiveis;
- producao nao esta liberada.

## 3. Matriz de decisoes pendentes

| ID | Tema | Tela afetada | Pergunta para o dono do projeto | Opcao A | Opcao B | Recomendacao tecnica | Impacto se decidir A | Impacto se decidir B | Status |
|---|---|---|---|---|---|---|---|---|---|
| OP-001 | Fluxo de Novo Pedido | Novo Pedido | O pedido cliente deve ser criado em uma etapa unica ou em duas etapas com revisao/finalizacao? | uma etapa, formulario direto | duas etapas, itens + revisao/finalizacao | **B**. O mockup ja separa itens, instrucoes e finalizacao, e isso reduz erro operacional. | Menor custo de UI agora; mantem o fluxo atual mais simples, mas com menor aderencia ao mockup. | Exige nova etapa de revisao, estados de navegacao e textos de confirmacao, mas alinha com o fluxo esperado. | PENDENTE |
| OP-002 | Modal Adicionar Item | Novo Pedido / Modal Adicionar Item | Itens devem ser adicionados inline ou por modal? | inline | modal dedicado | **B**. Mantem aderencia ao mockup e reduz a complexidade visual da tela principal. | Mantem a implementacao atual mais curta, mas conflita com o mockup e dificulta campos extras por item. | Exige componente/modal e reorganizacao da tela, mas melhora clareza e escalabilidade. | PENDENTE |
| OP-003 | Campos obrigatorios por item | Novo Pedido / Modal Adicionar Item | Quais campos sao obrigatorios para cada item? | obrigar so modelo + metragem | definir conjunto maior de obrigatorios (ex.: largura e cores) | **PENDENTE**. Falta decisao documentada; nao assumir obrigatoriedade de largura/cores/anexo sem confirmacao. | Menor friccao no preenchimento, mas pode gerar itens pouco especificados. | Maior qualidade operacional do pedido, com maior atrito na entrada. | PENDENTE |
| OP-004 | Tipo de recebimento | Novo Pedido | `tipo_recebimento` deve aparecer no Novo Pedido? | sim, com padrao "Retirada" | nao exibir ainda | **A**. O mockup ja usa "Retirada" como padrao e o schema ja possui o campo. | Introduz campo novo na UI, mas sem exigir schema novo. | Mantem o form atual mais curto, porem deixa um dado operacional ja modelado sem uso. | PENDENTE |
| OP-005 | Referencia do cliente | Novo Pedido / Dashboard / Detalhe | `referencia_cliente` deve ser campo visivel no Novo Pedido e no Dashboard/Detalhe? | visivel no Novo Pedido e Detalhe | apenas interno/admin | **A**, se o cliente usa numero interno ou OC propria. | Melhora rastreabilidade para o cliente, com impacto pequeno de UI e select. | Mantem a UI mais enxuta, mas pode dificultar conciliacao com processos do cliente. | PENDENTE |
| OP-006 | Prazo desejado vs prazo entrega | Novo Pedido / Detalhe | Cliente deve informar `prazo_desejado` separado de `prazo_entrega`? | cliente informa prazo desejado; admin define prazo entrega | continuar usando apenas prazo_entrega | **A**. Separa solicitacao do cliente de compromisso operacional. | Exige ajuste de formulario e de leitura no detalhe; melhora semantica. | Mantem simplicidade, mas mistura pedido do cliente com promessa operacional. | PENDENTE |
| OP-007 | Status operacional no detalhe cliente | Detalhe / Stepper | A tela cliente deve exibir `pedido.status` operacional junto com `status_cliente_visual`? | ocultar status operacional do cliente | exibir ambos | **C**. Exibir somente o status visual; qualquer fallback tecnico deve ficar invisivel ao cliente. | Reduz ambiguidade e aproxima a tela do mockup. | Mantem duas taxonomias simultaneas e pode confundir o cliente. | PENDENTE |
| OP-008 | Dashboard: acoes rapidas | Dashboard Cliente | Dashboard deve ter acoes rapidas? | Novo pedido + Ver pedidos | somente links contextuais | **A**, se o fluxo de criacao estiver maduro apos os ajustes. | Exige area nova de CTA e ajuda a navegacao primaria. | Mantem dashboard mais seco, com menor aderencia ao mockup. | PENDENTE |
| OP-009 | Menu cliente | Shell/Menu | Menu cliente deve ter 2 ou 4 itens? | Inicio + Meus pedidos | Inicio + Novo pedido + Meus pedidos + Suporte | **B**. Alinha com o mockup; "Suporte" pode ser placeholder nao funcional se houver autorizacao. | Menor risco e preserva shell atual. | Exige redesenho do menu e decisao sobre shell compartilhado; aproxima a UX do mockup. | PENDENTE |
| OP-010 | Suporte | Shell/Menu | A opcao Suporte deve existir agora? | nao | sim, como link/contato simples | **B** somente se houver canal definido; caso contrario, adiar. | Evita placeholder vazio e reduz escopo. | Introduz novo ponto de contato, mas depende de dono/canal real. | PENDENTE |
| OP-011 | Upload/imagem no item | Modal Adicionar Item | Cliente podera anexar imagem/referencia ao item? | nao nesta versao | sim, mas apenas visual/local futuro | **A** por enquanto. Storage/anexo abre novo bloco de schema, storage e policy. | Mantem escopo contido e sem novas superficies de seguranca. | Abre dependencia de storage e novas regras operacionais/tecnicas. | PENDENTE |
| OP-012 | Cancelamento/edicao pelo cliente | Detalhe / Meus pedidos | Cliente pode editar/cancelar pedido apos envio? | nao | editar enquanto status recebido | **A** ou fluxo indireto de solicitacao futura; nao criar update direto sem regra operacional fechada. | Preserva o portal read-only apos criacao e reduz risco operacional. | Exige regra clara de janela de edicao, auditoria e impacto em admin/operacao. | PENDENTE |

**Observacao sobre OP-007:** a matriz acima registra a recomendacao
tecnica como opcao "C" (somente status visual com fallback tecnico
invisivel), embora a tabela obrigatoria tenha as colunas de impacto A/B.
Se o dono do projeto optar por expor ambos os status, sera necessario
aceitar conscientemente duas taxonomias simultaneas na mesma tela.

**Observacao sobre OP-010:** a decisao completa possui tres caminhos
reais:

- A: nao;
- B: sim, como link/contato simples;
- C: sim, como formulario futuro.

Como a matriz obrigatoria pede apenas colunas de Opcao A e Opcao B, a
alternativa "C" fica registrada aqui como possibilidade futura, mas nao
recomendada para esta etapa.

**Campos a considerar em OP-003:** modelo, metragem, largura, cor 1,
cor 2, observacao, imagem/anexo.

## 4. Impacto por tela

### Dashboard Cliente

- **Decisoes que afetam a tela:** OP-005, OP-008.
- **Arquivos provaveis:** `js/screens/cliente-dashboard.js`.
- **Risco:** baixo.
- **Dependencia de decisao:** sem definir CTA/acoes rapidas e eventual
  referencia do cliente, qualquer ajuste visual tende a ser retrabalho.

### Novo Pedido

- **Decisoes que afetam a tela:** OP-001, OP-004, OP-005, OP-006.
- **Arquivos provaveis:** `js/screens/cliente-pedido-form.js`.
- **Risco:** medio, porque toca o unico write do portal cliente.
- **Dependencia de decisao:** o fluxo de 1 ou 2 etapas muda a estrutura
  base da tela; os campos `tipo_recebimento`, `referencia_cliente` e
  `prazo_desejado` nao devem ser introduzidos sem decisao fechada.

### Modal Adicionar Item

- **Decisoes que afetam a tela:** OP-002, OP-003, OP-011.
- **Arquivos provaveis:** `js/screens/cliente-pedido-form.js`,
  possivelmente `js/ui.js` se houver modal reutilizavel.
- **Risco:** medio.
- **Dependencia de decisao:** o conjunto de campos obrigatorios e a
  existencia ou nao de upload definem se a tela continua simples ou
  vira um fluxo mais pesado.

### Detalhe

- **Decisoes que afetam a tela:** OP-005, OP-006, OP-007, OP-012.
- **Arquivos provaveis:** `js/screens/cliente-pedido-detail.js`.
- **Risco:** baixo para reorganizacao visual; medio se a fase tentar
  introduzir edicao/cancelamento.
- **Dependencia de decisao:** a tela nao deve misturar duas taxonomias
  nem expor botoes de alteracao sem regra fechada.

### Stepper/Timeline

- **Decisoes que afetam a tela:** OP-007.
- **Arquivos provaveis:** `js/screens/cliente-pedido-tracking.js`,
  `js/pedido-tracking-ui.js`, `js/screens/cliente-pedido-detail.js`.
- **Risco:** baixo a medio.
- **Dependencia de decisao:** o status visual ja esta consolidado; a
  pendencia principal e evitar reintroduzir o status operacional como
  hierarquia paralela para o cliente.

### Shell/Menu

- **Decisoes que afetam a tela:** OP-009, OP-010.
- **Arquivos provaveis:** `js/screens/cliente-common.js`,
  `js/screens/common.js`.
- **Risco:** alto, porque `shellLayout` e compartilhado com admin e
  fornecedor.
- **Dependencia de decisao:** o shell deve ficar por ultimo; o risco
  cross-role e maior que nas demais telas.

## 5. Sequencia recomendada de implementacao

A sequencia abaixo so deve comecar **depois** de o dono do projeto
responder OP-001 a OP-012:

1. `UI-GAP-FIX-NOVO-PEDIDO-A`
2. `UI-GAP-FIX-MODAL-ITEM-A`
3. `UI-GAP-FIX-DETALHE-A`
4. `UI-GAP-FIX-DASHBOARD-A`
5. `UI-GAP-FIX-SHELL-A`

Registrar como regra:

- `UI-GAP-FIX-SHELL-A` deve ficar por ultimo, porque `shellLayout` e
  compartilhado com admin/fornecedor e carrega risco cross-role.

## 6. Perguntas para o dono do projeto

- OP-001: A/B?
- OP-002: A/B?
- OP-003: quais campos sao obrigatorios por item?
- OP-004: A/B?
- OP-005: A/B/C?
- OP-006: A/B?
- OP-007: A/B/C?
- OP-008: A/B/C?
- OP-009: A/B?
- OP-010: A/B/C?
- OP-011: A/B/C?
- OP-012: A/B/C?

## 7. Fora de escopo

- producao;
- automacao;
- fornecedor;
- storage/anexos;
- edicao/cancelamento;
- suporte completo;
- merge `origin/main`.

## 8. Confirmacoes finais

- Este documento **nao implementa UI**.
- Este documento **nao altera codigo, schema, SQL ou Supabase**.
- A UI cliente continua **nao final**.
- A proxima etapa recomendada e o dono do projeto responder
  `OP-001` a `OP-012` antes de qualquer implementacao de UI.
- Producao/original segue **bloqueada**.
