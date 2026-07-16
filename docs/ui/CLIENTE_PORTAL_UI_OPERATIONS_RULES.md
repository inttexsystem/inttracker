# Cliente Portal UI - Operational Rules Matrix

> **Phase:** `RAVATEX-TAPETES-CLIENTE-PORTAL-UI-OPERATIONS-RULES-A`
> **Type:** diagnostic/documentation of operational rules for UI.
> **Scope:** docs-only. No implementation. No UI changes.
> **Production:** remains blocked.

## 1. Base State

- **HEAD analyzed:** `a5377fc`.
- **Branch:** `work/app-next`.
- **Source of this document:** `docs/ui/CLIENTE_PORTAL_UI_GAP_INVENTORY.md`.
- **Staging:** functional for the B2B Client Portal.
- **UI:** functional, but **not final**.
- **Production/original:** blocked; this document does not authorize merge,
  deploy, environment promotion, or functional change.

## 2. Already Consolidated Decisions

The rules below are already closed and must be preserved in any future
phase:

- client does not see OP;
- client does not see batch;
- client does not see supplier;
- client does not see invoice/packing list;
- client does not see cost/margin;
- client does not see metadata/created_by/origin;
- client portal is read-only except for order creation;
- operational status and visual status are separate;
- admin publishes visual status;
- supplier does not change visual status directly at this stage;
- client timeline reads only visible events;
- production is not released.

## 3. Matrix of Pending Decisions

| ID | Topic | Affected Screen | Question for the Project Owner | Option A | Option B | Technical Recommendation | Impact if A is Decided | Impact if B is Decided | Status |
|---|---|---|---|---|---|---|---|---|---|
| OP-001 | New Order Flow | Novo Pedido | Should the client order be created in a single step or in two steps with review/finalization? | single step, direct form | two steps, items + review/finalization | **B**. The mockup already separates items, instructions, and finalization, and this reduces operational error. | Lower UI cost now; keeps the current flow simpler, but with less adherence to the mockup. | Requires a new review step, navigation states, and confirmation texts, but aligns with the expected flow. | PENDING |
| OP-002 | Add Item Modal | Novo Pedido / Modal Adicionar Item | Should items be added inline or via modal? | inline | dedicated modal | **B**. Keeps adherence to the mockup and reduces the visual complexity of the main screen. | Keeps the current implementation shorter, but conflicts with the mockup and makes extra fields per item harder. | Requires a component/modal and screen reorganization, but improves clarity and scalability. | PENDING |
| OP-003 | Required Fields per Item | Novo Pedido / Modal Adicionar Item | Which fields are required for each item? | require only model + meterage | define a larger set of required fields (e.g., width and colors) | **PENDING**. Documented decision is missing; do not assume width/colors/attachment are required without confirmation. | Less friction when filling in, but may generate under-specified items. | Higher operational quality of the order, with more friction on entry. | PENDING |
| OP-004 | Receiving Type | Novo Pedido | Should `tipo_recebimento` appear in Novo Pedido? | yes, with "Retirada" as default | do not display yet | **A**. The mockup already uses "Retirada" as the default and the schema already has the field. | Introduces a new field in the UI, but without requiring a new schema. | Keeps the current form shorter, but leaves an already-modeled operational data point unused. | PENDING |
| OP-005 | Client Reference | Novo Pedido / Dashboard / Detalhe | Should `referencia_cliente` be a visible field in Novo Pedido and in Dashboard/Detalhe? | visible in Novo Pedido and Detalhe | internal/admin only | **A**, if the client uses an internal number or their own PO. | Improves traceability for the client, with small UI and select impact. | Keeps the UI leaner, but may make reconciliation with the client's processes harder. | PENDING |
| OP-006 | Desired Deadline vs. Delivery Deadline | Novo Pedido / Detalhe | Should the client provide `prazo_desejado` separately from `prazo_entrega`? | client provides desired deadline; admin sets delivery deadline | keep using only prazo_entrega | **A**. Separates the client's request from the operational commitment. | Requires a form adjustment and a read adjustment in the detail view; improves semantics. | Keeps things simple, but mixes the client's request with the operational promise. | PENDING |
| OP-007 | Operational Status in the Client Detail View | Detalhe / Stepper | Should the client screen display the operational `pedido.status` together with `status_cliente_visual`? | hide the operational status from the client | display both | **C**. Display only the visual status; any technical fallback must remain invisible to the client. | Reduces ambiguity and brings the screen closer to the mockup. | Keeps two simultaneous taxonomies and may confuse the client. | PENDING |
| OP-008 | Dashboard: Quick Actions | Dashboard Cliente | Should the dashboard have quick actions? | Novo pedido + Ver pedidos | contextual links only | **A**, if the creation flow is mature after the adjustments. | Requires a new CTA area and helps primary navigation. | Keeps the dashboard leaner, with less adherence to the mockup. | PENDING |
| OP-009 | Client Menu | Shell/Menu | Should the client menu have 2 or 4 items? | Inicio + Meus pedidos | Inicio + Novo pedido + Meus pedidos + Suporte | **B**. Aligns with the mockup; "Suporte" can be a non-functional placeholder if authorized. | Lower risk and preserves the current shell. | Requires menu redesign and a decision about the shared shell; brings the UX closer to the mockup. | PENDING |
| OP-010 | Suporte | Shell/Menu | Should the Suporte option exist now? | no | yes, as a simple link/contact | **B** only if a defined channel exists; otherwise, postpone. | Avoids an empty placeholder and reduces scope. | Introduces a new point of contact, but depends on a real owner/channel. | PENDING |
| OP-011 | Upload/Image on the Item | Modal Adicionar Item | Will the client be able to attach an image/reference to the item? | not in this version | yes, but only visual/local in the future | **A** for now. Storage/attachment opens a new block of schema, storage, and policy. | Keeps scope contained and without new security surfaces. | Opens a storage dependency and new operational/technical rules. | PENDING |
| OP-012 | Cancellation/Editing by the Client | Detalhe / Meus pedidos | Can the client edit/cancel an order after submission? | no | edit while status is recebido | **A**, or an indirect future request flow; do not create a direct update without a closed operational rule. | Preserves the read-only portal after creation and reduces operational risk. | Requires a clear rule for the editing window, audit, and impact on admin/operations. | PENDING |

