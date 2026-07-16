# PORTAL_B2B_ARCHITECTURE_RULES.md

> Fase `RAVATEX-TAPETES-PORTAL-B2B-GOVERNANCE-A`.
> Escopo: **docs-only**.
> Objetivo: fixar limites arquiteturais antes da retomada de
> `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A`.

## 1. Princípio geral

O Portal B2B deve crescer de forma modular. E proibido colar HTML
standalone direto no app e tambem e proibido misturar, no mesmo fluxo,
responsabilidades de cliente, admin e fornecedor.

## 2. Separação de papéis

### Cliente

- cria pedido;
- visualiza pedidos proprios;
- visualiza status visual sanitizado;
- nunca ve OP, lote, fornecedor, custo, NF, romaneio ou dados internos.

### Admin

- controla status operacional;
- publica situacao visual para o cliente;
- ve preview do que o cliente enxerga;
- mantem autoridade sobre a comunicacao externa.

### Fornecedor

- no futuro, alimenta status interno/operacional;
- nao altera diretamente o status visual do cliente;
- nao acessa dados comerciais do cliente B2B.

## 3. Separação entre status operacional e status visual

Nunca reutilizar `pedidos.status` como fonte definitiva do
acompanhamento do cliente. A comunicacao externa deve usar campo proprio,
como `status_cliente_visual`. Eventos internos continuam separados dos
eventos visiveis ao cliente.

## 4. HTML standalone

Arquivos standalone vindos do Claude Design sao referencia visual.
E proibido copiar HTML bruto para dentro do app. Todo mockup deve ser
convertido para componentes compativeis com o padrao atual do app.

## 5. Componentes comuns

Elementos comuns devem ser compartilhaveis entre cliente, admin e
fornecedor:

- shell/base layout;
- sidebar;
- topbar;
- cards;
- metricas/KPIs;
- badges;
- tabelas;
- modais;
- formularios;
- steppers;
- empty states.

Nao duplicar o mesmo componente visual em multiplas telas sem
necessidade.

## 6. Padrão técnico atual

Manter o padrao tecnico atual do app:

- SPA estatico;
- JS classico;
- `window.*`;
- scripts ordenados em `index.html`;
- sem introduzir bundler;
- sem converter para framework;
- sem refactor amplo oportunista.

## 7. Regra de decomposição

As proximas fases devem ser pequenas e separadas por responsabilidade:

- diagnostico;
- schema;
- aplicacao Supabase;
- admin UI;
- cliente UI;
- fornecedor UI;
- dashboard;
- automacao;
- redesign shell.

Nao misturar schema + frontend na mesma fase.
Nao misturar admin + cliente na mesma fase, salvo ajuste minimo
explicitamente autorizado.
Nao misturar fornecedor + cliente na mesma fase.
Nao misturar automacao externa com UI.

## 8. Segurança e RLS

RLS controla linha, nao coluna. O cliente nao deve depender de
`select('*')`. Telas de cliente devem usar SELECT explicito, view
sanitizada ou RPC sanitizada quando necessario. Nunca expor
`service_role`, token, OP, lote, fornecedor, custo, NF, romaneio ou
metadados internos ao cliente.

## 9. Writes

Renderizacao nao deve escrever dados. Writes devem ficar em funcoes ou
modulos explicitos e auditaveis. Admin publica status visual. Cliente
cria pedido, mas nao publica nem manipula status visual. Fornecedor
futuro alimenta operacao interna, nao comunicacao externa direta.

## 10. Mockups atuais

Os mockups atuais desta frente sao:

- Dashboard Cliente;
- Novo Pedido;
- Modal Adicionar Item;
- Detalhe do Pedido.

Eles devem ser usados para extrair padroes visuais e de composicao, nao
como implementacao direta.

## 11. Próxima sequência

Apos esta governanca, a sequencia recomendada e:

1. `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A`
2. aplicacao do SQL em staging
3. dropdown admin
4. cliente lendo status visual real
5. historico visivel
6. dashboard cliente
7. redesign shell/componentes comuns
8. fornecedor e automacao apenas depois
