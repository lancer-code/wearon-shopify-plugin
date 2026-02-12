import {
  acknowledgePrivacy as persistPrivacyAcknowledgment,
  buildCreditCartLink,
  capturePhoto,
  createPoseOverlay,
  getShopperCreditBalance,
  getUserCamera,
  isAcknowledged,
  openCreditCheckout,
  pollShopperCreditBalance,
  resolveTryOnAccess,
} from './tryon-privacy-flow.js'

const DEFAULT_BUTTON_TEXT = 'Try On'
const DEFAULT_SIGN_IN_BUTTON_TEXT = 'Sign In to Try On'
const DEFAULT_LOADING_TEXT = 'Loading...'
const DEFAULT_LOADING_DELAY_MS = 700
const PRIVACY_MESSAGE = 'Your photo is deleted within 6 hours'
const DEFAULT_AUDIO_CUE = 'Center yourself.'
const DEFAULT_SHOPPER_BALANCE_ENDPOINT = '/api/shopper-credits/balance'
const POSE_DIRECTION_CUES = {
  left: 'Move left.',
  right: 'Move right.',
  center: 'Center yourself.',
}

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
  const resolveTryOnAccessFn = options.resolveTryOnAccessFn || resolveTryOnAccess
  const getShopperCreditBalanceFn = options.getShopperCreditBalanceFn || getShopperCreditBalance
  const pollShopperCreditBalanceFn = options.pollShopperCreditBalanceFn || pollShopperCreditBalance
  const openCreditCheckoutFn = options.openCreditCheckoutFn || openCreditCheckout
  const captureFrameFn = options.captureFrameFn || capturePhoto
  const defaultButtonText = options.buttonText || DEFAULT_BUTTON_TEXT
  const signInButtonText = options.signInButtonText || DEFAULT_SIGN_IN_BUTTON_TEXT
  const apiClient = options.apiClient
  const sessionStorageRef = options.sessionStorageRef
  const getPoseHint = options.getPoseHint || (() => 'center')
  const speakGuidance =
    options.speakGuidance ||
    ((message) => {
      if (
        typeof globalThis !== 'undefined' &&
        globalThis.speechSynthesis &&
        typeof globalThis.speechSynthesis.speak === 'function' &&
        typeof globalThis.SpeechSynthesisUtterance === 'function'
      ) {
        globalThis.speechSynthesis.speak(new globalThis.SpeechSynthesisUtterance(message))
      }
    })

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
      min-height: 44px;
      min-width: 44px;
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
      min-height: 44px;
      min-width: 44px;
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
    .wearon-widget__credit-balance {
      margin: 0;
      color: #344054;
      font-size: 13px;
      line-height: 1.4;
    }
    .wearon-widget__purchase {
      display: none;
      border: 0;
      border-radius: 10px;
      background: #0069ff;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      min-height: 44px;
      min-width: 44px;
      padding: 10px 14px;
      cursor: pointer;
    }
    .wearon-widget__purchase--active {
      display: block;
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
      min-height: 44px;
      min-width: 44px;
      padding: 10px 14px;
      cursor: pointer;
    }
    .wearon-widget__capture--active {
      display: block;
    }
    .wearon-widget__audio-toggle {
      border: 1px solid #344054;
      border-radius: 10px;
      background: #ffffff;
      color: #101828;
      font-size: 13px;
      font-weight: 600;
      min-height: 44px;
      min-width: 44px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .wearon-widget__visually-hidden {
      border: 0;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      height: 1px;
      margin: -1px;
      overflow: hidden;
      padding: 0;
      position: absolute;
      width: 1px;
      white-space: nowrap;
    }
    .wearon-widget button:focus-visible {
      outline: 3px solid #0069ff;
      outline-offset: 2px;
    }
    @media (forced-colors: active) {
      .wearon-widget {
        border: 1px solid CanvasText;
      }
      .wearon-widget button {
        forced-color-adjust: none;
        border: 1px solid CanvasText;
        color: CanvasText;
        background: Canvas;
      }
    }
  `

  const container = doc.createElement('section')
  container.className = 'wearon-widget'
  container.setAttribute('data-widget', 'wearon-tryon')
  container.setAttribute('role', 'region')
  container.setAttribute('aria-label', 'WearOn virtual try-on widget')

  const privacyText = doc.createElement('p')
  privacyText.className = 'wearon-widget__privacy'
  privacyText.textContent = PRIVACY_MESSAGE

  const privacyButton = doc.createElement('button')
  privacyButton.type = 'button'
  privacyButton.className = 'wearon-widget__privacy-ack'
  privacyButton.textContent = 'I Understand'
  privacyButton.setAttribute('aria-label', 'Acknowledge privacy notice')

  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'wearon-widget__button'
  button.textContent = defaultButtonText
  button.disabled = true
  button.setAttribute('aria-label', 'Start virtual try-on camera')

  const badge = doc.createElement('footer')
  badge.className = 'wearon-widget__badge'
  badge.textContent = 'Powered by WearOn'

  const creditBalanceText = doc.createElement('p')
  creditBalanceText.className = 'wearon-widget__credit-balance'
  creditBalanceText.textContent = ''

  const purchaseButton = doc.createElement('button')
  purchaseButton.type = 'button'
  purchaseButton.className = 'wearon-widget__purchase'
  purchaseButton.textContent = 'Buy Credits'
  purchaseButton.setAttribute('aria-label', 'Buy try-on credits')

  const cameraView = doc.createElement('video')
  cameraView.className = 'wearon-widget__camera'
  cameraView.setAttribute('autoplay', '')
  cameraView.setAttribute('playsinline', '')
  cameraView.setAttribute('aria-label', 'Live camera preview')

  const overlay = createPoseOverlay(doc)
  overlay.setAttribute('aria-label', 'Pose guidance overlay')
  const captureButton = doc.createElement('button')
  captureButton.type = 'button'
  captureButton.className = 'wearon-widget__capture'
  captureButton.textContent = 'Capture Photo'
  captureButton.setAttribute('aria-label', 'Capture photo')

  let latestCapturedPhoto = null
  let activeStream = null
  let audioGuidanceEnabled = false
  let privacyAcknowledged = isAcknowledged(sessionStorageRef)
  let requireLogin = false
  let billingMode = 'absorb_mode'
  let shopperBalance = 0
  let currentAccess = null

  const liveRegion = doc.createElement('div')
  liveRegion.className = 'wearon-widget__visually-hidden'
  liveRegion.setAttribute('role', 'status')
  liveRegion.setAttribute('aria-live', 'polite')
  liveRegion.setAttribute('aria-atomic', 'true')

  const audioToggleButton = doc.createElement('button')
  audioToggleButton.type = 'button'
  audioToggleButton.className = 'wearon-widget__audio-toggle'
  audioToggleButton.textContent = 'Enable Audio Guidance'
  audioToggleButton.setAttribute('aria-label', 'Toggle audio guidance')
  audioToggleButton.setAttribute('aria-pressed', 'false')

  const setLiveStatus = (message) => {
    liveRegion.textContent = message
  }

  const setTryOnButtonState = () => {
    const hasResellCredits = billingMode !== 'resell_mode' || shopperBalance > 0

    if (requireLogin) {
      button.disabled = false
      button.textContent = signInButtonText
      button.setAttribute('aria-label', 'Sign in required before virtual try-on')
      purchaseButton.className = 'wearon-widget__purchase'
      return
    }

    if (billingMode === 'resell_mode' && !hasResellCredits) {
      button.disabled = true
      button.textContent = 'Buy Credits to Try On'
      button.setAttribute('aria-label', 'Buy credits before virtual try-on')
      purchaseButton.className = 'wearon-widget__purchase wearon-widget__purchase--active'
      return
    }

    button.disabled = !privacyAcknowledged
    button.textContent = defaultButtonText
    button.setAttribute('aria-label', 'Start virtual try-on camera')
    purchaseButton.className = 'wearon-widget__purchase'
  }

  const updateCreditBalanceText = (access) => {
    if (billingMode !== 'resell_mode') {
      creditBalanceText.textContent = ''
      return
    }

    if (requireLogin) {
      creditBalanceText.textContent = access?.retailCreditPriceLabel
        ? `Sign in to use credits. ${access.retailCreditPriceLabel}`
        : 'Sign in to use credits.'
      return
    }

    creditBalanceText.textContent = `You have ${shopperBalance} credits remaining.`
    if (shopperBalance <= 0 && access?.retailCreditPriceLabel) {
      creditBalanceText.textContent = `You have 0 credits. ${access.retailCreditPriceLabel}`
    }
  }

  const setLoading = (isLoading) => {
    if (isLoading) {
      button.disabled = true
      button.textContent = options.loadingText || DEFAULT_LOADING_TEXT
      setLiveStatus('Opening camera.')
      return
    }

    setTryOnButtonState()
  }

  const showCameraUI = () => {
    cameraView.className = 'wearon-widget__camera wearon-widget__camera--active'
    overlay.className = 'wearon-widget__pose-overlay wearon-widget__pose-overlay--active'
    captureButton.className = 'wearon-widget__capture wearon-widget__capture--active'
  }

  const getPoseGuidanceCue = () => {
    const hint = getPoseHint()
    if (hint === 'left' || hint === 'right' || hint === 'center') {
      return POSE_DIRECTION_CUES[hint]
    }
    return DEFAULT_AUDIO_CUE
  }

  const hideCameraUI = () => {
    cameraView.className = 'wearon-widget__camera'
    overlay.className = 'wearon-widget__pose-overlay'
    captureButton.className = 'wearon-widget__capture'
    if (activeStream && typeof activeStream.getTracks === 'function') {
      activeStream.getTracks().forEach((track) => {
        if (track && typeof track.stop === 'function') {
          track.stop()
        }
      })
    }
    activeStream = null
    setLiveStatus('Camera closed.')
  }

  const acknowledgePrivacy = () => {
    persistPrivacyAcknowledgment(sessionStorageRef)
    privacyAcknowledged = true
    privacyButton.disabled = true
    privacyButton.textContent = 'Acknowledged'
    setTryOnButtonState()
    setLiveStatus('Privacy notice acknowledged. You can now open the camera.')
  }

  privacyButton.addEventListener('click', acknowledgePrivacy)

  if (privacyAcknowledged) {
    privacyButton.disabled = true
    privacyButton.textContent = 'Acknowledged'
  }

  const refreshShopperBalance = async () => {
    if (!apiClient || billingMode !== 'resell_mode') {
      return
    }

    const shopperCredits = await getShopperCreditBalanceFn(
      apiClient,
      options.shopperBalanceEndpoint || DEFAULT_SHOPPER_BALANCE_ENDPOINT,
    )
    requireLogin = false
    shopperBalance = Number(shopperCredits.balance || 0)
    updateCreditBalanceText(currentAccess)
    setTryOnButtonState()
  }

  const applyAccess = (access) => {
    currentAccess = access || null
    requireLogin = Boolean(access?.requireLogin)
    billingMode = access?.billingMode === 'resell_mode' ? 'resell_mode' : 'absorb_mode'

    if (requireLogin) {
      if (access?.retailCreditPriceLabel) {
        setLiveStatus(`Sign in required before try-on. ${access.retailCreditPriceLabel}`)
      } else {
        setLiveStatus('Sign in required before try-on.')
      }
    } else if (access?.billingMode === 'absorb_mode') {
      setLiveStatus('Try-on ready with zero-friction access.')
    } else if (access?.billingMode === 'resell_mode') {
      setLiveStatus('Checking shopper credit balance.')
    }

    updateCreditBalanceText(access)
    setTryOnButtonState()
  }

  const initializeAccessMode = async () => {
    if (!apiClient) {
      setTryOnButtonState()
      return
    }

    try {
      const access = await resolveTryOnAccessFn(apiClient, options.configEndpoint)
      applyAccess(access)
      if (access?.billingMode === 'resell_mode') {
        try {
          await refreshShopperBalance()
          setLiveStatus('Shopper credits loaded.')
        } catch {
          requireLogin = true
          updateCreditBalanceText(access)
          setTryOnButtonState()
          setLiveStatus('Sign in required before try-on.')
        }
      }
    } catch {
      requireLogin = false
      setTryOnButtonState()
    }
  }

  void initializeAccessMode()

  audioToggleButton.addEventListener('click', () => {
    audioGuidanceEnabled = !audioGuidanceEnabled
    audioToggleButton.setAttribute('aria-pressed', audioGuidanceEnabled ? 'true' : 'false')
    audioToggleButton.textContent = audioGuidanceEnabled
      ? 'Disable Audio Guidance'
      : 'Enable Audio Guidance'
    setLiveStatus(audioGuidanceEnabled ? 'Audio guidance enabled.' : 'Audio guidance disabled.')
  })

  const startCamera = async () => {
    const stream = await getUserCameraFn(options.mediaDevicesRef)
    activeStream = stream
    cameraView.srcObject = stream
    showCameraUI()
    setLiveStatus('Camera ready. Align yourself inside the guide.')
    if (audioGuidanceEnabled) {
      speakGuidance(getPoseGuidanceCue())
    }
    return stream
  }

  button.addEventListener('click', async () => {
    if (requireLogin) {
      setLiveStatus('Please sign in to your store account to continue.')
      return
    }
    if (!privacyAcknowledged) {
      setLiveStatus('Please acknowledge privacy notice before opening camera.')
      return
    }

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

  purchaseButton.addEventListener('click', async () => {
    const cartLink = buildCreditCartLink({
      shopDomain: currentAccess?.shopDomain,
      shopifyVariantId: currentAccess?.shopifyVariantId,
      quantity: 1,
    })

    if (!cartLink) {
      setLiveStatus('Unable to start checkout. Store credit product is not configured.')
      return
    }

    const opened = openCreditCheckoutFn(cartLink, options.windowRef)
    if (!opened) {
      setLiveStatus('Unable to open checkout. Please allow popups and try again.')
      return
    }

    setLiveStatus('Checkout opened. Checking for updated credits.')

    try {
      const latestBalance = await pollShopperCreditBalanceFn(apiClient, {
        endpoint: options.shopperBalanceEndpoint || DEFAULT_SHOPPER_BALANCE_ENDPOINT,
        intervalMs: 5000,
        timeoutMs: 60000,
      })

      shopperBalance = Number(latestBalance.balance || 0)
      updateCreditBalanceText(currentAccess)
      setTryOnButtonState()

      if (shopperBalance > 0) {
        setLiveStatus('Credits updated. You can now continue with try-on.')
      } else {
        setLiveStatus('Still waiting for credits. Please refresh shortly.')
      }
    } catch {
      setLiveStatus('Unable to refresh credits right now. Please try again.')
    }
  })

  captureButton.addEventListener('click', () => {
    const canvasElement = options.canvasRef || doc.createElement('canvas')
    latestCapturedPhoto = captureFrameFn(cameraView, canvasElement)
    setLiveStatus('Photo captured. Generation request submitted.')
    if (audioGuidanceEnabled) {
      speakGuidance('Photo captured. Generation in progress.')
    }
    if (typeof options.onCapture === 'function') {
      options.onCapture(latestCapturedPhoto)
    }
  })

  container.addEventListener('keydown', (event) => {
    if (!event || event.key !== 'Escape') {
      return
    }
    if (typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
    hideCameraUI()
  })

  container.appendChild(privacyText)
  container.appendChild(privacyButton)
  container.appendChild(audioToggleButton)
  container.appendChild(button)
  container.appendChild(creditBalanceText)
  container.appendChild(purchaseButton)
  container.appendChild(cameraView)
  container.appendChild(overlay)
  container.appendChild(captureButton)
  container.appendChild(badge)
  container.appendChild(liveRegion)
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(container)

  const announceGenerationStatus = (statusMessage) => {
    if (!statusMessage || typeof statusMessage !== 'string') {
      return
    }
    setLiveStatus(`Generation ${statusMessage}.`)
  }

  return {
    shadowRoot,
    container,
    styleElement: style,
    button,
    badge,
    privacyText,
    privacyButton,
    audioToggleButton,
    creditBalanceText,
    purchaseButton,
    liveRegion,
    cameraView,
    overlay,
    captureButton,
    setLoading,
    setLiveStatus,
    acknowledgePrivacy,
    startCamera,
    announceGenerationStatus,
    getLastCapture() {
      return latestCapturedPhoto
    },
    isPrivacyAcknowledged() {
      return privacyAcknowledged
    },
    requiresLogin() {
      return requireLogin
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
