import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { createTryOnWidget, initTryOnWidgets } from '../extensions/wearon-tryon/assets/tryon-widget.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const widgetBundlePath = path.resolve(
  currentDir,
  '../extensions/wearon-tryon/assets/tryon-widget.js',
)
const tryOnBlockPath = path.resolve(
  currentDir,
  '../extensions/wearon-tryon/blocks/tryon-block.liquid',
)

function collectBundleModules(entryPath, visited = new Set()) {
  const absolutePath = path.resolve(entryPath)
  if (visited.has(absolutePath)) {
    return []
  }
  visited.add(absolutePath)

  const source = readFileSync(absolutePath, 'utf8')
  const modules = [{ filePath: absolutePath, source }]
  const importRegex = /import\s+(?:[^'"]+from\s+)?['"](.+?)['"]/g
  let match = importRegex.exec(source)

  while (match) {
    const specifier = match[1]
    if (specifier && specifier.startsWith('.')) {
      modules.push(
        ...collectBundleModules(path.resolve(path.dirname(absolutePath), specifier), visited),
      )
    }
    match = importRegex.exec(source)
  }

  return modules
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName
    this.children = []
    this.className = ''
    this.textContent = ''
    this.srcObject = null
    this.videoWidth = 640
    this.videoHeight = 480
    this.disabled = false
    this.type = ''
    this.attributes = {}
    this.listeners = {}
    this.firstChild = null
  }

  setAttribute(name, value) {
    this.attributes[name] = value
  }

  appendChild(child) {
    this.children.push(child)
    this.firstChild = this.children[0] || null
    return child
  }

  removeChild(child) {
    this.children = this.children.filter((item) => item !== child)
    this.firstChild = this.children[0] || null
    return child
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback
  }

  click() {
    if (this.listeners.click) {
      return this.listeners.click()
    }
    return undefined
  }
}

function createFakeDocument() {
  return {
    createElement(tagName) {
      return new FakeElement(tagName)
    },
  }
}

function createHostElement() {
  return {
    shadowRoot: null,
    attachShadow() {
      this.shadowRoot = new FakeElement('shadow-root')
      return this.shadowRoot
    },
  }
}

function createSessionStorageMock(initial = {}) {
  const storage = new Map(Object.entries(initial))

  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null
    },
    setItem(key, value) {
      storage.set(key, String(value))
    },
  }
}

function findText(node, targetText) {
  if (!node) {
    return false
  }

  if (node.textContent === targetText) {
    return true
  }

  if (!node.children || node.children.length === 0) {
    return false
  }

  return node.children.some((child) => findText(child, targetText))
}

