# Ravatex Controle de Tapetes — Architectural Health Rules

## 1. Central principle

The app must remain simple, static and modular.

The current architecture accepts:

* declarative `index.html`;
* classic scripts with `window.*`;
* modules per screen or domain;
* smoke tests in Node;
* Supabase accessed by the client when appropriate;
* development push only to `staging`.

The architecture does not accept:

* moving heavy logic back into `index.html`;
* creation of giant screens without seams;
* Supabase writes scattered across render functions;
* broad refactor mixed with feature;
* production change without explicit authorization;
* removal of cache-busting from local assets.

## 2. Rule for `index.html`

`index.html` must remain declarative.

Allowed:

* base HTML structure;
* CSS/CDN loading;
* ordered loading of scripts;
* app root container;
* cache-busting query string on local assets.

Forbidden:

* business logic;
* screen functions;
* persistence functions;
* complex handlers;
* Supabase reads/writes;
* new inline scripts, except for justified emergency.

Any new local script in `index.html` must use the current cache-busting:

```html
<script src="js/algum-arquivo.js?v=20260623-asset1"></script>
```

External CDNs must not receive `?v=`.

## 3. Rule for `js/boot.js`

`js/boot.js` is the app entrypoint.

It may contain:

* route definition;
* initial bootstrap;
* call to `loadCurrentUser`;
* decision to navigate to login or current route;
* `hashchange` listener;
* `DOMContentLoaded` protection.

It must not contain:

* screen rendering;
* OP logic;
* delivery logic;
* Supabase write;
* registration functions;
* domain helpers.

`main()` must not be called directly before the DOM is ready.

## 4. Rule for `js/router.js`

`js/router.js` is a generic routing engine.

It may contain:

* route registration;
* hash matching;
* navigation;
* route fallback;
* handler calls.

It must not contain:

* specific list of app screens;
* authentication logic;
* OP logic;
* Supabase;
* screen HTML.

## 5. Rule for `js/ui.js`

`js/ui.js` contains generic UI primitives.

It may contain:

* `setApp`;
* element helpers;
* modal;
* toast;
* shell layout;
* generic table;
* generic inputs.

It must not contain:

* business rule;
* Supabase call;
* OP-specific logic;
* supplier-specific logic;
* delivery-specific logic.

The `#app` root must be fetched at time of use, not captured too early before the DOM exists.

## 6. Rule for screens

Files in `js/screens/` must represent screens, screen blocks or cohesive domains.

Accepted examples:

* `op-nova.js`;
* `op-pdf.js`;
* `op-persistir.js`;
* `op-recalculo.js`;
* `op-writes.js`;
* `entrega-writes.js`;
* `painel.js`;
* `fornecedor.js`.

A screen may orchestrate local state and rendering.

A screen must not become an indiscriminate dump of:

* writes;
* pure helpers;
* PDF;
* calculation rules;
* generic formatting;
* functions from other screens.

## 7. Size rule

Reference limits:

* ideal file: up to 250 lines;
* acceptable file: up to 500 lines;
* exceptional file: up to 900 lines, only if it is a cohesive screen with local closure;
* ideal function: up to 80 lines;
* acceptable function: up to 150 lines;
* exceptional function: above 150 lines only with justification.

`op-nova.js` is an accepted and frozen exception. Do not use `op-nova.js` as precedent to create new large screens.

If a new file exceeds 500 lines, IAexec must justify why it was not split.

If a new function exceeds 150 lines, IAexec must justify why it was not split.

## 8. Rule for pure helpers

Pure helpers must be extracted when:

* they do not depend on DOM;
* they do not depend on Supabase;
* they do not depend on closure state;
* they receive data by argument;
* they return a predictable value;
* they are testable in isolation.

Pure helpers must not access `window.supa`.

## 9. Rule for Supabase writes

Supabase writes must stay in explicit write modules, such as:

* `op-writes.js`;
* `op-persistir.js`;
* `op-recalculo.js`;
* `entrega-writes.js`.

Render functions must not do `insert`, `update`, `delete` or `upsert`.

Any new write must declare:

* affected table;
* operation type;
* payload;
* error behavior;
* whether there is risk of partial state;
* corresponding smoke test.

If a flow writes to multiple tables, there must be an explicit note about atomicity or risk of partial operation.

## 10. Rule for Supabase reads

Reads may remain in screens when they are simple and tied to screen mounting.

Reads must be extracted when:

* they are reused by more than one screen;
* they have complex joins;
* they have permission filters;
* they become a source of recurring bugs;
* they exceed the screen's responsibility.

## 11. Rule for authentication and profile

The app depends on:

```text
auth.users.id = public.usuarios.id
```

No patch must alter this rule without explicit decision.

If Auth login works, but the app returns to login, check first:

```sql
select id, email, nome, tipo, fornecedor_id
from public.usuarios
where id = '<auth-user-id>';
```

Do not alter `auth.js` to mask the absence of a profile.

## 12. Rule for cache-busting

