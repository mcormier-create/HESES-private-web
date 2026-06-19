import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const port = process.env.PORT || process.env.HESES_PORT || '4173'

const child = spawn(process.execPath, [
  viteBin,
  'preview',
  '--config',
  'vite.config.mjs',
  '--host',
  '0.0.0.0',
  '--port',
  port,
], {
  stdio: 'inherit',
  shell: false,
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code || 0)
})