describe('tryon widget', () => {
  test('theme block loads widget using module script tag', () => {
    const blockTemplate = readFileSync(tryOnBlockPath, 'utf8')
    expect(blockTemplate).toContain('<script type="module"')
    expect(blockTemplate).toContain("{{ 'tryon-widget.js' | asset_url }}")
  })

  test('renders inside shadow DOM', () => {
    const hostElement = createHostElement()
    const documentRef = createFakeDocument()

    const widget = createTryOnWidget(hostElement, { documentRef })

    expect(widget.shadowRoot).toBeTruthy()
    expect(widget.shadowRoot.children).toHaveLength(2)
  })

  test('shows privacy gate, opens camera with overlay, and captures photo', async () => {
    const hostElement = createHostElement()
    const documentRef = createFakeDocument()
    let scheduledCallback = null
    let capturedPhoto = null

    const widget = createTryOnWidget(hostElement, {
      documentRef,
      getUserCameraFn() {
        return Promise.resolve({ id: 'stream-1' })
      },
      captureFrameFn() {
        return 'data:image/jpeg;base64,captured'
      },
      onCapture(photoData) {
        capturedPhoto = photoData
      },
      schedule(callback) {
        scheduledCallback = callback
      },
    })

    expect(findText(widget.shadowRoot, 'Powered by WearOn')).toBe(true)
    expect(findText(widget.shadowRoot, 'Your photo is deleted within 6 hours')).toBe(true)
    expect(widget.button.textContent).toBe('Try On')
    expect(widget.button.disabled).toBe(true)

    widget.privacyButton.click()
    expect(widget.button.disabled).toBe(false)

    await widget.button.click()
    expect(widget.button.textContent).toBe('Loading...')
    expect(widget.cameraView.srcObject).toEqual({ id: 'stream-1' })
    expect(widget.overlay.className).toContain('wearon-widget__pose-overlay--active')
    expect(widget.captureButton.className).toContain('wearon-widget__capture--active')

    widget.captureButton.click()
    expect(capturedPhoto).toBe('data:image/jpeg;base64,captured')

    if (scheduledCallback) {
      scheduledCallback()
    }

    expect(widget.button.textContent).toBe('Try On')
  })

  test('restores privacy acknowledgment from session storage', () => {
    const hostElement = createHostElement()
    const documentRef = createFakeDocument()
    const sessionStorageRef = createSessionStorageMock({
      wearon_privacy_ack_v1: 'true',
    })

    const widget = createTryOnWidget(hostElement, {
      documentRef,
      sessionStorageRef,
    })

    expect(widget.isPrivacyAcknowledged()).toBe(true)
    expect(widget.privacyButton.disabled).toBe(true)
    expect(widget.privacyButton.textContent).toBe('Acknowledged')
    expect(widget.button.disabled).toBe(false)
  })

  test('applies billing-mode access resolution in widget runtime', async () => {
    const hostElement = createHostElement()
    const documentRef = createFakeDocument()

    const widget = createTryOnWidget(hostElement, {
      documentRef,
      sessionStorageRef: createSessionStorageMock(),
      apiClient: { get() {} },
      resolveTryOnAccessFn() {
        return Promise.resolve({
          billingMode: 'resell_mode',
          retailCreditPrice: 0.5,
          requireLogin: true,
          retailCreditPriceLabel: '$0.50 per credit',
        })
      },
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(widget.requiresLogin()).toBe(true)
    expect(widget.button.disabled).toBe(false)
    expect(widget.button.textContent).toBe('Sign In to Try On')
    await widget.button.click()
    expect(widget.liveRegion.textContent).toContain('Please sign in to your store account')
  })

  test('fails closed (requires login) when config API errors (MEDIUM #3 / HIGH #1 fix)', async () => {
    const hostElement = createHostElement()
    const documentRef = createFakeDocument()

    const widget = createTryOnWidget(hostElement, {
      documentRef,
      sessionStorageRef: createSessionStorageMock(),
      apiClient: { get() {} },
      resolveTryOnAccessFn() {
        // Simulate API failure (timeout, 500 error, network down, etc.)
        return Promise.reject(new Error('API timeout'))
      },
    })

    await Promise.resolve()
    await Promise.resolve()

    // HIGH #1 FIX VERIFICATION: Should require login on error (fail closed)
    expect(widget.requiresLogin()).toBe(true)
    expect(widget.button.textContent).toBe('Sign In to Try On')
    expect(widget.liveRegion.textContent).toContain('Unable to load try-on configuration')
  })

  test('in resell mode with zero balance, shows credit top-up flow and enables try-on after polling', async () => {
    const hostElement = createHostElement()
    const documentRef = createFakeDocument()
    const checkoutLinks = []
    const shopperBalanceChecks = []

    const widget = createTryOnWidget(hostElement, {
      documentRef,
      sessionStorageRef: createSessionStorageMock(),
      apiClient: { get() {} },
      resolveTryOnAccessFn() {
        return Promise.resolve({
          billingMode: 'resell_mode',
          retailCreditPrice: 0.5,
          requireLogin: false,
          retailCreditPriceLabel: '$0.50 per credit',
          shopDomain: 'store.myshopify.com',
          shopifyVariantId: '123456789',
        })
      },
      getShopperCreditBalanceFn() {
        shopperBalanceChecks.push('initial')
        return Promise.resolve({
          balance: 0,
          totalPurchased: 0,
          totalSpent: 0,
        })
      },
      openCreditCheckoutFn(link) {
        checkoutLinks.push(link)
        return true
      },
      pollShopperCreditBalanceFn() {
        shopperBalanceChecks.push('poll')
        return Promise.resolve({
          balance: 2,
          totalPurchased: 2,
          totalSpent: 0,
        })
      },
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(widget.purchaseButton.className).toContain('wearon-widget__purchase--active')
    expect(widget.button.disabled).toBe(true)
    expect(widget.button.textContent).toBe('Add Credits to Continue')
    expect(widget.creditBalanceText.textContent).toContain('0 credits')

    await widget.purchaseButton.click()
    await Promise.resolve()

    expect(checkoutLinks).toEqual(['https://store.myshopify.com/cart/123456789:1'])
    expect(shopperBalanceChecks).toEqual(['initial', 'poll'])
    expect(widget.button.textContent).toBe('Try On')
    expect(widget.creditBalanceText.textContent).toContain('2 credits')
    expect(widget.liveRegion.textContent).toContain('Credits updated')

    widget.privacyButton.click()
    expect(widget.button.disabled).toBe(false)
  })

  test('initializes all data-wearon-tryon hosts', () => {
    const hostOne = createHostElement()
    const hostTwo = createHostElement()
    const root = {
      querySelectorAll() {
        return [hostOne, hostTwo]
      },
    }
    const documentRef = createFakeDocument()

    const count = initTryOnWidgets(root, { documentRef })

    expect(count).toBe(2)
    expect(hostOne.shadowRoot).toBeTruthy()
    expect(hostTwo.shadowRoot).toBeTruthy()
  })

  test('bundle graph is below 50KB gzipped (entry + imported modules)', () => {
    const modules = collectBundleModules(widgetBundlePath)
    const combinedBundle = modules.map((mod) => mod.source).join('\n')
    const size = gzipSync(combinedBundle).byteLength

    expect(modules.length).toBeGreaterThan(1)
    expect(size).toBeLessThan(50 * 1024)
  })

  test('3G load budget stays below 2s (transfer + runtime initialization)', () => {
    const modules = collectBundleModules(widgetBundlePath)
    const combinedBundle = modules.map((mod) => mod.source).join('\n')
    const gzippedBytes = gzipSync(combinedBundle).byteLength
    const constrained3GBitsPerSecond = 400 * 1024
    const estimatedTransferMs = ((gzippedBytes * 8) / constrained3GBitsPerSecond) * 1000

    const hosts = [createHostElement(), createHostElement(), createHostElement()]
    const root = {
      querySelectorAll() {
        return hosts
      },
    }
    const documentRef = createFakeDocument()
    const startedAt = performance.now()
    const initializedCount = initTryOnWidgets(root, { documentRef })
    const runtimeInitMs = performance.now() - startedAt

    expect(initializedCount).toBe(3)
    expect(estimatedTransferMs + runtimeInitMs).toBeLessThan(2000)
  })
})