All local assets loaded by `index.html` must keep a version query string.

Example:

```html
<script src="js/screens/op-pdf.js?v=20260623-asset1"></script>
```

When adding new local JS:

* insert in the correct order;
* apply the current version;
* update smoke tests to accept `?v=`;
* do not apply `?v=` to external CDNs.

## 13. Rule for tests

Every patch must have a test proportional to the risk.

Minimum standard:

* `node --check` on the changed JS files;
* smoke test of the changed module;
* smoke test of the route/boot if `index.html`, `boot.js` or script order is changed;
* smoke test of writes if persistence is changed;
* manual local test when changing boot, UI, auth or a critical screen.

Do not run the full suite by default if the phase does not require it.

## 14. Rule for phases

Each phase must have a single scope.

Do not mix:

* diagnosis with patch;
* refactor with feature;
* docs with code;
* Supabase with frontend;
* production with staging;
* test fix with broad functional change.

If the phase touches more than 3 domains, it must be broken up.

## 15. Rule for Git

Before any patch:

```powershell
git status --short
git branch --show-current
git rev-parse --short HEAD
git ls-remote --heads staging main
git ls-remote --heads origin main
```

Forbidden:

* `git add .`;
* `git reset --hard`;
* `git rebase`;
* `git push --force`;
* push to `origin` without explicit authorization.

Allowed:

* selective staging;
* small commit;
* push to `staging work/app-next:main` when authorized.

## 16. Rule for documentation

Update docs when there is:

* new structural module;
* entrypoint change;
* route change;
* write helper change;
* Supabase contract change;
* freezing or unfreezing of refactor;
* relevant architectural decision.

Main docs:

* `PROJECT_STATE.md`;
* `AGENT_HANDOFF.md`;
* `docs/refactor/ARCHITECTURE_REFACTOR_LEDGER.md`;
* `docs/architecture/CODE_HEALTH_RULES.md`.

## 17. Architectural blocking criteria

A patch must be blocked if it:

* puts heavy logic back into `index.html`;
* adds a Supabase write inside render;
* removes cache-busting without a substitute;
* alters `auth.js` to hide the absence of a profile;
* touches `origin/main` without authorization;
* mixes broad refactor with feature;
* creates a large screen without justification;
* changes script order without a test;
* breaks smoke tests and treats it as irrelevant without proof.

## 18. Periodic audit

At each relevant set of features, run a read-only audit:

* largest files;
* largest functions;
* new Supabase writes;
* scripts in `index.html`;
* new routes;
* existing tests;
* atomicity risks;
* documentation pending items.

The audit must conclude with:

* continue;
* do a micro-refactor;
* freeze;
* or open a specific correction phase.

## 19. Rule for language

- New code, comments, and commit messages: English.
- User-facing UI strings: Portuguese (pt-BR).
- Existing comments are not translated retroactively; convergence to English
  happens only when a file is touched for another reason.

## 20. Rule for test doubles

A test double that imitates external behavior — the DOM, the Supabase client,
the network — must model the imitated system's **actual semantics on every axis
the suite asserts**. A double that encodes the author's assumption instead of the
imitated system's real behavior confirms any bug that assumption contains
(`TEST-MOCK-FIDELITY-AUDIT`, 2026-07-17).

Concrete axes that have already produced live defects, with the faithful shape:

- **DOM boolean attributes** — an HTML boolean attribute (`disabled`, `checked`,
  `selected`, ...) is true by mere presence, regardless of its string value; a
  faithful DOM double tracks presence (`hasAttribute`/`removeAttribute`) and
  coerces booleans, never stores the raw `setAttribute` value verbatim
  (`UI-EL-BOOLEAN-ATTR-FIX`).
- **`functions.invoke()` envelope** — the client returns the raw parsed body
  verbatim as `data`; since Edge Functions wrap success in `{ data: <payload> }`,
  a faithful `invoke` double returns `{ data: { data: <payload> }, error }` (the
  double envelope), not the flat inner payload (`UI-INVOKE-ENVELOPE-FIX`).
- **`.rpc()` / PostgREST reads** — resolve `{ data, error }`; `.single()`/
  `.maybeSingle()` return an object (or null), a chain terminal returns an array;
  `.rpc()` returns the raw function return under `data` (single level).

Adoption:

- **Prefer the shared `tests/_doubles.js`** (FaithfulNode + fake `supa`), which
  is the single canonical source for these semantics and ships with its own
  meta-tests proving it catches each class it exists to catch.
- A **hand-rolled divergence** from the shared double (a simplified per-suite
  stand-in) is allowed only with a **written justification comment in the suite**
  stating which axis is simplified and why no asserted test can be fooled by the
  simplification. A simplification that fails safe (the real code path crashes the
  test rather than passing) is acceptable; a simplification that could pass green
  on the real bug is not.
- New shared-double adoption is additive and opt-in; convergence happens when a
  suite is touched for another reason (§19 philosophy). No mandated big-bang
  migration.
