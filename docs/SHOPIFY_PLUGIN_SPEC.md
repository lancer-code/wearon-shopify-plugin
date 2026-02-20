# WearOn Shopify Plugin — Functional Specification

## 1. Overview

WearOn is a Shopify embedded app that provides AI-powered fit and size intelligence for e-commerce stores. Merchants install the app from the Shopify App Store, create a WearOn account, and embed a storefront widget that gives shoppers accurate clothing size recommendations.

**Currently available:** AI-powered size recommendation — shoppers upload a photo and get personalized size and body measurement estimates instantly.

**Coming Soon:** Virtual try-on — shoppers will see themselves wearing products via AI image generation.

**Core value:** Shoppers find the right size with confidence → fewer returns, higher conversion rates for merchants.

---

## 2. Installation & Authentication Flow

### 2.1 Managed Installation with WearOn Account Creation

WearOn uses Shopify's **managed installation** model combined with an explicit WearOn account creation step. There is no traditional OAuth callback URL. Instead:

1. Merchant clicks "Install" from Shopify App Store.
2. Shopify loads the embedded app iframe at `/shopify` with an App Bridge session token.
3. The frontend reads the session token and extracts `shopDomain` and `shopifyUserId` from the JWT claims.
4. **No existing WearOn account?** → The merchant is shown a **Sign Up page** (inside the Shopify iframe):
   - Fields: business/store name, contact email (pre-filled from Shopify merchant data where available), password.
   - On submit: creates a Supabase user account, then runs the session token exchange to auto-provision the store and link it to the new user.
   - After account creation → redirect to the dashboard with a **"Store connected ✓"** confirmation banner.
5. **Existing WearOn account / reinstall?** → The merchant is shown a **Log In page** (inside the Shopify iframe):
   - On login: session token exchange runs in the background and re-links the store to the existing account.
   - Redirect to dashboard with **"Store reconnected ✓"** banner.
6. Store provisioning (triggered after successful auth):
   - Exchanges the App Bridge session token for an **offline access token** via Shopify's `tokenExchange` API.
   - Encrypts the access token (AES) and stores it in `stores.access_token_encrypted`.
   - Upserts a `stores` row with `status: 'active'`, `billing_mode: 'absorb_mode'`, `owner_user_id` set to the authenticated WearOn user.
   - Creates a `store_api_keys` row with a hashed API key (`wk_<hex>`). If re-installing, existing keys are re-activated.
   - A `store_credits` row with balance=0 is auto-created via DB trigger.

### 2.2 Session Token Verification

Every request from the Shopify Admin UI is authenticated via:
- **JWT verification** — HMAC-SHA256 signature checked against `SHOPIFY_CLIENT_SECRET`.
- **Audience check** — `aud` claim must match `NEXT_PUBLIC_SHOPIFY_CLIENT_ID`.
- **Expiry/nbf check** — Standard JWT time validation.
- **Issuer check** — Must match `{dest}/admin` pattern.
- **Shop domain extraction** — Parsed from the `dest` claim URL.

The `withShopifySession(handler)` middleware wraps all Shopify Admin API routes and returns a `ShopifySessionContext` containing `storeId`, `shopDomain`, and `shopifyUserId`.

### 2.3 App Uninstall Handling

When a merchant uninstalls the app, Shopify sends an `app/uninstalled` webhook:
- HMAC-verified against `SHOPIFY_CLIENT_SECRET`.
- Triggers `cleanupStore()` which:
  1. Marks the store as `inactive`.
  2. Deletes all `store_api_keys`.
  3. Cancels any `queued` generation sessions (marks as `failed`).
  4. Deletes all files in `stores/{storeId}/` from Supabase Storage (paginated, 1000 at a time).
- Always returns 200 OK (even on partial failure) to prevent Shopify retry loops.

---

## 3. Shopify Admin Panel (Embedded App)

The admin panel is rendered inside Shopify's iframe at `/shopify/*` using **Shopify Polaris** (not Tamagui). App Bridge CDN is loaded globally in the root layout.

### 3.0 Auth Pages (`/shopify/signup`, `/shopify/login`)

Shown before the dashboard when the merchant has not yet linked a WearOn account.

