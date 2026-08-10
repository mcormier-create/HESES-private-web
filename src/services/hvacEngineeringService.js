import {
  grainsFromHumidityRatio,
  humidityRatioFromRH,
  moistAirEnthalpyBtuLb,
  sensibleHeatingKw,
  wetBulbC,
} from '../calculations/psychrometrics'

export function calculateHvacDashboardMetrics({
  outsideAirCFM,
  effectiveOutsideAirCFM,
  roomTemperature,
  roomRelativeHumidity,
  outsideWinterTemp,
  selectedRecoveries,
  wheelEfficiency,
  supplyAirTemperature,
  selectedReheatSystem,
  heatPumpCOP,
  steamBoilerEfficiency,
  atmosphericGasHumidifierEfficiency = 82,
  electricityRate,
  naturalGasRate,
  selectedCity,
  economizerTargetTemp,
  is100OA,
  scheduleFactor = 1,
  latentRecoveryEfficiency = 0,
}) {
  const selectedRecovery = selectedRecoveries[0]
  const isNoRecovery = Boolean(selectedRecovery?.noRecovery)
  const latentRecoverySupported = supportsLatentRecovery(selectedRecovery)
  const sensibleRecoveryEfficiency = isNoRecovery
    ? 0
    : clampValue(Number(wheelEfficiency), 0, 95)
  const effectiveLatentRecoveryEfficiency = isNoRecovery || !latentRecoverySupported
    ? 0
    : clampValue(Number(latentRecoveryEfficiency), 0, 95)
  const indoorHumidityRatio = humidityRatioFromRH(roomTemperature, roomRelativeHumidity)
  const outdoorHumidityRatio = humidityRatioFromRH(outsideWinterTemp, 90)
  const recoveredHumidityRatioRaw = outdoorHumidityRatio +
    (effectiveLatentRecoveryEfficiency / 100) * (indoorHumidityRatio - outdoorHumidityRatio)
  const enteringHumidityRatio = clampHumidityRatioBetween(outdoorHumidityRatio, indoorHumidityRatio, recoveredHumidityRatioRaw)
  const deltaW = Math.max(0, indoorHumidityRatio - enteringHumidityRatio)

  const indoorGrains = Math.round(grainsFromHumidityRatio(indoorHumidityRatio))
  const outdoorGrains = Math.round(grainsFromHumidityRatio(enteringHumidityRatio))
  const indoorEnthalpy = Math.round(moistAirEnthalpyBtuLb(roomTemperature, indoorHumidityRatio))
  const outdoorEnthalpy = Math.round(moistAirEnthalpyBtuLb(outsideWinterTemp, enteringHumidityRatio))

  const steamHumidificationLoad = Math.max(0, Math.round(4.5 * effectiveOutsideAirCFM * deltaW))
  const correctedHumidificationLoad = steamHumidificationLoad

  const combinedRecoveryEfficiency = sensibleRecoveryEfficiency
  const cappedRecoveryEfficiency = Math.min(combinedRecoveryEfficiency, 95)
  const baseSteamEnergyKW = Math.round(correctedHumidificationLoad * 0.345)
  const adiabaticLoad = correctedHumidificationLoad

  const latentWheelReductionFactor = 1
  const effectiveDeltaW = deltaW * latentWheelReductionFactor

  const adiabaticTemperatureDrop = Number(
    Math.max(0.3, Math.min(12, effectiveDeltaW * 7000 * 0.22)).toFixed(1)
  )

  const oaTempCalc = selectedCity?.hiver ?? outsideWinterTemp
  const mixTempCalc = is100OA ? oaTempCalc : economizerTargetTemp
  const temperatureRecoveryEfficiency = sensibleRecoveryEfficiency
  const afterWheelTemp = Math.round((mixTempCalc + (temperatureRecoveryEfficiency / 100) * (roomTemperature - mixTempCalc)) * 10) / 10
  const afterHumifogTemp = Math.round((afterWheelTemp - adiabaticTemperatureDrop) * 10) / 10

  const leavingAirTemperature = Number((supplyAirTemperature - adiabaticTemperatureDrop).toFixed(1))
  const reheatDeltaT = Math.max(0, supplyAirTemperature - leavingAirTemperature)
  const enteringHumifogEnthalpy = moistAirEnthalpyBtuLb(afterWheelTemp, enteringHumidityRatio)
  const preheatBtuPerHr = Math.max(0, 4.5 * effectiveOutsideAirCFM * (indoorEnthalpy - enteringHumifogEnthalpy))
  const grossHumifogPreheatKW = Math.round(preheatBtuPerHr / 3412)
  const baseHvacHeatingThermalKW = Math.round(
    sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, supplyAirTemperature - afterWheelTemp))
  )
  const grossReheatKW = Math.max(0, grossHumifogPreheatKW - baseHvacHeatingThermalKW)

  const cassetteBoostFactor = isEnthalpyCassette(selectedRecovery) ? 1.18 : 1
  const recoveryEnergyReductionKW = isNoRecovery
    ? 0
    : Math.round(sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, afterWheelTemp - oaTempCalc)))

  const steamEnergyKW = baseSteamEnergyKW
  const adiabaticPumpKW = Math.max(1, Math.round(adiabaticLoad * 0.0009))
  const recoveredHeatKW = recoveryEnergyReductionKW
  const exchangerRecoveredKW = recoveryEnergyReductionKW
  const netReheatKW = grossReheatKW
  const reheatEnergySource = String(selectedReheatSystem?.energie || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const usesHeatPumpReheat = reheatEnergySource.includes('thermopompe') || reheatEnergySource.includes('heat pump')
  const reheatEnergyKW = usesHeatPumpReheat
    ? Number((netReheatKW / Math.max(heatPumpCOP, 0.1)).toFixed(2))
    : Number((netReheatKW * (selectedReheatSystem?.facteur ?? 1)).toFixed(2))
  const adiabaticHumidificationKW = Math.max(1, adiabaticPumpKW)
  const rawAdiabaticEnergyKW = Number((adiabaticHumidificationKW + reheatEnergyKW).toFixed(2))
  const noRecoveryEnergyParityApplied = false
  const adiabaticEnergyKW = rawAdiabaticEnergyKW

  const naturalGasSteamInputKW = Math.round(steamEnergyKW / (steamBoilerEfficiency / 100))
  const naturalGasM3PerHour = Number((naturalGasSteamInputKW / 10.35).toFixed(1))
  const atmosphericGasHumidifierInputKW = Math.round(steamEnergyKW / (atmosphericGasHumidifierEfficiency / 100))
  const atmosphericGasHumidifierM3PerHour = Number((atmosphericGasHumidifierInputKW / 10.35).toFixed(1))
  const climateSeverityFactor = Math.max(0.4, Math.abs(selectedCity.hiver) / 23)
  const annualHumidificationHours = Math.round(4300 * climateSeverityFactor * scheduleFactor)

  const annualSteamCost = Math.round(steamEnergyKW * electricityRate * annualHumidificationHours)
  const annualNaturalGasCost = Math.round(naturalGasM3PerHour * naturalGasRate * annualHumidificationHours)
  const annualAtmosphericGasHumidifierCost = Math.round(
    atmosphericGasHumidifierM3PerHour * naturalGasRate * annualHumidificationHours
  )
  const annualAdiabaticPumpCost = Math.round(adiabaticHumidificationKW * electricityRate * annualHumidificationHours)
  const annualAdiabaticReheatCost = Math.round(reheatEnergyKW * electricityRate * annualHumidificationHours)
  const annualAdiabaticCost = Math.round(adiabaticEnergyKW * electricityRate * annualHumidificationHours)
  const savings = steamEnergyKW > 0 ? Math.round((1 - adiabaticEnergyKW / steamEnergyKW) * 100) : 0

  const naturalGasGES = Number(((naturalGasSteamInputKW * annualHumidificationHours * 0.182) / 1000).toFixed(1))
  const atmosphericGasHumidifierGES = Number(
    ((atmosphericGasHumidifierInputKW * annualHumidificationHours * 0.182) / 1000).toFixed(1)
  )
  const usesNaturalGasReheat = reheatEnergySource.includes('gaz naturel') || reheatEnergySource.includes('natural gas')
  const adiabaticGES = usesNaturalGasReheat
    ? Number(((reheatEnergyKW * annualHumidificationHours * 0.182) / 1000).toFixed(1))
    : 0
  const eliminatedGES = Number((naturalGasGES - adiabaticGES).toFixed(1))

  return {
    indoorHumidityRatio,
    outdoorHumidityRatio,
    deltaW,
    indoorGrains,
    outdoorGrains,
    indoorEnthalpy,
    outdoorEnthalpy,
    steamHumidificationLoad,
    latentRecoveryEffect: effectiveLatentRecoveryEfficiency,
    sensibleRecoveryEfficiency,
    latentRecoveryEfficiency: effectiveLatentRecoveryEfficiency,
    enteringHumidityRatio,
    correctedHumidificationLoad,
    combinedRecoveryEfficiency,
    cappedRecoveryEfficiency,
    baseSteamEnergyKW,
    adiabaticLoad,
    latentWheelReductionFactor,
    effectiveDeltaW,
    oaTempCalc,
    temperatureRecoveryEfficiency,
    adiabaticTemperatureDrop,
    afterWheelTemp,
    afterHumifogTemp,
    leavingAirTemperature,
    reheatDeltaT,
    grossReheatKW,
    grossHumifogPreheatKW,
    baseHvacHeatingThermalKW,
    reheatEnergyKW,
    cassetteBoostFactor,
    recoveryEnergyReductionKW,
    steamEnergyKW,
    adiabaticPumpKW,
    recoveredHeatKW,
    exchangerRecoveredKW,
    netReheatKW,
    adiabaticHumidificationKW,
    rawAdiabaticEnergyKW,
    noRecoveryEnergyParityApplied,
    adiabaticEnergyKW,
    annualAdiabaticPumpCost,
    annualAdiabaticReheatCost,
    naturalGasSteamInputKW,
    naturalGasM3PerHour,
    atmosphericGasHumidifierEfficiency,
    atmosphericGasHumidifierInputKW,
    atmosphericGasHumidifierM3PerHour,
    climateSeverityFactor,
    annualHumidificationHours,
    annualSteamCost,
    annualNaturalGasCost,
    annualAtmosphericGasHumidifierCost,
    annualAdiabaticCost,
    savings,
    naturalGasGES,
    atmosphericGasHumidifierGES,
    adiabaticGES,
    eliminatedGES,
    outsideAirCFM,
  }
}

