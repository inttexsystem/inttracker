# Vendored fixture runtime — React 18.3.1

**These are immutable third-party assets.** They exist so the versioned UI
fixtures render without reaching any external origin. Do not edit, reformat,
minify, concatenate, patch or regenerate them. They were promoted byte-for-byte
from the official npm packages and their hashes are pinned below.

## Packages

| Package | Version | License | Registry integrity |
|---|---|---|---|
| `react` | 18.3.1 | MIT | `sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==` |
| `react-dom` | 18.3.1 | MIT | `sha512-5m4nQKp+rZRb09LNH59GM4BxTh9251/ylbKIbpe7TpGxfJ+9kv6BLkLBXIjjspbgbnIBNqlI23tRnTWT0snUIw==` |

Tarballs were obtained with `npm pack react@18.3.1 react-dom@18.3.1` and their
SHA-1 matched the registry `dist.shasum` (`49ab8920…2891`, `c2265d79…5cb4`)
before extraction.

## Promoted files

| Versioned file | Original package-relative path | SHA-256 | Bytes |
|---|---|---|---|
| `react.production.min.js` | `react/umd/react.production.min.js` | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` | 10751 |
| `react-dom.production.min.js` | `react-dom/umd/react-dom.production.min.js` | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` | 131835 |
| `LICENSE` | `react/LICENSE` | `52412d7bc7ce4157ea628bbaacb8829e0a9cb3c58f57f99176126bc8cf2bfc85` | 1086 |

`react/LICENSE` and `react-dom/LICENSE` are byte-identical in these packages
(same SHA-256), so one copy covers both.

### Independent provenance proof

`docs/ui/fixtures/op-detail-compacto/support.js` hard-codes Subresource
Integrity hashes for the CDN copies it would otherwise fetch. Both promoted
files reproduce those hashes exactly:

| File | SRI pinned in `support.js` |
|---|---|
| `react.production.min.js` | `sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z` |
| `react-dom.production.min.js` | `sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1` |

So these files are byte-identical to what the CDN would have served. Nothing was
substituted or rebuilt.

## Why they are versioned here

`support.js` boots with `loadReactUmd().then(init)` and hides the raw template
before that promise settles. With external origins unavailable the fetch fails,
`init()` never runs, and the fixture renders a **blank page** — proved by an
offline gate that returned 0 characters of visible text and 0 rendered cards.

A reference fixture that only renders with internet access is not a reference.
`support.js` already short-circuits when the globals are present
(`if (w.React && w.ReactDOM) return Promise.resolve();`), so loading these two
files first makes the CDN path unreachable during normal initialization. The
fixture is therefore self-contained, and `support.js` was not modified.

## Boundaries

- **Product runtime must never import these files.** They are fixture
  infrastructure only: no `index.html` entry, no `js/**` import, no product
  bundle may reference this directory. A focused test asserts this.
- They are **not** precedent for project source-file size or formatting. Minified
  third-party bytes are exempt from `CODE_HEALTH_RULES.md` §7 because they are
  not project source and are never edited.
- They are **not** a second token, component or styling source. Visual values
  remain owned exclusively by `css/tokens.css`.
- **Changing these versions requires a separate explicit order.** Do not upgrade,
  downgrade, deduplicate or re-vendor them opportunistically; the pinned hashes
  above are part of the accepted checkpoint.
