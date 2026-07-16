# PORTAL_B2B_ARCHITECTURE_RULES.md

> Phase `RAVATEX-TAPETES-PORTAL-B2B-GOVERNANCE-A`.
> Scope: **docs-only**.
> Objective: establish architectural boundaries before resuming
> `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A`.

## 1. General principle

The B2B Portal must grow in a modular way. It is forbidden to paste
standalone HTML directly into the app, and it is also forbidden to mix,
within the same flow, client, admin, and supplier responsibilities.

## 2. Separation of roles

### Client

- creates an order;
- views own orders;
- views sanitized visual status;
- never sees OP, batch, supplier, cost, invoice, packing list, or internal data.

### Admin

- controls operational status;
- publishes the visual status for the client;
- sees a preview of what the client sees;
- retains authority over external communication.

### Supplier

- in the future, feeds internal/operational status;
- does not directly alter the client's visual status;
- does not access the B2B client's commercial data.

## 3. Separation between operational status and visual status

Never reuse `pedidos.status` as the definitive source for client
tracking. External communication must use its own field, such as
`status_cliente_visual`. Internal events remain separate from the
events visible to the client.

## 4. Standalone HTML

Standalone files coming from Claude Design are visual reference. It is
forbidden to copy raw HTML into the app. Every mockup must be
converted into components compatible with the app's current standard.

## 5. Common components

Common elements must be shareable between client, admin, and
supplier:

- shell/base layout;
- sidebar;
- topbar;
- cards;
- metrics/KPIs;
- badges;
- tables;
- modals;
- forms;
- steppers;
- empty states.

Do not duplicate the same visual component across multiple screens
without need.

## 6. Current technical standard

Maintain the app's current technical standard:

- static SPA;
- classic JS;
- `window.*`;
- scripts ordered in `index.html`;
- no introducing a bundler;
- no converting to a framework;
- no broad opportunistic refactoring.

## 7. Decomposition rule

The next phases must be small and separated by responsibility:

- diagnosis;
- schema;
- Supabase application;
- admin UI;
- client UI;
- supplier UI;
- dashboard;
- automation;
- shell redesign.

Do not mix schema + frontend in the same phase.
Do not mix admin + client in the same phase, except for a minimal
adjustment explicitly authorized.
Do not mix supplier + client in the same phase.
Do not mix external automation with UI.

## 8. Security and RLS

RLS controls the row, not the column. The client must not rely on
`select('*')`. Client screens must use explicit SELECT, a sanitized
view, or a sanitized RPC when necessary. Never expose `service_role`,
token, OP, batch, supplier, cost, invoice, packing list, or internal
metadata to the client.

## 9. Writes

Rendering must not write data. Writes must stay in explicit,
auditable functions or modules. Admin publishes the visual status.
Client creates an order, but does not publish or manipulate the
visual status. The future supplier feeds internal operations, not
direct external communication.

## 10. Current mockups

The current mockups for this front are:

- Client Dashboard;
- New Order;
- Add Item Modal;
- Order Detail.

They must be used to extract visual and compositional patterns, not
as a direct implementation.

## 11. Next sequence

After this governance, the recommended sequence is:

1. `RAVATEX-TAPETES-PEDIDOS-CLIENTE-TRACKING-SCHEMA-A`
2. application of the SQL in staging
3. admin dropdown
4. client reading real visual status
5. visible history
6. client dashboard
7. shell/common components redesign
8. supplier and automation only afterward
