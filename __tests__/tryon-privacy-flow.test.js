import { describe, expect, test } from 'vitest'
import {
  acknowledgePrivacy,
  capturePhoto,
  createTryOnExperienceState,
  createPoseOverlay,
  getStoreConfig,
  getUserCamera,
  isAcknowledged,
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
    expect(shouldRequireLogin({ billingMode: 'absorb' })).toBe(false)
    expect(shouldRequireLogin({ billingMode: 'resell' })).toBe(true)
  })

  test('reads billing_mode from API config endpoint and resolves access mode', async () => {
    const apiClient = {
      get() {
        return Promise.resolve({ data: { data: { billing_mode: 'absorb' } } })
      },
    }

    const config = await getStoreConfig(apiClient)
    const access = await resolveTryOnAccess(apiClient)

    expect(config.billingMode).toBe('absorb')
    expect(access.billingMode).toBe('absorb')
    expect(access.requireLogin).toBe(false)
  })
})
