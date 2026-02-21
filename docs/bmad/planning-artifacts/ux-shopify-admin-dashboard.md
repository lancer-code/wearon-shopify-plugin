# WearOn Shopify Admin Plugin — UX/UI Specification

**Designer:** Sally (UX Designer Agent)
**Date:** 2026-02-21
**Revision:** 2 — aligned to interactive prototype (`docs/artifacts/shopify-admin-dashboard-prototype.html`)
**Design System:** Shopify Polaris
**App URL root:** `/shopify`
**Rendering context:** Shopify Admin embedded iframe

---

## 1. Design Principles

| Principle | Application |
|-----------|-------------|
| **Polaris-native** | Every component maps to a Polaris primitive — no custom CSS frameworks |
| **Single-page, tab-driven** | No sub-page routing. All content lives on `/shopify` via tabs |
| **Trust first** | Merchants see "Store connected" banner immediately after auth — reassurance before anything else |
| **Free is obvious** | Size Recommendation is clearly free, no credit card language anywhere near it |
| **Progressive disclosure** | Virtual Try-On sections (balance, mode, analytics) only appear when VTO is active |
| **Billing off-platform** | Any credit/payment CTA opens `app.wearon.ai` in `_top` — never collected inside iframe |
| **Mobile-first Polaris** | Polaris is responsive by default — follow its grid, don't fight it |

---

## 2. Information Architecture

```
/shopify/signup     <- First-time install (no WearOn account)
/shopify/login      <- Reinstall / existing account
/shopify            <- Main dashboard (post-auth)
  +-- Top Bar (store domain + log out)
  +-- Overview Board (persistent top banner)
  +-- Tabs
      +-- [Features]  <- Default active tab
      +-- [Settings]  <- Store info, API key, allowed domains
      +-- [Insights]  <- Analytics for Size Rec + VTO
```

---

## 3. Auth Pages

### 3.1 Sign Up Page (`/shopify/signup`)

**Trigger:** Shown when App Bridge session token is valid but no WearOn account is linked to this `shopifyUserId`.

**User story:** *"I just installed WearOn. I see a clean, branded page asking me to create my account. It already knows my store email — I just need to set a password and name. In 30 seconds I'm in."*

#### Layout

```
+-------------------------------------------+
|  [W] WearOn                               |
|                                            |
|  Welcome to WearOn                         |
|  Create your account to connect your store |
|                                            |
|  +------------------------------------+   |
|  | WearOn Account Name                |   |  <- TextField
|  +------------------------------------+   |
|  +------------------------------------+   |
|  | Contact Email  [pre-filled]        |   |  <- TextField (pre-filled from Shopify session)
|  |  "Pre-filled from your Shopify     |   |
|  |   account"                         |   |  <- helper text
|  +------------------------------------+   |
|  +------------------------------------+   |
|  | Password                      [eye]|   |  <- TextField type=password + show/hide toggle
|  +------------------------------------+   |
|  +------------------------------------+   |
|  | Confirm Password             [eye] |   |  <- TextField type=password + show/hide toggle
|  +------------------------------------+   |
|                                            |
|  [ ] I agree to WearOn's Terms of         |
|      Service and Privacy Policy            |  <- Checkbox
|                                            |
|  [      Create Account      ]              |  <- Button variant="primary" fullWidth
|                                            |
|  Already have an account? Log in ->        |  <- Link to /shopify/login
|                                            |
|  lock Your data is encrypted and           |
|       stored securely.                     |  <- small text, muted
+-------------------------------------------+
```

#### Polaris Component Map

| UI Element | Polaris Component | Notes |
|------------|-------------------|-------|
| Page wrapper | `Page` (no header) | Center-aligned, max-width 440px |
| Logo | `Text` + custom logo mark | WearOn branded "W" square + text |
| Card container | `Card` | Single card, no sections |
| Account name | `TextField` label="WearOn Account Name" | Required, placeholder="e.g. Sunrise Boutique" |
| Email | `TextField` label="Contact Email" type="email" | Pre-filled from Shopify session `email` claim, helper text below |
| Password | `TextField` label="Password" type="password" | Min 8 chars, with show/hide toggle button |
| Confirm password | `TextField` label="Confirm Password" type="password" | Must match password, with show/hide toggle button |
| Terms checkbox | `Checkbox` | Links to Terms of Service and Privacy Policy |
| Submit | `Button` variant="primary" fullWidth | Loading state with spinner on submit |
| Login link | `Link` | Below card |
| Security note | `Text` variant="bodySm" tone="subdued" | Below card |

