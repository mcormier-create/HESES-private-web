import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://hesahvac.com'

async function testLiveProduction() {
  const results = {
    url: PRODUCTION_URL,
    timestamp: new Date().toISOString(),
    authenticated: false,
    controls: [],
    reportButton: null,
    consoleErrors: [],
    networkErrors: [],
  }

  let browser
  let page

  try {
    console.log(`Lancement du navigateur...`)
    browser = await chromium.launch({ headless: false })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1024 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    })

    page = await context.newPage()

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        results.consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        })
      }
    })

    page.on('pageerror', (error) => {
      results.consoleErrors.push({
        text: error.message,
        stack: error.stack,
      })
    })

    page.on('requestfailed', (request) => {
      results.networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText,
      })
    })

    console.log(`Navigation vers ${PRODUCTION_URL}...`)
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const currentUrl = page.url()
    const title = await page.title()
    results.pageTitle = title
    results.finalUrl = currentUrl

    const hasPasswordInput = await page.locator('input[type="password"]').count() > 0
    const hasLoginForm = await page.locator('form').count() > 0 && hasPasswordInput

    if (hasLoginForm) {
      console.log(`❌ Session déconnectée - page de connexion détectée`)
      results.authenticated = false
      results.blocker = 'Session déconnectée - page de connexion visible'
      return results
    }

    console.log(`✅ Session authentifiée détectée`)
    results.authenticated = true

    await page.waitForTimeout(1500)

    // Test 1: Langue (FR/EN)
    console.log(`Test 1: Contrôle langue...`)
    const langControl = await testControl(page, {
      name: 'Langue (FR/EN)',
      selectors: ['button:has-text("EN")', 'button:has-text("FR")', '[data-testid="language-toggle"]', 'button[aria-label*="language"]', 'button[aria-label*="langue"]'],
      expectedChange: 'Changement de langue visible',
    })
    results.controls.push(langControl)

    // Test 2: Métrique/Impérial
    console.log(`Test 2: Contrôle unités...`)
    const unitControl = await testControl(page, {
      name: 'Métrique/Impérial',
      selectors: ['button:has-text("Imperial")', 'button:has-text("Metric")', 'button:has-text("Métrique")', '[data-testid="unit-toggle"]', 'input[type="radio"][value="imperial"]', 'input[type="radio"][value="metric"]'],
      expectedChange: 'Changement d\'unités visible',
    })
    results.controls.push(unitControl)

    // Test 3: 100% Outside Air
    console.log(`Test 3: Contrôle 100% Outside Air...`)
    const oaControl = await testControl(page, {
      name: '100% Outside Air',
      selectors: ['input[type="checkbox"]#outsideAir', 'input[id*="100oa"]', 'input[id*="outside"]', 'label:has-text("100%") input', 'label:has-text("Outside Air") input'],
      expectedChange: 'État de la case cochée inversé',
    })
    results.controls.push(oaControl)

    // Test 4: Free Cooling + évaporative
    console.log(`Test 4: Contrôle Free Cooling...`)
    const fcControl = await testControl(page, {
      name: 'Free Cooling + évaporative',
      selectors: ['select[id*="recovery"]', 'select[id*="freecool"]', 'input[value*="free"]', 'label:has-text("Free Cooling") input', 'option:has-text("Free Cooling")'],
      expectedChange: 'Sélection du type de récupération',
    })
    results.controls.push(fcControl)

    await page.waitForTimeout(1000)

    const controlsResponsive = results.controls.some(c => c.success)

    if (controlsResponsive) {
      console.log(`Test 5: Bouton rapport principal...`)
      const reportBtn = await testReportButton(page)
      results.reportButton = reportBtn
    } else {
      results.reportButton = {
        tested: false,
        reason: 'Contrôles non réactifs, bouton rapport non testé',
      }
    }

    return results
  } catch (error) {
    results.error = {
      message: error.message,
      stack: error.stack,
    }
    return results
  } finally {
    if (page) await page.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
  }
}

