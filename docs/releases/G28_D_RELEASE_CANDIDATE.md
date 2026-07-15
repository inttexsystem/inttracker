# G28-D release candidate — contract discovery

**Status:** `RELEASE CONTRACT DISCOVERY COMPLETE / BLOCKED BY SPECIFIC MISSING DEPLOYMENT DEFINITION`
**Candidate commit at preparation:** `d5ec09f803c2c64697ee3605b7d4ecfee168a66a`
**Authority:** preparation only; no publication, production access, push, tag, or release creation is authorized or performed.

## Source-backed contract

| Field | Discovery |
| --- | --- |
| APPLICATION_RUNTIME | Static browser application: root `index.html` plus classic JavaScript modules; `README.md` identifies static HTML hosted on GitHub Pages. |
| BUILD_COMMAND | `NONE — NOT DEFINED IN REPOSITORY` for the root static application (no root `package.json` or build configuration). |
| BUILD_OUTPUT | Repository root static assets (`index.html`, `js/`, `css/`); a generated output directory is `UNKNOWN — NOT DEFINED IN REPOSITORY`. |
| DEPLOYMENT_PROVIDER | GitHub Pages is stated in legacy `docs/DEPLOYMENT.md`; no current canonical deployment configuration exists in the repository. |
| DEPLOYMENT_TARGET | Historical `docs/DEPLOYMENT.md` states repository `grupoterrabranca/controle-tapetes`, branch `main`, root directory. The present canonical mapping is `UNKNOWN — NOT DEFINED IN REPOSITORY`. |
| CUSTOMER_ACCESS_URL | Historical `docs/DEPLOYMENT.md` states `https://grupoterrabranca.github.io/controle-tapetes/`; `js/config.js` selects production only for `grupoterrabranca.github.io`. Current Pages configuration is `UNKNOWN — NOT DEFINED IN REPOSITORY`. |
| DEPLOYMENT_BRANCH | `UNKNOWN — NOT DEFINED IN REPOSITORY`. Local metadata has `origin/main` at `1047181...`, but it cannot prove the configured Pages source. |
| REQUIRED_PUSH | `UNKNOWN — NOT DEFINED IN REPOSITORY`. Historical deployment text says push to `main`; it is explicitly legacy and no current authorization is granted. |
| REQUIRED_TAG_OR_RELEASE | `UNKNOWN — NOT DEFINED IN REPOSITORY`. No local tag contains the candidate. |
| REQUIRED_ENVIRONMENT | Production host must select `APP_ENVIRONMENTS.production` in `js/config.js`; current hosting environment configuration is `UNKNOWN — NOT DEFINED IN REPOSITORY`. |
| REQUIRED_DATABASE_STATE | Migrations `db/51_document_canonical_links.sql` and `db/52_document_link_correction_revocation_restoration.sql` are application prerequisites. They are recorded verified in staging only; production application state and its apply procedure are `UNKNOWN — NOT DEFINED IN REPOSITORY`. |
| ROLLBACK_MECHANISM | Historical `docs/DEPLOYMENT.md` describes `git revert <sha>` followed by a push; the current authorized rollback procedure is `UNKNOWN — NOT DEFINED IN REPOSITORY`. |
| POST_DEPLOY_SMOKE | `UNKNOWN — NOT DEFINED IN REPOSITORY`. The accepted non-blocking debt remains authenticated browser smoke unavailable to the tooling. |

## Accepted release contents and lineage

- Base: `9ef61e1896af631bc5aeeced4af93c77051f4de4` (B7 accepted implementation baseline).
- Included commits: `f985f8b857f83d977936eae47ea830a5cb6ba4c3` (B8 technical), `5c30c147601ac5b31e9fb09569cc057dee02de09` (B8 staging closeout), `a7d7caa8984e56b44c0302bff5d578a8be5ff536` (C closeout), `d5ec09f803c2c64697ee3605b7d4ecfee168a66a` (C acceptance).
- Application changes: canonical document-link correction, revocation, restoration, audit runtime and modal, wired only in the central Documentos queue; no Pedido/OP write surface was added.
- Migrations: `db/51_document_canonical_links.sql` and `db/52_document_link_correction_revocation_restoration.sql`; 52 is additive and its staging registry evidence is `20260715024449`.
- Canonical documentation changes: `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, master G28 plan, and append-only G28 ledger.
- Unrelated commits: none identified in the lineage from B7 base to the accepted C commit; the diff is document-link implementation, tests, migrations, and canonical closeout documentation.
- Local deploy-ref relationship: candidate is ahead of locally cached `origin/main` by 540 commits and of locally cached `staging/main` by 238 commits; each local ref is 0 commits ahead of the candidate. Remote divergence after the cached refs is `UNKNOWN — NOT DETERMINABLE WITHOUT FETCH`.

## Readiness evidence

- Focused document/link release battery selected from B4–B8 test files: `901` pass, `0` fail (local, no network).
- Syntax checks passed for the five B8 JavaScript files; `git diff --check` passed.
- No root build script exists. `services/documents-ingestor` has `npm run build`/`npm test`, but its combined local run timed out after 120 seconds without output; it is not the static-app publication build contract.
- No `.env`, `.env.local`, or `services/documents-ingestor/.env` file is tracked or staged; the latter is ignored by its component `.gitignore`.
- No production-only mutation can be declared unnecessary: the production state of migrations 51/52 is not repository-provable, and no authorized production apply mechanism is defined.

## Preconditions and checklists

Before any architect-authorized publication, define and authorize all of: current Pages/provider mapping, exact deployment branch/ref and publication command, production migration 51/52 state plus approved apply/verification method, rollback owner/procedure, and authenticated post-deploy smoke.

Pre-deploy: confirm the selected commit and clean index; rerun the focused document/link battery and `git diff --check`; confirm no secret/local-env path is staged; verify production database prerequisites through an explicitly authorized procedure.

Post-deploy: perform an authenticated admin smoke for the Documentos link-admin modal (history, correction, unlink, restoration, stale/conflict feedback) and verify the customer URL serves the selected revision.

## Publication contract

No publication command is proposed. The repository lacks a current canonical definition for the production deployment mapping and production database migration procedure. Historical commands in `docs/DEPLOYMENT.md` are intentionally not actionable because that document marks itself legacy.

No tag/release was created, no push occurred, and production was not accessed.