#### States

| State | Behaviour |
|-------|-----------|
| **Default** | Email pre-filled, name and password fields empty, terms unchecked |
| **Loading** | Button shows spinner + "Creating account...", fields disabled |
| **Validation error** | Toast notification for: empty name, password < 8 chars, password mismatch, terms unchecked |
| **Server error** | `Banner` variant="critical" above form — "Something went wrong. Please try again or contact support." with dismiss button |
| **Success** | Redirect to `/shopify` (dashboard view) with connected banner shown |

---

### 3.2 Log In Page (`/shopify/login`)

**Trigger:** Shown when App Bridge session token is valid but the `shopifyUserId` maps to an existing WearOn account (reinstall scenario) OR when merchant navigates to login manually.

**User story:** *"I reinstalled WearOn. I recognise the login screen — same email/password I set up before. Two fields, one button. I'm back in 10 seconds."*

#### Layout

```
+-------------------------------------------+
|  [W] WearOn                               |
|                                            |
|  Welcome back                              |
|  Log in to your WearOn account.            |
|                                            |
|  +------------------------------------+   |
|  | Email                              |   |  <- TextField
|  +------------------------------------+   |
|  +------------------------------------+   |
|  | Password                      [eye]|   |  <- TextField type=password + show/hide toggle
|  +------------------------------------+   |
|                                            |
|  [         Log In           ]              |  <- Button variant="primary" fullWidth
|                                            |
|  Forgot password? Reset on WearOn ->       |  <- Link opens app.wearon.ai/forgot-password _top
|  Don't have an account? Sign up ->         |  <- Link to /shopify/signup
+-------------------------------------------+
```

#### Polaris Component Map

| UI Element | Polaris Component | Notes |
|------------|-------------------|-------|
| Page wrapper | `Page` (no header) | Center-aligned, max-width 440px |
| Logo | `Text` + custom logo mark | Same branding as signup |
| Card container | `Card` | |
| Email | `TextField` label="Email" type="email" | |
| Password | `TextField` label="Password" type="password" | With show/hide toggle button |
| Submit | `Button` variant="primary" fullWidth | Loading with spinner + "Logging in..." |
| Forgot password | `Link` | Opens `_top` -> `app.wearon.ai/forgot-password` |
| Sign up link | `Link` | To `/shopify/signup` |

#### States

| State | Behaviour |
|-------|-----------|
| **Default** | Both fields empty |
| **Loading** | Button shows spinner + "Logging in...", fields disabled |
| **Invalid credentials** | `Banner` variant="critical" — "Incorrect email or password. Please try again." with dismiss button |
| **Empty fields** | Toast notification — "Please enter your email and password" |
| **Success** | Redirect to `/shopify` (dashboard view) with connected banner shown |

---

## 4. Main Dashboard (`/shopify`)

### 4.1 High-Level Layout

```
+------------------------------------------------------+
|  TOP BAR                                              |
|  WearOn          example-store.myshopify.com [Log out]|
+------------------------------------------------------+
|                                                       |
|  CONNECTED BANNER (conditional)                       |
|  "Store connected successfully! WearOn is ready."     |
|                                                       |
|  OVERVIEW BOARD                                       |
|  [W] example-store.myshopify.com  [Active badge]     |
|  owner@example-store.com                              |
|  [Size Rec: Active]  [Virtual Try-On: Active/Soon]   |
|                                                       |
|  [Features]  [Settings]  [Insights]    <- Tabs       |
|  --------------------------------------------------- |
|                                                       |
|  TAB CONTENT PANEL                                    |
|  (changes based on active tab)                        |
|                                                       |
+------------------------------------------------------+
```

---

### 4.2 Top Bar

| UI Element | Polaris Component | Notes |
|------------|-------------------|-------|
| App title | `Text` variant="headingSm" | "WearOn" |
| Store domain | `Text` variant="bodySm" | Right-aligned |
| Log out | `Button` variant="secondary" size="slim" | Triggers confirm dialog, then returns to login view |