async function testControl(page, config) {
  const result = {
    name: config.name,
    success: false,
    found: false,
    clicked: false,
    latencyMs: null,
    stateChanged: false,
    errors: [],
    visibleBlocker: null,
  }

  try {
    let element = null
    let foundSelector = null

    for (const selector of config.selectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        element = page.locator(selector).first()
        foundSelector = selector
        result.found = true
        result.selector = foundSelector
        break
      }
    }

    if (!element) {
      result.errors.push(`Aucun sélecteur trouvé parmi: ${config.selectors.join(', ')}`)
      return result
    }

    await page.waitForTimeout(300)

    const isVisible = await element.isVisible()
    const isEnabled = await element.isEnabled()

    if (!isVisible) {
      result.errors.push('Élément non visible')
      return result
    }

    if (!isEnabled) {
      result.errors.push('Élément désactivé')
      return result
    }

    const beforeState = await captureState(page, element)

    const startTime = Date.now()
    await element.click({ timeout: 5000 })
    result.clicked = true

    await page.waitForTimeout(500)

    const endTime = Date.now()
    result.latencyMs = endTime - startTime

    const afterState = await captureState(page, element)
    result.stateChanged = !statesEqual(beforeState, afterState)

    const overlay = await page.locator('[role="dialog"], .modal, .overlay, [aria-modal="true"]').count()
    if (overlay > 0) {
      result.visibleBlocker = 'Dialogue/modal détecté après le clic'
    }

    result.success = result.stateChanged

    return result
  } catch (error) {
    result.errors.push(error.message)
    return result
  }
}

async function captureState(page, element) {
  try {
    const tagName = await element.evaluate(el => el.tagName.toLowerCase())
    const state = {
      tagName,
      textContent: await element.textContent().catch(() => ''),
      ariaLabel: await element.getAttribute('aria-label').catch(() => null),
      class: await element.getAttribute('class').catch(() => ''),
    }

    if (tagName === 'input') {
      state.type = await element.getAttribute('type')
      if (state.type === 'checkbox' || state.type === 'radio') {
        state.checked = await element.isChecked()
      } else {
        state.value = await element.inputValue().catch(() => '')
      }
    } else if (tagName === 'select') {
      state.value = await element.inputValue().catch(() => '')
    } else if (tagName === 'button') {
      state.ariaPressed = await element.getAttribute('aria-pressed').catch(() => null)
    }

    return state
  } catch (error) {
    return { error: error.message }
  }
}

function statesEqual(before, after) {
  if (before.error || after.error) return true
  
  if (before.checked !== after.checked) return false
  if (before.value !== after.value) return false
  if (before.ariaPressed !== after.ariaPressed) return false
  if (before.textContent !== after.textContent) return false
  if (before.class !== after.class) return false

  return true
}

async function testReportButton(page) {
  const result = {
    tested: true,
    found: false,
    clicked: false,
    popupOpened: false,
    pageNavigated: false,
    targetUrl: null,
    containsReportContent: false,
    errors: [],
  }

  try {
    const selectors = [
      'button:has-text("Rapport")',
      'button:has-text("Report")',
      '[data-testid="generate-report"]',
      'button[aria-label*="rapport"]',
      'button[aria-label*="report"]',
      '#generateReport',
      '.generate-report',
    ]

    let reportButton = null
    let foundSelector = null

    for (const selector of selectors) {
      const count = await page.locator(selector).count()
      if (count > 0) {
        reportButton = page.locator(selector).first()
        foundSelector = selector
        result.found = true
        result.selector = foundSelector
        break
      }
    }

    if (!reportButton) {
      result.errors.push(`Bouton rapport non trouvé parmi: ${selectors.join(', ')}`)
      return result
    }

    const isVisible = await reportButton.isVisible()
    const isEnabled = await reportButton.isEnabled()

    if (!isVisible) {
      result.errors.push('Bouton non visible')
      return result
    }

    if (!isEnabled) {
      result.errors.push('Bouton désactivé')
      return result
    }

    const [newPage] = await Promise.race([
      Promise.all([
        page.context().waitForEvent('page', { timeout: 5000 }).then(p => [p]).catch(() => []),
        reportButton.click({ timeout: 5000 }),
      ]),
      new Promise(resolve => setTimeout(() => resolve([]), 6000)),
    ])

    result.clicked = true

    await page.waitForTimeout(2000)

    if (newPage) {
      result.popupOpened = true
      result.targetUrl = newPage.url()

      await newPage.waitForLoadState('load', { timeout: 10000 }).catch(() => {})
      await newPage.waitForTimeout(1500)

      const content = await newPage.content()
      result.containsReportContent = 
        content.includes('rapport') ||
        content.includes('Report') ||
        content.includes('HESA') ||
        content.includes('Energy') ||
        content.includes('Énergie') ||
        content.includes('Humidification')

      await newPage.close().catch(() => {})
    } else {
      const currentUrl = page.url()
      if (currentUrl !== PRODUCTION_URL) {
        result.pageNavigated = true
        result.targetUrl = currentUrl
        await page.waitForTimeout(1500)
        const content = await page.content()
        result.containsReportContent = 
          content.includes('rapport') ||
          content.includes('Report') ||
          content.includes('HESA') ||
          content.includes('Energy') ||
          content.includes('Énergie') ||
          content.includes('Humidification')
      } else {
        result.errors.push('Aucune popup/navigation détectée après le clic')
      }
    }

    return result
  } catch (error) {
    result.errors.push(error.message)
    return result
  }
}

