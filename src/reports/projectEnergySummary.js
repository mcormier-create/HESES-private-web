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

export function normalizeReferenceTechnology(value) {
  if (value === 'atmosphericGas') return 'atmosphericGas'
  if (value === 'atmosphericGasHumidifier') return 'atmosphericGas'
  return BASELINE_TECHNOLOGIES.includes(value) ? value : null
}

export function selectedReferenceTechnology(system = {}, fallback = 'electricSteam') {
  return normalizeReferenceTechnology(
    system.economics?.annualComparisonReference ??
      system.annualComparisonReference ??
      fallback
  ) || normalizeReferenceTechnology(fallback) || 'electricSteam'
}

function finiteOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sumNullable(values) {
  return values.every((value) => value !== null) ? values.reduce((sum, value) => sum + value, 0) : null
}

function installedCostFor(results, installedCosts, key) {
  return finiteOrNull(results[key]?.installedInvestmentCost ?? installedCosts[key])
}

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
  const referenceTechnology = selectedReferenceTechnology(system, fallbackReferenceTechnology)
  const selectedHumifogKey = selectedHumifogTechnology(system)
  const referenceResult = results[referenceTechnology] || {}
  const humifogResult = results[selectedHumifogKey] || {}
  const installedCosts = system.economics?.installedCosts || system.installedCosts || {}
  const referenceEnergy = finiteOrNull(referenceResult.annualEnergyKWh)
  const humifogEnergy = finiteOrNull(humifogResult.annualEnergyKWh)
  const referenceCost = finiteOrNull(referenceResult.annualOperatingCost)
  const humifogCost = finiteOrNull(humifogResult.annualOperatingCost)
  const referenceInvestment = installedCostFor(results, installedCosts, referenceTechnology)
  const humifogInvestment = installedCostFor(results, installedCosts, selectedHumifogKey)
  const energySavings = referenceEnergy !== null && humifogEnergy !== null ? referenceEnergy - humifogEnergy : null
  const costSavings = referenceCost !== null && humifogCost !== null ? referenceCost - humifogCost : null
  const incrementalInvestment = referenceInvestment !== null && humifogInvestment !== null
    ? humifogInvestment - referenceInvestment
    : null
  const simplePaybackYears = incrementalInvestment !== null && incrementalInvestment > 0 && costSavings !== null && costSavings > 0
    ? incrementalInvestment / costSavings
    : null
  const paybackStatus = referenceInvestment === null || humifogInvestment === null || costSavings === null
    ? 'notAvailable'
    : costSavings <= 0
      ? 'notEconomical'
      : incrementalInvestment <= 0
        ? 'immediate'
        : 'years'

  return {
    referenceTechnology,
    selectedHumifogKey,
    referenceEnergy,
    humifogEnergy,
    energySavings,
    energyReductionPercent: referenceEnergy !== null && referenceEnergy > 0 && energySavings !== null ? energySavings / referenceEnergy * 100 : null,
    referenceCost,
    humifogCost,
    costSavings,
    incrementalInvestment,
    simplePaybackYears,
    simpleAnnualRoiPercent: incrementalInvestment !== null && incrementalInvestment > 0 && costSavings !== null
      ? costSavings / incrementalInvestment * 100
      : null,
    paybackStatus,
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
    total.referenceEnergyValues.push(savings.referenceEnergy)
    total.humifogEnergyValues.push(savings.humifogEnergy)
    total.referenceCostValues.push(savings.referenceCost)
    total.humifogCostValues.push(savings.humifogCost)
    total.incrementalInvestmentValues.push(savings.incrementalInvestment)
    return total
  }, {
    referenceEnergyValues: [],
    humifogEnergyValues: [],
    referenceCostValues: [],
    humifogCostValues: [],
    incrementalInvestmentValues: [],
  })
  totals.referenceEnergy = sumNullable(totals.referenceEnergyValues)
  totals.humifogEnergy = sumNullable(totals.humifogEnergyValues)
  totals.referenceCost = sumNullable(totals.referenceCostValues)
  totals.humifogCost = sumNullable(totals.humifogCostValues)
  totals.incrementalInvestment = sumNullable(totals.incrementalInvestmentValues)
  totals.energySavings = totals.referenceEnergy !== null && totals.humifogEnergy !== null
    ? totals.referenceEnergy - totals.humifogEnergy
    : null
  totals.energyReductionPercent = totals.referenceEnergy !== null && totals.referenceEnergy > 0 && totals.energySavings !== null
    ? totals.energySavings / totals.referenceEnergy * 100
    : null
  totals.costSavings = totals.referenceCost !== null && totals.humifogCost !== null
    ? totals.referenceCost - totals.humifogCost
    : null
  totals.simplePaybackYears = totals.incrementalInvestment !== null && totals.incrementalInvestment > 0 && totals.costSavings !== null && totals.costSavings > 0
    ? totals.incrementalInvestment / totals.costSavings
    : null
  totals.simpleAnnualRoiPercent = totals.incrementalInvestment !== null && totals.incrementalInvestment > 0 && totals.costSavings !== null
    ? totals.costSavings / totals.incrementalInvestment * 100
    : null
  totals.paybackStatus = totals.incrementalInvestment === null || totals.costSavings === null
    ? 'notAvailable'
    : totals.costSavings <= 0
      ? 'notEconomical'
      : totals.incrementalInvestment <= 0
        ? 'immediate'
        : 'years'
  delete totals.referenceEnergyValues
  delete totals.humifogEnergyValues
  delete totals.referenceCostValues
  delete totals.humifogCostValues
  delete totals.incrementalInvestmentValues
  return { bySystem, totals }
}