---

### 4.3 Overview Board (Persistent — always visible)

**User story:** *"The moment I land on the dashboard, I instantly know my store is connected, what's live, and what's coming. No ambiguity — just confidence."*

#### Layout

```
+--------------------------------------------------------------+
|  [W]  example-store.myshopify.com       [Active badge]       |
|       owner@example-store.com                                 |
|                                                               |
|  +------------------------+  +-----------------------------+ |
|  | checkmark Size Rec     |  | circle Virtual Try-On       | |
|  | FREE - No usage req.   |  | AI-powered outfit preview   | |
|  |            [Active]    |  |           [Active/Coming Soon]| |
|  +------------------------+  +-----------------------------+ |
+--------------------------------------------------------------+
```

#### Polaris Component Map

| UI Element | Polaris Component | Notes |
|------------|-------------------|-------|
| Outer wrapper | `Card` with gradient background | `linear-gradient(135deg, #fff 60%, #f0faf6 100%)` |
| WearOn logo mark | Custom `Box` | 28x28 green square with white "W", `border-radius: 6px` |
| Store domain | `Text` variant="headingMd" | Inline with logo mark |
| Owner email | `Text` variant="bodySm" tone="subdued" | |
| Status badge | `Badge` tone="success" | "Active" or `tone="critical"` if inactive |
| Feature pills | `InlineGrid columns={2}` | Each pill is bordered `Box` with label + sublabel + badge |
| Size Rec pill | `Box` | Always shows `Badge tone="success"` "Active" |
| VTO pill | `Box` | Dynamic: `Badge tone="info"` "Coming Soon" OR `Badge tone="success"` "Active" |

#### "Store Connected" Banner

Shown **only** on first load after signup/login. Dismissed on close.

```
+--------------------------------------------------------------+
|  checkmark  Store connected successfully! WearOn is ready    |
|             on your storefront.                          [x] |
+--------------------------------------------------------------+
```

| UI Element | Polaris Component |
|------------|-------------------|
| Success banner | `Banner` variant="success" onDismiss |

---

### 4.4 Tab: Features (default active)

**User story:** *"I open the app. I see my features at a glance — one is live, one is coming. When VTO is active, I can manage my balance and choose my billing mode."*

#### Layout — VTO Inactive (Coming Soon)

```
+------------------------------------------------------+
|  Features                                             |
|                                                       |
|  +--------------------------------------------------+|
|  | checkmark  Size Recommendation    [Active] [FREE]||
|  | Free AI-powered clothing size prediction for     ||
|  | your shoppers. No usage required -- available     ||
|  | to all shoppers immediately.                     ||
|  +--------------------------------------------------+|
|                                                       |
|  +--------------------------------------------------+|
|  | circle  Virtual Try-On          [Coming Soon]    ||
|  | Let shoppers see themselves wearing your          ||
|  | products with AI generation. Activate on the     ||
|  | WearOn platform to enable for your store.        ||
|  |                                                  ||
|  | [Enable Virtual Try-On (Demo)]                   ||
|  | [Join the Waitlist on WearOn ext]                 ||
|  +--------------------------------------------------+|
+------------------------------------------------------+
```

#### Layout — VTO Active (additional sections appear)

When VTO is enabled, three additional sections appear below the feature cards:

**Section 1: Virtual Try-On Balance**
```
+------------------------------------------------------+
|  Virtual Try-On                                       |
|                                                       |
|  +--------------------------------------------------+|
|  | Available Balance                                ||
|  |                                                  ||
|  |  120 units                                       ||
|  |                                                  ||
|  |  Each virtual try-on uses 1 unit. Balance        ||
|  |  syncs automatically from the WearOn platform.   ||
|  |                              [Manage on WearOn]  ||
|  +--------------------------------------------------+|
+------------------------------------------------------+
```

**Section 2: Try-On Mode Switch**
```
+------------------------------------------------------+
|  Try-On Mode                                          |
|  Choose how try-on sessions are funded for shoppers.  |
|                                                       |
|  +--------------------------------------------------+|
|  | +---------------------+ +---------------------+  ||
|  | | store  Absorb       | | card  Resell        |  ||
|  | | You cover the cost. | | Charge shoppers per |  ||
|  | | Shoppers try on for | | try-on. Set your    |  ||
|  | | free -- no friction | | own price and keep  |  ||
|  | | at checkout. [SEL]  | | the margin.         |  ||
|  | +---------------------+ +---------------------+  ||
|  |                                                   ||
|  | [Mode info box -- context for active mode]        ||
|  +--------------------------------------------------+|
+------------------------------------------------------+
```

