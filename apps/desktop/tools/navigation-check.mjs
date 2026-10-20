// Isolated Electron check for the chat window's navigation guard: a temp userData, local pages, and
// shell.openExternal stubbed to record calls. It never starts the host, updater, login or service
// install. Not part of `npm test`: it needs the Electron binary from `npm ci` and a desktop session.
//   node tools/navigation-check.mjs        (exit 0 = every check passed)
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const desktop = join(here, '..')
const work = mkdtempSync(join(tmpdir(), 'codync-nav-'))

try {
  await build({
    entryPoints: [join(desktop, 'src/main/navigation-guard.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    outfile: join(work, 'guard.cjs'),
  })
  cpSync(join(here, 'navigation-check'), work, { recursive: true })
  // The electron package exports the path to its binary when required from Node.
  const electronBinary = createRequire(import.meta.url)('electron')
  const run = spawnSync(electronBinary, ['--disable-gpu', join(work, 'main.cjs')], { stdio: 'inherit', timeout: 120_000 })
  process.exitCode = run.status ?? 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