export function summarizeProjectEnergy(systems, referenceTechnology = null) {
  const activeSystems = (systems || []).filter((system) => system?.active !== false)
  const totals = Object.fromEntries([...BASELINE_TECHNOLOGIES, 'humifogSelected'].map((key) => [key, {
    annualEnergyKWh: 0,
    annualOperatingCost: 0,
    installedInvestmentCost: 0,
    annualEnergyComplete: true,
    annualCostComplete: true,
    installedCostComplete: true,
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
      const annualEnergy = finiteOrNull(result.annualEnergyKWh)
      const annualCost = finiteOrNull(result.annualOperatingCost)
      if (annualEnergy === null) total.annualEnergyComplete = false
      else if (total.annualEnergyComplete) total.annualEnergyKWh += annualEnergy
      if (annualCost === null) total.annualCostComplete = false
      else if (total.annualCostComplete) total.annualOperatingCost += annualCost
      const installedCost = installedCostFor(results, installedCosts, key)
      if (installedCost === null) total.installedCostComplete = false
      else if (total.installedCostComplete) total.installedInvestmentCost += installedCost
    }

    const humifogKey = selectedHumifogTechnology(system)
    const humifogResult = results[humifogKey]
    if (humifogResult) {
      const total = totals.humifogSelected
      total.applicableSystems += 1
      const annualEnergy = finiteOrNull(humifogResult.annualEnergyKWh)
      const annualCost = finiteOrNull(humifogResult.annualOperatingCost)
      if (annualEnergy === null) total.annualEnergyComplete = false
      else if (total.annualEnergyComplete) total.annualEnergyKWh += annualEnergy
      if (annualCost === null) total.annualCostComplete = false
      else if (total.annualCostComplete) total.annualOperatingCost += annualCost
      const installedCost = installedCostFor(results, installedCosts, humifogKey)
      if (installedCost === null) total.installedCostComplete = false
      else if (total.installedCostComplete) total.installedInvestmentCost += installedCost
    }
  }

  for (const total of Object.values(totals)) {
    if (!total.annualEnergyComplete) total.annualEnergyKWh = null
    if (!total.annualCostComplete) total.annualOperatingCost = null
    if (!total.installedCostComplete) total.installedInvestmentCost = null
    delete total.annualEnergyComplete
    delete total.annualCostComplete
    delete total.installedCostComplete
  }

  const selectedReferences = activeSystems.map((system) => selectedReferenceTechnology(system, referenceTechnology || 'electricSteam'))
  const uniformReferenceTechnology = selectedReferences.length > 0 && selectedReferences.every((key) => key === selectedReferences[0])
    ? selectedReferences[0]
    : null
  const referenceEnergyValues = activeSystems.map((system) => {
    const results = system.annualTechnologyResults || system.results || {}
    return finiteOrNull(results[selectedReferenceTechnology(system, referenceTechnology || 'electricSteam')]?.annualEnergyKWh)
  })
  const referenceCostValues = activeSystems.map((system) => {
    const results = system.annualTechnologyResults || system.results || {}
    return finiteOrNull(results[selectedReferenceTechnology(system, referenceTechnology || 'electricSteam')]?.annualOperatingCost)
  })
  const referenceInstalledValues = activeSystems.map((system) => {
    const results = system.annualTechnologyResults || system.results || {}
    const installedCosts = system.economics?.installedCosts || system.installedCosts || {}
    return installedCostFor(results, installedCosts, selectedReferenceTechnology(system, referenceTechnology || 'electricSteam'))
  })
  const reference = {
    annualEnergyKWh: sumNullable(referenceEnergyValues),
    annualOperatingCost: sumNullable(referenceCostValues),
    installedInvestmentCost: sumNullable(referenceInstalledValues),
  }
  for (const total of Object.values(totals)) {
    total.annualSavings = reference.annualOperatingCost !== null
      ? reference.annualOperatingCost - total.annualOperatingCost
      : null
    total.incrementalInvestment = reference.installedInvestmentCost !== null && total.installedInvestmentCost !== null
      ? total.installedInvestmentCost - reference.installedInvestmentCost
      : null
    total.simplePaybackYears = total.incrementalInvestment !== null && total.incrementalInvestment > 0 && total.annualSavings !== null && total.annualSavings > 0
      ? total.incrementalInvestment / total.annualSavings
      : null
    total.simpleAnnualRoiPercent = total.incrementalInvestment !== null && total.incrementalInvestment > 0 && total.annualSavings !== null
      ? total.annualSavings / total.incrementalInvestment * 100
      : null
    total.paybackStatus = total.incrementalInvestment === null || total.annualSavings === null
      ? 'notAvailable'
      : total.annualSavings <= 0
        ? 'notEconomical'
        : total.incrementalInvestment <= 0
          ? 'immediate'
          : 'years'
    total.energyReductionPercent = reference.annualEnergyKWh !== null && total.annualEnergyKWh !== null && reference.annualEnergyKWh > 0
      ? (reference.annualEnergyKWh - total.annualEnergyKWh) / reference.annualEnergyKWh * 100
      : null
  }

  const hourBases = [...new Set(activeSystems.map((system) => system.hoursBasis || system.mode?.selectedCalculationMethod || system.results?.electricSteam?.hoursBasis).filter(Boolean))]
  return {
    referenceTechnology: uniformReferenceTechnology,
    referenceTechnologies: selectedReferences,
    referenceEnergy: reference.annualEnergyKWh,
    referenceCost: reference.annualOperatingCost,
    referenceInstalledInvestment: reference.installedInvestmentCost,
    referenceLabel: uniformReferenceTechnology || 'buildingSelectedBySystem',
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