# wearon-shopify - Development Guide

## Prerequisites
- Node.js available in local environment
- Workspace dependencies installed so shared `node_modules` is available
- Shopify app config available in `shopify.app.toml`

## Setup
1. Open repository root.
2. Ensure dependencies are installed at expected workspace location.
3. Confirm extension files exist under `extensions/wearon-tryon/`.

## Local Validation Commands
- `npm test`
- `node ../node_modules/vitest/vitest.mjs run`

## Development Workflow
1. Implement or update extension logic in `extensions/wearon-tryon/assets/`.
2. Keep theme block contract stable in `extensions/wearon-tryon/blocks/tryon-block.liquid`.
3. Update/add tests in `__tests__/`.
4. Re-run test suite and verify no regressions.

## Runtime Contracts to Preserve
- `GET /api/store-config`
- `GET /api/shopper-credits/balance`
- Shopify cart-link checkout flow: `https://{shop_domain}/cart/{variant_id}:{quantity}`

## Diagram References
- Runtime and widget state diagrams: `docs/architecture.md`
- Resell contract interaction diagram: `docs/api-contracts.md`

## Quality Guardrails
- Keep Shadow DOM isolation behavior intact.
- Keep widget visible and usable on first render, mobile-first.
- Preserve no-camera/no-age-gate runtime behavior in storefront extension layer.
- Preserve accessibility behaviors (aria labels, focus, touch target, live region).
- Maintain absorb/resell mode logic consistency.

## Deployment Context
This repo does not include direct CI/CD manifests. Storefront extension assets are deployed through Shopify app extension workflows; backend lifecycle is handled in upstream platform repos.
