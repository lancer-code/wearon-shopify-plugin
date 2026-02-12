export const CONFIDENCE_THRESHOLD = 0.8
export const SIZE_REC_DISCLAIMER =
  'This is a suggestion based on your measurements, not a guarantee'

const FALLBACK_RANGE = {
  lower: 'M',
  upper: 'L',
}

export function getSizeRecPresentation({ recommendedSize, confidence, sizeRange }) {
  const normalizedConfidence = Math.max(0, Math.min(1, Number(confidence ?? 0)))
  const normalizedSizeRange = sizeRange || FALLBACK_RANGE

  if (normalizedConfidence >= CONFIDENCE_THRESHOLD) {
    return {
      primaryText: `Recommended: ${recommendedSize}`,
      secondaryText: null,
      confidencePercent: Math.round(normalizedConfidence * 100),
      disclaimer: SIZE_REC_DISCLAIMER,
      isDefinitive: true,
    }
  }

  return {
    primaryText: `Between ${normalizedSizeRange.lower} and ${normalizedSizeRange.upper}`,
    secondaryText: `Confidence: ${Math.round(normalizedConfidence * 100)}%`,
    confidencePercent: Math.round(normalizedConfidence * 100),
    disclaimer: SIZE_REC_DISCLAIMER,
    isDefinitive: false,
  }
}

export function createSizeRecDisplay(input) {
  const presentation = getSizeRecPresentation(input)

  return {
    ...presentation,
    touchTarget: {
      minWidth: 44,
      minHeight: 44,
    },
    colors: {
      recommendationText: '#101828',
      confidenceText: '#344054',
      disclaimerText: '#344054',
      background: '#ffffff',
    },
  }
}
