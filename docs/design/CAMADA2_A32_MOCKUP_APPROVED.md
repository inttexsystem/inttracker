# Camada 2 — A3.2 — Approved Mockup (Summary Cards + Toolbar)

> **Approved by the architect on 2026-07-15**, including the adjustment of the
> cards' background from `#f4f6f9` to `#fff` (same tone as `.rv-adm-card` in
> `js/screens/painel.js`), applied in commit `3198570`.
> Status badge (Ativo/Inativo) and other grid tokens not listed here
> follow the pre-existing baseline of `js/screens/admin-usuarios.js` (A3.1),
> untouched by this phase.
> Reference implementation: `js/screens/admin-usuarios.js`
> (`kpiCard`, `tipoBadge`, toolbar in `renderStandalone()`).
> Not a source of state — operational state lives in `PROJECT_STATE.md`.

---

## 1. Summary Cards (KPI)

4-column grid, above the toolbar.

- **Grid:** `grid-template-columns: repeat(4, 1fr)`, `gap: 14px`,
  `margin-bottom: 18px`.
- **Card (default — Administradores / Fornecedores / Clientes):**
  - background `#fff`;
  - border `1px solid #e4e8ee`;
  - `border-radius: 5px`;
  - `padding: 14px 16px`.
- **Card (Inativos — alert tone):**
  - background `#fff8f8`;
  - border `1px solid #f3dcdc`.
- **Label** (top left): `font-size: 12px`; color `#8a93a3` (default) /
  `#b06a6a` (Inativos). Literal text: "Administradores", "Fornecedores",
  "Clientes", "Inativos".
- **KPI icon** (top right): 15×15, `stroke-width: 1.9`, same
  stroke-based convention as the other icons on the screen (`viewBox 0 0 24 24`,
  `linecap`/`linejoin: round`). Color `#8a93a3` (default) / `#b06a6a`
  (Inativos). One per card: shield (Administradores), factory
  (Fornecedores), users (Clientes), user-off (Inativos).
- **Value:** `font-size: 22px`, `font-weight: 500`, color `#16203a`
  (default) / `#d6403a` (Inativos).
- **Subtitle:** `font-size: 11.5px`, same color as the label, `margin-top:
  2px`. Default: `"{ativos} ativos · {inativos} inativos"`. Inativos:
  `"de {N} no total"`.
- **Counts:** derived from the data already loaded by `reload()`
  (`allUsers`), no new query — always over the total, independent of
  search/filter/sort applied to the grid below.

## 2. Toolbar

Replaces the search+toggle row from A3.1; same handlers preserved.

- **Container:** `display: flex`, `align-items: center`, `gap: 12px`,
  `margin-bottom: 14px`, `flex-wrap: wrap`.
- **Search:** `flex: 1 1 320px`, `min-width: 220px`; background `#fff`; border
  `1px solid #d8dce2`; `border-radius: 5px`; `padding: 8px 13px`; magnifying-glass
  icon 14px `#9aa2af`. Placeholder: `"Buscar por nome ou e-mail"`.
  Matched fields: e-mail, nome, tipo, fornecedor, cliente, status
  (inherited from A3.1, expanded only in the placeholder text).
- **"Ordenar" select:** same border/radius style as the search field; `padding:
  8px 11px`; `font-size: 13px`. Options: `Nome A–Z` (default) / `Nome Z–A`
  / `Tipo` / `Último acesso`. **"Último acesso" is inert** (stable sort,
  no visible effect) until the read RPC exists — see §4.
- **"Filtrar por tipo" select:** same style. Options: `Todos` (default)
  / `Admin` / `Fornecedor` / `Cliente`. Client-side filter over
  `allUsers`, no new query.
- **"Mostrar inativos" toggle:** inline, `gap: 8px`, `font-size: 13px`,
  color `#5b6472`. Handler identical to the one in A3.1.

## 3. Role badge (Tipo column)

Replaces the plain text of the Tipo column in the main grid.

- `display: inline-flex`, `border-radius: 4px`, `padding: 2px 8px`,
  `font-size: 11.5px`, `font-weight: 600`.
- **Admin:** background `#e8eefc`, color `#2563eb`.
- **Fornecedor:** background `#eceef1`, color `#5a6472`.
- **Cliente:** background `#f0edfc`, color `#6d5bd0`.

## 4. "Último acesso" column — Not implemented in this phase

Blocked by HARD STOP: `auth.users.last_sign_in_at` is not read anywhere
in the repository and no RPC/view exposes it today; any read path
requires a new migration. **Architect decision (2026-07-15):
chosen path = admin-only `SECURITY DEFINER` RPC, following the `is_admin()`
pattern.** Recorded as future micro-phase `CAMADA2-LAST-ACCESS-RPC` —
`NOT AUTHORIZED`, a candidate to be grouped with the `A4.1` migration
(see `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`). The main
grid remains with the same 6 columns + Ações from A3.1 until this
RPC exists.

## 5. Inactive row opacity

Rows in the main grid with `ativo === false` receive `opacity: 0.6`
on the entire row element (applied independently of the opacity
already existing on the individual action buttons, inherited from A3.1).

## 6. Out of scope for this spec (do not confuse with pending items here)

- Password reset/reactivation icons — belong to `A5`.
- Bulk actions — `A3.3`, `DEFERRED`.
- Status badge (Ativo/Inativo), main grid, create/
  edit/deactivate/delete modals — baseline from `A3.1`, not changed by this
  spec.

---

> Full functional/visual reference for the Camada 2 front:
> `docs/architecture/CAMADA2_USUARIOS_SPEC_PROPOSED.md`.