#### Polaris Component Map

| UI Element | Polaris Component | Notes |
|------------|-------------------|-------|
| Section title | `Text` variant="headingMd" | "Features" |
| Size Rec card | `Card` | Green left border (3px), `Badge tone="success"` "Active" + "FREE" badge |
| VTO card (inactive) | `Card` | Blue left border (3px), `Badge tone="info"` "Coming Soon" |
| VTO card (active) | `Card` | Green left border (3px), `Badge tone="success"` "Active" |
| Enable VTO CTA | `Button` variant="plain" size="slim" | Demo toggle |
| Waitlist CTA | `Button` variant="secondary" size="slim" | Opens `app.wearon.ai/waitlist` in `_top` |
| Balance section | `Card` | Only visible when VTO active |
| Balance value | `Text` variant="headingXl" (2.5rem, weight 800) | e.g. "120" |
| Balance unit | `Text` variant="headingMd" tone="subdued" | "units" |
| Balance description | `Text` variant="bodySm" tone="subdued" | |
| Manage CTA | `Button` variant="primary" | Opens `app.wearon.ai/dashboard` in `_top` |
| Mode section title | `Text` variant="headingMd" | "Try-On Mode" |
| Mode description | `Text` variant="bodySm" tone="subdued" | |
| Mode switch | Two custom `Button` cards in `InlineGrid columns={2}` | Selected state: green border + green background tint |
| Mode info box | Colored `Box` | Green background for absorb, blue background for resell |
| Resell pricing CTA | `Button` variant="secondary" size="slim" | Only in resell info box, opens `app.wearon.ai/resell-settings` in `_top` |

#### Mode Switch — Confirmation Modal

Triggered when switching between Absorb and Resell. Clicking the already-active mode is a no-op.

```
+----------------------------------------------+
|  Switch Try-On Mode?                     [x] |
|                                              |
|  Switching to [Mode] mode means...           |
|  [context-appropriate description]           |
|                                              |
|  [Keep Current]          [Switch Mode]       |
+----------------------------------------------+
```

| Element | Polaris Component |
|---------|-------------------|
| Modal | `Modal` |
| Description | `Text` with HTML content | Absorb: "you cover the cost..." / Resell: "shoppers are charged..." |
| Keep Current | `Button` variant="secondary" | Auto-focused on open |
| Switch Mode | `Button` variant="primary" |

#### VTO State Transitions

| Event | VTO Pill badge | Feature card | Balance section | Mode section | Analytics |
|-------|---------------|--------------|-----------------|--------------|-----------|
| VTO disabled | `tone="info"` "Coming Soon" | Blue border, "Coming Soon" badge | Hidden | Hidden | Empty state |
| VTO enabled | `tone="success"` "Active" | Green border, "Active" badge | Visible | Visible | Data visible |

---

### 4.5 Tab: Settings

**User story:** *"I need to check my store details, manage my API key, and configure my allowed domains. Everything is on one page — no hunting."*

This tab merges store info, API key management, and allowed domains into a single scrollable view.

#### Layout

```
+------------------------------------------------------+
|  Store Information                                    |
|                                                       |
|  +--------------------------------------------------+|
|  | SHOP DOMAIN                                      ||
|  | example-store.myshopify.com                      ||
|  |                                                  ||
|  | STATUS                                           ||
|  | [Active badge]                                   ||
|  |                                                  ||
|  | OWNER EMAIL                                      ||
|  | owner@example-store.com                          ||
|  |                                                  ||
|  | WEARON ACCOUNT                                   ||
|  | Sunrise Boutique - owner@example-store.com       ||
|  +--------------------------------------------------+|
|                                                       |
|  --------------------------------------------------- |
|                                                       |
|  API Key                                              |
|                                                       |
|  +--------------------------------------------------+|
|  | [New Key Banner -- shown after regen only]       ||
|  |                                                  ||
|  | Your API Key                                     ||
|  | wk_a1b2c3d4e5f6g7h8...****   (monospace)        ||
|  | Created: Jan 15, 2026                            ||
|  |                                                  ||
|  | [Regenerate API Key]  (critical button)          ||
|  | Regenerating creates a new key and immediately   ||
|  | deactivates the current one. Update any theme    ||
|  | integrations before regenerating.                ||
|  +--------------------------------------------------+|
|                                                       |
|  --------------------------------------------------- |
|                                                       |
|  WearOn Platform                                      |
|                                                       |
|  +--------------------------------------------------+|
|  | Manage your full account, balance, and advanced  ||
|  | settings on the WearOn platform.                 ||
|  |                                                  ||
|  | [Open WearOn Dashboard ext]                      ||
|  +--------------------------------------------------+|
+------------------------------------------------------+
```