**Note on OP-007:** the matrix above records the technical recommendation
as option "C" (visual status only, with an invisible technical fallback),
even though the mandatory table only has impact columns for A/B.
If the project owner chooses to expose both statuses, it will be necessary
to consciously accept two simultaneous taxonomies on the same screen.

**Note on OP-010:** the full decision has three real paths:

- A: no;
- B: yes, as a simple link/contact;
- C: yes, as a future form.

Since the mandatory matrix only asks for Option A and Option B columns, the
alternative "C" is recorded here as a future possibility, but not
recommended for this stage.

**Fields to consider in OP-003:** model, meterage, width, color 1,
color 2, notes, image/attachment.

## 4. Impact by Screen

### Dashboard Cliente

- **Decisions affecting the screen:** OP-005, OP-008.
- **Likely files:** `js/screens/cliente-dashboard.js`.
- **Risk:** low.
- **Decision dependency:** without defining CTA/quick actions and the
  eventual client reference, any visual adjustment tends to be rework.

### Novo Pedido

- **Decisions affecting the screen:** OP-001, OP-004, OP-005, OP-006.
- **Likely files:** `js/screens/cliente-pedido-form.js`.
- **Risk:** medium, because it touches the client portal's only write.
- **Decision dependency:** the 1- or 2-step flow changes the screen's
  base structure; the fields `tipo_recebimento`, `referencia_cliente`, and
  `prazo_desejado` must not be introduced without a closed decision.

### Modal Adicionar Item

- **Decisions affecting the screen:** OP-002, OP-003, OP-011.
- **Likely files:** `js/screens/cliente-pedido-form.js`,
  possibly `js/ui.js` if there is a reusable modal.
- **Risk:** medium.
- **Decision dependency:** the set of required fields and whether or not
  upload exists define whether the screen stays simple or becomes a
  heavier flow.

### Detalhe

- **Decisions affecting the screen:** OP-005, OP-006, OP-007, OP-012.
- **Likely files:** `js/screens/cliente-pedido-detail.js`.
- **Risk:** low for visual reorganization; medium if the phase attempts
  to introduce editing/cancellation.
- **Decision dependency:** the screen must not mix two taxonomies nor
  expose change buttons without a closed rule.

### Stepper/Timeline

- **Decisions affecting the screen:** OP-007.
- **Likely files:** `js/screens/cliente-pedido-tracking.js`,
  `js/pedido-tracking-ui.js`, `js/screens/cliente-pedido-detail.js`.
- **Risk:** low to medium.
- **Decision dependency:** the visual status is already consolidated; the
  main pending item is avoiding reintroducing the operational status as a
  parallel hierarchy for the client.

### Shell/Menu

- **Decisions affecting the screen:** OP-009, OP-010.
- **Likely files:** `js/screens/cliente-common.js`,
  `js/screens/common.js`.
- **Risk:** high, because `shellLayout` is shared with admin and
  supplier.
- **Decision dependency:** the shell must come last; the cross-role risk
  is higher than on the other screens.

## 5. Recommended Implementation Sequence

The sequence below must only start **after** the project owner answers
OP-001 through OP-012:

1. `UI-GAP-FIX-NOVO-PEDIDO-A`
2. `UI-GAP-FIX-MODAL-ITEM-A`
3. `UI-GAP-FIX-DETALHE-A`
4. `UI-GAP-FIX-DASHBOARD-A`
5. `UI-GAP-FIX-SHELL-A`

Record as a rule:

- `UI-GAP-FIX-SHELL-A` must come last, because `shellLayout` is shared
  with admin/supplier and carries cross-role risk.

## 6. Questions for the Project Owner

- OP-001: A/B?
- OP-002: A/B?
- OP-003: which fields are required per item?
- OP-004: A/B?
- OP-005: A/B/C?
- OP-006: A/B?
- OP-007: A/B/C?
- OP-008: A/B/C?
- OP-009: A/B?
- OP-010: A/B/C?
- OP-011: A/B/C?
- OP-012: A/B/C?

## 7. Out of Scope

- production;
- automation;
- supplier;
- storage/attachments;
- editing/cancellation;
- full support;
- merge `origin/main`.

## 8. Final Confirmations

- This document **does not implement UI**.
- This document **does not change code, schema, SQL, or Supabase**.
- The client UI remains **not final**.
- The recommended next step is for the project owner to answer
  `OP-001` through `OP-012` before any UI implementation.
- Production/original remains **blocked**.
