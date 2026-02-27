# QA Test Matrix

| Area | Scenario | Expected |
|---|---|---|
| Access config | Config endpoint unavailable | Fail closed (login required / blocked state) |
| Access config | `absorb_mode` | Try-on enabled (post privacy/age gates) |
| Access config | `resell_mode` + zero credits | Add credits CTA shown, try-on blocked |
| Credits payload | v1 keys (`total_added`, `total_used`) | Parsed correctly |
| Credits payload | legacy keys (`total_purchased`, `total_spent`) | Parsed correctly |
| Privacy gate | Not acknowledged | Camera action blocked |
| Age gate | Under 13 | Feature blocked |
| Age gate | Verified + fresh timestamp | Access allowed |
| Age gate | Expired/tampered timestamp | Verification invalidated |
| UX copy | User-facing labels | No “buy/purchase” wording |
| A11y | Keyboard/focus/aria-live | Usable and announced |
| Theme integration | Non-product page | Widget not injected |
