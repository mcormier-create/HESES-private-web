export const PROJECT_TECHNOLOGIES = [
  'electricSteam',
  'naturalGasSteam',
  'atmosphericGas',
  'humifogElectric',
  'humifogHeatPump',
  'humifogFreeCooling',
]

export const BASELINE_TECHNOLOGIES = [
  'electricSteam',
  'naturalGasSteam',
  'atmosphericGas',
]

export function selectedHumifogTechnology(system = {}) {
  const mode = system.mode || {}
  if (mode.includesFreeCoolingAnalysis || mode.isFreeCoolingMode) return 'humifogFreeCooling'

  const source = String(system.system?.reheatEnergySource || system.reheatEnergySource || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return source.includes('thermopompe') || source.includes('heat pump')
    ? 'humifogHeatPump'
    : 'humifogElectric'
}

export function selectedTechnologiesForSystem(system = {}) {
  return [...BASELINE_TECHNOLOGIES, selectedHumifogTechnology(system)]
}

export function summarizeSystemSavings(system = {}, fallbackReferenceTechnology = 'electricSteam') {
  const results = system.annualTechnologyResults || system.results || {}
  const referenceTechnology = BASELINE_TECHNOLOGIES.includes(system.economics?.annualComparisonReference)
    ? system.economics.annualComparisonReference
    : fallbackReferenceTechnology
  const selectedHumifogKey = selectedHumifogTechnology(system)
  const referenceResult = results[referenceTechnology] || {}
  const humifogResult = results[selectedHumifogKey] || {}
  const installedCosts = system.economics?.installedCosts || system.installedCosts || {}
  const referenceEnergy = number(referenceResult.annualEnergyKWh)
  const humifogEnergy = number(humifogResult.annualEnergyKWh)
  const referenceCost = number(referenceResult.annualOperatingCost)
  const humifogCost = number(humifogResult.annualOperatingCost)
  const referenceInvestment = number(referenceResult.installedInvestmentCost ?? installedCosts[referenceTechnology])
  const humifogInvestment = number(humifogResult.installedInvestmentCost ?? installedCosts[selectedHumifogKey])
  const energySavings = referenceEnergy - humifogEnergy
  const costSavings = referenceCost - humifogCost
  const incrementalInvestment = humifogInvestment - referenceInvestment

  return {
    referenceTechnology,
    selectedHumifogKey,
    referenceEnergy,
    humifogEnergy,
    energySavings,
    energyReductionPercent: referenceEnergy > 0 ? energySavings / referenceEnergy * 100 : null,
    referenceCost,
    humifogCost,
    costSavings,
    incrementalInvestment,
    simplePaybackYears: incrementalInvestment > 0 && costSavings > 0 ? incrementalInvestment / costSavings : null,
    simpleAnnualRoiPercent: incrementalInvestment > 0 ? costSavings / incrementalInvestment * 100 : null,
  }
}

export function summarizeBuildingSavings(systems, fallbackReferenceTechnology = 'electricSteam') {
  const activeSystems = (systems || []).filter((system) => system?.active !== false)
  const bySystem = activeSystems.map((system) => ({
    system,
    savings: summarizeSystemSavings(system, fallbackReferenceTechnology),
  }))
  const totals = bySystem.reduce((total, entry) => {
    const savings = entry.savings
    total.referenceEnergy += savings.referenceEnergy
    total.humifogEnergy += savings.humifogEnergy
    total.referenceCost += savings.referenceCost
    total.humifogCost += savings.humifogCost
    total.incrementalInvestment += savings.incrementalInvestment
    return total
  }, {
    referenceEnergy: 0,
    humifogEnergy: 0,
    referenceCost: 0,
    humifogCost: 0,
    incrementalInvestment: 0,
  })
  totals.energySavings = totals.referenceEnergy - totals.humifogEnergy
  totals.energyReductionPercent = totals.referenceEnergy > 0
    ? totals.energySavings / totals.referenceEnergy * 100
    : null
  totals.costSavings = totals.referenceCost - totals.humifogCost
  totals.simplePaybackYears = totals.incrementalInvestment > 0 && totals.costSavings > 0
    ? totals.incrementalInvestment / totals.costSavings
    : null
  totals.simpleAnnualRoiPercent = totals.incrementalInvestment > 0
    ? totals.costSavings / totals.incrementalInvestment * 100
    : null
  return { bySystem, totals }
}

export function summarizeProjectEnergy(systems, referenceTechnology = 'electricSteam') {
  const activeSystems = (systems || []).filter((system) => system?.active !== false)
  const totals = Object.fromEntries([...BASELINE_TECHNOLOGIES, 'humifogSelected'].map((key) => [key, {
    annualEnergyKWh: 0,
    annualOperatingCost: 0,
    installedInvestmentCost: 0,
    annualSavings: 0,
    incrementalInvestment: 0,
    simplePaybackYears: null,
    simpleAnnualRoiPercent: null,
    energyReductionPercent: 0,
    applicableSystems: 0,
  }]))

  for (const system of activeSystems) {
    const results = system.annualTechnologyResults || system.results || {}
    const installedCosts = system.economics?.installedCosts || system.installedCosts || {}
    for (const key of BASELINE_TECHNOLOGIES) {
      const result = results[key]
      if (!result) continue
      const total = totals[key]
      total.applicableSystems += 1
      total.annualEnergyKWh += number(result.annualEnergyKWh)
      total.annualOperatingCost += number(result.annualOperatingCost)
      total.installedInvestmentCost += number(result.installedInvestmentCost ?? installedCosts[key])
    }

    const humifogKey = selectedHumifogTechnology(system)
    const humifogResult = results[humifogKey]
    if (humifogResult) {
      const total = totals.humifogSelected
      total.applicableSystems += 1
      total.annualEnergyKWh += number(humifogResult.annualEnergyKWh)
      total.annualOperatingCost += number(humifogResult.annualOperatingCost)
      total.installedInvestmentCost += number(humifogResult.installedInvestmentCost ?? installedCosts[humifogKey])
    }
  }

  const reference = totals[referenceTechnology] || totals.electricSteam
  for (const total of Object.values(totals)) {
    total.annualSavings = reference.annualOperatingCost - total.annualOperatingCost
    total.incrementalInvestment = total.installedInvestmentCost - reference.installedInvestmentCost
    total.simplePaybackYears = total.incrementalInvestment > 0 && total.annualSavings > 0
      ? total.incrementalInvestment / total.annualSavings
      : null
    total.simpleAnnualRoiPercent = total.incrementalInvestment > 0
      ? total.annualSavings / total.incrementalInvestment * 100
      : null
    total.energyReductionPercent = reference.annualEnergyKWh > 0
      ? (reference.annualEnergyKWh - total.annualEnergyKWh) / reference.annualEnergyKWh * 100
      : 0
  }

  const hourBases = [...new Set(activeSystems.map((system) => system.hoursBasis || system.mode?.selectedCalculationMethod || system.results?.electricSteam?.hoursBasis).filter(Boolean))]
  return {
    referenceTechnology,
    totals,
    operatingHourBasis: hourBases.length > 1 ? 'mixed' : (hourBases[0] || ''),
    systemHourBases: activeSystems.map((system) => ({
      name: system.name || system.system?.name || 'AHU',
      basis: system.hoursBasis || system.mode?.selectedCalculationMethod || system.results?.electricSteam?.hoursBasis || '',
      humifogTechnology: selectedHumifogTechnology(system),
    })),
  }
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}