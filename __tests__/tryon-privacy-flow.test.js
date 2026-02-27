import { describe, expect, test } from 'vitest'
import {
  acknowledgePrivacy,
  buildCreditCartLink,
  capturePhoto,
  createTryOnExperienceState,
  createPoseOverlay,
  getStoreConfig,
  getRetailCreditPriceLabel,
  getShopperCreditBalance,
  getUserCamera,
  isAcknowledged,
  openCreditCheckout,
  pollShopperCreditBalance,
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

  test('reads billing_mode and retail_credit_price from v1 config endpoint by default', async () => {
    const endpoints = []
    const apiClient = {
      get(endpoint) {
        endpoints.push(endpoint)
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
    expect(endpoints).toEqual(['/api/v1/stores/config', '/api/v1/stores/config'])
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

  test('reads shopper balance payload from v1 endpoint by default', async () => {
    const endpoints = []
    const apiClient = {
      get(endpoint) {
        endpoints.push(endpoint)
        return Promise.resolve({
          data: {
            data: {
              balance: 2,
              total_purchased: 5,
              total_spent: 3,
            },
          },
        })
      },
    }

    const balance = await getShopperCreditBalance(apiClient)
    expect(balance).toEqual({
      balance: 2,
      totalPurchased: 5,
      totalSpent: 3,
    })
    expect(endpoints).toEqual(['/api/v1/credits/shopper'])
  })

  test('supports both current and legacy shopper balance payload keys', async () => {
    let callCount = 0
    const apiClient = {
      get() {
        callCount += 1
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              data: {
                balance: 4,
                total_added: 6,
                total_used: 2,
              },
            },
          })
        }

        return Promise.resolve({
          data: {
            data: {
              balance: 1,
              total_purchased: 3,
              total_spent: 2,
            },
          },
        })
      },
    }

    const v1Balance = await getShopperCreditBalance(apiClient)
    const legacyBalance = await getShopperCreditBalance(apiClient)

    expect(v1Balance).toEqual({
      balance: 4,
      totalPurchased: 6,
      totalSpent: 2,
    })
    expect(legacyBalance).toEqual({
      balance: 1,
      totalPurchased: 3,
      totalSpent: 2,
    })
  })

  test('polls shopper balance every interval until credits appear', async () => {
    let callCount = 0
    const apiClient = {
      get() {
        callCount += 1
        if (callCount < 3) {
          return Promise.resolve({
            data: {
              data: {
                balance: 0,
                total_purchased: 0,
                total_spent: 0,
              },
            },
          })
        }

        return Promise.resolve({
          data: {
            data: {
              balance: 2,
              total_purchased: 2,
              total_spent: 0,
            },
          },
        })
      },
    }

    const delays = []
    const result = await pollShopperCreditBalance(apiClient, {
      waitFn(delayMs) {
        delays.push(delayMs)
        return Promise.resolve()
      },
      intervalMs: 5000,
      timeoutMs: 60000,
    })

    expect(result.balance).toBe(2)
    expect(callCount).toBe(3)
    expect(delays).toEqual([5000, 5000])
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