#### Polaris Component Map

| UI Element | Polaris Component | Notes |
|------------|-------------------|-------|
| Store info title | `Text` variant="headingMd" | "Store Information" |
| Info card | `Card` | |
| Info rows | Custom `BlockStack` | Label (uppercase, subdued, small) + value (normal) pattern |
| Shop domain | `Text` | Read-only |
| Status | `Badge` tone="success" or "critical" | "Active" / "Inactive" |
| Owner email | `Text` | Read-only |
| WearOn account | `Text` | Account name + email |
| API Key title | `Text` variant="headingMd" | |
| Key card | `Card` | |
| Masked key | `Text` monospace | `wk_a1b2c3d4e5f6g7h8...****` |
| Created date | `Text` variant="bodySm" tone="subdued" | |
| Regenerate button | `Button` tone="critical" | Triggers confirmation modal |
| Regen warning text | `Text` variant="bodySm" tone="subdued" | Below button, explains consequences |
| Platform card | `Card` | |
| Open dashboard CTA | `Button` variant="secondary" | Opens `app.wearon.ai/dashboard` in `_top` |

#### Regenerate Key — Confirmation Modal

```
+----------------------------------------------+
|  Regenerate API Key                      [x] |
|                                              |
|  [critical banner]                           |
|  Your current API key will be immediately    |
|  deactivated. Any theme integrations using   |
|  the old key will stop working until updated |
|  with the new key.                           |
|                                              |
|  [Cancel]          [Regenerate Key]          |
+----------------------------------------------+
```

| Element | Polaris Component |
|---------|-------------------|
| Modal | `Modal` with focus trap + Escape to close |
| Warning content | `Banner` variant="critical" | Inside modal body |
| Cancel | `Button` variant="secondary" | Auto-focused on open |
| Confirm | `Button` tone="critical" |

#### New Key — One-Time Display Banner

Shown **immediately after regeneration**, dismissed manually. Full key displayed once only.

```
+--------------------------------------------------------------+
|  warning  New API Key -- Copy it now. It won't be shown  [x] |
|           again.                                              |
|           wk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6  (monospace)  |
|           [clipboard Copy to Clipboard]                       |
+--------------------------------------------------------------+
```

| Element | Polaris Component |
|---------|-------------------|
| Warning banner | `Banner` variant="warning" with dismiss |
| Key text | `Text` monospace | Full key shown once |
| Copy button | `Button` variant="secondary" size="slim" | Uses `navigator.clipboard.writeText()` |

---

### 4.6 Tab: Insights

**User story:** *"I want to know how my WearOn features are performing — how many size recommendations were given, what sizes are most common, and once VTO is live, how shoppers are using it."*

This tab is split into two sections: Size Recommendation (always visible) and Virtual Try-On (gated behind VTO activation).

#### Size Recommendation Analytics (always visible)

**Header row:** Title "Size Recommendation" + sublabel "Always active - Free" + date range selector + Active badge + Export button

**Primary stat cards** (4-column grid):

| Card | Value | Sublabel | Delta |
|------|-------|----------|-------|
| Recommendations | 284 | "given this month" | "+67 vs last month" (up) |
| Accuracy Rate | 91% | "shopper-confirmed fit" | "+3% vs last month" (up) |
| Unique Shoppers | 247 | "used size rec" | "+31 new shoppers" (up) |
| Add-to-Cart Rate | 73% | "after recommendation" | "+8% vs last month" (up) |

