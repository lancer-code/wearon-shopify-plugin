import { describe, expect, test } from 'vitest'
import {
  CONFIDENCE_THRESHOLD,
  createSizeRecDisplay,
  getSizeRecPresentation,
  SIZE_REC_DISCLAIMER,
} from '../extensions/wearon-tryon/assets/size-rec-display.js'

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

describe('size rec display (plugin)', () => {
  test('high confidence uses definitive recommendation', () => {
    const result = getSizeRecPresentation({
      recommendedSize: 'M',
      confidence: 0.8,
      sizeRange: { lower: 'M', upper: 'L' },
    })

    expect(CONFIDENCE_THRESHOLD).toBe(0.8)
    expect(result.primaryText).toBe('Recommended: M')
    expect(result.secondaryText).toBeNull()
  })

  test('low confidence uses range + confidence percent', () => {
    const result = getSizeRecPresentation({
      recommendedSize: 'M',
      confidence: 0.72,
      sizeRange: { lower: 'M', upper: 'L' },
    })

    expect(result.primaryText).toBe('Between M and L')
    expect(result.secondaryText).toBe('Confidence: 72%')
  })

  test('disclaimer is always present', () => {
    const display = createSizeRecDisplay({
      recommendedSize: 'L',
      confidence: 0.92,
    })

    expect(display.disclaimer).toBe(SIZE_REC_DISCLAIMER)
  })

  test('mobile-first touch targets are at least 44x44', () => {
    const display = createSizeRecDisplay({
      recommendedSize: 'L',
      confidence: 0.92,
    })

    expect(display.touchTarget.minWidth).toBeGreaterThanOrEqual(44)
    expect(display.touchTarget.minHeight).toBeGreaterThanOrEqual(44)
  })

  test('disclaimer color contrast meets 4.5:1', () => {
    const display = createSizeRecDisplay({
      recommendedSize: 'M',
      confidence: 0.75,
    })

    const ratio = contrastRatio(display.colors.disclaimerText, display.colors.background)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})
