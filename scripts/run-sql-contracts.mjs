import { readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const contractsDirectory = resolve('tests/sql')
const contracts = readdirSync(contractsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()

if (!contracts.length) throw new Error('No SQL contracts were found.')

for (const contract of contracts) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_pet-seen',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    {
      encoding: 'utf8',
      input: readFileSync(resolve(contractsDirectory, contract)),
    },
  )
  if (result.status === 0) {
    console.log(`PASS ${contract}`)
    continue
  }
  process.stderr.write(result.stderr || result.stdout)
  throw new Error(`SQL contract failed: ${contract}`)
}
