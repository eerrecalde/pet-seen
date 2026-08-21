import { describe, expect, it } from 'vitest'
import { scoreAttributeEvidence } from './pet-matching'

const cases = [
  [
    'No descriptive evidence',
    {},
    { breedPoints: 0, colourPoints: 0, score: 85, reasons: [] },
  ],
  [
    'Breed ignores case, spaces and hyphens',
    { reportBreed: ' Jack-Russell ', caseBreed: 'jack russell' },
    {
      breedPoints: 10,
      colourPoints: 0,
      score: 95,
      reasons: ['Matching breed'],
    },
  ],
  [
    'Breed exact after punctuation removal',
    { reportBreed: 'Maine.Coon', caseBreed: 'maine coon' },
    {
      breedPoints: 10,
      colourPoints: 0,
      score: 95,
      reasons: ['Matching breed'],
    },
  ],
  [
    'Specific breed partial',
    { reportBreed: 'British Shorthair cat', caseBreed: 'British Shorthair' },
    { breedPoints: 5, colourPoints: 0, score: 90, reasons: ['Similar breed'] },
  ],
  [
    'Generic breed partial is blocked',
    { reportBreed: 'Terrier', caseBreed: 'Jack Russell terrier' },
    { breedPoints: 0, colourPoints: 0, score: 85, reasons: [] },
  ],
  [
    'Unknown, Mixed and Other are not breed evidence',
    { reportBreed: 'Unknown', caseBreed: 'unknown' },
    { breedPoints: 0, colourPoints: 0, score: 85, reasons: [] },
  ],
  [
    'Exact markings ignore order and punctuation',
    { reportColour: 'black-and-white', caseColour: ' White, black ' },
    {
      breedPoints: 0,
      colourPoints: 5,
      score: 90,
      reasons: ['Matching markings'],
    },
  ],
  [
    'Gray and grey are the same marking',
    { reportColour: 'grey and white', caseColour: 'gray white' },
    {
      breedPoints: 0,
      colourPoints: 5,
      score: 90,
      reasons: ['Matching markings'],
    },
  ],
  [
    'Partial markings receive reduced credit',
    { reportColour: 'black', caseColour: 'black and white' },
    {
      breedPoints: 0,
      colourPoints: 2,
      score: 87,
      reasons: ['Similar markings'],
    },
  ],
  [
    'Unrelated markings receive no credit',
    { reportColour: 'ginger', caseColour: 'black and white' },
    { breedPoints: 0, colourPoints: 0, score: 85, reasons: [] },
  ],
  [
    'Strong positive combines full evidence',
    {
      reportBreed: 'Maine-Coon',
      caseBreed: 'maine coon',
      reportColour: 'black and white',
      caseColour: 'White, black',
    },
    {
      breedPoints: 10,
      colourPoints: 5,
      score: 100,
      reasons: ['Matching breed', 'Matching markings'],
    },
  ],
  [
    'Likely positive with partial evidence',
    {
      reportBreed: 'British Shorthair cat',
      caseBreed: 'British Shorthair',
      reportColour: 'grey',
      caseColour: 'gray and white',
    },
    {
      breedPoints: 5,
      colourPoints: 2,
      score: 92,
      reasons: ['Similar breed', 'Similar markings'],
    },
  ],
] as const

describe('PS-413 attribute scoring', () => {
  it.each(cases)('%s', (_name, input, expected) => {
    expect(scoreAttributeEvidence(input)).toEqual(expected)
  })
})