**Secondary stat cards** (3-column grid):

| Card | Value | Sublabel | Delta |
|------|-------|----------|-------|
| Avg Response Time | 0.3s | "per recommendation" | — |
| Return Rate Impact | -22% | "fewer size returns" | "saving ~$340/mo" (up) |
| Avg per Day | 9.5 | "recommendations / day" | "peak on weekends" (up) |

Note: "Return Rate Impact" has a tooltip button (?) explaining the calculation methodology.

**Daily Recommendations chart:** 14-day bar chart in `Card`. Shows peak day label in header.

**Two-column detail cards:**

| Left: Top Products by Recs | Right: Size Distribution Recommended |
|---|---|
| Ranked list (1-5) with product name, rec count, category, percentage badge | Horizontal progress bars for XS, S, M, L, XL, XXL with counts |

#### Virtual Try-On Analytics (gated)

**Header row:** Title "Virtual Try-On" + sublabel "Last 30 days" + Mode badge (shows current mode) + Export button

**Empty state** (when VTO is inactive):
```
+------------------------------------------------------+
|                    chart icon                         |
|              No analytics yet                         |
|  Virtual Try-On insights will appear here once the    |
|  feature is active on your store. Enable Virtual      |
|  Try-On on the Features tab to get started.           |
+------------------------------------------------------+
```

**Active state** (when VTO is enabled):

**Primary stat cards** (4-column grid):

| Card | Value | Sublabel | Delta |
|------|-------|----------|-------|
| Balance | 120 units | "remaining" | "38 used this month" (down) |
| Used | 38 | "this month" | "+46% vs last month" (up) |
| Unique Shoppers | 31 | "tried on this month" | "+8 new shoppers" (up) |
| Success Rate | 94% | "completed without error" | "-2% vs last month" (down) |

**Secondary stat cards** (3-column grid):

| Card | Value | Sublabel | Notes |
|------|-------|----------|-------|
| Conversion Lift | +18% | "add-to-cart after try-on" | Green left border |
| Avg. per Day | 1.3 | "try-ons / day" | Blue left border, delta "peak on Fri-Sat" |
| Cost (Absorb) | 38 units | "absorbed this month" | Orange left border, shown in absorb mode |
| Revenue (Resell) | $47.80 | "earned from shopper try-ons" | Orange left border, shown in resell mode, replaces Cost card |

**Daily Usage chart:** 14-day bar chart in `Card`. Same format as Size Rec chart.

**Two-column detail cards:**

| Left: Top Products | Right: Category Breakdown + Mode Split |
|---|---|
| Ranked list (1-5) with product name, session count, category, percentage badge | Category bars (Women's, Men's, Unisex) + Divider + Mode Split bars (Absorb/Resell) with session counts |

Mode Split note: When resell is inactive, shows italic subdued text "Resell mode not yet active" below the resell bar.

**Recent Sessions list** (full-width `Card`):

Shows last 8 events with:
- Status icon: green circle with checkmark (success) or red circle with X (failed)
- Product name
- Time ago + shopper ID + mode + failure reason if applicable
- Status badge: `Badge tone="success"` "Done" or `Badge tone="critical"` "Failed"

#### Polaris Component Map (Insights tab)

| UI Element | Polaris Component | Notes |
|------------|-------------------|-------|
| Date range selector | `Select` | Options: Last 30 days, Last 14 days, Last 7 days, This month |
| Export button | `Button` variant="secondary" size="slim" | "Export" — triggers CSV download, shows toast |
| Mode badge | Custom `Badge` | Absorb: blue bg/text, Resell: orange bg/text |
| Stat cards | Custom `Card` variant | Label (uppercase, small, subdued) + value (1.8rem, weight 800) + sublabel + delta |
| Delta indicator | `Text` colored | Green for up, red for down |
| Bar chart | Custom `Box` layout | Flex column bars, bottom labels, "today" bar highlighted |
| Ranked list | Custom `ResourceList` variant | Numbered circles (green for top 2, grey for rest) + product info + percentage badge |
| Progress bars | Custom `Box` | 8px height, border-radius, colored fill on grey background |
| Session list | Custom list in `Card` | Icon + meta + badge per row, bottom-bordered |
| Empty state | Centered `Box` | Large icon + heading + body text |
| Tooltip button | Custom `Button` | 15px circle with "?" — shows explanation on click |

