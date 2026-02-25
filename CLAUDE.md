# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**wearon-shopify** is a Shopify Theme App Extension that embeds a virtual try-on widget on merchant product pages. It is the storefront-facing layer of the WearOn platform — the backend (billing, webhooks, credit ledger, generation) lives in the upstream `wearon` monorepo, not here.

The app is listed as **free** on the Shopify App Store. No payments are collected inside the Shopify iframe — all credit management happens on the WearOn platform (`app.wearon.ai`).

**Two features:**
- **Size Recommendation** — free, unlimited. Uses Google MediaPipe for body measurement, compares against merchant-entered garment measurements.
- **Virtual Try-On (VTO)** — credit-based. Uses OpenAI image generation. Credits are managed on the WearOn platform, synced automatically.

**Two billing modes:**
- **absorb_mode**: merchant covers VTO credit costs, shopper gets frictionless access
- **resell_mode**: shopper adds credits at a merchant-set retail price (merchant earns margin)

**Language rule:** Never use "buy" or "purchase" in user-facing plugin UI/copy. Use "manage", "add", "topup" instead.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | JavaScript (ES Modules, `"type": "module"`) |
| UI | Vanilla DOM + Shadow DOM (no framework) |
| Theme integration | Liquid block (`tryon-block.liquid`) |
| Testing | Vitest (from parent monorepo's `node_modules`) |
| Platform | Shopify App (embedded, webhooks API `2026-01`) |

## Development Commands

```bash
# Run all tests (from this directory)
npm test
# Or directly:
node ../node_modules/vitest/vitest.mjs run

# Run a single test file
node ../node_modules/vitest/vitest.mjs run __tests__/tryon-widget.test.js

# Run tests in watch mode
node ../node_modules/vitest/vitest.mjs

# Shopify CLI (requires @shopify/cli installed globally or via parent monorepo)
shopify app dev                  # Start local dev server + tunnel (uses wearon-ai-tester.myshopify.com)
shopify app deploy               # Deploy extension to Shopify Partners
shopify app build                # Build extension assets for deploy
```

There is no build step for assets — the extension JS files are plain ES modules served directly by Shopify.

## Project Structure

```
extensions/wearon-tryon/
  blocks/tryon-block.liquid       # Liquid block — injects widget on product pages only
  assets/
    tryon-widget.js               # Main widget: Shadow DOM UI, state machine, camera, capture, auto-init
    tryon-privacy-flow.js         # Config/balance API helpers, privacy/age session storage, checkout link builder
    size-rec-display.js           # Size recommendation formatting + XSS sanitization

__tests__/
  tryon-widget.test.js            # Widget lifecycle, billing modes, privacy gate, bundle size budget
  tryon-privacy-flow.test.js      # Config parsing, balance polling, age verification timestamp logic
  tryon-accessibility.test.js     # ARIA, focus, touch targets, forced-colors, live regions
  size-rec-display.test.js        # Size formatting, confidence threshold, input sanitization

shopify.app.toml                  # Shopify app config (client_id, scopes, redirect URLs, webhooks)
.shopify/project.json             # Dev store: wearon-ai-tester.myshopify.com
```

## Architecture

### Widget Lifecycle

1. `tryon-block.liquid` renders a `<div data-wearon-tryon>` host on **product pages only** (`{% if request.page_type == 'product' %}`) and loads `tryon-widget.js` as a `defer`red module script
2. On load, `initTryOnWidgets(document)` auto-runs — it queries all `[data-wearon-tryon]` elements and calls `createTryOnWidget(host, options)` on each
3. `createTryOnWidget()` attaches a Shadow DOM to the host, builds the full UI tree imperatively, and starts the access-mode state machine
4. Widget calls `GET /api/v1/stores/config` to resolve billing mode, then conditionally fetches `GET /api/v1/credits/shopper` (resell mode only)
5. On config errors, widget **fails closed** (requires login, blocks access)

### Key Design Decisions

- **Shadow DOM isolation** — prevents host theme CSS from breaking the widget; all styles are scoped
- **No bundler** — assets are plain ES modules with relative imports; a test enforces the bundle stays under 50KB gzipped and loads within 2s on simulated 3G
- **Dependency injection throughout** — `createTryOnWidget()` accepts `documentRef`, `getUserCameraFn`, `resolveTryOnAccessFn`, `apiClient`, `sessionStorageRef`, etc., making all tests run without browser APIs
- **Session storage** for privacy acknowledgment and age verification (with 24h timestamp expiry on age gate)

### Canonical API Endpoints (v1)

The source code contains legacy non-versioned defaults (`/api/store-config`, `/api/shopper-credits/balance`). **All new and updated code must use the versioned paths below.** Endpoints are injectable via options — no hardcoded paths in production.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/stores/config` | Store config: `billing_mode`, `retail_credit_price`, `shop_domain`, `shopify_variant_id`, `vtoDailyLimit` |
| `GET /api/v1/credits/shopper` | Shopper credit state: `balance`, `totalAdded`, `totalUsed` (resell mode) |
| `POST /api/v1/size-rec/events` | Size recommendation event tracking |
| `POST /api/v1/size-rec/feedback` | Size recommendation feedback (token-based, rate-limited) |
| `POST /api/v1/generation/events` | VTO generation event tracking (key: `client_session_id`) |

Checkout link format: `https://{shop_domain}/cart/{variant_id}:{quantity}` (opens new tab)

### Integration Constraints

- `event_id` must be retry-stable (reuse same UUID on retries)
- VTO tracking uses `client_session_id` key (not `session_id`)
- CORS is enforced server-side against allowed domains tied to the store API key

## Testing Conventions

Tests use lightweight fakes (`FakeElement`, `createFakeDocument`, `createHostElement`, `createSessionStorageMock`) instead of JSDOM. All browser APIs are injected via options. Test files mirror asset files 1:1.

Performance budget tests (in `tryon-widget.test.js`):
- Bundle graph must be < 50KB gzipped
- Simulated 3G load (transfer + init for 3 widgets) must be < 2s

## Quality Guardrails

- Preserve Shadow DOM isolation — never break out of it
- Keep widget visible and functional on first render, mobile-first (max-width 320px)
- Maintain accessibility: ARIA labels, `aria-live` regions, focus-visible outlines, 44px min touch targets, forced-colors media query support
- Size recommendation values are sanitized against `[A-Z0-9]{1,10}` to prevent XSS; use `textContent` (never `innerHTML`)
- `Intl.NumberFormat` for credit price display

## Upstream Documentation

Plugin docs are symlinked at `docs/Shopify-Plugin-docs/` → `../../docs/Shopify-Plugin-docs/`:

| File | Purpose |
|------|---------|
| `spec/SHOPIFY_PLUGIN_SPEC.md` | PRD — functional specification |
| `architecture.md` | Widget lifecycle, state machine, runtime flow diagrams |
| `plugin-api-endpoints.md` | Full versioned API endpoints reference |
| `tech-spec-merchant-analytics-size-rec-vto.md` | Backend analytics tech spec (migrations, services, endpoints) |
| `bmad/planning-artifacts/ux-design-specification.md` | Storefront widget UX spec |
| `bmad/planning-artifacts/ux-shopify-admin-dashboard.md` | Admin dashboard UX spec (Polaris) |
| `bmad/implementation-artifacts/tech-spec-plugin-analytics-storefront-dashboard-feedback.md` | Plugin-side analytics tech spec |
| `artifacts/` | HTML prototypes (mobile widget, desktop floating, admin dashboard) |

Sprint status and story files (source of truth): `../docs/_bmad/implementation-artifacts/sprint-status.yaml`
