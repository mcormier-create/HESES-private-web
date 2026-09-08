import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.HESA_TEST_URL || 'http://127.0.0.1:4173/'
const browserCandidates = [
  ['Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
  ['Microsoft Edge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
  ['Microsoft Edge', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'],
]
const modes = [
  { name: '100% Air extérieur', freeCooling: false },
  { name: 'Free Cooling + évaporatif', freeCooling: true },
]
const testedBrowsers = new Set()

for (const [browserName, executablePath] of browserCandidates) {
  if (testedBrowsers.has(browserName) || !await fileExists(executablePath)) continue
  testedBrowsers.add(browserName)

  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const mode of modes) {
      const context = await browser.newContext()
      const page = await context.newPage()
      page.setDefaultTimeout(15_000)
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })

      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'DÉMARRER UNE ANALYSE' }).click()
      if (mode.freeCooling) {
        await page.getByRole('button', { name: mode.name }).click()
      }

      const popupPromise = page.waitForEvent('popup', { timeout: 15_000 })
      await page.getByRole('button', { name: 'Générer rapport PDF' }).click()
      const popup = await popupPromise
      popup.setDefaultTimeout(15_000)
      await popup.waitForLoadState('domcontentloaded')
      const reportText = await popup.locator('body').innerText()
      const isValidReport = popup.url().includes('/heses-report-print')
        && reportText.includes('HESA')
        && reportText.length > 5_000
        && errors.length === 0

      console.log(`${browserName} | ${mode.name} | ${isValidReport ? 'PASS' : 'FAIL'} | ${reportText.length} characters`)
      if (!isValidReport) {
        console.error(`Errors: ${errors.join(' / ') || 'None'}`)
        process.exitCode = 1
      }
      await popup.close()
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

if (!testedBrowsers.size) {
  console.error('Google Chrome and Microsoft Edge were not found.')
  process.exitCode = 1
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}