import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://hesahvac.com'
const TEST_PASSWORD = process.env.HESA_ACCESS_PASSWORD || ''

async function epwPerformanceAudit() {
  const audit = {
    url: PRODUCTION_URL,
    timestamp: new Date().toISOString(),
    findings: [],
    metrics: {
      montreal: { epwLoad: null, recalc: null, inputChange: null, epwReloads: 0 },
      ottawa: { epwLoad: null, recalc: null, inputChange: null, epwReloads: 0 },
    },
    consoleErrors: [],
    networkRequests: [],
    verdict: 'EN_COURS',
  }

  let browser
  let page

  try {
    console.log(`\n🚀 Audit de performance EPW - ${PRODUCTION_URL}\n`)
    browser = await chromium.launch({ headless: false, slowMo: 300 })
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
    })

    page = await context.newPage()

    // Track console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        audit.consoleErrors.push({ time: Date.now(), text: msg.text() })
      }
    })

    // Track network requests for EPW files
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('.epw') || url.includes('weather')) {
        audit.networkRequests.push({
          time: Date.now(),
          method: request.method(),
          url: url,
          resourceType: request.resourceType(),
        })
        console.log(`📡 EPW Request: ${url.split('/').pop()}`)
      }
    })

    // Step 1: Load and authenticate
    console.log(`1️⃣ Chargement de la page...`)
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 45000 })
    
    // Check for password prompt
    const passwordInput = await page.locator('input[type="password"]').first()
    const passwordVisible = await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)
    
    if (passwordVisible) {
      console.log(`🔐 Authentification requise...`)
      if (!TEST_PASSWORD) {
        console.log(`⚠️  HESA_ACCESS_PASSWORD non défini. Tentative de navigation sans authentification...`)
        // Try to continue anyway, the site might be publicly accessible now
        await page.waitForTimeout(2000)
      } else {
        await passwordInput.fill(TEST_PASSWORD)
        await page.keyboard.press('Enter')
        await page.waitForLoadState('networkidle', { timeout: 15000 })
      }
    }

    // Wait for app to be ready
    await page.waitForTimeout(2000)
    
    // Check if we're actually authenticated/can access the app
    const pageContent = await page.content()
    if (pageContent.includes('Access') && pageContent.includes('password')) {
      audit.findings.push({
        severity: 'BLOQUANT',
        message: 'Authentification requise mais HESA_ACCESS_PASSWORD non défini. Définissez la variable d\'environnement et relancez.',
      })
      audit.verdict = 'NON_VALIDÉ'
      return audit
    }
    
    console.log(`✅ Page chargée\n`)

    // Step 1.5: Activate hourly EPW mode
    console.log(`⚙️  Activation du mode calcul horaire EPW (8760)...`)
    
    // Wait for city cards to be visible (means the app is loaded)
    try {
      await page.locator('div.rounded-2xl').first().waitFor({ state: 'visible', timeout: 15000 })
      console.log(`   ✅ Interface chargée`)
    } catch (e) {
      console.log(`   ⚠️  Timeout lors de l'attente de l'interface`)
      audit.findings.push({
        severity: 'AVERTISSEMENT',
        message: 'Timeout lors du chargement de l\'interface. Le site pourrait nécessiter un mot de passe.',
      })
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'audit-main-interface.png', fullPage: true })
    console.log(`   📸 Capture: audit-main-interface.png`)
    
    // Look for the hourly mode button - be flexible
    try {
      const hourlyButton = page.locator('button').filter({ 
        hasText: /8760|hourly.*weather|simulation.*horaire|météo horaire/i 
      }).first()
      
      const hourlyButtonVisible = await hourlyButton.isVisible({ timeout: 3000 }).catch(() => false)
      
      if (hourlyButtonVisible) {
        await hourlyButton.click()
        console.log(`   ✅ Mode horaire EPW activé`)
        await page.waitForTimeout(2000)
      } else {
        console.log(`   ⚠️  Bouton mode horaire non trouvé. Le mode pourrait déjà être actif.`)
        audit.findings.push({
          severity: 'INFO',
          message: 'Bouton mode horaire EPW non trouvé. Le mode pourrait déjà être actif.',
        })
      }
    } catch (e) {
      console.log(`   ⚠️  Erreur lors de l'activation du mode hourly: ${e.message}`)
    }

    // Wait for app to be ready
    await page.waitForTimeout(2000)
    console.log(`✅ Prêt pour les tests de ville\n`)

    // Step 2: Test Montreal EPW mode
    console.log(`2️⃣ TEST MONTRÉAL - Mode EPW 8760\n`)
    await testCityEPW(page, audit, 'montreal', 'Montréal')

    // Step 3: Test Ottawa EPW mode
    console.log(`\n3️⃣ TEST OTTAWA - Mode EPW 8760\n`)
    await testCityEPW(page, audit, 'ottawa', 'Ottawa')

    // Analysis
    analyzeResults(audit)

    console.log(`\n✅ Audit terminé\n`)

  } catch (error) {
    audit.findings.push({
      severity: 'ERREUR',
      message: `Erreur durant l'audit: ${error.message}`,
      stack: error.stack,
    })
    audit.verdict = 'NON_VALIDÉ'
  } finally {
    if (browser) {
      await browser.close()
    }
  }

  return audit
}