#### Responsive Behaviour (Insights)

| Grid | Desktop | Tablet (<720px) | Mobile (<600px) |
|------|---------|-----------------|-----------------|
| 4-column stat grid | 4 columns | 2 columns | 2 columns |
| 3-column stat grid | 3 columns | 2 columns | 2 columns |
| 2-column detail cards | 2 columns side-by-side | 2 columns | 1 column stacked |

---

## 5. Navigation & Routing

| Route | Component loaded | Condition |
|-------|-----------------|-----------|
| `/shopify/signup` | `<SignupPage>` | No WearOn account linked to Shopify session |
| `/shopify/login` | `<LoginPage>` | WearOn account exists, not authenticated |
| `/shopify` | `<Dashboard>` | Authenticated WearOn session |
| `/shopify?connected=true` | `<Dashboard>` + success Banner | Immediately after signup/login |

**Auth guard logic (client-side in `polaris-provider.tsx`):**
```
1. App Bridge session token obtained
2. Call GET /api/shopify/store (with session token)
3. If 401 / no owner_user_id -> redirect to /shopify/signup or /shopify/login
4. If 200 -> render Dashboard
```

---

## 6. Global States & Error Handling

### Loading State (page-level)

While auth check and initial data load:

```
+------------------------------------------------------+
|                                                       |
|              [Polaris Spinner]                        |
|         Loading your WearOn dashboard...              |
|                                                       |
+------------------------------------------------------+
```

| Element | Polaris Component |
|---------|-------------------|
| Spinner | `Spinner` size="large" |
| Text | `Text` variant="bodySm" tone="subdued" |
| Wrapper | `Frame` -> `Loading` or centered `Box` |

### Store Inactive State

If `stores.status === 'inactive'`:

```
+------------------------------------------------------+
|  warning Your store connection is inactive.           |
|  This may happen after reinstallation.                |
|  [Reconnect Store]                                    |
+------------------------------------------------------+
```

| Element | Polaris Component |
|---------|-------------------|
| Banner | `Banner` variant="warning" |
| CTA | `Button` — triggers session token exchange re-run |

### Network / API Error

```
+------------------------------------------------------+
|  x Unable to load dashboard. Check your connection.   |
|  [Try Again]                                          |
+------------------------------------------------------+
```

| Element | Polaris Component |
|---------|-------------------|
| Banner | `Banner` variant="critical" |
| Retry | `Button` variant="secondary" |

### Toast Notifications

Used throughout for transient feedback. Auto-dismiss after ~3 seconds.

| Trigger | Toast message |
|---------|---------------|
| API key regenerated | "API key regenerated -- copy it now!" |
| API key copied | "API key copied!" |
| Mode switched | "Mode set to Absorb" / "Mode set to Resell" |
| VTO toggled | "Virtual Try-On enabled" / "Virtual Try-On disabled" |
| Date range changed | "Date range updated" |
| Export triggered | "Report exported as CSV" |

| Element | Polaris Component |
|---------|-------------------|
| Toast | `Toast` | Fixed bottom-center, dark background, white text |

---

## 7. Responsive Behaviour

Polaris handles most responsiveness natively. Key breakpoints:

| Layout element | Desktop (>720px) | Mobile (<=720px) |
|----------------|---------|--------|
| Left nav (Shopify shell) | Visible | Hidden |
| Top bar padding | 20px | 12px |
| App frame padding | 20px | 12px |
| Overview Board feature pills | `InlineGrid columns={2}` | Stacks to single column |
| Mode switch buttons | 2 columns | 1 column (<=520px) |
| Tab labels | "Features", "Settings", "Insights" | Same (Polaris Tabs are responsive) |
| Stat card grids | 3-4 columns | 2 columns, 1 column on very small |
| Detail card grids | 2 columns side-by-side | 1 column stacked |
| Auth pages | Max-width 440px centered | Full width with padding |

---

## 8. Modals Summary

| Modal | Trigger | Primary action | Secondary action |
|-------|---------|---------------|------------------|
| Regenerate API Key | Click "Regenerate API Key" on Settings tab | `Button` tone="critical" "Regenerate Key" | `Button` "Cancel" (auto-focused) |
| Switch Try-On Mode | Click non-active mode button on Features tab | `Button` variant="primary" "Switch Mode" | `Button` "Keep Current" (auto-focused) |
| Log Out | Click "Log out" on top bar | Browser `confirm()` dialog | Cancel |

