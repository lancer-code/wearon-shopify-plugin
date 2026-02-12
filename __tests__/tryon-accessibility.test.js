import { describe, expect, test } from 'vitest'
import { createTryOnWidget } from '../extensions/wearon-tryon/assets/tryon-widget.js'

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName
    this.children = []
    this.className = ''
    this.textContent = ''
    this.disabled = false
    this.type = ''
    this.attributes = {}
    this.listeners = {}
    this.firstChild = null
    this.srcObject = null
    this.videoWidth = 640
    this.videoHeight = 480
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value)
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

  keydown(key) {
    if (this.listeners.keydown) {
      this.listeners.keydown({ key, preventDefault() {} })
    }
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

describe('tryon accessibility', () => {
  function toLinear(channel) {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  function hexToRgb(hex) {
    const input = hex.replace('#', '')
    return {
      r: Number.parseInt(input.slice(0, 2), 16),
      g: Number.parseInt(input.slice(2, 4), 16),
      b: Number.parseInt(input.slice(4, 6), 16),
    }
  }

  function contrastRatio(foreground, background) {
    const fg = hexToRgb(foreground)
    const bg = hexToRgb(background)
    const fgLuminance =
      0.2126 * toLinear(fg.r) + 0.7152 * toLinear(fg.g) + 0.0722 * toLinear(fg.b)
    const bgLuminance =
      0.2126 * toLinear(bg.r) + 0.7152 * toLinear(bg.g) + 0.0722 * toLinear(bg.b)
    const lighter = Math.max(fgLuminance, bgLuminance)
    const darker = Math.min(fgLuminance, bgLuminance)
    return (lighter + 0.05) / (darker + 0.05)
  }

  test('adds ARIA labels and live-region status updates', async () => {
    const widget = createTryOnWidget(createHostElement(), {
      documentRef: createFakeDocument(),
      getUserCameraFn() {
        return Promise.resolve({ id: 'stream-1' })
      },
      captureFrameFn() {
        return 'data:image/jpeg;base64,ok'
      },
      schedule(callback) {
        callback()
      },
    })

    expect(widget.button.attributes['aria-label']).toBeTruthy()
    expect(widget.privacyButton.attributes['aria-label']).toBeTruthy()
    expect(widget.captureButton.attributes['aria-label']).toBeTruthy()
    expect(widget.liveRegion.attributes['aria-live']).toBe('polite')

    widget.privacyButton.click()
    await widget.button.click()
    expect(widget.liveRegion.textContent.toLowerCase()).toContain('camera')
  })

  test('supports keyboard escape to close overlays', async () => {
    const widget = createTryOnWidget(createHostElement(), {
      documentRef: createFakeDocument(),
      getUserCameraFn() {
        return Promise.resolve({ id: 'stream-1' })
      },
      schedule(callback) {
        callback()
      },
    })

    widget.privacyButton.click()
    await widget.button.click()
    expect(widget.overlay.className).toContain('--active')

    widget.container.keydown('Escape')
    expect(widget.overlay.className).toBe('wearon-widget__pose-overlay')
  })

  test('enforces touch targets, focus indicators, forced-colors, and audio toggle', () => {
    const widget = createTryOnWidget(createHostElement(), {
      documentRef: createFakeDocument(),
    })

    const styleText = widget.styleElement.textContent

    expect(styleText).toContain(':focus-visible')
    expect(styleText).toContain('min-height: 44px')
    expect(styleText).toContain('min-width: 44px')
    expect(styleText).toContain('@media (forced-colors: active)')

    expect(widget.audioToggleButton.attributes['aria-pressed']).toBe('false')
    widget.audioToggleButton.click()
    expect(widget.audioToggleButton.attributes['aria-pressed']).toBe('true')
  })

  test('keeps text contrast at or above WCAG AA 4.5:1', () => {
    const bodyTextContrast = contrastRatio('#344054', '#ffffff')
    const buttonTextContrast = contrastRatio('#101828', '#ffffff')
    const badgeContrast = contrastRatio('#667085', '#ffffff')

    expect(bodyTextContrast).toBeGreaterThanOrEqual(4.5)
    expect(buttonTextContrast).toBeGreaterThanOrEqual(4.5)
    expect(badgeContrast).toBeGreaterThanOrEqual(4.5)
  })
})
