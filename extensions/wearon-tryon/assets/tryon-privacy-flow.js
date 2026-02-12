const PRIVACY_ACK_KEY = 'wearon_privacy_ack_v1'
const DEFAULT_CONFIG_ENDPOINT = '/api/store-config'

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
    return 'resell'
  }

  return input.toLowerCase() === 'absorb' ? 'absorb' : 'resell'
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

export function shouldRequireLogin({ billingMode }) {
  return normalizeBillingMode(billingMode) !== 'absorb'
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
  }
}

export async function resolveTryOnAccess(apiClient, endpoint = DEFAULT_CONFIG_ENDPOINT) {
  const config = await getStoreConfig(apiClient, endpoint)

  return {
    billingMode: config.billingMode,
    requireLogin: shouldRequireLogin({ billingMode: config.billingMode }),
  }
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
