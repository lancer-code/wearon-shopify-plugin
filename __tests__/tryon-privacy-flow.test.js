import { describe, expect, test } from 'vitest'
import {
  acknowledgePrivacy,
  buildCreditCartLink,
  capturePhoto,
  createTryOnExperienceState,
  createPoseOverlay,
  getStoreConfig,
  getRetailCreditPriceLabel,
  getUserCamera,
  isAcknowledged,
  openCreditCheckout,
  resolveTryOnAccess,
  shouldRequireLogin,
} from '../extensions/wearon-tryon/assets/tryon-privacy-flow.js'

describe('tryon privacy flow', () => {
  test('blocks camera until privacy disclosure acknowledged', () => {
    const storage = new Map()
    const state = createTryOnExperienceState({
      sessionStorageRef: {
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null
        },
        setItem(key, value) {
          storage.set(key, value)
        },
      },
    })

    expect(state.canOpenCamera()).toBe(false)

    state.acknowledgePrivacy()
    expect(state.canOpenCamera()).toBe(true)
    expect(isAcknowledged(state.sessionStorageRef)).toBe(true)
  })

  test('acknowledgment helper persists per session key', () => {
    const storage = new Map()
    const sessionStorageRef = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null
      },
      setItem(key, value) {
        storage.set(key, value)
      },
    }

    expect(isAcknowledged(sessionStorageRef)).toBe(false)
    expect(acknowledgePrivacy(sessionStorageRef)).toBe(true)
    expect(isAcknowledged(sessionStorageRef)).toBe(true)
  })

  test('camera helper delegates to getUserMedia', async () => {
    const stream = { id: 'stream-1' }
    const result = await getUserCamera({
      getUserMedia() {
        return Promise.resolve(stream)
      },
    })

    expect(result).toBe(stream)
  })

  test('pose overlay creates alignment hint content', () => {
    const overlay = createPoseOverlay({
      createElement() {
        return { className: '', textContent: '' }
      },
    })

    expect(overlay.className).toBe('wearon-widget__pose-overlay')
    expect(overlay.textContent).toContain('Align your face and shoulders')
  })

  test('capture photo draws frame and returns jpeg data url', () => {
    const drawCalls = []
    const canvas = {
      width: 0,
      height: 0,
      getContext() {
        return {
          drawImage(...args) {
            drawCalls.push(args)
          },
        }
      },
      toDataURL() {
        return 'data:image/jpeg;base64,abc123'
      },
    }
    const video = { videoWidth: 640, videoHeight: 480 }

    const result = capturePhoto(video, canvas)

    expect(result).toBe('data:image/jpeg;base64,abc123')
    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)
    expect(drawCalls).toHaveLength(1)
  })

  test('absorb mode skips login requirement', () => {
    expect(shouldRequireLogin({ billingMode: 'absorb_mode' })).toBe(false)
    expect(shouldRequireLogin({ billingMode: 'resell_mode' })).toBe(true)
  })

  test('reads billing_mode and retail_credit_price from API config endpoint', async () => {
    const apiClient = {
      get() {
        return Promise.resolve({
          data: {
            data: {
              billing_mode: 'resell_mode',
              retail_credit_price: 0.5,
              shop_domain: 'store.myshopify.com',
              shopify_variant_id: '123456789',
            },
          },
        })
      },
    }

    const config = await getStoreConfig(apiClient)
    const access = await resolveTryOnAccess(apiClient)

    expect(config.billingMode).toBe('resell_mode')
    expect(config.retailCreditPrice).toBe(0.5)
    expect(access.billingMode).toBe('resell_mode')
    expect(access.retailCreditPrice).toBe(0.5)
    expect(access.shopDomain).toBe('store.myshopify.com')
    expect(access.shopifyVariantId).toBe('123456789')
    expect(access.requireLogin).toBe(true)
    expect(access.retailCreditPriceLabel).toBe('$0.50 per credit')
  })

  test('builds direct cart link from shop domain and variant id', () => {
    expect(
      buildCreditCartLink({
        shopDomain: 'https://store.myshopify.com/',
        shopifyVariantId: '987654321',
        quantity: 3,
      }),
    ).toBe('https://store.myshopify.com/cart/987654321:3')
  })

  test('opens Shopify checkout cart link in a new tab', () => {
    const opened = []
    const didOpen = openCreditCheckout('https://store.myshopify.com/cart/123:1', {
      open(...args) {
        opened.push(args)
      },
    })

    expect(didOpen).toBe(true)
    expect(opened).toEqual([['https://store.myshopify.com/cart/123:1', '_blank', 'noopener,noreferrer']])
  })

  test('builds shopper-friendly retail price label for resell mode', () => {
    expect(
      getRetailCreditPriceLabel({
        billingMode: 'resell_mode',
        retailCreditPrice: 1.25,
      }),
    ).toBe('$1.25 per credit')

    expect(
      getRetailCreditPriceLabel({
        billingMode: 'absorb_mode',
        retailCreditPrice: 1.25,
      }),
    ).toBeNull()
  })
})
