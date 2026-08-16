const nonSpecificValues = new Set(['unknown', 'mixed', 'other'])
const genericBreedValues = new Set(['unknown', 'mixed', 'other', 'crossbreed', 'mongrel', 'terrier', 'spaniel', 'shepherd', 'retriever', 'poodle', 'hound', 'shorthair', 'longhair', 'domesticshort', 'domesticlong'])
const ignoredColourTokens = new Set(['a', 'an', 'and', 'or', 'the', 'with', 'unknown', 'mixed', 'other'])

export function canonicalBreed(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const canonical = value.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  return canonical && !nonSpecificValues.has(canonical) ? canonical : null
}

export function colourTokens(value: string | null | undefined) {
  if (typeof value !== 'string') return []
  return [...new Set(value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).map((token) => token === 'grey' ? 'gray' : token).filter((token) => token && !ignoredColourTokens.has(token)))].sort()
}

export function hasSafePartialBreedMatch(left: string | null | undefined, right: string | null | undefined) {
  const [leftValue, rightValue] = [canonicalBreed(left), canonicalBreed(right)]
  if (!leftValue || !rightValue) return false
  const [shorter, longer] = leftValue.length <= rightValue.length ? [leftValue, rightValue] : [rightValue, leftValue]
  return shorter.length >= 8 && !genericBreedValues.has(shorter) && longer.includes(shorter)
}

export function scoreAttributeEvidence({ reportBreed, caseBreed, reportColour, caseColour }: { reportBreed?: string | null, caseBreed?: string | null, reportColour?: string | null, caseColour?: string | null }) {
  const normalizedReportBreed = canonicalBreed(reportBreed)
  const normalizedCaseBreed = canonicalBreed(caseBreed)
  const breedPoints = normalizedReportBreed && normalizedReportBreed === normalizedCaseBreed ? 10 : hasSafePartialBreedMatch(reportBreed, caseBreed) ? 5 : 0
  const reportTokens = colourTokens(reportColour)
  const caseTokens = colourTokens(caseColour)
  const exactColour = reportTokens.length > 0 && reportTokens.join('|') === caseTokens.join('|')
  const partialColour = !exactColour && reportTokens.some((token) => caseTokens.includes(token))
  const colourPoints = exactColour ? 5 : partialColour ? 2 : 0
  return {
    breedPoints,
    colourPoints,
    score: 85 + breedPoints + colourPoints,
    reasons: [breedPoints === 10 ? 'Matching breed' : breedPoints === 5 ? 'Similar breed' : null, colourPoints === 5 ? 'Matching markings' : colourPoints === 2 ? 'Similar markings' : null].filter((reason): reason is string => reason !== null),
  }
}
