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

  test('bundle is below 50KB gzipped', () => {
    const bundle = readFileSync(widgetBundlePath, 'utf8')
    const size = gzipSync(bundle).byteLength

    expect(size).toBeLessThan(50 * 1024)
  })

  test('bundle transfer estimate stays below 2s on constrained 3G', () => {
    const bundle = readFileSync(widgetBundlePath, 'utf8')
    const gzippedBytes = gzipSync(bundle).byteLength
    const constrained3GBitsPerSecond = 400 * 1024
    const estimatedSeconds = (gzippedBytes * 8) / constrained3GBitsPerSecond

    expect(estimatedSeconds).toBeLessThan(2)
  })
})