**Sign Up page** (`/shopify/signup`):
- Fields: store/business name, contact email (pre-filled from Shopify session data), password.
- On submit: creates WearOn Supabase user → triggers store provisioning → redirects to dashboard.

**Log In page** (`/shopify/login`):
- Fields: email, password.
- On submit: authenticates existing WearOn user → re-links Shopify store → redirects to dashboard.

Both pages operate fully inside the Shopify iframe with no external redirects. Session token exchange runs silently after auth.

### 3.1 Dashboard Page (`/shopify`)

Requires authenticated WearOn session. On first load after sign-up/login, displays a **"Store connected ✓"** confirmation banner.

Displays:
- **Store Overview** — Shop domain, status badge (active/inactive).
- **Credits Card** — Current virtual try-on credit balance (sourced from WearOn platform). "Buy Credits" button opens WearOn platform in a new tab (`target="_top"` to escape iframe).
- **API Key Card** — Masked key preview (`wk_abc123...****`), creation date. Regenerate button with confirmation dialog. Copy-to-clipboard for newly generated keys (shown once in a warning banner).
- **Feature Status Card** — Size Recommendation (active, free), Virtual Try-On (coming soon — requires WearOn credits).

### 3.2 Credits Page (`/shopify/credits`)

Simple read-only view of the store's WearOn credit balance:
- Current balance, total purchased, total spent.
- **"Manage Credits on WearOn Platform"** button — opens `https://app.wearon.ai/dashboard` in a new top-level window (`target="_top"`). Merchant adds their card and purchases credits there.
- Informational note: *"Credits are managed on the WearOn platform. Virtual try-on consumes 1 credit per generation."*

> **No payment is collected inside the Shopify iframe.** All billing happens on the WearOn platform (app.wearon.ai) via the merchant's WearOn account.

### 3.3 Settings Page (`/shopify/settings`)

**Billing Mode** — *(Coming Soon — will be configurable once virtual try-on is publicly enabled)*

Radio choice:
- **Absorb Mode** (default): Store pays for all try-on credits. Shoppers use the feature for free.
- **Resell Mode**: Shoppers buy try-on credits at a retail price set by the merchant. Requires `retail_credit_price` (positive number, max $100).

**Store Information** — Read-only display: shop domain, subscription tier, status.

When switching to **Resell Mode**, the backend:
1. Creates a hidden "Try-On Credit" product on the merchant's Shopify store via Admin GraphQL API.
2. Sets the variant price to the configured retail credit price.
3. Removes the product from the Online Store channel (hidden from storefront browsing, only accessible via direct cart link or the plugin widget).
4. Sets product status to ACTIVE.
5. Stores `shopify_product_id` and `shopify_variant_id` in the `stores` table.

---

## 4. Storefront Plugin (B2B REST API)

The storefront widget communicates via a REST API at `/api/v1/*`, authenticated with the store's API key (`X-API-Key` header).

### 4.1 Authentication & Security

**API Key Auth** (`withB2BAuth` middleware):
1. Extracts `X-API-Key` header.
2. SHA-256 hashes the key and looks up `store_api_keys` by `key_hash`.
3. Verifies key is active and store is active.
4. Returns `B2BContext` with `storeId`, `requestId`, `allowedDomains`, `subscriptionTier`.

**CORS** — Validates `Origin` header against `store_api_keys.allowed_domains`.

**Rate Limiting** — Per-store rate limits based on subscription tier, with `X-RateLimit-*` headers.

### 4.2 API Endpoints

#### `GET /api/v1/health`
Health check. Returns `{ status: "ok", storeId, timestamp }`.

#### `POST /api/v1/size-rec` ← **Active (current release)**
See section below.

#### `POST /api/v1/generation/create` — **(Coming Soon — not exposed in current plugin UI)**
> Virtual try-on is fully implemented on the backend but not yet surfaced in the storefront widget. It will be enabled in a future release after Shopify app review.

Create a virtual try-on generation.

**Request:**
```json
{
  "image_urls": ["https://...supabase.../stores/{storeId}/uploads/model.jpg", "..."],
  "prompt": "Optional custom prompt (defaults to built-in try-on prompt)",
  "age_verified": true
}
```

