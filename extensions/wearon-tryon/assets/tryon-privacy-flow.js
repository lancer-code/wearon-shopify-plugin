const AGE_VERIFIED_KEY = 'wearon_age_verified_v1'
// MEDIUM #2 FIX: Add timestamp validation to prevent stale/tampered verification
const AGE_VERIFIED_TIMESTAMP_KEY = 'wearon_age_verified_ts_v1'
const MAX_AGE_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const PRIVACY_ACK_KEY = 'wearon_privacy_ack_v1'
const DEFAULT_CONFIG_ENDPOINT = '/api/v1/stores/config'
const DEFAULT_SHOPPER_BALANCE_ENDPOINT = '/api/v1/credits/shopper'

function getSessionStorage(storageRef) {
  if (storageRef) {
    return storageRef
  }

  if (typeof globalThis === 'undefined' || !globalThis.sessionStorage) {
    return null
  }

  return globalThis.sessionStorage
}

function normalizeBillingMode(input) {
  if (!input || typeof input !== 'string') {
    return 'resell_mode'
  }

  const normalized = input.toLowerCase()
  if (normalized === 'absorb' || normalized === 'absorb_mode') {
    return 'absorb_mode'
  }

  return 'resell_mode'
}

function normalizeRetailCreditPrice(input) {
  const parsed = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeShopDomain(input) {
  if (typeof input !== 'string') {
    return null
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '')
  return withoutProtocol.replace(/\/+$/, '')
}

export function getRetailCreditPriceLabel({ billingMode, retailCreditPrice, currency = 'USD' }) {
  if (normalizeBillingMode(billingMode) !== 'resell_mode') {
    return null
  }

  const normalizedPrice = normalizeRetailCreditPrice(retailCreditPrice)
  if (normalizedPrice === null) {
    return null
  }

  return `${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizedPrice)} per credit`
}

export function isAcknowledged(storageRef) {
  const storage = getSessionStorage(storageRef)
  if (!storage) {
    return false
  }

  return storage.getItem(PRIVACY_ACK_KEY) === 'true'
}

export function acknowledgePrivacy(storageRef) {
  const storage = getSessionStorage(storageRef)
  if (!storage) {
    return false
  }

  storage.setItem(PRIVACY_ACK_KEY, 'true')
  return true
}

export function isAgeVerified(storageRef) {
  const storage = getSessionStorage(storageRef)
  if (!storage) {
    return false
  }

  const verified = storage.getItem(AGE_VERIFIED_KEY) === 'true'
  if (!verified) {
    return false
  }

  // MEDIUM #2 FIX: Validate timestamp hasn't been tampered or expired
  const timestampStr = storage.getItem(AGE_VERIFIED_TIMESTAMP_KEY)
  if (!timestampStr) {
    // No timestamp - invalidate verification
    storage.removeItem(AGE_VERIFIED_KEY)
    return false
  }

  const timestamp = Number(timestampStr)
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    // Invalid timestamp - clear and reject
    storage.removeItem(AGE_VERIFIED_KEY)
    storage.removeItem(AGE_VERIFIED_TIMESTAMP_KEY)
    return false
  }

  const now = Date.now()
  const age = now - timestamp

  if (age < 0 || age > MAX_AGE_VERIFICATION_DURATION_MS) {
    // Timestamp is in the future (tampered) or too old - invalidate
    storage.removeItem(AGE_VERIFIED_KEY)
    storage.removeItem(AGE_VERIFIED_TIMESTAMP_KEY)
    return false
  }

  return true
}

export function setAgeVerified(storageRef) {
  const storage = getSessionStorage(storageRef)
  if (!storage) {
    return false
  }

  storage.setItem(AGE_VERIFIED_KEY, 'true')
  storage.setItem(AGE_VERIFIED_TIMESTAMP_KEY, Date.now().toString())
  return true
}

export function shouldRequireLogin({ billingMode }) {
  return normalizeBillingMode(billingMode) !== 'absorb_mode'
}

export async function getStoreConfig(apiClient, endpoint = DEFAULT_CONFIG_ENDPOINT) {
  if (!apiClient || typeof apiClient.get !== 'function') {
    throw new Error('API client with a get() method is required')
  }

  const response = await apiClient.get(endpoint)
  const payload = response && response.data ? response.data : {}
  const data = payload && payload.data ? payload.data : payload

  return {
    billingMode: normalizeBillingMode(data.billing_mode || data.billingMode),
    retailCreditPrice: normalizeRetailCreditPrice(
      data.retail_credit_price || data.retailCreditPrice,
    ),
    shopDomain: normalizeShopDomain(data.shop_domain || data.shopDomain),
    shopifyVariantId: data.shopify_variant_id || data.shopifyVariantId || null,
  }
}

