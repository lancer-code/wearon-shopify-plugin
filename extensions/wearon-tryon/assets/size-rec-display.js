export const CONFIDENCE_THRESHOLD = 0.8
export const SIZE_REC_DISCLAIMER =
  'This is a suggestion based on your measurements, not a guarantee'

const FALLBACK_RANGE = {
  lower: 'M',
  upper: 'L',
}

// MEDIUM #1 & #3 FIX: Validate size format to prevent XSS and UI issues
const SIZE_FORMAT_REGEX = /^[A-Z0-9]{1,10}$/

function sanitizeSize(size) {
  if (!size || typeof size !== 'string') {
    return null
  }

  const trimmed = size.trim().toUpperCase()

  // Validate against expected format (alphanumeric, max 10 chars)
  if (!SIZE_FORMAT_REGEX.test(trimmed)) {
    return null
  }

  return trimmed
}

export function getSizeRecPresentation({ recommendedSize, confidence, sizeRange }) {
  // LOW #2 FIX: Validate confidence is a number before normalizing
  const confidenceNum = Number(confidence)
  if (!Number.isFinite(confidenceNum)) {
    throw new Error('Invalid confidence value: must be a finite number')
  }

  const normalizedConfidence = Math.max(0, Math.min(1, confidenceNum))

  // MEDIUM #1 & #3 FIX: Sanitize all size values to prevent XSS
  const sanitizedRecommendedSize = sanitizeSize(recommendedSize)
  const sanitizedLower = sanitizeSize(sizeRange?.lower)
  const sanitizedUpper = sanitizeSize(sizeRange?.upper)

  // Guard against partial or invalid sizeRange objects
  const hasValidRange = sanitizedLower && sanitizedUpper
  const normalizedSizeRange = hasValidRange
    ? { lower: sanitizedLower, upper: sanitizedUpper }
    : FALLBACK_RANGE

  if (normalizedConfidence >= CONFIDENCE_THRESHOLD) {
    if (!sanitizedRecommendedSize) {
      throw new Error('Invalid recommendedSize: must be alphanumeric (1-10 chars)')
    }

    return {
      primaryText: `Recommended: ${sanitizedRecommendedSize}`,
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
