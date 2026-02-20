# WearOn Shopify Plugin — API Endpoints Reference

Complete reference for every API endpoint in the WearOn Shopify plugin. Covers both the **Storefront B2B API** (used by the plugin widget embedded in the merchant's storefront) and the **Shopify Admin API** (used by the embedded Shopify admin app).

> **Current Release Scope:** The storefront widget currently exposes **size recommendation only** (`POST /api/v1/size-rec`). All virtual try-on generation endpoints are fully implemented on the backend but marked **Coming Soon** — they will be surfaced in the widget UI in a future release.

---

## Table of Contents

- [Authentication](#authentication)
- [Standard Response Envelope](#standard-response-envelope)
- [Rate Limiting Headers](#rate-limiting-headers)
- [B2B Storefront API — `/api/v1/*`](#b2b-storefront-api)
  - [GET /api/v1/health](#get-apiv1health)
  - [POST /api/v1/size-rec](#post-apiv1size-rec) ← **Active**
  - [POST /api/v1/generation/create](#post-apiv1generationcreate) *(Coming Soon)*
  - [GET /api/v1/generation/:id](#get-apiv1generationid) *(Coming Soon)*
  - [GET /api/v1/credits/balance](#get-apiv1creditsbalance) *(Coming Soon)*
  - [GET /api/v1/credits/shopper](#get-apiv1creditsshopper) *(Coming Soon)*
  - [GET /api/v1/stores/config](#get-apiv1storesconfig)
  - [PATCH /api/v1/stores/config](#patch-apiv1storesconfig) *(Coming Soon)*
  - [GET /api/v1/stores/analytics](#get-apiv1storesanalytics)
- [Shopify Admin API — `/api/shopify/store/*`](#shopify-admin-api)
  - [GET /api/shopify/store](#get-apishopifystore)
  - [GET /api/shopify/store/credits](#get-apishopifystorecredits)
  - [GET /api/shopify/store/api-key](#get-apishopifystoreapi-key)
  - [POST /api/shopify/store/api-key/regenerate](#post-apishopifystoreapi-keyregenerate)
- [Webhook Endpoints](#webhook-endpoints)
  - [POST /api/v1/webhooks/shopify/app](#post-apiv1webhooksshopifyapp)
  - [POST /api/v1/webhooks/shopify/orders](#post-apiv1webhooksshopifyorders) *(Coming Soon — resell mode)*
- [Cron Endpoints](#cron-endpoints)
  - [GET /api/cron/cleanup](#get-apicroncleanup)
  - [GET /api/cron/churn-detection](#get-apicronchurn-detection)
- [Error Codes Reference](#error-codes-reference)

---

## Authentication

### B2B Storefront API

All `/api/v1/*` endpoints require an API key in the request header:

```
X-API-Key: wk_<hex>
```

The key is validated by SHA-256 hashing it and looking up the hash in `store_api_keys`. The key must be active and the associated store must be active.

The `Origin` header is also validated against the `allowed_domains` list registered for the API key (CORS enforcement).

### Shopify Admin API

All `/api/shopify/store/*` endpoints require an App Bridge session token:

```
Authorization: Bearer <shopify-session-token>
```

The token is a HS256 JWT signed by Shopify using `SHOPIFY_CLIENT_SECRET`. Verification checks: signature, audience (`NEXT_PUBLIC_SHOPIFY_CLIENT_ID`), expiry, not-before, and issuer.

### Webhook Endpoints

- Shopify webhooks: verified via `X-Shopify-Hmac-Sha256` header (HMAC-SHA256 of raw body using `SHOPIFY_CLIENT_SECRET`).
- Paddle webhooks: verified via `Paddle-Signature` header.

### Cron Endpoints

```
Authorization: Bearer <CRON_SECRET>
```

---

## Standard Response Envelope

All B2B API endpoints return a consistent JSON envelope:

**Success:**
```json
{
  "data": { ... },
  "error": null
}
```

**Error:**
```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

HTTP status codes are set appropriately (200, 201, 400, 401, 402, 403, 404, 429, 500, 503).

---

## Rate Limiting Headers

All B2B API responses include:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

Rate limits are per-store and scale with subscription tier.

---

## B2B Storefront API

Base URL: `/api/v1`

---

### GET /api/v1/health

**Purpose:** Health check to verify the API key is valid and the store is active. Use this on plugin initialization to confirm connectivity.

**Auth:** `X-API-Key`

**Request:** No body or query parameters.

**Response — 200 OK:**
```json
{
  "data": {
    "status": "ok",
    "storeId": "uuid",
    "timestamp": "2026-02-20T10:00:00.000Z"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"ok"` |
| `storeId` | string (UUID) | The authenticated store's ID |
| `timestamp` | string (ISO 8601) | Server time at the response |

---

### POST /api/v1/generation/create — *(Coming Soon)*

> This endpoint is fully implemented on the backend but not yet exposed in the storefront widget UI. It will be enabled in a future release after Shopify app review.

**Purpose:** Create a new virtual try-on generation. Deducts 1 credit from the store (absorb mode) or from the shopper (resell mode), queues the AI generation job, and returns a session ID for status polling.

**Auth:** `X-API-Key`

**Request Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | Store API key |
| `X-Shopper-Email` | Conditional | Required when store is in `resell_mode`. Must be a valid email address. Used to identify which shopper's credit balance to deduct from. |

**Request Body:**
```json
{
  "image_urls": [
    "https://<supabase-project>.supabase.co/storage/v1/object/sign/virtual-tryon-images/stores/<storeId>/uploads/model.jpg?token=...",
    "https://<supabase-project>.supabase.co/storage/v1/object/sign/virtual-tryon-images/stores/<storeId>/uploads/outfit.jpg?token=..."
  ],
  "prompt": "Optional custom prompt text",
  "age_verified": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_urls` | string[] | Yes | Array of signed Supabase Storage URLs. Must contain 1–10 items. All URLs must belong to the authenticated store's upload path (`stores/{storeId}/uploads/`). First URL is the model photo; second is the outfit; additional are accessories. |
| `prompt` | string | No | Custom prompt for the AI generation. Defaults to WearOn's built-in virtual try-on prompt if omitted or empty. |
| `age_verified` | boolean | Yes | Must be `true`. Confirms COPPA compliance — shopper is 13 or older. Requests with `false` or missing value are rejected with 403. |

**Security — URL validation:**
Only URLs whose pathname starts with `stores/{storeId}/uploads/` are accepted. Query parameters are ignored during validation to prevent injection bypass. URLs from other stores or external domains are rejected.

**Credit deduction logic:**
- **Absorb mode:** 1 credit deducted from `store_credits.balance` via atomic DB RPC with row lock.
- **Resell mode:** 1 credit deducted from `store_shopper_credits` for the given shopper email.
- **Overage (absorb mode only):** If store balance = 0 but has an active Paddle subscription, 1 overage charge is billed via Paddle API instead.

**Response — 201 Created (success):**
```json
{
  "data": {
    "sessionId": "018f1234-abcd-7xyz-...",
    "status": "queued"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string (UUID) | Use this to poll for generation status. |
| `status` | string | Always `"queued"` on creation. |

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 400 | `VALIDATION_ERROR` | Invalid JSON, missing `image_urls`, wrong URL format, wrong URL path, more than 10 URLs, missing `x-shopper-email` in resell mode |
| 402 | `INSUFFICIENT_CREDITS` | Store (or shopper in resell mode) has no credits and no active subscription |
| 403 | `AGE_VERIFICATION_REQUIRED` | `age_verified` is not `true` |
| 404 | `NOT_FOUND` | Store configuration not found |
| 500 | `INTERNAL_ERROR` | Session creation failed or internal error |
| 503 | `SERVICE_UNAVAILABLE` | Queue push failed or overage billing unavailable |

---

### GET /api/v1/generation/:id — *(Coming Soon)*

> Not exposed in current widget UI. Available in a future release alongside virtual try-on.

**Purpose:** Get the current status and result of a generation session. Poll this endpoint until `status` is `completed` or `failed`. Alternatively, subscribe to Supabase Realtime on the `store_generation_sessions` table for push updates.

**Auth:** `X-API-Key`

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The `sessionId` returned by the create endpoint. Must be a valid UUID format. |

**Request:** No body.

**Response — 200 OK:**
```json
{
  "data": {
    "sessionId": "018f1234-abcd-7xyz-...",
    "status": "completed",
    "modelImageUrl": "https://.../stores/.../uploads/model.jpg?token=...",
    "outfitImageUrl": "https://.../stores/.../uploads/outfit.jpg?token=...",
    "generatedImageUrl": "https://.../stores/.../generated/result.jpg?token=...",
    "errorMessage": null,
    "creditsUsed": 1,
    "requestId": "req_abc123",
    "createdAt": "2026-02-20T10:00:00.000Z",
    "completedAt": "2026-02-20T10:00:45.000Z"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string (UUID) | Session identifier |
| `status` | string | `queued` → `processing` → `completed` or `failed` |
| `modelImageUrl` | string | Signed URL for the uploaded model photo |
| `outfitImageUrl` | string \| null | Signed URL for the outfit photo (if provided) |
| `generatedImageUrl` | string \| null | Signed URL for the AI-generated result image. Only present when `status = "completed"`. Expires after 6 hours. |
| `errorMessage` | string \| null | Human-readable error reason. Only present when `status = "failed"`. |
| `creditsUsed` | integer | Always `1` |
| `requestId` | string | Internal correlation ID for support |
| `createdAt` | string (ISO 8601) | When the session was created |
| `completedAt` | string (ISO 8601) \| null | When generation finished (completed or failed) |

**Status Values:**
| Status | Meaning |
|--------|---------|
| `queued` | Job is waiting in the queue |
| `processing` | Worker is actively generating |
| `completed` | Generation succeeded — `generatedImageUrl` is available |
| `failed` | Generation failed — `errorMessage` explains why. Credits were refunded. |

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing or invalid UUID format for session ID |
| 404 | `NOT_FOUND` | Session not found or belongs to a different store |
| 500 | `INTERNAL_ERROR` | DB query failed |

---

### GET /api/v1/credits/balance — *(Coming Soon)*

> Will be used by the widget when virtual try-on credits are enabled.

**Purpose:** Get the current credit balance for the authenticated store. Use this to display the remaining try-on credits in the merchant's storefront widget or dashboard.

**Auth:** `X-API-Key`

**Request:** No body or parameters.

**Response — 200 OK:**
```json
{
  "data": {
    "balance": 250,
    "totalPurchased": 500,
    "totalSpent": 250
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `balance` | integer | Current available credits |
| `totalPurchased` | integer | Lifetime credits purchased (subscriptions + PAYG) |
| `totalSpent` | integer | Lifetime credits spent on generations |

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 500 | `INTERNAL_ERROR` | Failed to retrieve credit balance |

---

### GET /api/v1/credits/shopper — *(Coming Soon)*

> Only relevant in resell mode with virtual try-on enabled.

**Purpose:** Get the credit balance for a specific shopper in resell mode. Use this to display how many try-on credits the logged-in shopper has available on the storefront.

**Auth:** `X-API-Key`

**Request Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `X-Shopper-Email` | Yes | The shopper's email address. Normalized to lowercase. |

**Request:** No body or query parameters.

**Response — 200 OK:**
```json
{
  "data": {
    "balance": 3,
    "totalPurchased": 5,
    "totalSpent": 2
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `balance` | integer | Shopper's available credits for this store |
| `totalPurchased` | integer | Lifetime credits purchased by this shopper at this store |
| `totalSpent` | integer | Lifetime credits spent by this shopper at this store |

> **Note:** If no credit record exists yet for the shopper, `balance` is `0` (not a 404 error).

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing or invalid `X-Shopper-Email` header |
| 500 | `INTERNAL_ERROR` | Failed to retrieve shopper balance |

---

### GET /api/v1/stores/config

**Purpose:** Retrieve the store's plugin configuration. Call this on widget initialization to determine billing mode, retail pricing, and to obtain the privacy disclosure text required by compliance rules.

**Auth:** `X-API-Key`

**Request:** No body or parameters.

**Response — 200 OK:**
```json
{
  "data": {
    "storeId": "uuid",
    "shopDomain": "example-store.myshopify.com",
    "billingMode": "absorb_mode",
    "retailCreditPrice": null,
    "shopifyVariantId": null,
    "subscriptionTier": "growth",
    "status": "active",
    "privacyDisclosure": "Your photo is processed by WearOn and deleted within 6 hours. Photos are sent to our AI provider (OpenAI) for virtual try-on generation. No images are stored permanently."
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `storeId` | string (UUID) | Store identifier |
| `shopDomain` | string | Shopify myshopify.com domain |
| `billingMode` | string | `"absorb_mode"` or `"resell_mode"` |
| `retailCreditPrice` | number \| null | Per-credit retail price in USD. Only set in resell mode. |
| `shopifyVariantId` | string \| null | Shopify variant ID for the hidden credit product. Use this to add credits to the shopper's cart in resell mode. |
| `subscriptionTier` | string \| null | `"starter"`, `"growth"`, `"scale"`, or `null` |
| `status` | string | Store status: `"active"` or `"inactive"` |
| `privacyDisclosure` | string | Required disclosure text — display to shopper before they upload a photo. |

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 404 | `NOT_FOUND` | Store not found |
| 500 | `INTERNAL_ERROR` | DB query failed |

---

### PATCH /api/v1/stores/config — *(Coming Soon)*

> Billing mode configuration is not exposed in the current settings UI. Will be enabled with virtual try-on.

**Purpose:** Update the store's billing mode and retail credit price. When switching to resell mode, this automatically creates or updates the hidden "Try-On Credit" product on the Shopify store via Admin GraphQL API.

**Auth:** `X-API-Key`

**Request Body:**
```json
{
  "billing_mode": "resell_mode",
  "retail_credit_price": 0.50
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `billing_mode` | string | Yes | Must be `"absorb_mode"` or `"resell_mode"` |
| `retail_credit_price` | number | Conditional | Required when `billing_mode` is `"resell_mode"`. Must be a positive number. Set to `null` or omit for absorb mode. |

**Resell mode side effects:**
1. Creates a hidden Shopify product titled "Try-On Credit" with `status: DRAFT`.
2. Sets variant price to `retail_credit_price`.
3. Removes the product from the Online Store sales channel (hidden from browse).
4. Sets product status to `ACTIVE`.
5. Saves `shopify_product_id` and `shopify_variant_id` to the store record.

If the product already exists, only the variant price is updated.

**Response — 200 OK:**
```json
{
  "data": {
    "storeId": "uuid",
    "shopDomain": "example-store.myshopify.com",
    "billingMode": "resell_mode",
    "retailCreditPrice": 0.50,
    "shopifyVariantId": "45678901234",
    "subscriptionTier": "growth",
    "status": "active"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `storeId` | string (UUID) | Store identifier |
| `shopDomain` | string | Shopify domain |
| `billingMode` | string | Updated billing mode |
| `retailCreditPrice` | number \| null | Updated retail price |
| `shopifyVariantId` | string \| null | Created/existing Shopify variant ID |
| `subscriptionTier` | string \| null | Current subscription tier |
| `status` | string | Store status |

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 400 | `VALIDATION_ERROR` | Invalid `billing_mode`, missing or invalid `retail_credit_price` in resell mode |
| 404 | `NOT_FOUND` | Store not found |
| 500 | `INTERNAL_ERROR` | DB update failed |
| 503 | `SERVICE_UNAVAILABLE` | Shopify store not connected, or Shopify GraphQL API call failed |

---

### GET /api/v1/stores/analytics

**Purpose:** Get generation and credit usage analytics for the store. Optionally filter by date range.

**Auth:** `X-API-Key`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string (ISO 8601) | No | Filter sessions from this date onwards (e.g., `2026-01-01`) |
| `end_date` | string (ISO 8601) | No | Filter sessions up to this date (e.g., `2026-02-01`) |

**Request:** No body.

**Response — 200 OK:**
```json
{
  "data": {
    "total_generations": 1245,
    "completed_generations": 1190,
    "failed_generations": 55,
    "success_rate": 0.9558,
    "credits_remaining": 250,
    "credits_used": 1190
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total_generations` | integer | Total generation sessions in the date range (max 10,000) |
| `completed_generations` | integer | Sessions with `status = "completed"` |
| `failed_generations` | integer | Sessions with `status = "failed"` |
| `success_rate` | number (0–1) | `completed / total`. `0` if no sessions. |
| `credits_remaining` | integer | Current store credit balance |
| `credits_used` | integer | Lifetime credits spent (from `store_credits.total_spent`) |

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 400 | `VALIDATION_ERROR` | Invalid date format for `start_date` or `end_date` |
| 500 | `INTERNAL_ERROR` | DB query failed |

---

### POST /api/v1/size-rec

**Purpose:** Get an AI-powered clothing size recommendation for a shopper based on their photo and height. Calls an external worker service that performs body measurement estimation using computer vision. This endpoint does **not** consume any credits.

**Auth:** `X-API-Key`

**Rate Limit:** 100 requests per hour per store (in-memory, resets on server restart).

**Request Body:**
```json
{
  "image_url": "https://<supabase-project>.supabase.co/storage/v1/object/sign/.../model.jpg?token=...",
  "height_cm": 175.5
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `image_url` | string (URL) | Yes | Must be from the Supabase project domain | Full-body photo URL for body measurement estimation |
| `height_cm` | number | Yes | 100–250, max 1 decimal place | Shopper's height in centimetres |

**Security:** `image_url` domain is validated against `NEXT_PUBLIC_SUPABASE_URL`. Only URLs from the trusted Supabase project are accepted.

**Response — 200 OK:**
```json
{
  "data": {
    "recommended_size": "M",
    "measurements": {
      "chest_cm": 96.5,
      "waist_cm": 80.0,
      "hip_cm": 102.0,
      "shoulder_cm": 44.5,
      "inseam_cm": 81.0,
      "height_cm": 175.5
    },
    "confidence": 0.87,
    "body_type": "athletic"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `recommended_size` | string | Recommended clothing size (e.g., `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`, `"2XL"`) |
| `measurements` | object | Estimated body measurements in centimetres. Keys are limited to: `chest_cm`, `waist_cm`, `hip_cm`, `shoulder_cm`, `inseam_cm`, `height_cm`. |
| `confidence` | number (0–1) | Worker's confidence score for the recommendation |
| `body_type` | string \| null | Detected body type category (e.g., `"athletic"`, `"pear"`, `"rectangular"`) |

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 400 | `VALIDATION_ERROR` | Invalid body (missing fields, `image_url` not from trusted domain, `height_cm` out of range or too many decimal places) |
| 429 | `RATE_LIMIT_EXCEEDED` | Store exceeded 100 requests/hour |
| 503 | `SERVICE_UNAVAILABLE` | Worker API not configured, unreachable, or returned an error |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

---

## Shopify Admin API

Base URL: `/api/shopify/store`

All endpoints require `Authorization: Bearer <session-token>` from App Bridge.

---

### GET /api/shopify/store

**Purpose:** Get the store overview for the Shopify Admin dashboard. Called on dashboard load.

**Request:** No body.

**Response — 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "shop_domain": "example-store.myshopify.com",
    "status": "active",
    "onboarding_completed": true
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Store ID |
| `shop_domain` | string | Shopify myshopify.com domain |
| `status` | string | `"active"` or `"inactive"` |
| `onboarding_completed` | boolean | Whether onboarding flow has been completed |

---

---

> **Removed:** `GET /api/shopify/store/config` and `PATCH /api/shopify/store/config` — billing mode configuration is not available in the current release. Will be re-introduced when virtual try-on (resell mode) is enabled.

---

### GET /api/shopify/store/credits

**Purpose:** Get the store's wholesale credit balance for the Credits card on the Admin dashboard.

**Request:** No body.

**Response — 200 OK:**
```json
{
  "data": {
    "balance": 250,
    "total_purchased": 500,
    "total_spent": 250
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `balance` | integer | Current available credits |
| `total_purchased` | integer | Lifetime credits purchased |
| `total_spent` | integer | Lifetime credits consumed |

---

### GET /api/shopify/store/api-key

**Purpose:** Get the masked API key preview for display in the Admin dashboard. The full key is never returned after initial generation — only the first 16 characters are shown.

**Request:** No body.

**Response — 200 OK (key exists):**
```json
{
  "data": {
    "masked_key": "wk_a1b2c3d4e5f6g7h8...****",
    "created_at": "2026-01-15T09:00:00.000Z"
  },
  "error": null
}
```

**Response — 200 OK (no key yet):**
```json
{
  "data": {
    "masked_key": null,
    "created_at": null
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `masked_key` | string \| null | First 16 chars of the key followed by `...****`. `null` if no key has been generated. |
| `created_at` | string (ISO 8601) \| null | When the key was created |

---

### POST /api/shopify/store/api-key/regenerate

**Purpose:** Generate a new API key for the store. Immediately invalidates any existing active API keys. The full plaintext key is returned **only once** in this response — it cannot be retrieved again.

**Request:** No body.

**Response — 200 OK:**
```json
{
  "data": {
    "api_key": "wk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `api_key` | string | Full plaintext API key beginning with `wk_`. **Store this securely — it is shown only once.** |

> **Security note:** The previous active key is deactivated before the new key is inserted. There is a brief window where no key is active between deactivation and insertion.

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 500 | `INTERNAL_ERROR` | Failed to deactivate old keys or insert new key |

---

---

> **Removed endpoints:** `GET /api/shopify/store/billing-catalog`, `POST /api/shopify/store/checkout`, `POST /api/shopify/store/change-plan`, `GET /api/shopify/store/overage` — all Paddle-based billing endpoints have been removed. Billing is handled on the WearOn platform (`app.wearon.ai`), not inside the Shopify admin.

---

## Webhook Endpoints

---

### POST /api/v1/webhooks/shopify/orders

**Purpose:** Receives `orders/create` webhook events from Shopify. When a shopper purchases the hidden "Try-On Credit" product, this webhook credits their shopper balance. Only active in **resell mode**.

**Auth:** HMAC-SHA256 verification via `X-Shopify-Hmac-Sha256` header.

**Shopify Headers:**
| Header | Description |
|--------|-------------|
| `X-Shopify-Topic` | Must be `orders/create` |
| `X-Shopify-Hmac-Sha256` | Base64-encoded HMAC signature |
| `X-Shopify-Shop-Domain` | Merchant's myshopify.com domain |

**Request Body:** Standard Shopify order object (JSON). Key fields consumed:
```json
{
  "id": 820982911946154508,
  "email": "shopper@example.com",
  "currency": "USD",
  "customer": {
    "email": "shopper@example.com"
  },
  "line_items": [
    {
      "product_id": 632910392,
      "quantity": 3,
      "price": "0.50"
    }
  ],
  "myshopify_domain": "example-store.myshopify.com"
}
```

**Processing logic:**
1. Verifies HMAC signature.
2. Checks topic is `orders/create` (ignores others).
3. Extracts shop domain, order ID, shopper email.
4. Looks up store — ignores if not found or not in resell mode.
5. Matches line items against `stores.shopify_product_id` to count credits purchased.
6. Checks for duplicate order (idempotency via `shopify_order_id` UNIQUE constraint).
7. Calls `process_store_shopper_purchase` DB RPC to atomically:
   - Deduct credits from store's wholesale pool.
   - Credit the shopper's balance (`store_shopper_credits`).
   - Record the purchase in `store_shopper_purchases`.

**Response — 200 OK (processed):**
```json
{
  "data": {
    "acknowledged": true,
    "purchase": {
      "status": "processed",
      "purchase_id": "uuid",
      "store_id": "uuid",
      "shopper_email": "shopper@example.com",
      "shopify_order_id": "820982911946154508",
      "credits_purchased": 3,
      "amount_paid": 1.50,
      "currency": "USD"
    }
  },
  "error": null
}
```

**Response — 200 OK (ignored):**
```json
{
  "data": { "acknowledged": true, "ignored": "non_credit_order" },
  "error": null
}
```

Ignored reasons: `"unsupported_topic"`, `"unknown_store"`, `"store_not_in_resell_mode"`, `"non_credit_order"`, `"missing_shop_domain"`, `"missing_order_id"`, `"missing_shopper_email"`, `"missing_credit_product_id"`.

**Response — 200 OK (duplicate):**
```json
{
  "data": { "acknowledged": true, "duplicate": true },
  "error": null
}
```

**Response — 200 OK (insufficient store credits):**
```json
{
  "data": {
    "acknowledged": true,
    "insufficient_credits": true,
    "credits_required": 3
  },
  "error": null
}
```

> **Note:** Always returns 200 OK (even on errors) to prevent Shopify retry loops. Processing errors are logged server-side.

**Error Responses:**

| HTTP | Code | Cause |
|------|------|-------|
| 401 | `INVALID_API_KEY` | HMAC verification failed |
| 500 | `INTERNAL_ERROR` | Webhook secret not configured |

---

### POST /api/v1/webhooks/shopify/app

**Purpose:** Receives the `app/uninstalled` Shopify webhook. Cleans up the store's data when a merchant uninstalls the app.

**Auth:** HMAC-SHA256 verification via `X-Shopify-Hmac-Sha256` header.

**Shopify Headers:**
| Header | Description |
|--------|-------------|
| `X-Shopify-Topic` | Must be `app/uninstalled` |
| `X-Shopify-Hmac-Sha256` | HMAC signature |

**Request Body:**
```json
{
  "myshopify_domain": "example-store.myshopify.com"
}
```

**Cleanup actions (in order):**
1. Marks `stores.status = 'inactive'`.
2. Deletes all `store_api_keys` for the store.
3. Marks all `queued` generation sessions as `failed` with `error_message: "Store uninstalled"`.
4. Deletes all files from `stores/{storeId}/` in the `virtual-tryon-images` storage bucket (paginated, 1000 files per batch).

**Response — 200 OK:**
```json
{
  "data": {
    "acknowledged": true,
    "cleanup": {
      "store_id": "uuid",
      "api_keys_deleted": 1,
      "jobs_cancelled": 0,
      "storage_files_deleted": 47,
      "already_inactive": false
    }
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `store_id` | string (UUID) | Store that was cleaned up |
| `api_keys_deleted` | integer | Number of API keys deleted |
| `jobs_cancelled` | integer | Number of queued generation jobs cancelled |
| `storage_files_deleted` | integer | Number of storage files deleted |
| `already_inactive` | boolean | `true` if the store was already inactive before this event (re-run of cleanup) |

**Response — 200 OK (cleanup failed):**
```json
{
  "data": { "acknowledged": true, "cleanup_failed": true },
  "error": null
}
```

> Always returns 200 OK to prevent Shopify from retrying the webhook.

---

---

> **Removed:** `POST /api/v1/webhooks/paddle` — Paddle integration has been removed. All billing is handled on the WearOn platform. No Paddle webhooks are registered or processed by this app.

---

## Cron Endpoints

These endpoints are called by Vercel Cron or manually. Protected by `Authorization: Bearer <CRON_SECRET>`.

---

### GET /api/cron/cleanup

**Purpose:** Daily maintenance job that deletes expired images, cleans stale session URLs, and recovers stuck generation jobs.

**Schedule:** Daily at midnight UTC (`0 0 * * *`)

**Auth:** `Authorization: Bearer <CRON_SECRET>`

**Request:** No body.

**Actions:**
1. **File cleanup** — Deletes images from Supabase Storage that are older than 6 hours (uploads and generated images).
2. **Session URL cleanup** — Clears `generated_image_url` from sessions whose images have been deleted.
3. **Stuck job recovery** — Finds sessions stuck in `processing` or `queued` status for more than 10 minutes, marks them `failed`, and refunds their credits.

**Response — 200 OK:**
```json
{
  "success": true,
  "timestamp": "2026-02-20T00:00:05.000Z",
  "duration": 4820,
  "results": {
    "files": {
      "total": 312,
      "folders": ["uploads", "generated"],
      "errors": 0
    },
    "sessions": {
      "updated": 45
    },
    "stuckJobs": {
      "recovered": 2,
      "refunded": 2,
      "errors": 0
    }
  },
  "errors": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the cron completed without throwing |
| `timestamp` | string (ISO 8601) | Execution time |
| `duration` | integer | Time taken in milliseconds |
| `results.files.total` | integer | Number of storage files deleted |
| `results.files.folders` | string[] | Storage folders that were cleaned |
| `results.files.errors` | integer | Number of file deletion errors |
| `results.sessions.updated` | integer | Number of session URLs cleared |
| `results.stuckJobs.recovered` | integer | Number of stuck sessions marked failed |
| `results.stuckJobs.refunded` | integer | Number of credits refunded |
| `results.stuckJobs.errors` | integer | Number of recovery errors |
| `errors` | array | Details of any non-fatal errors |

---

### GET /api/cron/churn-detection

**Purpose:** Weekly job that identifies stores at risk of churning by comparing generation volume week-over-week. Flags stores with a >50% drop as churn risks.

**Schedule:** Every Monday at 6:00 AM UTC (`0 6 * * 1`)

**Auth:** `Authorization: Bearer <CRON_SECRET>`

**Request:** No body.

**Logic:**
- For every active store: compares generation count from the current week vs the previous week.
- Stores with >50% week-over-week drop → `is_churn_risk = true`, `churn_flagged_at = now()`.
- Previously flagged stores that have recovered → `is_churn_risk = false`, `churn_flagged_at = null`.

**Response — 200 OK:**
```json
{
  "success": true,
  "timestamp": "2026-02-17T06:00:03.000Z",
  "duration": 1240,
  "results": {
    "processed": 85,
    "newlyFlagged": 3,
    "unflagged": 1,
    "errors": 0
  },
  "errors": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the cron completed |
| `timestamp` | string (ISO 8601) | Execution time |
| `duration` | integer | Time taken in milliseconds |
| `results.processed` | integer | Total stores evaluated |
| `results.newlyFlagged` | integer | Stores newly flagged as churn risk |
| `results.unflagged` | integer | Previously flagged stores now recovered |
| `results.errors` | integer | Stores that failed to evaluate |
| `errors` | array | Per-store error details |

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key / session token |
| `INVALID_API_KEY` | 401 | Invalid HMAC signature (webhooks) |
| `VALIDATION_ERROR` | 400 | Request body or parameter validation failed |
| `AGE_VERIFICATION_REQUIRED` | 403 | `age_verified` not `true` (COPPA) |
| `INSUFFICIENT_CREDITS` | 402 | Not enough credits to process request |
| `RATE_LIMIT_EXCEEDED` | 429 | Per-store rate limit hit |
| `NOT_FOUND` | 404 | Resource does not exist or belongs to a different store |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | External dependency unavailable (Shopify, worker, queue) |