export async function resolveTryOnAccess(apiClient, endpoint = DEFAULT_CONFIG_ENDPOINT) {
  const config = await getStoreConfig(apiClient, endpoint)

  return {
    billingMode: config.billingMode,
    retailCreditPrice: config.retailCreditPrice,
    shopDomain: config.shopDomain,
    shopifyVariantId: config.shopifyVariantId,
    requireLogin: shouldRequireLogin({ billingMode: config.billingMode }),
    retailCreditPriceLabel: getRetailCreditPriceLabel(config),
  }
}

export async function getShopperCreditBalance(
  apiClient,
  endpoint = DEFAULT_SHOPPER_BALANCE_ENDPOINT,
) {
  if (!apiClient || typeof apiClient.get !== 'function') {
    throw new Error('API client with a get() method is required')
  }

  const response = await apiClient.get(endpoint)
  const payload = response && response.data ? response.data : {}
  const data = payload && payload.data ? payload.data : payload

  return {
    balance: Number(data.balance || 0),
    totalPurchased: Number(
      data.total_added || data.totalAdded || data.total_purchased || data.totalPurchased || 0,
    ),
    totalSpent: Number(data.total_used || data.totalUsed || data.total_spent || data.totalSpent || 0),
  }
}

export async function pollShopperCreditBalance(apiClient, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) ? Number(options.intervalMs) : 5000
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 60000
  const endpoint =
    typeof options.endpoint === 'string' && options.endpoint
      ? options.endpoint
      : DEFAULT_SHOPPER_BALANCE_ENDPOINT
  const waitFn =
    typeof options.waitFn === 'function'
      ? options.waitFn
      : (delayMs) =>
          new Promise((resolve) => {
            setTimeout(resolve, delayMs)
          })

  const attempts = Math.max(1, Math.floor(timeoutMs / intervalMs) + 1)
  let latestBalance = {
    balance: 0,
    totalPurchased: 0,
    totalSpent: 0,
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latestBalance = await getShopperCreditBalance(apiClient, endpoint)
    if (latestBalance.balance > 0) {
      return latestBalance
    }

    if (attempt < attempts - 1) {
      await waitFn(intervalMs)
    }
  }

  return latestBalance
}

export function buildCreditCartLink({ quantity = 1, shopDomain, shopifyVariantId }) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain)
  const normalizedVariantId =
    typeof shopifyVariantId === 'string' && /^\d+$/.test(shopifyVariantId.trim())
      ? shopifyVariantId.trim()
      : null
  const normalizedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1

  if (!normalizedShopDomain || !normalizedVariantId) {
    return null
  }

  return `https://${normalizedShopDomain}/cart/${normalizedVariantId}:${normalizedQuantity}`
}

export function openCreditCheckout(cartLink, windowRef) {
  const targetWindow = windowRef || (typeof globalThis !== 'undefined' ? globalThis.window : undefined)

  if (!targetWindow || typeof targetWindow.open !== 'function' || typeof cartLink !== 'string') {
    return false
  }

  targetWindow.open(cartLink, '_blank', 'noopener,noreferrer')
  return true
}

export async function getUserCamera(mediaDevicesRef) {
  const mediaDevices =
    mediaDevicesRef || (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined)

  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    throw new Error('Camera access is not supported in this environment')
  }

  return mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
    },
    audio: false,
  })
}

export function createPoseOverlay(documentRef) {
  const doc = documentRef || globalThis.document
  if (!doc || typeof doc.createElement !== 'function') {
    throw new Error('A valid document reference is required')
  }

  const overlay = doc.createElement('div')
  overlay.className = 'wearon-widget__pose-overlay'
  overlay.textContent = 'Align your face and shoulders inside the outline.'
  return overlay
}

export function capturePhoto(videoElement, canvasElement) {
  if (!canvasElement || typeof canvasElement.getContext !== 'function') {
    throw new Error('A canvas element is required for capture')
  }

  const width = videoElement?.videoWidth || 0
  const height = videoElement?.videoHeight || 0
  if (!width || !height) {
    throw new Error('Video stream is not ready for capture')
  }

  canvasElement.width = width
  canvasElement.height = height
  const context = canvasElement.getContext('2d')
  if (!context || typeof context.drawImage !== 'function') {
    throw new Error('Canvas 2D context is unavailable')
  }

  context.drawImage(videoElement, 0, 0, width, height)
  if (typeof canvasElement.toDataURL !== 'function') {
    throw new Error('Canvas toDataURL is unavailable')
  }

  return canvasElement.toDataURL('image/jpeg')
}

export function createTryOnExperienceState(options = {}) {
  const sessionStorageRef = getSessionStorage(options.sessionStorageRef)

  return {
    sessionStorageRef,
    canOpenCamera() {
      return isAcknowledged(sessionStorageRef)
    },
    acknowledgePrivacy() {
      return acknowledgePrivacy(sessionStorageRef)
    },
    shouldRequireLogin(config = {}) {
      return shouldRequireLogin(config)
    },
  }
}
