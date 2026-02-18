# WearOn Shopify Extension - UI Component Inventory (Main)

## Scope
Inventory of storefront UI elements implemented by the theme app extension widget.

## Host + Bootstrapping
- `data-wearon-tryon` host container injected by `blocks/tryon-block.liquid`
- Module script loader: `tryon-widget.js`

## Core Widget Components

### Container
- `section.wearon-widget`
- Role/aria: region with `aria-label="WearOn shopper widget"`
- Mobile-first: visible by default on page load

### Shopper Context + Status
- Product-fit/size context copy (short, readable, first viewport)
- Shopper status text for absorb/resell availability
- Live status region: `div[role=status][aria-live=polite]`

### Shopper Action Controls
- Primary action button: `button.wearon-widget__button` (single-thumb reachable on mobile)
- Credit purchase CTA: `button.wearon-widget__purchase`
- Optional secondary controls (for result reset / retry where relevant)

### Result Presentation
- Result container for generated output and recommendations
- Size recommendation text block
- Error/retry state block

### Credit + Branding Elements
- Shopper credit status text: `p.wearon-widget__credit-balance`
- Branding badge: `footer.wearon-widget__badge` (“Powered by WearOn”)

## Accessibility/UX Design System Signals
- Focus-visible styles on all widget buttons
- Minimum touch targets (`44x44`)
- Forced-colors media support
- Aria labeling on controls and live region support
- Mobile-first spacing and typography hierarchy for small screens

## Reusability Classification
- Reusable primitives: button patterns, live status region, result/retry sections
- Feature-specific flows: absorb/resell gating, credit purchase/polling states

## Source References
- `extensions/wearon-tryon/assets/tryon-widget.js`
- `extensions/wearon-tryon/blocks/tryon-block.liquid`
- `__tests__/tryon-widget.test.js`
- `__tests__/tryon-accessibility.test.js`