export function estimateWetBulbC(dryBulbC, relativeHumidity) {
  return wetBulbC(dryBulbC, relativeHumidity)
}

export function calculateFreeCoolingPhase1({
  enabled,
  bins,
  outdoorDesignTempC,
  outdoorDesignRh,
  economizerTargetTemp,
  roomTemperature,
  supplyAirTemperature,
  outsideAirCFM,
  minimumOutsideAirPercent = 20,
  evaporativeEffectiveness = 0.72,
  compressorCop = 3.2,
  electricityRate = 0.12,
}) {
  const wetBulbC = estimateWetBulbC(outdoorDesignTempC, outdoorDesignRh)
  const evaporativeLeavingTempC = Number(
    (outdoorDesignTempC - evaporativeEffectiveness * Math.max(outdoorDesignTempC - wetBulbC, 0)).toFixed(1)
  )
  const dryEconomizerActive = outdoorDesignTempC <= economizerTargetTemp
  const evaporativeActive = enabled && evaporativeLeavingTempC <= supplyAirTemperature
  const sensibleCoolingKw = Math.max(
    0,
    ((1.08 * outsideAirCFM * Math.max(outdoorDesignTempC - evaporativeLeavingTempC, 0)) / 3412) * 1.8
  )

  const rows = bins.map(([tempC, hours]) => {
    const binRh = outdoorDesignRh
    const binWetBulb = estimateWetBulbC(tempC, binRh)
    const leavingTempC = tempC - evaporativeEffectiveness * Math.max(tempC - binWetBulb, 0)
    const adiabaticDropC = Math.max(tempC - leavingTempC, 0)
    const targetMixTempC = Math.min(roomTemperature, economizerTargetTemp + adiabaticDropC)
    const minimumOutsideAirFraction = minimumOutsideAirPercent / 100
    const requiredOutsideAirFraction = tempC < targetMixTempC && targetMixTempC <= roomTemperature
      ? Math.max(0, Math.min(1, (targetMixTempC - roomTemperature) / (tempC - roomTemperature)))
      : 0
    const dryFreeCooling = tempC <= economizerTargetTemp && economizerTargetTemp < roomTemperature
    const evaporativeFreeCooling = enabled && requiredOutsideAirFraction > minimumOutsideAirFraction
    const savedCoolingKw = evaporativeFreeCooling
      ? Math.max(0, ((1.08 * outsideAirCFM * (tempC - leavingTempC)) / 3412) * 1.8)
      : 0

    return {
      tempC,
      hours,
      wetBulbC: Number(binWetBulb.toFixed(1)),
      leavingTempC: Number(leavingTempC.toFixed(1)),
      dryFreeCooling,
      evaporativeFreeCooling,
      requiredOutsideAirPercent: Math.round(requiredOutsideAirFraction * 100),
      savedCoolingKwh: savedCoolingKw / compressorCop * hours,
    }
  })

  const evaporativeHours = rows.reduce((total, row) => total + (row.evaporativeFreeCooling ? row.hours : 0), 0)
  const dryEconomizerHours = rows.reduce((total, row) => total + (row.dryFreeCooling ? row.hours : 0), 0)
  const annualSavedKwh = Math.round(rows.reduce((total, row) => total + row.savedCoolingKwh, 0))

  return {
    enabled,
    wetBulbC: Number(wetBulbC.toFixed(1)),
    evaporativeLeavingTempC,
    dryEconomizerActive,
    evaporativeActive,
    sensibleCoolingKw: Math.round(sensibleCoolingKw),
    dryEconomizerHours,
    evaporativeHours,
    annualSavedKwh,
    annualSavings: Math.round(annualSavedKwh * electricityRate),
    rows,
  }
}

function supportsLatentRecovery(recovery) {
  const name = normalizeRecoveryName(recovery)
  if (!recovery) return false
  return name.includes('roue') || name.includes('thermal wheel') ||
    (name.includes('cassette') && (name.includes('enthalpique') || name.includes('enthalpy')))
}

function isEnthalpyCassette(recovery) {
  const name = normalizeRecoveryName(recovery)
  return name.includes('cassette') && (name.includes('enthalpique') || name.includes('enthalpy'))
}

function normalizeRecoveryName(recovery) {
  return String(recovery?.nom ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function clampValue(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max)
}

function clampHumidityRatioBetween(outdoorHumidityRatio, returnHumidityRatio, recoveredHumidityRatio) {
  const minRatio = Math.min(outdoorHumidityRatio, returnHumidityRatio)
  const maxRatio = Math.max(outdoorHumidityRatio, returnHumidityRatio)
  return clampValue(recoveredHumidityRatio, Math.max(0, minRatio), maxRatio)
}
