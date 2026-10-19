import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const fixturePath = resolve(root, 'scripts/jev-shadow-evaluation.v1.json')
const outputPath = resolve(root, 'tmp/jev-shadow-evaluation.json')
const gateThreshold = 0.2

export function evaluate(cases) {
  const positive = cases.filter((item) => item.label === 'same_pet')
  const gated = cases.filter(
    (item) =>
      item.route === 'incompatible' && item.probability <= gateThreshold,
  )
  const trueNegativeGates = gated.filter(
    (item) => item.label === 'different_pet',
  )
  const falseNegativeGates = gated.filter((item) => item.label === 'same_pet')
  const brier =
    cases.reduce(
      (sum, item) =>
        sum + (item.probability - (item.label === 'same_pet' ? 1 : 0)) ** 2,
      0,
    ) / cases.length
  return {
    cases: cases.length,
    positiveRecall: Number(
      ((positive.length - falseNegativeGates.length) / positive.length).toFixed(
        4,
      ),
    ),
    incompatiblePrecision: Number(
      (trueNegativeGates.length / gated.length).toFixed(4),
    ),
    calibrationBrier: Number(brier.toFixed(4)),
    proposedVisionGate: {
      probabilityAtMost: gateThreshold,
      route: 'incompatible',
      gated: gated.length,
      falseNegatives: falseNegativeGates.length,
    },
  }
}

export async function runEvaluation() {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  const metrics = evaluate(fixture.cases)
  await mkdir(resolve(root, 'tmp'), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify({ version: fixture.version, metrics }, null, 2)}\n`,
  )
  return { metrics, outputPath }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { metrics, outputPath: saved } = await runEvaluation()
  console.table([metrics])
  console.log(`Synthetic shadow evaluation saved to ${saved}`)
}