function printResultsFrench(results) {
  console.log('\n' + '='.repeat(70))
  console.log('RÉSULTATS DU TEST DE PRODUCTION HESA')
  console.log('='.repeat(70))
  console.log(`URL: ${results.url}`)
  console.log(`Date: ${results.timestamp}`)
  console.log(`Titre de page: ${results.pageTitle || 'N/A'}`)
  console.log(`URL finale: ${results.finalUrl || 'N/A'}`)
  console.log('')

  if (!results.authenticated) {
    console.log(`❌ BLOQUEUR: ${results.blocker}`)
    console.log('')
    console.log('Le test s\'arrête ici. Authentification requise.')
    return
  }

  console.log('✅ Session authentifiée\n')

  console.log('CONTRÔLES TESTÉS:')
  console.log('-'.repeat(70))
  
  for (const ctrl of results.controls) {
    console.log(`\n${ctrl.name}:`)
    console.log(`  Trouvé: ${ctrl.found ? '✅' : '❌'}`)
    if (ctrl.selector) console.log(`  Sélecteur: ${ctrl.selector}`)
    console.log(`  Cliqué: ${ctrl.clicked ? '✅' : '❌'}`)
    if (ctrl.latencyMs !== null) console.log(`  Latence: ${ctrl.latencyMs} ms`)
    console.log(`  État changé: ${ctrl.stateChanged ? '✅' : '❌'}`)
    if (ctrl.visibleBlocker) console.log(`  Bloqueur: ${ctrl.visibleBlocker}`)
    if (ctrl.errors.length > 0) {
      console.log(`  Erreurs:`)
      ctrl.errors.forEach(err => console.log(`    - ${err}`))
    }
  }

  console.log('\n' + '-'.repeat(70))
  console.log('BOUTON RAPPORT PRINCIPAL:')
  console.log('-'.repeat(70))

  if (results.reportButton) {
    const rb = results.reportButton
    if (!rb.tested) {
      console.log(`  Non testé: ${rb.reason}`)
    } else {
      console.log(`  Trouvé: ${rb.found ? '✅' : '❌'}`)
      if (rb.selector) console.log(`  Sélecteur: ${rb.selector}`)
      console.log(`  Cliqué: ${rb.clicked ? '✅' : '❌'}`)
      console.log(`  Popup ouverte: ${rb.popupOpened ? '✅' : '❌'}`)
      console.log(`  Page naviguée: ${rb.pageNavigated ? '✅' : '❌'}`)
      if (rb.targetUrl) console.log(`  URL cible: ${rb.targetUrl}`)
      console.log(`  Contenu rapport visible: ${rb.containsReportContent ? '✅' : '❌'}`)
      if (rb.errors.length > 0) {
        console.log(`  Erreurs:`)
        rb.errors.forEach(err => console.log(`    - ${err}`))
      }
    }
  }

  console.log('\n' + '-'.repeat(70))
  console.log('ERREURS CONSOLE:')
  console.log('-'.repeat(70))
  if (results.consoleErrors.length === 0) {
    console.log('  Aucune erreur console détectée ✅')
  } else {
    results.consoleErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.text}`)
      if (err.location) console.log(`     ${JSON.stringify(err.location)}`)
    })
  }

  console.log('\n' + '-'.repeat(70))
  console.log('ERREURS RÉSEAU:')
  console.log('-'.repeat(70))
  if (results.networkErrors.length === 0) {
    console.log('  Aucune erreur réseau détectée ✅')
  } else {
    results.networkErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.url}`)
      console.log(`     ${err.failure}`)
    })
  }

  console.log('\n' + '='.repeat(70))
  console.log('FIN DU TEST')
  console.log('='.repeat(70) + '\n')
}

const results = await testLiveProduction()
printResultsFrench(results)

if (results.error) {
  console.error('\n❌ ERREUR FATALE:')
  console.error(results.error.message)
  console.error(results.error.stack)
  process.exit(1)
}

process.exit(0)
