import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://hesahvac.com'
const TEST_PASSWORD = process.env.HESA_ACCESS_PASSWORD || ''

console.log(`\n🚀 Audit EPW simplifié - ${PRODUCTION_URL}\n`)

let browser
let page

try {
  browser = await chromium.launch({ headless: false, slowMo: 200 })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  page = await context.newPage()

  const networkLogs = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('.epw') || url.includes('weather')) {
      const log = `📡 ${new Date().toISOString().slice(11, 23)} - ${url.split('/').pop()}`
      console.log(log)
      networkLogs.push(log)
    }
  })

  console.log(`1️⃣ Navigation vers ${PRODUCTION_URL}...`)
  await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  
  // Check for password
  await page.waitForTimeout(2000)
  const passwordInput = page.locator('input[type="password"]').first()
  if (await passwordInput.isVisible().catch(() => false)) {
    console.log(`🔐 Prompt de mot de passe détecté`)
    if (TEST_PASSWORD) {
      await passwordInput.fill(TEST_PASSWORD)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(3000)
      console.log(`✅ Authentifié`)
    } else {
      console.log(`⚠️  HESA_ACCESS_PASSWORD non défini - tentative de navigation sans auth`)
    }
  }

  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'audit-step1-loaded.png', fullPage: true })
  console.log(`📸 Capture: audit-step1-loaded.png\n`)

  // Try to find and click hourly mode button
  console.log(`2️⃣ Recherche du mode horaire EPW...`)
  const buttons = await page.locator('button').all()
  console.log(`   Boutons trouvés: ${buttons.length}`)
  
  let hourlyButtonFound = false
  for (let i = 0; i < buttons.length && !hourlyButtonFound; i++) {
    const text = await buttons[i].textContent().catch(() => '')
    if (text.includes('8760') || text.toLowerCase().includes('hourly')) {
      console.log(`   ✅ Bouton trouvé: "${text.trim()}"`)
      await buttons[i].click()
      hourlyButtonFound = true
      await page.waitForTimeout(2000)
      break
    }
  }
  
  if (!hourlyButtonFound) {
    console.log(`   ⚠️  Bouton mode hourly non trouvé parmi ${buttons.length} boutons`)
  }

  await page.screenshot({ path: 'audit-step2-hourly-mode.png', fullPage: true })
  console.log(`📸 Capture: audit-step2-hourly-mode.png\n`)

  // Find and test Montréal
  console.log(`3️⃣ Test MONTRÉAL...\n`)
  const montrealCard = page.locator('div').filter({ hasText: /^Montréal$/ }).first()
  if (await montrealCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`   📍 Carte Montréal trouvée, clic...`)
    const beforeClick = Date.now()
    await montrealCard.click()
    await page.waitForTimeout(4000)
    const afterClick = Date.now()
    console.log(`   ⏱️  Temps écoulé: ${afterClick - beforeClick}ms`)
  } else {
    console.log(`   ❌ Carte Montréal non trouvée`)
  }

  await page.screenshot({ path: 'audit-step3-montreal.png', fullPage: true })
  console.log(`📸 Capture: audit-step3-montreal.png\n`)

  // Change an input
  console.log(`4️⃣ Test: changement de débit...\n`)
  const inputs = await page.locator('input[type="number"]').all()
  console.log(`   Champs numériques trouvés: ${inputs.length}`)
  
  if (inputs.length > 0) {
    const beforeChange = Date.now()
    await inputs[0].scrollIntoViewIfNeeded()
    await inputs[0].click()
    await inputs[0].fill('5000')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(3000)
    const afterChange = Date.now()
    console.log(`   ⏱️  Temps de recalcul: ${afterChange - beforeChange}ms`)
  }

  await page.screenshot({ path: 'audit-step4-input-change.png', fullPage: true })
  console.log(`📸 Capture: audit-step4-input-change.png\n`)

  // Try Ottawa
  console.log(`5️⃣ Test OTTAWA...\n`)
  const ottawaCard = page.locator('div').filter({ hasText: /^Ottawa$/ }).first()
  if (await ottawaCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`   📍 Carte Ottawa trouvée, clic...`)
    const beforeClick = Date.now()
    await ottawaCard.click()
    await page.waitForTimeout(4000)
    const afterClick = Date.now()
    console.log(`   ⏱️  Temps écoulé: ${afterClick - beforeClick}ms`)
  } else {
    console.log(`   ❌ Carte Ottawa non trouvée`)
  }

  await page.screenshot({ path: 'audit-step5-ottawa.png', fullPage: true })
  console.log(`📸 Capture: audit-step5-ottawa.png\n`)

  console.log(`\n` + '='.repeat(60))
  console.log(`📊 RÉSUMÉ`)
  console.log('='.repeat(60))
  console.log(`\nRequêtes réseau EPW capturées: ${networkLogs.length}`)
  networkLogs.forEach(log => console.log(`   ${log}`))
  
  console.log(`\n📁 Captures d'écran sauvegardées:`)
  console.log(`   - audit-step1-loaded.png`)
  console.log(`   - audit-step2-hourly-mode.png`)
  console.log(`   - audit-step3-montreal.png`)
  console.log(`   - audit-step4-input-change.png`)
  console.log(`   - audit-step5-ottawa.png`)
  
  console.log(`\n💡 RECOMMANDATIONS:`)
  console.log(`   1. Vérifier les captures d'écran pour identifier les problèmes d'UI`)
  console.log(`   2. Analyser le nombre de requêtes EPW (devrait être minimal)`)
  console.log(`   3. Si le site nécessite HESA_ACCESS_PASSWORD, définir la variable et relancer`)
  console.log(`\n✅ Audit terminé\n`)

} catch (error) {
  console.error(`\n❌ Erreur: ${error.message}`)
  if (page) {
    await page.screenshot({ path: 'audit-error.png', fullPage: true })
    console.log(`📸 Capture d'erreur: audit-error.png`)
  }
} finally {
  if (browser) {
    await browser.close()
  }
}