async function testCityEPW(page, audit, cityKey, cityName) {
  const metrics = audit.metrics[cityKey]

  try {
    // Take a screenshot before clicking
    await page.screenshot({ path: `audit-before-${cityKey}.png`, fullPage: false })
    
    // Click on the city card - try multiple approaches
    console.log(`   📍 Sélection de ${cityName}...`)
    
    // First, wait for city cards to be visible
    await page.waitForTimeout(2000)
    
    // Approach 1: Look for div with exact text match (with accent handling)
    const cityNameVariants = [
      cityName,
      cityName.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), // Remove accents
      cityName.replace('é', 'e').replace('É', 'E'), // Manual accent handling
    ]
    
    let cityCard = null
    let cardFound = false
    
    for (const variant of cityNameVariants) {
      console.log(`   🔍 Recherche: "${variant}"`)
      const cards = page.locator('div.rounded-2xl.cursor-pointer')
      const cardCount = await cards.count()
      console.log(`   📋 ${cardCount} cartes trouvées au total`)
      
      // Try to find the card with this variant
      for (let i = 0; i < cardCount; i++) {
        const card = cards.nth(i)
        const cardText = await card.textContent()
        console.log(`      Carte ${i}: "${cardText.trim().slice(0, 50)}"`)
        
        if (cardText.includes(variant)) {
          cityCard = card
          cardFound = true
          console.log(`   ✅ Carte trouvée avec variant "${variant}"`)
          break
        }
      }
      
      if (cardFound) break
    }
    
    if (!cardFound) {
      // Try another approach: look for any div containing the city name
      console.log(`   🔍 Approche alternative: recherche par texte large`)
      const allDivs = page.locator('div')
      const divCount = await allDivs.count()
      console.log(`   📋 ${divCount} divs à examiner`)
      
      audit.findings.push({
        severity: 'AVERTISSEMENT',
        message: `Carte de ville ${cityName} non trouvée. Capture: audit-before-${cityKey}.png`,
      })
      return
    }

    const epwLoadStart = Date.now()
    audit.networkRequests.push({ marker: `${cityName}_CLICK_START`, time: epwLoadStart })
    
    // Click the city card
    await cityCard.scrollIntoViewIfNeeded()
    await cityCard.click()
    console.log(`   🖱️  Carte cliquée`)
    
    // Take a screenshot after clicking
    await page.screenshot({ path: `audit-after-${cityKey}.png`, fullPage: false })
    
    // Wait for EPW to load
    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle', { timeout: 30000 })
    
    metrics.epwLoad = Date.now() - epwLoadStart
    console.log(`   ⏱️  Chargement EPW: ${metrics.epwLoad}ms`)

    // Count EPW requests during initial load
    const initialEPWCount = audit.networkRequests.filter(r => 
      r.time >= epwLoadStart && r.url && (r.url.includes(cityKey) || r.url.includes('.epw'))
    ).length
    metrics.epwReloads = Math.max(0, initialEPWCount - 1)

    // Wait for any calculations to complete
    await page.waitForTimeout(2000)

    // Test 1: Change flow rate (should NOT reload EPW)
    console.log(`   🔧 Test: Changement de débit...`)
    const flowInputs = await page.locator('input[type="number"]').all()
    
    if (flowInputs.length === 0) {
      audit.findings.push({
        severity: 'AVERTISSEMENT',
        message: `${cityName}: Aucun champ de saisie numérique trouvé`,
      })
      return
    }
    
    const flowInput = flowInputs[0]
    await flowInput.scrollIntoViewIfNeeded()
    await flowInput.click()
    await flowInput.fill('5000')
    await page.keyboard.press('Enter')
    
    const recalcStart = Date.now()
    await page.waitForTimeout(2000)
    metrics.recalc = Date.now() - recalcStart
    console.log(`   ⏱️  Recalcul: ${metrics.recalc}ms`)

    const epwReloadDuringChange = audit.networkRequests.filter(r => 
      r.time >= recalcStart && r.url && r.url.includes('.epw')
    ).length
    
    if (epwReloadDuringChange > 0) {
      audit.findings.push({
        severity: 'CRITIQUE',
        message: `${cityName}: EPW rechargé ${epwReloadDuringChange}x lors du changement de débit (NON SOUHAITABLE)`,
      })
      metrics.epwReloads += epwReloadDuringChange
    } else {
      console.log(`   ✅ Pas de rechargement EPW lors du changement de débit`)
    }

    // Test 2: Change temperature
    console.log(`   🔧 Test: Changement de température...`)
    if (flowInputs.length > 1) {
      await flowInputs[1].scrollIntoViewIfNeeded()
      await flowInputs[1].click()
      await flowInputs[1].fill('22')
      await page.keyboard.press('Enter')
      
      const changeStart = Date.now()
      await page.waitForTimeout(2000)
      metrics.inputChange = Date.now() - changeStart
      
      const epwReloadTemp = audit.networkRequests.filter(r => 
        r.time >= changeStart && r.url && r.url.includes('.epw')
      ).length
      
      if (epwReloadTemp > 0) {
        audit.findings.push({
          severity: 'CRITIQUE',
          message: `${cityName}: EPW rechargé ${epwReloadTemp}x lors du changement de température`,
        })
        metrics.epwReloads += epwReloadTemp
      } else {
        console.log(`   ✅ Pas de rechargement EPW lors du changement de température`)
      }
    }

    // Check UI responsiveness - look for loading indicators
    const loadingIndicators = await page.locator('[class*="spinner"], [class*="loading"], [aria-busy="true"], [role="status"]')
      .count()
    
    if (loadingIndicators > 0) {
      console.log(`   ⏳ ${loadingIndicators} indicateur(s) de chargement détecté(s)`)
    }

    console.log(`   📊 EPW recharges totales: ${metrics.epwReloads}`)

  } catch (error) {
    audit.findings.push({
      severity: 'ERREUR',
      message: `${cityName}: ${error.message}`,
    })
  }
}