**Headers:** `X-API-Key`, `X-Shopper-Email` (required for resell mode).

**Flow:**
1. Validates `age_verified === true` (COPPA compliance — blocks with 403 if false).
2. Validates `image_urls` array (1–10 URLs, must be store-scoped Supabase paths).
3. Checks store's `billing_mode`:
   - **Absorb mode**: Atomically deducts 1 credit from `store_credits`.
   - **Resell mode**: Atomically deducts 1 credit from `store_shopper_credits` for the given `x-shopper-email`.
4. If store credit = 0 but has active subscription → bills 1 **overage charge** via Paddle API.
5. Creates `store_generation_sessions` row with status `queued`.
6. Pushes `GenerationTaskPayload` to Redis as a Celery task.
7. Returns `{ sessionId, status: "queued" }` (201).

**Error recovery**: If session creation or queue push fails, credits are refunded. If overage billing succeeds but queue fails, the Paddle charge is refunded.

#### `GET /api/v1/generation/{id}` — **(Coming Soon)**
Poll generation status. Not exposed in current plugin UI.

**Response:**
```json
{
  "sessionId": "uuid",
  "status": "queued|processing|completed|failed",
  "modelImageUrl": "...",
  "outfitImageUrl": "...",
  "generatedImageUrl": "...",
  "errorMessage": null,
  "creditsUsed": 1,
  "requestId": "...",
  "createdAt": "...",
  "completedAt": "..."
}
```

Scoped to `store_id` — prevents cross-tenant access.

#### `GET /api/v1/credits/balance` — **(Coming Soon)**
Returns `{ balance, totalPurchased, totalSpent }` for the store. Will be used by the widget when virtual try-on is enabled.

#### `GET /api/v1/credits/shopper` — **(Coming Soon)**
Returns shopper-level credit balance. Requires `X-Shopper-Email` header. Missing shopper rows return `{ balance: 0 }`. Only relevant in resell mode with virtual try-on.

#### `GET /api/v1/stores/config`
Returns store configuration: `storeId`, `shopDomain`, `billingMode`, `retailCreditPrice`, `shopifyVariantId`, `subscriptionTier`, `status`, plus a `privacyDisclosure` string for the widget to display.

#### `PATCH /api/v1/stores/config` — **(Coming Soon)**
Update `billing_mode` and `retail_credit_price`. When switching to resell mode, auto-creates/updates the hidden Shopify credit product via Admin GraphQL API. Not exposed in current settings UI.

#### `GET /api/v1/stores/analytics`
Store-level analytics with optional `start_date`/`end_date` query params. Returns `total_generations`, `completed_generations`, `failed_generations`, `success_rate`, `credits_remaining`, `credits_used`.

#### `POST /api/v1/size-rec`
AI-powered body size recommendation.

**Request:**
```json
{
  "image_url": "https://...supabase.../...",
  "height_cm": 175.5
}
```

**Flow:**
1. Validates `image_url` domain is trusted (Supabase origin).
2. Validates `height_cm` (100–250, max 1 decimal place).
3. Per-store rate limiting: 100 requests/hour.
4. Forwards to external worker API (`WORKER_API_URL/estimate-body`) with 5s timeout.
5. Validates worker response schema.
6. Returns `{ recommended_size, measurements, confidence, body_type }`.

---

## 5. Billing Model

The Shopify plugin is **free**. No payment is collected inside the Shopify admin or storefront widget.

### 5.1 Current Release (Free)

- **Size Recommendation** — free for all merchants, unlimited use.
- No credit system, no payment required.

### 5.2 Virtual Try-On Credits (Coming Soon)

When virtual try-on is enabled, credits will be required. Credits are purchased exclusively on the **WearOn platform** (`app.wearon.ai`):

