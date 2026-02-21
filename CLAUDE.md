# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**wearon-shopify** is a Shopify Theme App Extension that embeds a virtual try-on widget on merchant product pages. It is the storefront-facing layer of the WearOn platform — the backend (billing, webhooks, credit ledger, generation) lives in the upstream `wearon` monorepo, not here.

The widget supports two billing modes:
- **absorb_mode**: merchant absorbs costs, shopper gets frictionless access
- **resell_mode**: shopper purchases credits via Shopify checkout before using try-on

## Tech Stack

| Layer | Technology |
|---|---|
| Language | JavaScript (ES Modules, `"type": "module"`) |
| UI | Vanilla DOM + Shadow DOM (no framework) |
| Theme integration | Liquid block (`tryon-block.liquid`) |
| Testing | Vitest |
| Platform | Shopify App (embedded, webhooks API `2026-01`) |

## Development Commands

```bash
# Run tests (from this directory)
npm test
# Or directly:
node ../node_modules/vitest/vitest.mjs run
```

There is no build step — the extension assets are plain ES modules served by Shopify.

## Project Structure

```
extensions/wearon-tryon/
  blocks/tryon-block.liquid       # Liquid block — injects widget on product pages
  assets/
    tryon-widget.js               # Main widget: Shadow DOM UI, state machine, camera, capture
    tryon-privacy-flow.js         # Config/balance API helpers, privacy/age session storage, checkout link builder
    size-rec-display.js           # Size recommendation formatting + XSS sanitization

__tests__/
  tryon-widget.test.js            # Widget lifecycle, billing modes, privacy gate, bundle size budget
  tryon-privacy-flow.test.js      # Config parsing, balance polling, age verification timestamp logic
  tryon-accessibility.test.js     # ARIA, focus, touch targets, forced-colors, live regions
  size-rec-display.test.js        # Size formatting, confidence threshold, input sanitization

docs/                             # Architecture diagrams, API contracts, prototypes
shopify.app.toml                  # Shopify app config (client_id, scopes, redirect URLs)
```

## Architecture

### Widget Lifecycle
1. `tryon-block.liquid` renders a `<div data-wearon-tryon>` host and loads `tryon-widget.js` as a module script (product pages only)
2. `createTryOnWidget()` attaches a Shadow DOM to the host, builds the full UI tree imperatively, and starts the access-mode state machine
3. Widget calls `GET /api/store-config` to resolve billing mode, then conditionally fetches `GET /api/shopper-credits/balance`
4. On config errors, widget **fails closed** (requires login, blocks access)

### Key Design Decisions
- **Shadow DOM isolation** — prevents host theme CSS from breaking the widget; all styles are scoped
- **No bundler** — assets are plain ES modules with relative imports; a test enforces the bundle stays under 50KB gzipped and loads within 2s on simulated 3G
- **Dependency injection throughout** — `createTryOnWidget()` accepts `documentRef`, `getUserCameraFn`, `resolveTryOnAccessFn`, `apiClient`, `sessionStorageRef`, etc., making all tests run without browser APIs
- **Session storage** for privacy acknowledgment and age verification (with 24h timestamp expiry on age gate)

### API Contracts (consumed from upstream)
- `GET /api/store-config` — returns `billing_mode`, `retail_credit_price`, `shop_domain`, `shopify_variant_id`
- `GET /api/shopper-credits/balance` — returns `balance`, `total_purchased`, `total_spent`
- Checkout link: `https://{shop_domain}/cart/{variant_id}:{quantity}` (opens in new tab)

## Testing Conventions

Tests use lightweight fakes (`FakeElement`, `createFakeDocument`, `createHostElement`, `createSessionStorageMock`) instead of JSDOM. All browser APIs are injected via options. Test files mirror asset files 1:1.

Performance budget tests:
- Bundle graph must be < 50KB gzipped
- Simulated 3G load (transfer + init for 3 widgets) must be < 2s

## Quality Guardrails

- Preserve Shadow DOM isolation — never break out of it
- Keep widget visible and functional on first render, mobile-first (max-width 320px)
- Maintain accessibility: ARIA labels, `aria-live` regions, focus-visible outlines, 44px min touch targets, forced-colors media query support
- Size recommendation values are sanitized against `[A-Z0-9]{1,10}` to prevent XSS
- All size inputs use `textContent` (never `innerHTML`)
- `Intl.NumberFormat` for credit price display
