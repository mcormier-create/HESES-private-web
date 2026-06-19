export function createLocalHesesAnswer({ question = '', context = {} }) {
  const language = context.language === 'en' ? 'en' : 'fr'
  const freeCooling = context.freeCooling || {}
  const displayed = context.displayedValues || {}
  const system = context.system || {}
  const annual = freeCooling.annualComparison || {}
  const steam = annual.freeCooling || {}
  const humifog = annual.humifog || {}
  const netSavings = freeCooling.netSavings || {}
  const comparisonBasis = freeCooling.comparisonBasis || {}
  const steamScenario = comparisonBasis.steamScenario || {}
  const humifogScenario = comparisonBasis.humifogScenario || {}
  const pdfReport = context.pdfReport || {}
  const normalizedQuestion = String(question).toLowerCase()
  const binRows = Array.isArray(freeCooling.binValidationRows) ? freeCooling.binValidationRows : []
  const sortedSavingsBins = [...binRows]
    .sort((a, b) => Number(b?.difference?.binEnergyKwh || 0) - Number(a?.difference?.binEnergyKwh || 0))
    .slice(0, 3)

  const lines = []
  const missing = language === 'fr'
    ? "L'information est manquante dans les donnees HESES fournies."
    : 'The information is missing from the provided HESES data.'

  const add = (label, value) => {
    if (value === undefined || value === null || value === '') return
    lines.push(`${label}: ${value}`)
  }

  const addNumber = (label, value, unit = '') => {
    if (!Number.isFinite(Number(value))) return
    lines.push(`${label}: ${Number(value).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')}${unit}`)
  }

  lines.push(language === 'fr'
    ? 'Mode local HESES actif - reponse basee uniquement sur les donnees actuellement affichees.'
    : 'HESES local mode active - response based only on the currently displayed data.')

  add(language === 'fr' ? 'Question' : 'Question', question)
  add(language === 'fr' ? 'Mode' : 'Mode', context.mode?.ventilationModeName || system.type)
  add(language === 'fr' ? 'Debit total affiche' : 'Displayed total airflow', displayed.totalAirflow)
  add(language === 'fr' ? 'Air exterieur affiche' : 'Displayed outdoor air', displayed.outsideAirFlow)
  add(language === 'fr' ? 'Air de retour affiche' : 'Displayed return air', displayed.returnAirFlow)
  addNumber(language === 'fr' ? 'OA actif' : 'Active OA', displayed.activeOaPercent, '%')
  addNumber(language === 'fr' ? 'RA actif' : 'Active RA', displayed.activeRaPercent, '%')

  if (normalizedQuestion.includes('pdf') || normalizedQuestion.includes('rapport')) {
    add(language === 'fr' ? 'Rapport PDF disponible' : 'PDF report available', pdfReport.available ? (language === 'fr' ? 'oui' : 'yes') : (language === 'fr' ? 'non' : 'no'))
    if (Array.isArray(pdfReport.sections) && pdfReport.sections.length) {
      lines.push(`${language === 'fr' ? 'Sections du rapport' : 'Report sections'}: ${pdfReport.sections.join(', ')}`)
    }
  }

  if (freeCooling.calculationComplete) {
    addNumber(language === 'fr' ? 'OA moyen vapeur' : 'Average steam OA', steamScenario.averageOa, '%')
    addNumber(language === 'fr' ? 'OA moyen Humifog' : 'Average Humifog OA', humifogScenario.averageOa, '%')
    addNumber(language === 'fr' ? 'T melange moyenne vapeur' : 'Average steam mixed air temperature', steamScenario.averageMixedDb, ' C')
    addNumber(language === 'fr' ? 'T melange moyenne Humifog' : 'Average Humifog mixed air temperature', humifogScenario.averageMixedDb, ' C')
    addNumber(language === 'fr' ? 'T sortie Humifog moyenne' : 'Average Humifog outlet temperature', humifogScenario.averageHumifogOutletDb, ' C')
    addNumber(language === 'fr' ? 'Energie annuelle vapeur' : 'Steam annual energy', steam.totalEnergyKwh, ' kWh/year')
    addNumber(language === 'fr' ? 'Energie annuelle Humifog' : 'Humifog annual energy', humifog.totalEnergyKwh, ' kWh/year')
    addNumber(language === 'fr' ? 'Economies annuelles nettes' : 'Net annual savings', netSavings.netAnnualEnergySavingsKwh, ' kWh/year')
    addNumber(language === 'fr' ? 'Reduction energie' : 'Energy reduction', netSavings.energyReductionPercent, '%')

    if (normalizedQuestion.includes('bin') || normalizedQuestion.includes('contrib')) {
      if (sortedSavingsBins.length) {
        lines.push(language === 'fr'
          ? 'BIN contribuant le plus aux economies affichees:'
          : 'BINs contributing most to displayed savings:')
        sortedSavingsBins.forEach((row) => {
          add(
            `${Number(row.tempC).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} C`,
            `${Number(row.hours || 0).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} h, ${Number(row?.difference?.binEnergyKwh || 0).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} kWh`
          )
        })
      } else {
        lines.push(missing)
      }
    }

    if (normalizedQuestion.includes('rechauff') || normalizedQuestion.includes('reheat')) {
      const debug = annual.humifogDebug || {}
      addNumber(language === 'fr' ? 'Rechauffage Humifog applique' : 'Applied Humifog reheat', debug.selectedReheatEnergyKwh ?? humifog.reheatEnergyKwh, ' kWh/year')
      addNumber(language === 'fr' ? 'Rechauffage thermique requis' : 'Required thermal reheat', debug.adiabaticReheatThermalKwh, ' kWh/year')
      lines.push(language === 'fr'
        ? "Le rechauffage apparait seulement lorsque les donnees HESES indiquent que la temperature apres Humifog descend sous la consigne utilisee par le calcul."
        : 'Reheat appears only when the HESES data indicates the temperature after Humifog falls below the calculation setpoint.')
    }

    if (normalizedQuestion.includes('client') || normalizedQuestion.includes('rapport') || normalizedQuestion.includes('texte')) {
      lines.push(language === 'fr'
        ? 'Resume client: selon les resultats affiches par HESES, le scenario Humifog avec Free Cooling reduit la consommation annuelle par rapport au scenario vapeur. Les economies proviennent des valeurs BIN, OA/RA, refroidissement adiabatique et rechauffage deja calcules par HESES. Une validation finale d ingenierie demeure requise.'
        : 'Client summary: according to the results displayed by HESES, the Humifog with Free Cooling scenario reduces annual consumption compared with the steam scenario. Savings come from the BIN, OA/RA, adiabatic cooling and reheat values already calculated by HESES. Final engineering validation remains required.')
    }
  } else if (freeCooling.incompleteReason) {
    add(language === 'fr' ? 'Calcul Free Cooling incomplet' : 'Incomplete Free Cooling calculation', freeCooling.incompleteReason)
  }

  if (Array.isArray(freeCooling.alignedComparisonRows) && freeCooling.alignedComparisonRows.length) {
    const rows = freeCooling.alignedComparisonRows.slice(0, 4).map((row) => {
      return `${row.label}: ${row.reference} / ${row.humifog}${row.difference ? ` (${row.difference})` : ''}`
    })
    lines.push(language === 'fr' ? 'Comparaison affichee:' : 'Displayed comparison:')
    lines.push(...rows)
  }

  if (lines.length <= 3) {
    lines.push(missing)
  }

  lines.push(language === 'fr'
    ? "Note: l'assistant explique les resultats; il ne modifie pas les calculs HESES."
    : 'Note: the assistant explains results; it does not modify HESES calculations.')

  return lines.join('\n')
}
