import { capturePhoto, createPoseOverlay, getUserCamera } from './tryon-privacy-flow.js'

const DEFAULT_BUTTON_TEXT = 'Try On'
const DEFAULT_LOADING_TEXT = 'Loading...'
const DEFAULT_LOADING_DELAY_MS = 700
const PRIVACY_MESSAGE = 'Your photo is deleted within 6 hours'

function clearChildren(node) {
  if (!node || typeof node.firstChild === 'undefined' || typeof node.removeChild !== 'function') {
    return
  }

  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

function getShadowRoot(hostElement) {
  if (!hostElement || typeof hostElement.attachShadow !== 'function') {
    throw new Error('Host element must support attachShadow')
  }

  return hostElement.shadowRoot || hostElement.attachShadow({ mode: 'open' })
}

function getDocument(documentRef) {
  const doc = documentRef || globalThis.document
  if (!doc || typeof doc.createElement !== 'function') {
    throw new Error('A valid document reference is required')
  }

  return doc
}

export function createTryOnWidget(hostElement, options = {}) {
  const doc = getDocument(options.documentRef)
  const shadowRoot = getShadowRoot(hostElement)
  const schedule = options.schedule || ((callback, delay) => globalThis.setTimeout(callback, delay))
  const getUserCameraFn = options.getUserCameraFn || getUserCamera
  const captureFrameFn = options.captureFrameFn || capturePhoto

  clearChildren(shadowRoot)

  const style = doc.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .wearon-widget {
      box-sizing: border-box;
      width: 100%;
      max-width: 320px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 14px;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: grid;
      gap: 10px;
    }
    .wearon-widget__button {
      border: 0;
      border-radius: 10px;
      background: #101828;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 14px;
      cursor: pointer;
      transition: opacity 120ms ease-in-out;
    }
    .wearon-widget__privacy {
      margin: 0;
      color: #344054;
      font-size: 13px;
      line-height: 1.4;
    }
    .wearon-widget__privacy-ack {
      border: 1px solid #344054;
      border-radius: 10px;
      background: #ffffff;
      color: #101828;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 12px;
      cursor: pointer;
    }
    .wearon-widget__privacy-ack[disabled] {
      cursor: default;
      opacity: 0.75;
    }
    .wearon-widget__button[disabled] {
      cursor: wait;
      opacity: 0.75;
    }
    .wearon-widget__badge {
      color: #667085;
      font-size: 12px;
      line-height: 1.3;
    }
    .wearon-widget__camera {
      display: none;
      width: 100%;
      border-radius: 12px;
      border: 1px solid #d0d5dd;
      background: #0b1220;
      min-height: 200px;
    }
    .wearon-widget__camera--active {
      display: block;
    }
    .wearon-widget__pose-overlay {
      display: none;
      border: 2px dashed #98a2b3;
      border-radius: 14px;
      padding: 10px;
      color: #475467;
      font-size: 12px;
      line-height: 1.4;
      text-align: center;
    }
    .wearon-widget__pose-overlay--active {
      display: block;
    }
    .wearon-widget__capture {
      display: none;
      border: 0;
      border-radius: 10px;
      background: #0069ff;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 14px;
      cursor: pointer;
    }
    .wearon-widget__capture--active {
      display: block;
    }
  `

  const container = doc.createElement('section')
  container.className = 'wearon-widget'
  container.setAttribute('data-widget', 'wearon-tryon')

  const privacyText = doc.createElement('p')
  privacyText.className = 'wearon-widget__privacy'
  privacyText.textContent = PRIVACY_MESSAGE

  const privacyButton = doc.createElement('button')
  privacyButton.type = 'button'
  privacyButton.className = 'wearon-widget__privacy-ack'
  privacyButton.textContent = 'I Understand'

  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'wearon-widget__button'
  button.textContent = options.buttonText || DEFAULT_BUTTON_TEXT
  button.disabled = true

  const badge = doc.createElement('footer')
  badge.className = 'wearon-widget__badge'
  badge.textContent = 'Powered by WearOn'

  const cameraView = doc.createElement('video')
  cameraView.className = 'wearon-widget__camera'
  cameraView.setAttribute('autoplay', '')
  cameraView.setAttribute('playsinline', '')

  const overlay = createPoseOverlay(doc)
  const captureButton = doc.createElement('button')
  captureButton.type = 'button'
  captureButton.className = 'wearon-widget__capture'
  captureButton.textContent = 'Capture Photo'

  let latestCapturedPhoto = null

  const setLoading = (isLoading) => {
    button.disabled = Boolean(isLoading)
    button.textContent = isLoading
      ? options.loadingText || DEFAULT_LOADING_TEXT
      : options.buttonText || DEFAULT_BUTTON_TEXT
  }

  const showCameraUI = () => {
    cameraView.className = 'wearon-widget__camera wearon-widget__camera--active'
    overlay.className = 'wearon-widget__pose-overlay wearon-widget__pose-overlay--active'
    captureButton.className = 'wearon-widget__capture wearon-widget__capture--active'
  }

  const hideCameraUI = () => {
    cameraView.className = 'wearon-widget__camera'
    overlay.className = 'wearon-widget__pose-overlay'
    captureButton.className = 'wearon-widget__capture'
  }

  const acknowledgePrivacy = () => {
    button.disabled = false
    privacyButton.disabled = true
    privacyButton.textContent = 'Acknowledged'
  }

  privacyButton.addEventListener('click', acknowledgePrivacy)

  const startCamera = async () => {
    const stream = await getUserCameraFn(options.mediaDevicesRef)
    cameraView.srcObject = stream
    showCameraUI()
    return stream
  }

  button.addEventListener('click', async () => {
    setLoading(true)
    try {
      await startCamera()
    } catch {
      hideCameraUI()
    }
    schedule(() => {
      setLoading(false)
    }, options.loadingDelayMs || DEFAULT_LOADING_DELAY_MS)
  })

  captureButton.addEventListener('click', () => {
    const canvasElement = options.canvasRef || doc.createElement('canvas')
    latestCapturedPhoto = captureFrameFn(cameraView, canvasElement)
    if (typeof options.onCapture === 'function') {
      options.onCapture(latestCapturedPhoto)
    }
  })

  container.appendChild(privacyText)
  container.appendChild(privacyButton)
  container.appendChild(button)
  container.appendChild(cameraView)
  container.appendChild(overlay)
  container.appendChild(captureButton)
  container.appendChild(badge)
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(container)

  return {
    shadowRoot,
    button,
    badge,
    privacyText,
    privacyButton,
    cameraView,
    overlay,
    captureButton,
    setLoading,
    acknowledgePrivacy,
    startCamera,
    getLastCapture() {
      return latestCapturedPhoto
    },
  }
}

export function initTryOnWidgets(root = globalThis.document, options = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return 0
  }

  const hosts = root.querySelectorAll('[data-wearon-tryon]')
  hosts.forEach((hostElement) => {
    createTryOnWidget(hostElement, options)
  })

  return hosts.length
}

function autoInit() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTryOnWidgets(document)
    })
    return
  }

  initTryOnWidgets(document)
}

autoInit()