All modals implement:
- Focus trap (Tab cycling within modal)
- Escape key to close
- Cancel/secondary button auto-focused on open (safety default)

---

## 9. Polaris Component Inventory Summary

| Component | Used in |
|-----------|---------|
| `Page` | Auth pages wrapper |
| `Card` | All content cards, stat cards, detail cards |
| `Tabs` | Dashboard navigation (Features, Settings, Insights) |
| `Badge` | Status indicators, feature states, percentage labels |
| `Banner` | Success/error/warning messages, new key display, regen modal content |
| `Button` | All CTAs, mode switch cards, toggle buttons |
| `TextField` | Auth forms, domain input |
| `Text` | All typography |
| `BlockStack` | Vertical stacking layout |
| `InlineStack` | Horizontal alignment with gap |
| `InlineGrid` | Feature pills, stat grids, detail card pairs |
| `Modal` | API key regeneration, mode switch confirmation |
| `Spinner` | Loading state, button loading |
| `Divider` | Section separators |
| `Link` | Auth page navigation, Terms of Service |
| `Box` | Layout primitives, info boxes |
| `Frame` + `Loading` | Page-level loading indicator |
| `Select` | Date range selector in Insights |
| `Checkbox` | Terms acceptance on signup |
| `Toast` | Transient feedback notifications |
| Custom: Logo mark | 28x28 branded square |
| Custom: Stat card | Analytics metric display |
| Custom: Bar chart | 14-day trend visualization |
| Custom: Progress bar | Size distribution, category breakdown |

---

## 10. Copy & Tone Guide

| Context | Tone | Example |
|---------|------|---------|
| Feature status | Confident, positive | "Free AI-powered clothing size prediction for your shoppers." |
| VTO inactive | Exciting, not apologetic | "Let shoppers see themselves wearing your products with AI generation." |
| VTO active | Clear, operational | "Shoppers can now generate AI try-on images directly on your product pages." |
| Balance info | Informative, low pressure | "Each virtual try-on uses 1 unit. Balance syncs automatically from the WearOn platform." |
| Mode switch | Neutral, descriptive | "Choose how try-on sessions are funded for your shoppers." |
| Absorb mode | Benefit-focused | "Shoppers see no paywall -- great for conversion. Best when you want zero shopper friction." |
| Resell mode | Revenue-focused | "You still consume 1 unit per session but earn revenue that offsets the cost." |
| API key warning | Direct, not scary | "Regenerating creates a new key and immediately deactivates the current one." |
| Error messages | Clear, actionable | "Incorrect email or password. Please try again." |
| Empty analytics | Encouraging, directional | "Virtual Try-On insights will appear here once the feature is active on your store." |

---

## 11. Decisions Resolved (from Prototype)

| # | Question | Decision |
|---|----------|----------|
| 1 | Overview Board branding | WearOn logo mark (green 28x28 square with white "W") in overview board |
| 2 | Allowed domains needed? | No — removed. API key auth is sufficient for B2B/external API use. CORS restrictions would break headless/server consumers. |
| 3 | Credits balance polling | On page load only (manual refresh by navigating away and back) |
| 4 | "Get Early Access" CTA behaviour | Links to WearOn platform only, no email capture |
| 5 | Password reset | Handled entirely on WearOn platform — link to `app.wearon.ai/forgot-password` |
| 6 | Tab names | Changed from Main/Manage/Setting to Features/Settings/Insights |
| 7 | Settings tab consolidation | Store Info + API Key + WearOn Platform merged into single Settings tab |
| 8 | Signup additional fields | Confirm Password + Terms of Service checkbox added |
| 9 | Password visibility | Show/hide toggle on all password fields |
| 10 | Mode switch | Absorb/Resell toggle with confirmation modal before switching |

---

*Document produced by Sally — WearOn UX Designer Agent*
*Prototype reference: `docs/artifacts/shopify-admin-dashboard-prototype.html`*
*Output path: `docs/bmad/planning-artifacts/ux-shopify-admin-dashboard.md`*