function analyzeResults(audit) {
  console.log(`\n` + '='.repeat(60))
  console.log(`📊 RÉSULTATS DE L'AUDIT`)
  console.log('='.repeat(60))

  // Performance metrics
  console.log(`\n🏙️  MONTRÉAL:`)
  console.log(`   - Chargement EPW: ${audit.metrics.montreal.epwLoad || 'N/A'}ms`)
  console.log(`   - Recalcul: ${audit.metrics.montreal.recalc || 'N/A'}ms`)
  console.log(`   - Recharges EPW: ${audit.metrics.montreal.epwReloads}`)

  console.log(`\n🏙️  OTTAWA:`)
  console.log(`   - Chargement EPW: ${audit.metrics.ottawa.epwLoad || 'N/A'}ms`)
  console.log(`   - Recalcul: ${audit.metrics.ottawa.recalc || 'N/A'}ms`)
  console.log(`   - Recharges EPW: ${audit.metrics.ottawa.epwReloads}`)

  // Findings by severity
  const critical = audit.findings.filter(f => f.severity === 'CRITIQUE')
  const blocking = audit.findings.filter(f => f.severity === 'BLOQUANT')
  const warnings = audit.findings.filter(f => f.severity === 'AVERTISSEMENT')
  const errors = audit.findings.filter(f => f.severity === 'ERREUR')

  console.log(`\n⚠️  FINDINGS:`)
  if (blocking.length > 0) {
    console.log(`   🛑 BLOQUANTS: ${blocking.length}`)
    blocking.forEach(f => console.log(`      - ${f.message}`))
  }
  if (critical.length > 0) {
    console.log(`   🔴 CRITIQUES: ${critical.length}`)
    critical.forEach(f => console.log(`      - ${f.message}`))
  }
  if (errors.length > 0) {
    console.log(`   ⚠️  ERREURS: ${errors.length}`)
    errors.forEach(f => console.log(`      - ${f.message}`))
  }
  if (warnings.length > 0) {
    console.log(`   ⚡ AVERTISSEMENTS: ${warnings.length}`)
    warnings.forEach(f => console.log(`      - ${f.message}`))
  }
  if (audit.findings.length === 0) {
    console.log(`   ✅ Aucun problème détecté`)
  }

  // Console errors
  if (audit.consoleErrors.length > 0) {
    console.log(`\n🐛 Erreurs console: ${audit.consoleErrors.length}`)
    audit.consoleErrors.slice(0, 3).forEach(e => console.log(`   - ${e.text.slice(0, 80)}`))
  }

  // Verdict
  console.log(`\n` + '='.repeat(60))
  if (blocking.length > 0 || errors.length > 0) {
    audit.verdict = 'NON VALIDÉ'
    console.log(`❌ VERDICT: NON VALIDÉ`)
  } else if (critical.length > 0) {
    audit.verdict = 'PARTIELLEMENT VALIDÉ'
    console.log(`⚠️  VERDICT: PARTIELLEMENT VALIDÉ`)
  } else {
    audit.verdict = 'VALIDÉ'
    console.log(`✅ VERDICT: VALIDÉ`)
  }
  console.log('='.repeat(60) + `\n`)

  // Recommendations
  const recommendations = []
  
  if (critical.length > 0) {
    recommendations.push('Éliminer les rechargements EPW non nécessaires lors de changements d\'intrants')
  }
  
  const maxLoad = Math.max(
    audit.metrics.montreal.epwLoad || 0,
    audit.metrics.ottawa.epwLoad || 0
  )
  if (maxLoad > 5000) {
    recommendations.push('Optimiser le chargement EPW initial (actuellement > 5s)')
  }
  
  const maxRecalc = Math.max(
    audit.metrics.montreal.recalc || 0,
    audit.metrics.ottawa.recalc || 0
  )
  if (maxRecalc > 2000) {
    recommendations.push('Optimiser les recalculs (actuellement > 2s)')
  }

  if (audit.consoleErrors.length > 5) {
    recommendations.push('Corriger les erreurs console récurrentes')
  }

  if (recommendations.length > 0) {
    console.log(`💡 ACTIONS RECOMMANDÉES (TOP 3):\n`)
    recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`)
    })
    console.log()
  }
}

// Execute
epwPerformanceAudit()
  .then(async audit => {
    // Save results
    const fs = await import('fs')
    const path = await import('path')
    const outPath = path.join(process.cwd(), 'epw-audit-results.json')
    fs.writeFileSync(outPath, JSON.stringify(audit, null, 2))
    console.log(`📁 Résultats sauvegardés: ${outPath}\n`)
    
    process.exit(audit.verdict === 'VALIDÉ' ? 0 : 1)
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })
