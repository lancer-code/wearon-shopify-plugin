const DEFAULT_BUTTON_TEXT = 'Try On'
const DEFAULT_LOADING_TEXT = 'Loading...'
const DEFAULT_LOADING_DELAY_MS = 700

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
    .wearon-widget__button[disabled] {
      cursor: wait;
      opacity: 0.75;
    }
    .wearon-widget__badge {
      color: #667085;
      font-size: 12px;
      line-height: 1.3;
    }
  `

  const container = doc.createElement('section')
  container.className = 'wearon-widget'
  container.setAttribute('data-widget', 'wearon-tryon')

  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'wearon-widget__button'
  button.textContent = options.buttonText || DEFAULT_BUTTON_TEXT

  const badge = doc.createElement('footer')
  badge.className = 'wearon-widget__badge'
  badge.textContent = 'Powered by WearOn'

  const setLoading = (isLoading) => {
    button.disabled = Boolean(isLoading)
    button.textContent = isLoading
      ? options.loadingText || DEFAULT_LOADING_TEXT
      : options.buttonText || DEFAULT_BUTTON_TEXT
  }

  button.addEventListener('click', () => {
    setLoading(true)
    schedule(() => {
      setLoading(false)
    }, options.loadingDelayMs || DEFAULT_LOADING_DELAY_MS)
  })

  container.appendChild(button)
  container.appendChild(badge)
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(container)

  return {
    shadowRoot,
    button,
    badge,
    setLoading,
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
