---
stepsCompleted:
  - scope-lock
  - ux-plan-v1
inputDocuments:
  - docs/SHOPIFY_PLUGIN_SPEC.md
  - docs/architecture.md
  - docs/api-contracts.md
---

# UX Design Specification wearon-shopify

**Author:** Glactic  
**Date:** 2026-02-18  
**Scope:** Storefront plugin UI only (widget + API integration). No admin, billing backend, or webhook implementation in this plan.

## 1. Product UX Goal
- Help shoppers quickly understand and try virtual fitting on PDP.
- Keep friction low: visible entry, clear upload, one primary action.
- Support both billing modes without exposing backend complexity.

## 2. UX Principles (For This Widget)
- Mobile-first interaction model, desktop-enhanced layout.
- One dominant CTA per state.
- Honest system feedback: loading, failure, and no-credit states must be explicit.
- Keep decision UI simple: result image + recommended size first.
- Never block the shopper with non-essential forms.

## 3. Primary User Flows
1. Entry and discoverability
- Widget entry is always visible on PDP.
- Intro hint can appear once per session.

2. Image upload flow
- Shopper clicks image placeholder or drags image into it.
- Validate type and show uploaded preview immediately.

3. Generate flow
- Shopper taps `Generate`.
- UI transitions: `base -> loading -> result` or `error`.
- Compare overlay appears only when result exists.

4. Resell-mode credit flow
- If balance is zero, replace action with buy-credit CTA.
- After checkout, poll balance and re-enable generation.

## 4. Information Architecture (Widget)
- Header: title + close.
- Preview Card:
- Upload target in original image area.
- Generated overlay + draggable compare handle.
- Result summary: recommended size.
- Side Panel:
- Runtime controls (prototype toggles for now).
- Primary actions (`Generate`, optional `Top Up`).

## 5. Required UI States
1. `base`
- Upload target visible.
- Size placeholder (`M` in prototype) and no extra copy noise.

2. `loading`
- Disable generate button.
- Show in-progress label.

3. `result`
- Show generated overlay.
- Enable compare drag handle.
- Show recommended size.

4. `error`
- Hide generated overlay.
- Clear compare handle.
- Show clear retry path.

5. `resell_no_credits`
- Block generation.
- Show top-up CTA as primary path.

## 6. API-to-UI Contract Mapping
- `GET /api/v1/stores/config`
  - drives billing mode, disclosure copy, and credit purchase behavior.
- `POST /api/v1/generation/create`
  - starts generation; UI enters loading.
- `GET /api/v1/generation/{id}`
  - drives status updates for queued/processing/completed/failed.
- `GET /api/v1/credits/shopper` (resell)
  - controls top-up blocking/unblocking.
- `GET /api/v1/credits/balance` (absorb, optional display)
  - optional merchant-funded balance display.

## 7. Accessibility Requirements
- Upload area keyboard operable (`Enter`/`Space`) and announced as button.
- Focus-visible ring on all actionable controls.
- Minimum 44px interactive targets.
- Status updates through `aria-live` region.
- Compare slider remains keyboard-friendly for left/right adjustments.

## 8. Content and Tone Rules
- Avoid fake-scientific messaging.
- Keep text short and action-focused.
- Avoid exposing internal billing logic terminology to shopper.
- If demo-only values are shown, mark them as prototype explicitly.

## 9. Analytics Events (UI Layer)
- `widget_opened`
- `upload_started`
- `upload_completed`
- `generate_clicked`
- `generation_result_shown`
- `generation_failed`
- `topup_clicked`
- `credit_balance_updated`

## 10. Implementation Plan (Execution Sprints)
1. Sprint A: Core shopper flow
- Entry, upload zone, generate lifecycle, result compare interaction.

2. Sprint B: Billing-mode UX
- absorb/resell branching, no-credit UX, top-up CTA behavior.

3. Sprint C: Hardening
- accessibility pass, error text polish, analytics instrumentation, visual QA.

## 11. Acceptance Criteria
1. Shopper can upload from click and drag-drop in preview area.
2. Generate action reflects loading/result/error without stale UI remnants.
3. Compare overlay appears only in result state.
4. Resell with zero credits cannot trigger generate.
5. All interactive elements are keyboard accessible.
6. Mobile viewport (320px+) remains usable without overlap or hidden CTA.

## 12. Out of Scope
- Shopify Admin Polaris pages.
- Paddle checkout internals and billing webhook logic.
- Cron, DB migrations, and worker implementation details.