1. Merchant clicks "Buy Credits" in the Shopify admin or is prompted when credits run out.
2. Link opens `app.wearon.ai/dashboard` in a new top-level window (`target="_top"`).
3. Merchant adds a credit card and purchases credits on the WearOn platform (handled by WearOn's own payment system — no Shopify Billing API involved).
4. Credits are stored in `store_credits.balance` and synced to the plugin via the WearOn API.
5. Each virtual try-on generation deducts 1 credit atomically.

### 5.3 Why Billing is Off-Platform

- The Shopify app is listed as **free** on the App Store — no Shopify Billing API required.
- Virtual try-on credits are a **WearOn platform feature**, not a Shopify app charge.
- This is the same model used by apps like Klaviyo and Gorgias (free Shopify app, paid features billed on own platform).
- Compliant with Shopify policies: no payment collected inside the iframe.

---

## 6. Resell Mode — Coming Soon

> Resell mode (where merchants sell try-on credits to their own shoppers) is part of the virtual try-on feature set and will be enabled in a future release. All backend infrastructure is implemented but not active.

When enabled, resell mode will allow merchants to:
1. Set a retail credit price per try-on.
2. Let shoppers purchase credits via a hidden Shopify product.
3. Shopify `orders/create` webhook credits the shopper's balance automatically.

Shopper email handling:
- Extracted from `X-Shopper-Email` header.
- Normalized: `trim().toLowerCase()`.
- Logged as SHA-256 hash (first 12 chars) for privacy.

---

## 7. Database Schema (B2B Tables)

### `stores`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Store ID |
| shop_domain | TEXT (UNIQUE) | Shopify myshopify.com domain |
| access_token_encrypted | TEXT | AES-encrypted Shopify offline access token |
| owner_user_id | UUID | Linked WearOn user account (set at signup) |
| status | TEXT | `active` or `inactive` |
| onboarding_completed | BOOLEAN | Whether onboarding is done |
| is_churn_risk | BOOLEAN | Flagged by churn detection cron |
| churn_flagged_at | TIMESTAMPTZ | When churn risk was flagged |
| billing_mode | TEXT | `absorb_mode` or `resell_mode` *(Coming Soon)* |
| retail_credit_price | NUMERIC | Per-credit retail price in USD *(Coming Soon — resell mode)* |
| shopify_product_id | TEXT | Hidden credit product ID *(Coming Soon — resell mode)* |
| shopify_variant_id | TEXT | Credit product variant ID *(Coming Soon — resell mode)* |

### `store_api_keys`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Key ID |
| store_id | UUID (FK) | Parent store |
| key_hash | TEXT | SHA-256 hash of the API key |
| key_prefix | TEXT | First 16 chars for masked display |
| allowed_domains | TEXT[] | CORS whitelist |
| is_active | BOOLEAN | Whether key is usable |

### `store_credits`
| Column | Type | Description |
|--------|------|-------------|
| store_id | UUID (FK, UNIQUE) | Parent store |
| balance | INTEGER | Current credit balance |
| total_purchased | INTEGER | Lifetime purchased |
| total_spent | INTEGER | Lifetime spent |

### `store_credit_transactions`
| Column | Type | Description |
|--------|------|-------------|
| store_id | UUID (FK) | Parent store |
| amount | INTEGER | Positive=credit, negative=debit |
| type | TEXT | `deduction`, `refund`, `purchase` |
| request_id | TEXT | Correlation ID |
| description | TEXT | Human-readable |

### `store_generation_sessions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Session ID |
| store_id | UUID (FK) | Parent store |
| shopper_email | TEXT | Shopper email (resell mode) |
| status | TEXT | `queued`, `processing`, `completed`, `failed` |
| model_image_url | TEXT | Uploaded model photo URL |
| outfit_image_url | TEXT | Uploaded outfit photo URL |
| generated_image_url | TEXT | Result image URL |
| prompt_system | TEXT | System prompt used |
| error_message | TEXT | Error details if failed |
| processing_time_ms | INTEGER | Time to generate |
| credits_used | INTEGER | Always 1 |
| request_id | TEXT | Correlation ID |
| metadata | JSONB | Extra data (e.g., overage_charge_id) |

Realtime enabled for status change notifications via WebSocket.

### `store_analytics_events`
| Column | Type | Description |
|--------|------|-------------|
| store_id | UUID (FK) | Parent store |
| event_type | TEXT | Event name |
| shopper_email | TEXT | Associated shopper |
| metadata | JSONB | Event payload |

### `store_shopper_credits` (Resell Mode)
| Column | Type | Description |
|--------|------|-------------|
| store_id | UUID (FK) | Parent store |
| shopper_email | TEXT | Shopper identifier |
| balance | INTEGER | Current credit balance |
| total_purchased | INTEGER | Lifetime purchased |
| total_spent | INTEGER | Lifetime spent |

Unique constraint on `(store_id, shopper_email)`.

### `store_shopper_purchases` (Resell Mode)
| Column | Type | Description |
|--------|------|-------------|
| store_id | UUID (FK) | Parent store |
| shopper_email | TEXT | Buyer |
| shopify_order_id | TEXT (UNIQUE) | Idempotency key |
| credits_purchased | INTEGER | Credits bought |
| amount_paid | NUMERIC | Total price paid |
| currency | TEXT | Default USD |

### `shopify_webhook_events`
Audit table for Shopify webhook idempotency (orders/create, app/uninstalled). *(Paddle webhook table removed — no Paddle integration.)*

---

## 8. Cron Jobs

### Daily Cleanup (`/api/cron/cleanup`)
- **Schedule:** Daily at midnight UTC.
- **Auth:** `CRON_SECRET` bearer token.
- Deletes expired files from Supabase Storage (6-hour TTL).
- Clears old session URLs from DB.
- Recovers stuck jobs (processing/pending > 10 minutes) — marks as failed, refunds credits.

### Weekly Churn Detection (`/api/cron/churn-detection`)
- **Schedule:** Weekly, Monday 6:00 AM UTC.
- Compares current vs previous week generation counts for all active stores.
- Flags stores with >50% week-over-week drop as `is_churn_risk = true`.
- Unflags stores that recover.

---

## 9. Privacy & Compliance

### Data Retention
- All uploaded photos and generated images: **auto-deleted within 6 hours**.
- No long-term image storage on server.
- Generated images available for download during the 6-hour window.

### COPPA Compliance
- `age_verified: true` is required in every generation request.
- Blocked requests are logged with `age_verification_failed_b2b` event.
- 403 error returned with clear message.

### Privacy Templates
The plugin provides auto-generated privacy policy templates (GDPR, CCPA, DPA) via the config endpoint. The store name placeholder is sanitized to prevent XSS. A short `privacyDisclosure` string is provided for the widget to display inline.

### Shopper Email Privacy
- Shopper emails are only stored for resell mode credit tracking.
- All logs use SHA-256 hashed email (first 12 chars) — never plaintext.

---

## 10. Generation Pipeline (B2B Channel) — Coming Soon

> Virtual try-on generation is fully implemented on the backend and will be enabled in a future release. The storefront widget currently surfaces size recommendation only.

1. Storefront widget uploads images to Supabase Storage at `stores/{storeId}/uploads/`.
2. `POST /api/v1/generation/create` validates, deducts credits, creates session, pushes to Redis queue.
3. **Celery Worker** (Python, separate process) picks up the job from Redis:
   - Downloads images from Supabase Storage.
   - Resizes to max 1024px (cost optimization).
   - Sends to OpenAI GPT Image 1.5 `/images/edits` endpoint.
   - Uploads generated image to `stores/{storeId}/generated/`.
   - Updates `store_generation_sessions` status → triggers Supabase Realtime.
4. Widget receives real-time status update via WebSocket (fallback: poll `GET /api/v1/generation/{id}`).

**Error handling:**
- Moderation blocked → user-friendly message, credits refunded.
- Rate limit (429) → Celery retries with exponential backoff.
- Other errors → no retry, credits refunded, session marked failed.

---

## 11. Environment Variables Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SHOPIFY_CLIENT_ID` | Shopify app client ID |
| `SHOPIFY_CLIENT_SECRET` | Shopify app secret (JWT verify + webhook HMAC) |
| `SHOPIFY_APP_URL` | Public URL of the app |
| `SHOPIFY_SCOPES` | Comma-separated Shopify access scopes |
| `WORKER_API_URL` | External Python Celery worker API base URL (for size-rec) |
| `CRON_SECRET` | Bearer token for cron job authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key for generation worker *(used by Celery worker, Coming Soon)* |
| `REDIS_URL` | Redis connection string (Celery broker, Coming Soon) |

---

## 12. File Map

```
apps/next/app/
├── layout.tsx                           # Root layout (App Bridge CDN script)
├── shopify/
│   ├── layout.tsx                       # Polaris provider + shopify-api-key metadata
│   ├── polaris-provider.tsx             # Shopify Polaris + App Bridge ready gate
│   ├── use-shopify-api.ts              # Axios client with session token auth (XHR adapter)
│   ├── signup/page.tsx                  # WearOn account creation (shown on first install)
│   ├── login/page.tsx                   # WearOn account login (shown on reinstall)
│   ├── page.tsx                         # Dashboard (store overview, credits card, API key, feature status)
│   ├── credits/page.tsx                 # Credits balance + "Manage on WearOn Platform" link
│   └── settings/page.tsx               # Store info (read-only for now)
├── api/shopify/store/
│   ├── route.ts                         # GET store overview
│   ├── credits/route.ts                 # GET credit balance (from WearOn platform sync)
│   ├── api-key/route.ts                 # GET API key preview
│   └── api-key/regenerate/route.ts      # POST regenerate API key
├── api/v1/
│   ├── health/route.ts                  # GET health check
│   ├── size-rec/route.ts               # POST size recommendation (active)
│   ├── stores/config/route.ts           # GET store config (B2B widget init)
│   ├── stores/analytics/route.ts        # GET store analytics
│   ├── generation/create/route.ts       # POST create generation (Coming Soon)
│   ├── generation/[id]/route.ts         # GET generation status (Coming Soon)
│   ├── credits/balance/route.ts         # GET store credit balance (Coming Soon)
│   ├── credits/shopper/route.ts         # GET shopper credit balance (Coming Soon)
│   ├── stores/config/route.ts           # PATCH store config — resell mode (Coming Soon)
│   ├── webhooks/shopify/orders/route.ts # POST Shopify orders webhook (Coming Soon — resell)
│   └── webhooks/shopify/app/route.ts    # POST Shopify app/uninstalled webhook
└── api/cron/
    ├── cleanup/route.ts                 # Daily: file/session/job cleanup
    └── churn-detection/route.ts         # Weekly: churn risk flagging

packages/api/src/
├── middleware/
│   ├── shopify-session.ts               # JWT verification + store provisioning + WearOn auth link
│   ├── b2b.ts                           # API key auth + CORS + rate limiting
│   ├── api-key-auth.ts                  # SHA-256 key lookup
│   ├── cors.ts                          # Origin validation
│   ├── rate-limit.ts                    # Per-store rate limiting
│   └── request-id.ts                    # Request ID extraction
├── services/
│   ├── shopify.ts                       # Shopify API client, token exchange
│   ├── merchant-ops.ts                  # Store CRUD, API key management, WearOn user linking
│   ├── b2b-credits.ts                   # Credit balance read (deduction Coming Soon)
│   ├── store-cleanup.ts                 # Uninstall cleanup (keys, jobs, storage)
│   ├── store-analytics.ts              # Analytics event logging
│   ├── redis-queue.ts                   # Celery task dispatch via Redis (Coming Soon)
│   ├── shopify-credit-product.ts        # Hidden credit product CRUD (Coming Soon — resell)
│   └── churn-detection.ts              # Weekly churn risk analysis
├── utils/
│   ├── shopify-hmac.ts                  # Webhook HMAC verification
│   ├── b2b-response.ts                  # Standard JSON response helpers
│   ├── encryption.ts                    # AES encrypt/decrypt for access tokens
│   └── snake-case.ts                    # camelCase → snake_case converter
└── templates/
    └── privacy-policy.ts               # GDPR, CCPA, DPA templates

supabase/migrations/
├── 005_b2b_stores_schema.sql            # stores, store_api_keys, store_credits, RPCs
├── 006_b2b_generation_schema.sql        # store_generation_sessions, store_analytics_events (Coming Soon)
└── 007_b2b_resell_schema.sql            # store_shopper_credits, purchases (Coming Soon)
```