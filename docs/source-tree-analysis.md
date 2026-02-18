# wearon-shopify - Source Tree Analysis

**Date:** 2026-02-18

## Overview
This repository is documented as a single-part codebase focused on a Shopify theme app extension for WearOn try-on flows, with generated documentation under `docs/`.

## Complete Directory Structure (Focused)

```text
wearon-shopify/
├── extensions/
│   └── wearon-tryon/
│       ├── blocks/
│       │   └── tryon-block.liquid
│       └── assets/
│           ├── tryon-widget.js
│           ├── tryon-privacy-flow.js
│           └── size-rec-display.js
├── __tests__/
│   ├── tryon-widget.test.js
│   ├── tryon-privacy-flow.test.js
│   ├── tryon-accessibility.test.js
│   └── size-rec-display.test.js
├── docs/
│   ├── api-contracts.md
│   ├── architecture.md
│   ├── component-inventory.md
│   ├── development-guide.md
│   ├── index.md
│   ├── project-overview.md
│   ├── source-tree-analysis.md
│   └── project-scan-report.json
├── shopify.app.toml
├── package.json
└── _bmad/
```

## Critical Directories

### `extensions/wearon-tryon/`
Purpose: Storefront extension runtime delivered into Shopify themes.
Contains: Liquid block loader + widget JavaScript modules.
Entry points:
- `extensions/wearon-tryon/blocks/tryon-block.liquid`
- `extensions/wearon-tryon/assets/tryon-widget.js`

### `__tests__/`
Purpose: Behavioral/spec regression coverage for widget, privacy flow, accessibility, and size recommendation display.
Contains: Vitest test suites for storefront extension modules.

### `docs/`
Purpose: Generated architecture and engineering documentation outputs.
Contains: index, overview, architecture, source-tree, component, development, and API contract docs.

### `_bmad/`
Purpose: Workflow/task engine and method assets used for structured planning/documentation workflows.
Contains: workflow definitions, task runners, agent configs.

## Entry Points
- Runtime storefront bootstrapping: `extensions/wearon-tryon/blocks/tryon-block.liquid`
- Runtime widget module: `extensions/wearon-tryon/assets/tryon-widget.js`
- Local test command entry: `package.json` script `test`
- Shopify app configuration: `shopify.app.toml`

## File Organization Patterns
- Storefront runtime code is isolated in `extensions/wearon-tryon/assets/`.
- Theme-injection concerns are isolated in `extensions/wearon-tryon/blocks/`.
- Tests mirror major runtime modules under `__tests__/`.
- Generated project documentation is maintained under `docs/`.

## Configuration Files
- `shopify.app.toml`: Shopify app identity, scopes, webhooks version, auth redirect, install mode.
- `package.json`: ESM module mode and Vitest execution script.

## Notes for Development
- The extension has a small runtime surface (Liquid + vanilla JS modules), while business workflows (OAuth, webhooks, credit accounting) remain upstream platform responsibilities referenced by API contracts.
