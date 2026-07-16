import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const processes = [
  ['assistant', ['run', 'assistant']],
  ['vite', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5176']],
]

const children = processes.map(([name, args]) => {
  const child = spawn(npmCommand, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] stopped by ${signal}`)
      return
    }
    console.log(`[${name}] exited with code ${code}`)
  })

  return child
})

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

process.on('SIGINT', () => {
  stopAll()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopAll()
  process.exit(0)
})
