# wearon-shopify - Project Overview

**Date:** 2026-02-18
**Type:** Shopify Theme App Extension
**Architecture:** Embedded storefront widget + upstream platform contracts

## Executive Summary
`wearon-shopify` is the storefront extension repository for WearOn’s Shopify channel. It provides a mobile-first, on-product-page shopper experience for fit/visual confidence and size recommendation using a sandboxed widget architecture.

The plugin exists to support two core business goals:
- Improve merchant conversion and reduce return risk with fit/visual confidence tools
- Enable merchant monetization via resell-mode shopper credits

## Project Classification
- **Repository Type:** Monolith (single extension-focused repo)
- **Project Part:** `main`
- **Primary Language:** JavaScript (ES modules)
- **Theme Layer:** Liquid block for Shopify product pages

## Key Features in This Repo
- Theme app extension block auto-loading on product pages
- Shadow DOM-isolated, always-visible shopper widget UI
- Mobile-first layout and interaction model
- Access mode handling (`absorb_mode` vs `resell_mode`)
- Shopper credit balance and purchase flow integration (API/cart-link contracts)
- Accessibility-focused UI controls and test coverage
- No camera capture and no extension-level age-verification gate in target architecture

## Architecture Visuals
- Runtime flow and widget state diagrams: `docs/architecture.md`
- Contract-oriented resell flow diagram: `docs/api-contracts.md`

## Technology Stack Summary
| Category | Technology |
|---|---|
| Platform | Shopify App + Theme App Extension |
| Language | JavaScript (ESM) |
| Templating | Liquid |
| UI Runtime | Vanilla DOM + Shadow DOM |
| Testing | Vitest |

## Development Overview
### Commands
- `npm test`
- `node ../node_modules/vitest/vitest.mjs run`

### Key Entry Points
- `extensions/wearon-tryon/blocks/tryon-block.liquid`
- `extensions/wearon-tryon/assets/tryon-widget.js`

## Documentation Map
- `docs/architecture.md`
- `docs/source-tree-analysis.md`
- `docs/api-contracts.md`
- `docs/component-inventory.md`
- `docs/development-guide.md`
- `docs/index.md` (master index)

## Repository Structure Summary
- Runtime storefront extension code: `extensions/wearon-tryon/`
- Automated behavior checks: `__tests__/`
- Planning/implementation context + generated docs: `docs/`

## Notes
- OAuth provisioning, webhook processing, billing, and credit ledgers are upstream platform responsibilities referenced by this extension.
