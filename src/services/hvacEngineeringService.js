import {
  grainsFromHumidityRatio,
  humidityRatioFromRH,
  moistAirEnthalpyBtuLb,
  relativeHumidityFromHumidityRatio,
  sensibleHeatingKw,
  wetBulbC,
} from '../calculations/psychrometrics.js'

export function calculateHvacDashboardMetrics({
  outsideAirCFM,
  effectiveOutsideAirCFM,
  roomTemperature,
  roomRelativeHumidity,
  supplyAirTemperature = roomTemperature,
  outsideWinterTemp,
  selectedRecoveries,
  wheelEfficiency,
  selectedReheatSystem,
  heatPumpCOP,
  steamBoilerEfficiency,
  atmosphericGasHumidifierEfficiency = 82,
  electricityRate,
  naturalGasRate,
  selectedCity,
  economizerTargetTemp,
  is100OA,
  outsideRelativeHumidity = 90,
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
  const finalSupplyTemperature = is100OA && Number.isFinite(Number(supplyAirTemperature))
    ? Number(supplyAirTemperature)
    : roomTemperature
  const indoorHumidityRatio = humidityRatioFromRH(finalSupplyTemperature, roomRelativeHumidity)
  const outdoorHumidityRatio = humidityRatioFromRH(outsideWinterTemp, outsideRelativeHumidity)
  const recoveredHumidityRatioRaw = outdoorHumidityRatio +
    (effectiveLatentRecoveryEfficiency / 100) * (indoorHumidityRatio - outdoorHumidityRatio)
  const enteringHumidityRatio = clampHumidityRatioBetween(outdoorHumidityRatio, indoorHumidityRatio, recoveredHumidityRatioRaw)
  const deltaW = Math.max(0, indoorHumidityRatio - enteringHumidityRatio)

  const indoorGrainsRaw = grainsFromHumidityRatio(indoorHumidityRatio)
  const outdoorGrainsRaw = grainsFromHumidityRatio(enteringHumidityRatio)
  const indoorEnthalpyRaw = moistAirEnthalpyBtuLb(finalSupplyTemperature, indoorHumidityRatio)
  const outdoorEnthalpyRaw = moistAirEnthalpyBtuLb(outsideWinterTemp, enteringHumidityRatio)

  const steamHumidificationLoadRaw = Math.max(0, 4.5 * effectiveOutsideAirCFM * deltaW)
  const correctedHumidificationLoadRaw = steamHumidificationLoadRaw

  const combinedRecoveryEfficiency = sensibleRecoveryEfficiency
  const cappedRecoveryEfficiency = Math.min(combinedRecoveryEfficiency, 95)
  const baseSteamEnergyKWRaw = correctedHumidificationLoadRaw * 0.345
  const adiabaticLoadRaw = correctedHumidificationLoadRaw
  const humidificationTolerance = 1e-9
  const hasActiveHumidification = adiabaticLoadRaw > humidificationTolerance

  const latentWheelReductionFactor = 1
  const effectiveDeltaW = deltaW * latentWheelReductionFactor

  const oaTempCalc = selectedCity?.hiver ?? outsideWinterTemp
  const mixTempCalc = is100OA ? oaTempCalc : economizerTargetTemp
  const temperatureRecoveryEfficiency = sensibleRecoveryEfficiency
  const afterWheelTempRaw = mixTempCalc + (temperatureRecoveryEfficiency / 100) * (roomTemperature - mixTempCalc)
  const enteringHumifogEnthalpyRaw = moistAirEnthalpyBtuLb(afterWheelTempRaw, enteringHumidityRatio)
  const preheatBtuPerHrRaw = hasActiveHumidification
    ? Math.max(0, 4.5 * effectiveOutsideAirCFM * (indoorEnthalpyRaw - enteringHumifogEnthalpyRaw))
    : 0
  const preheatTargetTempRaw = hasActiveHumidification
    ? calculateAutomaticPreHumifogTemperature(indoorEnthalpyRaw, enteringHumidityRatio)
    : afterWheelTempRaw
  const afterHumifogTempRaw = hasActiveHumidification ? finalSupplyTemperature : afterWheelTempRaw
  const adiabaticTemperatureDropRaw = Math.max(0, preheatTargetTempRaw - afterHumifogTempRaw)
  const preheatRelativeHumidityRaw = relativeHumidityFromHumidityRatio(preheatTargetTempRaw, enteringHumidityRatio)
  const afterHumifogRelativeHumidityRaw = relativeHumidityFromHumidityRatio(afterHumifogTempRaw, indoorHumidityRatio)

  const leavingAirTemperatureRaw = afterHumifogTempRaw
  const reheatDeltaTRaw = Math.max(0, preheatTargetTempRaw - leavingAirTemperatureRaw)
  const grossHumifogPreheatKWRaw = hasActiveHumidification ? (preheatBtuPerHrRaw / 3412) : 0
  const baseHvacHeatingThermalKWRaw = sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, preheatTargetTempRaw - afterWheelTempRaw))
  const commonHvacHeatingThermalKWRaw = sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, finalSupplyTemperature - afterWheelTempRaw))
  const grossReheatKWRaw = hasActiveHumidification
    ? is100OA
      ? sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, preheatTargetTempRaw - finalSupplyTemperature))
      : Math.max(0, grossHumifogPreheatKWRaw - baseHvacHeatingThermalKWRaw)
    : 0

  const cassetteBoostFactor = isEnthalpyCassette(selectedRecovery) ? 1.18 : 1
  const recoveryEnergyReductionKWRaw = isNoRecovery
    ? 0
    : sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, afterWheelTempRaw - oaTempCalc))

  const steamEnergyKWRaw = baseSteamEnergyKWRaw
  const adiabaticPumpKWRaw = hasActiveHumidification
    ? Math.max(1, adiabaticLoadRaw * 0.0009)
    : 0
  const recoveredHeatKWRaw = recoveryEnergyReductionKWRaw
  const exchangerRecoveredKWRaw = recoveryEnergyReductionKWRaw
  const netReheatKWRaw = grossReheatKWRaw
  const reheatEnergySource = String(selectedReheatSystem?.energie || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const usesPassiveRecoveryReheat = reheatEnergySource.includes('recuperation') || reheatEnergySource.includes('recovery') || reheatEnergySource.includes('passive')
  const usesHeatPumpReheat = reheatEnergySource.includes('thermopompe') || reheatEnergySource.includes('heat pump')
  const usesNaturalGasReheat = reheatEnergySource.includes('gaz naturel') || reheatEnergySource.includes('natural gas') || reheatEnergySource.includes('gaz')
  const selectedReheatEfficiencyPercent = Number.isFinite(Number(selectedReheatSystem?.rendement))
    ? Number(selectedReheatSystem.rendement)
    : (usesHeatPumpReheat ? 100 : 100)
  const selectedReheatCop = Number.isFinite(Number(selectedReheatSystem?.cop))
    ? Number(selectedReheatSystem.cop)
    : heatPumpCOP
  const reheatEnergyKWRaw = usesPassiveRecoveryReheat
    ? 0
    : usesHeatPumpReheat
      ? netReheatKWRaw / Math.max(selectedReheatCop, 0.1)
      : usesNaturalGasReheat
        ? netReheatKWRaw / Math.max(selectedReheatEfficiencyPercent / 100, 0.01)
        : netReheatKWRaw * (selectedReheatSystem?.facteur ?? 1)
  const adiabaticHumidificationKWRaw = adiabaticPumpKWRaw
  const rawAdiabaticEnergyKW = Math.max(0, adiabaticHumidificationKWRaw + reheatEnergyKWRaw)
  const noRecoveryEnergyParityApplied = false
  const adiabaticEnergyKW = rawAdiabaticEnergyKW

  const steamInputEnergyKWRaw = steamEnergyKWRaw / Math.max(steamBoilerEfficiency / 100, 0.01)
  const naturalGasSteamInputKWRaw = steamInputEnergyKWRaw
  const naturalGasM3PerHourRaw = naturalGasSteamInputKWRaw / 10.35
  const atmosphericGasHumidifierInputKWRaw = steamEnergyKWRaw / Math.max(atmosphericGasHumidifierEfficiency / 100, 0.01)
  const atmosphericGasHumidifierM3PerHourRaw = atmosphericGasHumidifierInputKWRaw / 10.35
  const climateSeverityFactor = Math.max(0.4, Math.abs(selectedCity.hiver) / 23)
  const annualHumidificationHoursRaw = 4300 * climateSeverityFactor * scheduleFactor

  const annualSteamCostRaw = steamInputEnergyKWRaw * electricityRate * annualHumidificationHoursRaw
  const annualNaturalGasCostRaw = naturalGasM3PerHourRaw * naturalGasRate * annualHumidificationHoursRaw
  const annualAtmosphericGasHumidifierCostRaw = atmosphericGasHumidifierM3PerHourRaw * naturalGasRate * annualHumidificationHoursRaw
  const annualAdiabaticPumpCostRaw = adiabaticHumidificationKWRaw * electricityRate * annualHumidificationHoursRaw
  const annualAdiabaticReheatCostRaw = usesPassiveRecoveryReheat
    ? 0
    : usesNaturalGasReheat
      ? (reheatEnergyKWRaw / 10.35) * naturalGasRate * annualHumidificationHoursRaw
      : reheatEnergyKWRaw * electricityRate * annualHumidificationHoursRaw
  const annualAdiabaticCostRaw = annualAdiabaticPumpCostRaw + annualAdiabaticReheatCostRaw
  const savingsRaw = steamEnergyKWRaw > 0 ? (1 - adiabaticEnergyKW / steamEnergyKWRaw) * 100 : 0

  const naturalGasGESRaw = (naturalGasSteamInputKWRaw * annualHumidificationHoursRaw * 0.182) / 1000
  const atmosphericGasHumidifierGESRaw = (atmosphericGasHumidifierInputKWRaw * annualHumidificationHoursRaw * 0.182) / 1000
  const adiabaticGESRaw = usesNaturalGasReheat
    ? (reheatEnergyKWRaw * annualHumidificationHoursRaw * 0.182) / 1000
    : 0
  const eliminatedGESRaw = naturalGasGESRaw - adiabaticGESRaw

  const indoorGrains = Math.round(indoorGrainsRaw)
  const outdoorGrains = Math.round(outdoorGrainsRaw)
  const indoorEnthalpy = Math.round(indoorEnthalpyRaw)
  const outdoorEnthalpy = Math.round(outdoorEnthalpyRaw)
  const steamHumidificationLoad = Math.round(steamHumidificationLoadRaw)
  const correctedHumidificationLoad = steamHumidificationLoad
  const baseSteamEnergyKW = Math.round(baseSteamEnergyKWRaw)
  const adiabaticLoad = steamHumidificationLoad
  const adiabaticTemperatureDrop = Number(adiabaticTemperatureDropRaw.toFixed(1))
  const afterWheelTemp = Math.round(afterWheelTempRaw * 10) / 10
  const afterHumifogTemp = Math.round(afterHumifogTempRaw * 10) / 10
  const leavingAirTemperature = Number(leavingAirTemperatureRaw.toFixed(1))
  const reheatDeltaT = reheatDeltaTRaw
  const grossHumifogPreheatKW = Math.round(grossHumifogPreheatKWRaw)
  const baseHvacHeatingThermalKW = Math.round(baseHvacHeatingThermalKWRaw)
  const commonHvacHeatingThermalKW = Math.round(commonHvacHeatingThermalKWRaw)
  const grossReheatKW = Math.round(grossReheatKWRaw)
  const recoveryEnergyReductionKW = Math.round(recoveryEnergyReductionKWRaw)
  const steamEnergyKW = Math.round(steamEnergyKWRaw)
  const adiabaticPumpKW = hasActiveHumidification
    ? Math.max(1, Math.round(adiabaticPumpKWRaw))
    : 0
  const recoveredHeatKW = Math.round(recoveredHeatKWRaw)
  const exchangerRecoveredKW = Math.round(exchangerRecoveredKWRaw)
  const netReheatKW = grossReheatKW
  const reheatEnergyKW = Number(reheatEnergyKWRaw.toFixed(2))
  const adiabaticHumidificationKW = hasActiveHumidification
    ? Math.max(1, Math.round(adiabaticHumidificationKWRaw))
    : 0
  const naturalGasSteamInputKW = Math.round(naturalGasSteamInputKWRaw)
  const naturalGasM3PerHour = Number(naturalGasM3PerHourRaw.toFixed(1))
  const atmosphericGasHumidifierInputKW = Math.round(atmosphericGasHumidifierInputKWRaw)
  const atmosphericGasHumidifierM3PerHour = Number(atmosphericGasHumidifierM3PerHourRaw.toFixed(1))
  const annualHumidificationHours = Math.round(annualHumidificationHoursRaw)
  const annualSteamCost = Math.round(annualSteamCostRaw)
  const annualNaturalGasCost = Math.round(annualNaturalGasCostRaw)
  const annualAtmosphericGasHumidifierCost = Math.round(annualAtmosphericGasHumidifierCostRaw)
  const annualAdiabaticPumpCost = Math.round(annualAdiabaticPumpCostRaw)
  const annualAdiabaticReheatCost = Math.round(annualAdiabaticReheatCostRaw)
  const annualAdiabaticCost = Math.round(annualAdiabaticCostRaw)
  const savings = Math.round(savingsRaw)
  const naturalGasGES = Number(naturalGasGESRaw.toFixed(1))
  const atmosphericGasHumidifierGES = Number(atmosphericGasHumidifierGESRaw.toFixed(1))
  const adiabaticGES = Number(adiabaticGESRaw.toFixed(1))
  const eliminatedGES = Number(eliminatedGESRaw.toFixed(1))

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
    preHumifogTempRaw: preheatTargetTempRaw,
    preHumifogTemp: Number(preheatTargetTempRaw.toFixed(1)),
    preHumifogRh: Number(preheatRelativeHumidityRaw.toFixed(1)),
    afterHumifogRh: Number(afterHumifogRelativeHumidityRaw.toFixed(1)),
    leavingAirTemperature,
    reheatDeltaT,
    grossReheatKW,
    grossHumifogPreheatKW,
    baseHvacHeatingThermalKW,
    commonHvacHeatingThermalKW,
    commonHvacHeatingThermalKWRaw,
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
    outsideRelativeHumidity,
    indoorGrainsRaw,
    outdoorGrainsRaw,
    indoorEnthalpyRaw,
    outdoorEnthalpyRaw,
    steamHumidificationLoadRaw,
    correctedHumidificationLoadRaw,
    baseSteamEnergyKWRaw,
    adiabaticLoadRaw,
    adiabaticTemperatureDropRaw,
    afterWheelTempRaw,
    afterHumifogTempRaw,
    leavingAirTemperatureRaw,
    reheatDeltaTRaw,
    enteringHumifogEnthalpyRaw,
    preheatBtuPerHrRaw,
    grossHumifogPreheatKWRaw,
    baseHvacHeatingThermalKWRaw,
    grossReheatKWRaw,
    recoveryEnergyReductionKWRaw,
    steamEnergyKWRaw,
    adiabaticPumpKWRaw,
    recoveredHeatKWRaw,
    exchangerRecoveredKWRaw,
    netReheatKWRaw,
    reheatEnergyKWRaw,
    adiabaticHumidificationKWRaw,
    adiabaticEnergyKWRaw: rawAdiabaticEnergyKW,
    naturalGasSteamInputKWRaw,
    naturalGasM3PerHourRaw,
    atmosphericGasHumidifierInputKWRaw,
    atmosphericGasHumidifierM3PerHourRaw,
    annualHumidificationHoursRaw,
    annualSteamCostRaw,
    annualNaturalGasCostRaw,
    annualAtmosphericGasHumidifierCostRaw,
    annualAdiabaticPumpCostRaw,
    annualAdiabaticReheatCostRaw,
    annualAdiabaticCostRaw,
    savingsRaw,
    naturalGasGESRaw,
    atmosphericGasHumidifierGESRaw,
    adiabaticGESRaw,
    eliminatedGESRaw,
  }
}

export function estimateWetBulbC(dryBulbC, relativeHumidity) {
  return wetBulbC(dryBulbC, relativeHumidity)
}

function dryBulbFromEnthalpyHumidityRatioBtu(enthalpyBtuLb, humidityRatio) {
  const safeHumidityRatio = Math.max(0, Number(humidityRatio) || 0)
  const denominator = 0.24 + 0.444 * safeHumidityRatio
  if (Math.abs(denominator) < 1e-9) return 0
  return (Number(enthalpyBtuLb) - safeHumidityRatio * 1061) / denominator
}

export function calculateAutomaticPreHumifogTemperature(enthalpyBtuLb, humidityRatio) {
  const dryBulbF = dryBulbFromEnthalpyHumidityRatioBtu(enthalpyBtuLb, humidityRatio)
  return (dryBulbF - 32) * 5 / 9
}

export function calculateFreeCoolingPhase1({
  enabled,
  bins,
  outdoorDesignTempC,
  outdoorDesignRh,
  economizerTargetTemp,
  roomTemperature,
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
  const evaporativeActive = enabled && evaporativeLeavingTempC <= roomTemperature
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
