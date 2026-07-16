# Camada 2 — A3.2 — Mockup Aprovado (Cards-resumo + Toolbar)

> **Aprovado pelo arquiteto em 2026-07-15**, incluindo o ajuste de fundo dos
> cards de `#f4f6f9` para `#fff` (mesmo tom de `.rv-adm-card` em
> `js/screens/painel.js`), aplicado no commit `3198570`.
> Badge de status (Ativo/Inativo) e demais tokens de grid não listados aqui
> seguem o baseline pré-existente de `js/screens/admin-usuarios.js` (A3.1),
> intocado por esta fase.
> Implementação de referência: `js/screens/admin-usuarios.js`
> (`kpiCard`, `tipoBadge`, toolbar em `renderStandalone()`).
> Não é fonte de estado — estado operacional vive em `PROJECT_STATE.md`.

---

## 1. Cards-resumo (KPI)

Grid de 4 colunas, acima da toolbar.

- **Grid:** `grid-template-columns: repeat(4, 1fr)`, `gap: 14px`,
  `margin-bottom: 18px`.
- **Card (padrão — Administradores / Fornecedores / Clientes):**
  - fundo `#fff`;
  - borda `1px solid #e4e8ee`;
  - `border-radius: 5px`;
  - `padding: 14px 16px`.
- **Card (Inativos — tom de alerta):**
  - fundo `#fff8f8`;
  - borda `1px solid #f3dcdc`.
- **Label** (topo esquerdo): `font-size: 12px`; cor `#8a93a3` (padrão) /
  `#b06a6a` (Inativos). Texto literal: "Administradores", "Fornecedores",
  "Clientes", "Inativos".
- **Ícone KPI** (topo direito): 15×15, `stroke-width: 1.9`, mesma
  convenção stroke-based dos demais ícones da tela (`viewBox 0 0 24 24`,
  `linecap`/`linejoin: round`). Cor `#8a93a3` (padrão) / `#b06a6a`
  (Inativos). Um por card: escudo (Administradores), fábrica
  (Fornecedores), usuários (Clientes), user-off (Inativos).
- **Valor:** `font-size: 22px`, `font-weight: 500`, cor `#16203a`
  (padrão) / `#d6403a` (Inativos).
- **Subtítulo:** `font-size: 11.5px`, mesma cor do label, `margin-top:
  2px`. Padrão: `"{ativos} ativos · {inativos} inativos"`. Inativos:
  `"de {N} no total"`.
- **Contagens:** derivadas dos dados já carregados por `reload()`
  (`allUsers`), sem query nova — sempre sobre o total, independentes de
  busca/filtro/ordenação aplicados ao grid abaixo.

## 2. Toolbar

Substitui a linha de busca+toggle de A3.1; mesmos handlers preservados.

- **Container:** `display: flex`, `align-items: center`, `gap: 12px`,
  `margin-bottom: 14px`, `flex-wrap: wrap`.
- **Busca:** `flex: 1 1 320px`, `min-width: 220px`; fundo `#fff`; borda
  `1px solid #d8dce2`; `border-radius: 5px`; `padding: 8px 13px`; ícone
  de lupa 14px `#9aa2af`. Placeholder: `"Buscar por nome ou e-mail"`.
  Campos casados: e-mail, nome, tipo, fornecedor, cliente, status
  (herdado de A3.1, ampliado apenas no texto do placeholder).
- **Select "Ordenar":** mesmo estilo de borda/radius da busca; `padding:
  8px 11px`; `font-size: 13px`. Opções: `Nome A–Z` (padrão) / `Nome Z–A`
  / `Tipo` / `Último acesso`. **"Último acesso" é inerte** (sort estável,
  sem efeito visível) até a RPC de leitura existir — ver §4.
- **Select "Filtrar por tipo":** mesmo estilo. Opções: `Todos` (padrão)
  / `Admin` / `Fornecedor` / `Cliente`. Filtro client-side sobre
  `allUsers`, sem query nova.
- **Toggle "Mostrar inativos":** inline, `gap: 8px`, `font-size: 13px`,
  cor `#5b6472`. Handler idêntico ao de A3.1.

## 3. Badge de papel (coluna Tipo)

Substitui o texto plano da coluna Tipo no grid principal.

- `display: inline-flex`, `border-radius: 4px`, `padding: 2px 8px`,
  `font-size: 11.5px`, `font-weight: 600`.
- **Admin:** fundo `#e8eefc`, cor `#2563eb`.
- **Fornecedor:** fundo `#eceef1`, cor `#5a6472`.
- **Cliente:** fundo `#f0edfc`, cor `#6d5bd0`.

## 4. Coluna "Último acesso" — NÃO implementada nesta fase

Bloqueada por HARD STOP: `auth.users.last_sign_in_at` não é lido em
lugar nenhum do repositório e nenhuma RPC/view o expõe hoje; qualquer
via de leitura exige migration nova. **Decisão do arquiteto (2026-07-15):
via escolhida = RPC `SECURITY DEFINER` admin-only, padrão `is_admin()`.**
Registrada como micro-fase futura `CAMADA2-LAST-ACCESS-RPC` —
`NOT AUTHORIZED`, candidata a ser agrupada com a migration de `A4.1`
(ver `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`). O grid
principal permanece com as mesmas 6 colunas + Ações de A3.1 até essa
RPC existir.

## 5. Opacidade de linha inativa

Linhas do grid principal com `ativo === false` recebem `opacity: 0.6`
no elemento da linha inteira (aplicado independentemente da opacidade
já existente nos botões de ação individuais, herdada de A3.1).

## 6. Fora de escopo desta spec (não confundir com pendente aqui)

- Ícones de reset/reativação de senha — pertencem à `A5`.
- Bulk actions — `A3.3`, `DEFERRED`.
- Badge de status (Ativo/Inativo), grid principal, modais de criar/
  editar/desativar/excluir — baseline de `A3.1`, não alterados por esta
  spec.

---

> Referência funcional/visual completa da frente Camada 2:
> `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
