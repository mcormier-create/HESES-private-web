import {
  applyHeatRecovery,
  applyHeatingToDryBulb,
  mixAirStates,
  overrideDryBulbKeepingHumidityRatio,
  psychrometricState,
  sensibleHeatingKw,
  stateFromDbW,
} from '../calculations/psychrometrics'

export const FREE_COOLING_OA_TEST_POINTS = [20, 25, 30, 35, 40, 50, 60]

export function calculateFreeCoolingHumifogComparison({
  bins,
  roomDb = 22,
  roomRh = 35,
  minimumOutdoorAirPercent = 20,
  recoveryType = 'none',
  recoveryEfficiency = null,
  humifogEffectiveness = 0.72,
  airflowCfm = 12500,
  electricityRate = 0.12,
  naturalGasRate = 0.45,
  mixedAirTargetDb = roomDb,
  selectedReheatSystem,
  heatPumpCOP = 3.8,
  useMeasuredMixedAirTemperature = false,
  measuredMixedAirTemperatureC = 18,
}) {
  const weatherBins = normalizeBins(bins)
  const hasValidBins = weatherBins.length > 0 && weatherBins.every((bin) =>
    Number.isFinite(bin.tempC) &&
    Number.isFinite(bin.hours) &&
    bin.hours > 0 &&
    Number.isFinite(bin.rh)
  )
  const room = psychrometricState({ dryBulbC: roomDb, relativeHumidity: roomRh })
  const normalizedRecoveryType = normalizeRecoveryType(recoveryType)
  const normalizedRecoveryEfficiency = Number.isFinite(Number(recoveryEfficiency))
    ? clamp(Number(recoveryEfficiency) / 100, 0, 0.95)
    : null
  const normalizedEffectiveness = humifogEffectiveness > 1
    ? humifogEffectiveness / 100
    : humifogEffectiveness

  const minimumOa = clamp(minimumOutdoorAirPercent, 0, 100)
  const steamDamperMinimumOa = minimumOa
  const humifogDamperMinimumOa = minimumOa
  const common = {
    room,
    roomDb,
    recoveryType: normalizedRecoveryType,
    recoveryEfficiency: normalizedRecoveryEfficiency,
    humifogEffectiveness: normalizedEffectiveness,
    mixedAirTargetDb,
    airflowCfm,
    selectedReheatSystem,
    heatPumpCOP,
    electricityRate,
    naturalGasRate,
    useMeasuredMixedAirTemperature,
    measuredMixedAirTemperatureC,
  }

  const binRows = weatherBins.map((bin) => calculateHumifogBinRow({
    ...common,
    bin,
    outdoorAirPercent: minimumOa,
    damperMinimumOutdoorAirPercent: humifogDamperMinimumOa,
  }))

  const oaTestPoints = [...new Set([
    minimumOa,
    ...FREE_COOLING_OA_TEST_POINTS.filter((oaPercent) => oaPercent >= minimumOa),
  ])].sort((a, b) => a - b)

  const optimizationRows = oaTestPoints.map((oaPercent) => {
    const rows = weatherBins.map((bin) => calculateHumifogBinRow({
      ...common,
      bin,
      outdoorAirPercent: oaPercent,
      damperMinimumOutdoorAirPercent: oaPercent,
    }))
    const summary = summarizeRows(rows)

    return {
      oaPercent,
      raPercent: 100 - oaPercent,
      tmix: summary.averageMixedDb,
      rhmix: summary.averageMixedRh,
      wmix: summary.averageMixedW,
      hmix: summary.averageMixedH,
      humifogOutletT: summary.averageHumifogDb,
      heatingEnergyKwh: summary.heatingEnergyKwh + summary.reheatEnergyKwh,
      humidificationEnergyKwh: summary.humidificationEnergyKwh,
      reheatLoadKwh: summary.reheatEnergyKwh,
      totalEnergyKwh: summary.totalEnergyKwh,
      annualCost: summary.totalCost,
      rows,
    }
  })

  const optimal = optimizationRows.reduce(
    (best, row) => (row.totalEnergyKwh < best.totalEnergyKwh ? row : best),
    optimizationRows[0]
  )

  const conventionalRows = weatherBins.map((bin) => calculateConventionalFreeCoolingRow({
    ...common,
    bin,
    minimumOutdoorAirPercent: steamDamperMinimumOa,
    designMinimumOutdoorAirPercent: minimumOa,
  }))
  const optimizedHumifogRows = weatherBins.map((bin) => calculateHumifogBinRow({
    ...common,
    bin,
    outdoorAirPercent: minimumOa,
    damperMinimumOutdoorAirPercent: humifogDamperMinimumOa,
  }))

  const freeCooling = summarizeRows(conventionalRows)
  const humifog = summarizeRows(optimizedHumifogRows)
  const freeCoolingAnnualCost = freeCooling.totalCost
  const humifogAnnualCost = humifog.totalCost
  const energyDeltaKwh = freeCooling.totalEnergyKwh - humifog.totalEnergyKwh
  const costDelta = freeCoolingAnnualCost - humifogAnnualCost
  const savingsKwh = energyDeltaKwh
  const annualSavings = costDelta
  const savingsPercent = freeCooling.totalEnergyKwh > 0
    ? (savingsKwh / freeCooling.totalEnergyKwh) * 100
    : 0
  const annualComparison = {
    freeCooling: {
      ...freeCooling,
      annualCost: freeCoolingAnnualCost,
    },
    humifog: {
      ...humifog,
      annualCost: humifogAnnualCost,
    },
    savingsKwh,
    annualSavings,
    savingsPercent,
    energyDeltaKwh,
    costDelta,
    humifogDebug: {
      humifogPumpKwh: humifog.humidificationEnergyKwh,
      humifogPumpCost: humifog.humidificationCost,
      adiabaticReheatThermalKwh: humifog.adiabaticReheatThermalKwh,
      heatPumpCOP,
      adiabaticReheatElectricKwh: humifog.adiabaticReheatElectricKwh,
      selectedReheatEnergyKwh: humifog.reheatEnergyKwh,
      selectedReheatCost: humifog.reheatCost,
      selectedReheatSource: reheatSourceType(selectedReheatSystem),
      totalAnnualHumifogKwh: humifog.totalEnergyKwh,
      totalAnnualHumifogCost: humifogAnnualCost,
    },
  }
  const binValidationRows = buildBinValidationRows(conventionalRows, optimizedHumifogRows)
  const annualTotalsValidation = buildAnnualTotalsValidation(binValidationRows, annualComparison)
  const dominantRow = binRows.reduce(
    (best, row) => (row.hours > best.hours ? row : best),
    binRows[0]
  )

  return {
    isComplete: hasValidBins && Number.isFinite(savingsKwh) && Number.isFinite(annualSavings),
    incompleteReason: hasValidBins ? '' : 'Missing or invalid BIN weather data',
    bins: weatherBins,
    binRows,
    conventionalRows,
    optimizedHumifogRows,
    binValidationRows,
    annualTotalsValidation,
    optimizationRows,
    optimal,
    psychrometricPoints: dominantRow?.points ?? [],
    validation: {
      calculatedMixedDb: dominantRow?.calculatedMixed.db ?? 0,
      measuredMixedDb: useMeasuredMixedAirTemperature ? measuredMixedAirTemperatureC : null,
      activeMixedDb: dominantRow?.mixed.db ?? 0,
      mixedAirDifferenceC: useMeasuredMixedAirTemperature
        ? measuredMixedAirTemperatureC - (dominantRow?.calculatedMixed.db ?? measuredMixedAirTemperatureC)
        : 0,
      dominantBinTempC: dominantRow?.tempC ?? 0,
      dominantBinHours: dominantRow?.hours ?? 0,
      isOverridden: useMeasuredMixedAirTemperature,
    },
    annualComparison,
    annualBreakdownRows: buildAnnualBreakdownRows(annualComparison),
    netSavings: buildNetSavings(annualComparison),
    message: {
      minimumOa,
      conventionalOa: freeCooling.averageOa,
      optimalOa: optimal.oaPercent,
      mixedAirIncreaseC: humifog.averageMixedDb - freeCooling.averageMixedDb,
      heatingReductionKwh: freeCooling.heatingEnergyKwh - humifog.heatingEnergyKwh,
      humidificationReductionKwh: freeCooling.humidificationEnergyKwh - humifog.humidificationEnergyKwh,
    },
  }
}

function calculateHumifogBinRow({
  bin,
  room,
  outdoorAirPercent,
  damperMinimumOutdoorAirPercent = outdoorAirPercent,
  recoveryType,
  recoveryEfficiency,
  humifogEffectiveness,
  mixedAirTargetDb,
  airflowCfm,
  selectedReheatSystem,
  heatPumpCOP,
  electricityRate,
  naturalGasRate,
  useMeasuredMixedAirTemperature,
  measuredMixedAirTemperatureC,
}) {
  const oa = psychrometricState({ dryBulbC: bin.tempC, relativeHumidity: bin.rh })
  const targetAfterHumifogDb = Number.isFinite(Number(mixedAirTargetDb))
    ? Number(mixedAirTargetDb)
    : room.db
  const finalState = calculateHumifogFreeCoolingState({
    oa,
    room,
    minimumOutdoorAirPercent: outdoorAirPercent,
    targetAfterHumifogDb,
    recoveryType,
    recoveryEfficiency,
    humifogEffectiveness,
    airflowCfm,
    selectedReheatSystem,
    heatPumpCOP,
    useMeasuredMixedAirTemperature,
    measuredMixedAirTemperatureC,
    damperMinimumOutdoorAirPercent,
  })
  const {
    calculatedMixed,
    mixed,
    recovered,
    inletToHumifog,
    afterHumifog,
    afterHeating,
    damperTargetDb,
    damperSolve,
    reheatDeltaC,
    reheatThermalKw,
    heatingLoadKw,
    reheatLoadKw,
    totalAfterHumifogHeatingKw,
    adiabaticCoolingC,
    mechanicalReheatRequired,
  } = finalState
  const humifogLoadLbHr = waterLoadLbHr(airflowCfm, Math.max(0, afterHumifog.w - inletToHumifog.w))
  const humifogPumpKw = Math.max(0, humifogLoadLbHr * 0.0009)
  const freeCoolingEconomy = calculateFreeCoolingEconomy({
    rowHours: bin.hours,
    airflowCfm,
    returnAir: room,
    leavingAir: afterHumifog,
    outdoorAirPercent: damperSolve.outdoorAirPercent,
    minimumOutdoorAirPercent: outdoorAirPercent,
    reheatLoadKw,
    humifogPumpKw,
  })
  const heatingEnergyKwh = heatingLoadKw * bin.hours
  const reheatEnergyKwh = reheatLoadKw * bin.hours
  const adiabaticReheatThermalKw = sensibleHeatingKw(airflowCfm, adiabaticCoolingC)
  const adiabaticReheatThermalKwh = adiabaticReheatThermalKw * bin.hours
  const adiabaticReheatElectricKw = adiabaticReheatThermalKw / Math.max(heatPumpCOP, 0.1)
  const adiabaticReheatElectricKwh = adiabaticReheatElectricKw * bin.hours
  const humidificationEnergyKwh = humifogPumpKw * bin.hours
  const totalEnergyKwh = heatingEnergyKwh + humidificationEnergyKwh + reheatEnergyKwh
  const heatingCost = reheatEnergyCost(heatingEnergyKwh, selectedReheatSystem, electricityRate, naturalGasRate)
  const humidificationCost = humidificationEnergyKwh * electricityRate
  const reheatCost = reheatEnergyCost(reheatEnergyKwh, selectedReheatSystem, electricityRate, naturalGasRate)
  const totalCost = heatingCost + humidificationCost + reheatCost
  const outdoorAirCfm = airflowCfm * damperSolve.outdoorAirPercent / 100
  const returnAirCfm = airflowCfm - outdoorAirCfm

  return {
    strategy: 'humifog',
    tempC: bin.tempC,
    rh: bin.rh,
    hours: bin.hours,
    oa,
    ra: room,
    calculatedMixed,
    mixed,
    recovered,
    inletToHumifog,
    afterHumifog,
    afterHeating,
    outdoorAirPercent: damperSolve.outdoorAirPercent,
    appliedOutdoorAirPercent: damperSolve.appliedOutdoorAirPercent ?? damperSolve.outdoorAirPercent,
    requestedOutdoorAirPercent: damperSolve.requestedOutdoorAirPercent,
    theoreticalOutdoorAirPercent: damperSolve.theoreticalOutdoorAirPercent ?? damperSolve.requestedOutdoorAirPercent,
    requestedMixedDb: damperSolve.requestedMixed?.db ?? damperTargetDb,
    returnAirPercent: 100 - damperSolve.outdoorAirPercent,
    outdoorAirCfm,
    returnAirCfm,
    minimumOutdoorAirPercent: outdoorAirPercent,
    targetAfterHumifogDb,
    targetMixedDb: damperTargetDb,
    damperCanMeetTarget: damperSolve.canMeetTarget,
    damperLimitedByMinimum: damperSolve.limitedByMinimum,
    damperLimitedByMaximum: damperSolve.limitedByMaximum,
    adiabaticCoolingC,
    mechanicalReheatRequired,
    humifogWetBulbReferenceC: mixed.wb,
    reheatDeltaC,
    reheatThermalKw,
    humifogLoadLbHr,
    humifogLoadKgH: humifogLoadLbHr * 0.453592,
    humidificationLoadKw: humifogPumpKw,
    humifogPumpKw,
    heatingLoadKw,
    reheatLoadKw,
    adiabaticReheatThermalKw,
    adiabaticReheatThermalKwh,
    adiabaticReheatElectricKw,
    adiabaticReheatElectricKwh,
    heatPumpCOP,
    totalAfterHumifogHeatingKw,
    heatingEnergyKwh,
    comparisonHeatingEnergyKwh: heatingLoadKw * bin.hours,
    humidificationEnergyKwh,
    reheatEnergyKwh,
    totalEnergyKwh,
    heatingCost,
    humidificationCost,
    reheatCost,
    totalCost,
    ...freeCoolingEconomy,
    points: buildPoints({ oa, room, mixed, recovered, afterHumifog, afterHeating }),
  }
}

function calculateConventionalFreeCoolingRow({
  bin,
  room,
  minimumOutdoorAirPercent,
  designMinimumOutdoorAirPercent = minimumOutdoorAirPercent,
  recoveryType,
  recoveryEfficiency,
  mixedAirTargetDb,
  airflowCfm,
  selectedReheatSystem,
  heatPumpCOP,
  electricityRate,
  naturalGasRate,
  useMeasuredMixedAirTemperature,
  measuredMixedAirTemperatureC,
}) {
  const oa = psychrometricState({ dryBulbC: bin.tempC, relativeHumidity: bin.rh })
  const targetMixedDb = Number.isFinite(Number(mixedAirTargetDb))
    ? Number(mixedAirTargetDb)
    : room.db
  const freeCoolingPossible = isFreeCoolingPossible(oa, room)
  const damperSolve = freeCoolingPossible
    ? solveOutdoorAirForMixedDryBulb(oa, room, targetMixedDb, minimumOutdoorAirPercent)
    : solveMinimumOutdoorAir(oa, room, targetMixedDb, minimumOutdoorAirPercent)
  const calculatedMixed = damperSolve.mixed
  const mixed = useMeasuredMixedAirTemperature
    ? overrideDryBulbKeepingHumidityRatio(calculatedMixed, measuredMixedAirTemperatureC)
    : calculatedMixed
  const recovered = applyHeatRecoveryForSelectedSystem(mixed, room, recoveryType, recoveryEfficiency)
  const afterHeating = applyHeatingToDryBulb(recovered, Math.max(recovered.db, targetMixedDb))
  const waterNeededLbHr = waterLoadLbHr(airflowCfm, Math.max(0, room.w - afterHeating.w))
  const steamHumidificationKw = waterNeededLbHr * 0.345
  const heatingLoadKw = reheatInputKw(
    sensibleHeatingKw(airflowCfm, Math.max(0, targetMixedDb - recovered.db)),
    selectedReheatSystem,
    heatPumpCOP
  )
  const freeCoolingEconomy = calculateFreeCoolingEconomy({
    rowHours: bin.hours,
    airflowCfm,
    returnAir: room,
    leavingAir: recovered,
    outdoorAirPercent: damperSolve.outdoorAirPercent,
    minimumOutdoorAirPercent,
    designMinimumOutdoorAirPercent,
    reheatLoadKw: heatingLoadKw,
    humifogPumpKw: 0,
  })
  const heatingEnergyKwh = heatingLoadKw * bin.hours
  const humidificationEnergyKwh = steamHumidificationKw * bin.hours
  const totalEnergyKwh = heatingEnergyKwh + humidificationEnergyKwh
  const heatingCost = reheatEnergyCost(heatingEnergyKwh, selectedReheatSystem, electricityRate, naturalGasRate)
  const humidificationCost = humidificationEnergyKwh * electricityRate
  const reheatCost = 0
  const totalCost = heatingCost + humidificationCost
  const outdoorAirCfm = airflowCfm * damperSolve.outdoorAirPercent / 100
  const returnAirCfm = airflowCfm - outdoorAirCfm

  return {
    strategy: 'freeCooling',
    tempC: bin.tempC,
    rh: bin.rh,
    hours: bin.hours,
    oa,
    ra: room,
    calculatedMixed,
    mixed,
    recovered,
    afterHumifog: recovered,
    afterHeating,
    controlledMixed: afterHeating,
    outdoorAirPercent: damperSolve.outdoorAirPercent,
    appliedOutdoorAirPercent: damperSolve.appliedOutdoorAirPercent ?? damperSolve.outdoorAirPercent,
    requestedOutdoorAirPercent: damperSolve.requestedOutdoorAirPercent,
    theoreticalOutdoorAirPercent: damperSolve.theoreticalOutdoorAirPercent ?? damperSolve.requestedOutdoorAirPercent,
    requestedMixedDb: damperSolve.requestedMixed?.db ?? targetMixedDb,
    returnAirPercent: 100 - damperSolve.outdoorAirPercent,
    outdoorAirCfm,
    returnAirCfm,
    minimumOutdoorAirPercent,
    designMinimumOutdoorAirPercent,
    freeCoolingPossible,
    targetMixedDb,
    damperCanMeetTarget: damperSolve.canMeetTarget,
    damperLimitedByMinimum: damperSolve.limitedByMinimum,
    damperLimitedByMaximum: damperSolve.limitedByMaximum,
    steamHumidificationKw,
    humifogLoadLbHr: 0,
    humifogLoadKgH: 0,
    humidificationLoadKw: steamHumidificationKw,
    humifogPumpKw: 0,
    heatingLoadKw,
    reheatLoadKw: 0,
    heatingEnergyKwh,
    comparisonHeatingEnergyKwh: heatingEnergyKwh,
    humidificationEnergyKwh,
    reheatEnergyKwh: 0,
    totalEnergyKwh,
    heatingCost,
    humidificationCost,
    reheatCost,
    totalCost,
    ...freeCoolingEconomy,
    points: buildPoints({ oa, room, mixed, recovered, afterHumifog: recovered, afterHeating }),
  }
}

function calculateFreeCoolingEconomy({
  rowHours,
  airflowCfm,
  returnAir,
  leavingAir,
  reheatLoadKw,
  humifogPumpKw,
}) {
  const freeCoolingObtainedKw = sensibleHeatingKw(airflowCfm, Math.max(0, returnAir.db - leavingAir.db))
  const penaltyKw = Math.max(0, reheatLoadKw) + Math.max(0, humifogPumpKw)
  const netFreeCoolingSavingsKw = freeCoolingObtainedKw - penaltyKw

  return {
    freeCoolingObtainedKw,
    freeCoolingObtainedKwh: freeCoolingObtainedKw * rowHours,
    humifogPumpEnergyKwh: Math.max(0, humifogPumpKw) * rowHours,
    netFreeCoolingSavingsKw,
    netFreeCoolingSavingsKwh: netFreeCoolingSavingsKw * rowHours,
  }
}

function calculateHumifogFreeCoolingState({
  oa,
  room,
  minimumOutdoorAirPercent,
  targetAfterHumifogDb,
  recoveryType,
  recoveryEfficiency,
  humifogEffectiveness,
  airflowCfm,
  selectedReheatSystem,
  heatPumpCOP,
  useMeasuredMixedAirTemperature,
  measuredMixedAirTemperatureC,
  damperMinimumOutdoorAirPercent = minimumOutdoorAirPercent,
}) {
  let estimatedAdiabaticCoolingC = 0
  let result = null

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const damperTargetDb = targetAfterHumifogDb + estimatedAdiabaticCoolingC
    const damperSolve = isFreeCoolingPossible(oa, room)
      ? solveOutdoorAirForMixedDryBulb(oa, room, damperTargetDb, damperMinimumOutdoorAirPercent)
      : solveMinimumOutdoorAir(oa, room, damperTargetDb, damperMinimumOutdoorAirPercent)
    const calculatedMixed = damperSolve.mixed
    const mixed = useMeasuredMixedAirTemperature
      ? overrideDryBulbKeepingHumidityRatio(calculatedMixed, measuredMixedAirTemperatureC)
      : calculatedMixed
    const recovered = applyHeatRecoveryForSelectedSystem(mixed, room, recoveryType, recoveryEfficiency)
    const inletToHumifog = recovered
    const afterHumifog = applyHumifogFromMixedWetBulb(inletToHumifog, inletToHumifog, humifogEffectiveness, room.w)
    const needsMechanicalReheat = afterHumifog.db < targetAfterHumifogDb - 0.05
    const finalReheatDb = needsMechanicalReheat
      ? targetAfterHumifogDb
      : afterHumifog.db
    const afterHeating = applyHeatingToDryBulb(afterHumifog, finalReheatDb)
    const heatingLoadKw = 0
    const reheatDeltaC = needsMechanicalReheat
      ? Math.max(0, targetAfterHumifogDb - afterHumifog.db)
      : 0
    const reheatThermalKw = sensibleHeatingKw(airflowCfm, reheatDeltaC)
    const reheatLoadKw = needsMechanicalReheat
      ? reheatInputKw(reheatThermalKw, selectedReheatSystem, heatPumpCOP)
      : 0
    const adiabaticCoolingC = Math.max(0, inletToHumifog.db - afterHumifog.db)

    result = {
      calculatedMixed,
      mixed,
      recovered,
      inletToHumifog,
      afterHumifog,
      afterHeating,
      damperTargetDb,
      damperSolve,
      reheatDeltaC,
      reheatThermalKw,
      heatingLoadKw,
      reheatLoadKw,
      totalAfterHumifogHeatingKw: heatingLoadKw + reheatLoadKw,
      adiabaticCoolingC,
      mechanicalReheatRequired: needsMechanicalReheat,
    }

    if (Math.abs(adiabaticCoolingC - estimatedAdiabaticCoolingC) < 0.05) break
    estimatedAdiabaticCoolingC = adiabaticCoolingC
  }

  return result
}

function isFreeCoolingPossible(outdoorAir, returnAir) {
  return outdoorAir.h < returnAir.h && outdoorAir.db < returnAir.db
}

function solveMinimumOutdoorAir(outdoorAir, returnAir, targetDb, minimumOutdoorAirPercent) {
  const outdoorAirPercent = clamp(minimumOutdoorAirPercent, 0, 100)
  const mixed = mixAirStates(outdoorAir, returnAir, outdoorAirPercent)
  const requestedOutdoorAirPercent = outdoorAirPercent
  const requestedMixed = mixed

  return {
    outdoorAirPercent,
    appliedOutdoorAirPercent: outdoorAirPercent,
    requestedOutdoorAirPercent,
    theoreticalOutdoorAirPercent: requestedOutdoorAirPercent,
    requestedMixed,
    mixed,
    appliedMixed: mixed,
    canMeetTarget: Math.abs(mixed.db - targetDb) <= 0.15,
    limitedByMinimum: true,
    limitedByMaximum: false,
    targetDb,
    mixedAtMinimum: mixed,
    mixedAtMaximum: mixAirStates(outdoorAir, returnAir, 100),
  }
}

function solveOutdoorAirForMixedDryBulb(outdoorAir, returnAir, targetDb, minimumOutdoorAirPercent) {
  const lower = clamp(minimumOutdoorAirPercent, 0, 100)
  const upper = 100
  const stateAtLower = mixAirStates(outdoorAir, returnAir, lower)
  const stateAtUpper = mixAirStates(outdoorAir, returnAir, upper)
  const denominator = returnAir.db - outdoorAir.db
  const rawFraction = Math.abs(denominator) > 0.0001
    ? (returnAir.db - targetDb) / denominator
    : lower / 100
  const requestedOutdoorAirPercent = clamp(rawFraction * 100, lower, upper)
  const outdoorAirPercent = clamp(rawFraction * 100, lower, upper)
  const requestedMixed = mixAirStates(outdoorAir, returnAir, requestedOutdoorAirPercent)
  const mixed = mixAirStates(outdoorAir, returnAir, outdoorAirPercent)

  return {
    outdoorAirPercent,
    appliedOutdoorAirPercent: outdoorAirPercent,
    requestedOutdoorAirPercent,
    theoreticalOutdoorAirPercent: requestedOutdoorAirPercent,
    requestedMixed,
    mixed,
    appliedMixed: mixed,
    canMeetTarget: Math.abs(mixed.db - targetDb) <= 0.15,
    limitedByMinimum: outdoorAirPercent <= lower + 0.0001,
    limitedByMaximum: outdoorAirPercent >= 99.9999,
    targetDb,
    mixedAtMinimum: stateAtLower,
    mixedAtMaximum: stateAtUpper,
  }
}

function applyHumifogFromMixedWetBulb(inletState, mixedAirState, effectiveness, targetHumidityRatio) {
  const wetBulbReferenceC = mixedAirState.wb
  const requestedHumidityRatio = Math.max(inletState.w, Number(targetHumidityRatio) || inletState.w)

  if (requestedHumidityRatio <= inletState.w + 0.0000001) {
    return {
      ...inletState,
      addedWaterGKg: 0,
      wetBulbReferenceC,
    }
  }

  const maximumCoolingDb = inletState.db - effectiveness * Math.max(inletState.db - wetBulbReferenceC, 0)
  const adiabaticDbForTargetW = (inletState.h - requestedHumidityRatio * 2501) /
    (1.006 + 1.86 * requestedHumidityRatio)
  const canReachTargetHumidityRatio = adiabaticDbForTargetW >= maximumCoolingDb
  const leavingDb = canReachTargetHumidityRatio ? adiabaticDbForTargetW : maximumCoolingDb
  const leavingHumidityRatio = canReachTargetHumidityRatio
    ? requestedHumidityRatio
    : Math.max(
      inletState.w,
      (inletState.h - 1.006 * leavingDb) / (2501 + 1.86 * leavingDb)
    )

  return {
    ...stateFromDbW({
      dryBulbC: leavingDb,
      humidityRatio: leavingHumidityRatio,
    }),
    addedWaterGKg: Math.max(0, (leavingHumidityRatio - inletState.w) * 1000),
    wetBulbReferenceC,
  }
}

function applyHeatRecoveryForSelectedSystem(inletState, returnAirState, recoveryType, recoveryEfficiency) {
  if (!Number.isFinite(recoveryEfficiency)) {
    return applyHeatRecovery(inletState, returnAirState, recoveryType)
  }

  const sensibleEffectiveness = recoveryType === 'none' ? 0 : clamp(recoveryEfficiency, 0, 0.95)
  const latentEffectiveness = recoveryType === 'enthalpyWheel'
    ? Math.min(sensibleEffectiveness * 0.82, 0.88)
    : 0

  return stateFromDbW({
    dryBulbC: inletState.db + sensibleEffectiveness * (returnAirState.db - inletState.db),
    humidityRatio: inletState.w + latentEffectiveness * (returnAirState.w - inletState.w),
  })
}

function buildPoints({ oa, room, mixed, recovered, afterHumifog, afterHeating }) {
  return [
    { key: 'oa', label: 'Outdoor air', state: oa },
    { key: 'ra', label: 'Return air', state: room },
    { key: 'mixed', label: 'Mixed air', state: mixed },
    { key: 'recovered', label: 'After recovery', state: recovered },
    { key: 'humifog', label: 'After Humifog', state: afterHumifog },
    { key: 'heating', label: 'After heating', state: afterHeating },
    { key: 'room', label: 'Room', state: room },
  ]
}

function buildAnnualBreakdownRows(annualComparison) {
  const { freeCooling, humifog } = annualComparison

  return [
    {
      key: 'heatingEnergyKwh',
      parameter: 'Annual heating energy',
      unit: 'kWh/year',
      steamReference: freeCooling.heatingEnergyKwh,
      humifogOptimized: humifog.heatingEnergyKwh,
      difference: freeCooling.heatingEnergyKwh - humifog.heatingEnergyKwh,
    },
    {
      key: 'humidificationEnergyKwh',
      parameter: 'Annual humidification energy',
      unit: 'kWh/year',
      steamReference: freeCooling.humidificationEnergyKwh,
      humifogOptimized: humifog.humidificationEnergyKwh,
      difference: freeCooling.humidificationEnergyKwh - humifog.humidificationEnergyKwh,
    },
    {
      key: 'reheatEnergyKwh',
      parameter: 'Annual reheat energy',
      unit: 'kWh/year',
      steamReference: freeCooling.reheatEnergyKwh,
      humifogOptimized: humifog.reheatEnergyKwh,
      difference: freeCooling.reheatEnergyKwh - humifog.reheatEnergyKwh,
    },
    {
      key: 'freeCoolingObtainedKwh',
      parameter: 'Free cooling obtained from Free Cooling',
      unit: 'kWh/year',
      steamReference: freeCooling.freeCoolingObtainedKwh,
      humifogOptimized: humifog.freeCoolingObtainedKwh,
      difference: humifog.freeCoolingObtainedKwh - freeCooling.freeCoolingObtainedKwh,
    },
    {
      key: 'totalEnergyKwh',
      parameter: 'Total annual energy',
      unit: 'kWh/year',
      steamReference: freeCooling.totalEnergyKwh,
      humifogOptimized: humifog.totalEnergyKwh,
      difference: annualComparison.savingsKwh,
    },
    {
      key: 'annualCost',
      parameter: 'Total annual cost',
      unit: '$/year',
      steamReference: freeCooling.annualCost,
      humifogOptimized: humifog.annualCost,
      difference: annualComparison.annualSavings,
    },
  ]
}

function buildNetSavings(annualComparison) {
  const { freeCooling, humifog } = annualComparison

  return {
    annualHeatingSavingsKwh: freeCooling.heatingEnergyKwh - humifog.heatingEnergyKwh,
    annualHumidificationSavingsKwh: freeCooling.humidificationEnergyKwh - humifog.humidificationEnergyKwh,
    additionalReheatEnergyKwh: humifog.reheatEnergyKwh,
    freeCoolingObtainedKwh: humifog.freeCoolingObtainedKwh,
    humifogPumpEnergyKwh: humifog.humifogPumpEnergyKwh,
    adiabaticReheatThermalKwh: humifog.adiabaticReheatThermalKwh,
    adiabaticReheatElectricKwh: humifog.adiabaticReheatElectricKwh,
    mechanicalReheatEnergyKwh: humifog.mechanicalReheatEnergyKwh,
    netAnnualEnergySavingsKwh: annualComparison.savingsKwh,
    annualCostSavings: annualComparison.annualSavings,
    energyReductionPercent: annualComparison.savingsPercent,
  }
}

function buildBinValidationRows(conventionalRows, optimizedHumifogRows) {
  return optimizedHumifogRows.map((humifogRow, index) => {
    const referenceRow = conventionalRows[index]
    const energyConsumptionKwh = humifogRow.totalEnergyKwh

    return {
      tempC: humifogRow.tempC,
      hours: humifogRow.hours,
      rh: humifogRow.rh,
      outdoorAirPercent: humifogRow.outdoorAirPercent,
      appliedOutdoorAirPercent: humifogRow.appliedOutdoorAirPercent ?? humifogRow.outdoorAirPercent,
      requestedOutdoorAirPercent: humifogRow.requestedOutdoorAirPercent,
      theoreticalOutdoorAirPercent: humifogRow.theoreticalOutdoorAirPercent ?? humifogRow.requestedOutdoorAirPercent,
      requestedMixedDb: humifogRow.requestedMixedDb ?? humifogRow.targetMixedDb,
      belowDesignMinimumOutdoorAir: humifogRow.outdoorAirPercent < humifogRow.minimumOutdoorAirPercent - 0.05,
      returnAirPercent: humifogRow.returnAirPercent,
      outdoorAirCfm: humifogRow.outdoorAirCfm,
      returnAirCfm: humifogRow.returnAirCfm,
      mixedDb: humifogRow.mixed.db,
      mixedW: humifogRow.mixed.w,
      humifogOutletDb: humifogRow.afterHumifog.db,
      targetAfterHumifogDb: humifogRow.targetAfterHumifogDb,
      targetMixedDb: humifogRow.targetMixedDb,
      adiabaticCoolingC: humifogRow.adiabaticCoolingC,
      reheatDeltaC: humifogRow.reheatDeltaC,
      reheatThermalKw: humifogRow.reheatThermalKw,
      reheatLoadKw: humifogRow.reheatLoadKw,
      adiabaticReheatThermalKw: humifogRow.adiabaticReheatThermalKw,
      adiabaticReheatThermalKwh: humifogRow.adiabaticReheatThermalKwh,
      adiabaticReheatElectricKw: humifogRow.adiabaticReheatElectricKw,
      adiabaticReheatElectricKwh: humifogRow.adiabaticReheatElectricKwh,
      humifogPumpKw: humifogRow.humifogPumpKw,
      heatingLoadKw: humifogRow.heatingLoadKw + humifogRow.reheatLoadKw,
      humidificationLoadKw: humifogRow.humidificationLoadKw,
      energyConsumptionKwh,
      cost: humifogRow.totalCost,
      steamReference: {
        oaPercent: referenceRow?.outdoorAirPercent ?? 0,
        appliedOaPercent: referenceRow?.appliedOutdoorAirPercent ?? referenceRow?.outdoorAirPercent ?? 0,
        requestedOaPercent: referenceRow?.requestedOutdoorAirPercent ?? referenceRow?.outdoorAirPercent ?? 0,
        theoreticalOaPercent: referenceRow?.theoreticalOutdoorAirPercent ?? referenceRow?.requestedOutdoorAirPercent ?? referenceRow?.outdoorAirPercent ?? 0,
        requestedMixedDb: referenceRow?.requestedMixedDb ?? referenceRow?.targetMixedDb ?? referenceRow?.mixed.db ?? 0,
        targetMixedDb: referenceRow?.targetMixedDb ?? 0,
        tmix: referenceRow?.mixed.db ?? 0,
        humidificationLoadKw: referenceRow?.humidificationLoadKw ?? 0,
        heatingLoadKw: referenceRow?.heatingLoadKw ?? 0,
        humidificationEnergyKwh: referenceRow?.humidificationEnergyKwh ?? 0,
        heatingEnergyKwh: referenceRow?.heatingEnergyKwh ?? 0,
        reheatEnergyKwh: referenceRow?.reheatEnergyKwh ?? 0,
        heatingCost: referenceRow?.heatingCost ?? 0,
        humidificationCost: referenceRow?.humidificationCost ?? 0,
        reheatCost: referenceRow?.reheatCost ?? 0,
        binEnergyKwh: referenceRow?.totalEnergyKwh ?? 0,
        binCost: referenceRow?.totalCost ?? 0,
      },
      humifogOptimized: {
        oaPercent: humifogRow.outdoorAirPercent,
        appliedOaPercent: humifogRow.appliedOutdoorAirPercent ?? humifogRow.outdoorAirPercent,
        requestedOaPercent: humifogRow.requestedOutdoorAirPercent,
        theoreticalOaPercent: humifogRow.theoreticalOutdoorAirPercent ?? humifogRow.requestedOutdoorAirPercent,
        requestedMixedDb: humifogRow.requestedMixedDb ?? humifogRow.targetMixedDb,
        targetMixedDb: humifogRow.targetMixedDb,
        tmix: humifogRow.mixed.db,
        humidificationLoadKw: humifogRow.humidificationLoadKw,
        heatingLoadKw: humifogRow.heatingLoadKw + humifogRow.reheatLoadKw,
        humidificationEnergyKwh: humifogRow.humidificationEnergyKwh,
        heatingEnergyKwh: humifogRow.heatingEnergyKwh,
        reheatEnergyKwh: humifogRow.reheatEnergyKwh,
        adiabaticReheatThermalKwh: humifogRow.adiabaticReheatThermalKwh,
        adiabaticReheatElectricKwh: humifogRow.adiabaticReheatElectricKwh,
        heatingCost: humifogRow.heatingCost,
        humidificationCost: humifogRow.humidificationCost,
        reheatCost: humifogRow.reheatCost,
        binEnergyKwh: humifogRow.totalEnergyKwh,
        binCost: humifogRow.totalCost,
      },
      difference: {
        oaPercent: (referenceRow?.appliedOutdoorAirPercent ?? referenceRow?.outdoorAirPercent ?? 0) -
          (humifogRow.appliedOutdoorAirPercent ?? humifogRow.outdoorAirPercent),
        requestedOaPercent: (referenceRow?.theoreticalOutdoorAirPercent ?? referenceRow?.requestedOutdoorAirPercent ?? referenceRow?.outdoorAirPercent ?? 0) -
          (humifogRow.theoreticalOutdoorAirPercent ?? humifogRow.requestedOutdoorAirPercent),
        mixedDb: (referenceRow?.mixed.db ?? 0) - humifogRow.mixed.db,
        binEnergyKwh: (referenceRow?.totalEnergyKwh ?? 0) - humifogRow.totalEnergyKwh,
        binCost: (referenceRow?.totalCost ?? 0) - humifogRow.totalCost,
      },
    }
  })
}

function buildAnnualTotalsValidation(binValidationRows, annualComparison) {
  const steamEnergyFromBins = binValidationRows.reduce(
    (total, row) => total + (row.steamReference?.binEnergyKwh || 0),
    0
  )
  const humifogEnergyFromBins = binValidationRows.reduce(
    (total, row) => total + (row.humifogOptimized?.binEnergyKwh || 0),
    0
  )
  const steamCostFromBins = binValidationRows.reduce(
    (total, row) => total + (row.steamReference?.binCost || 0),
    0
  )
  const humifogCostFromBins = binValidationRows.reduce(
    (total, row) => total + (row.humifogOptimized?.binCost || 0),
    0
  )
  const tolerance = 0.05
  const closeEnough = (left, right) => Math.abs((left || 0) - (right || 0)) <= tolerance
  const steamEnergyTotal = annualComparison.freeCooling?.totalEnergyKwh || 0
  const humifogEnergyTotal = annualComparison.humifog?.totalEnergyKwh || 0
  const steamCostTotal = annualComparison.freeCooling?.annualCost || 0
  const humifogCostTotal = annualComparison.humifog?.annualCost || 0

  return {
    steamEnergyFromBins,
    steamEnergyTotal,
    humifogEnergyFromBins,
    humifogEnergyTotal,
    steamCostFromBins,
    steamCostTotal,
    humifogCostFromBins,
    humifogCostTotal,
    energyTotalsMatch:
      closeEnough(steamEnergyFromBins, steamEnergyTotal) &&
      closeEnough(humifogEnergyFromBins, humifogEnergyTotal),
    costTotalsMatch:
      closeEnough(steamCostFromBins, steamCostTotal) &&
      closeEnough(humifogCostFromBins, humifogCostTotal),
  }
}

function summarizeRows(rows) {
  const totalHours = rows.reduce((total, row) => total + row.hours, 0)
  const weighted = (selector) =>
    rows.reduce((total, row) => total + selector(row) * row.hours, 0) / Math.max(totalHours, 1)

  return {
    totalHours,
    averageOa: weighted((row) => row.outdoorAirPercent),
    averageAppliedOa: weighted((row) => row.appliedOutdoorAirPercent ?? row.outdoorAirPercent),
    averageTheoreticalOa: weighted((row) => row.theoreticalOutdoorAirPercent ?? row.requestedOutdoorAirPercent ?? row.outdoorAirPercent),
    averageMixedDb: weighted((row) => row.mixed.db),
    averageMixedRh: weighted((row) => row.mixed.rh),
    averageMixedW: weighted((row) => row.mixed.w),
    averageMixedH: weighted((row) => row.mixed.h),
    averageHumifogDb: weighted((row) => row.afterHumifog.db),
    heatingEnergyKwh: rows.reduce((total, row) => total + row.heatingEnergyKwh, 0),
    comparisonHeatingEnergyKwh: rows.reduce((total, row) => total + row.comparisonHeatingEnergyKwh, 0),
    humidificationEnergyKwh: rows.reduce((total, row) => total + row.humidificationEnergyKwh, 0),
    reheatEnergyKwh: rows.reduce((total, row) => total + (row.reheatEnergyKwh || 0), 0),
    mechanicalReheatEnergyKwh: rows.reduce((total, row) => total + (row.reheatEnergyKwh || 0), 0),
    adiabaticReheatThermalKwh: rows.reduce((total, row) => total + (row.adiabaticReheatThermalKwh || 0), 0),
    adiabaticReheatElectricKwh: rows.reduce((total, row) => total + (row.adiabaticReheatElectricKwh || 0), 0),
    totalEnergyKwh: rows.reduce((total, row) => total + row.totalEnergyKwh, 0),
    freeCoolingObtainedKwh: rows.reduce((total, row) => total + (row.freeCoolingObtainedKwh || 0), 0),
    humifogPumpEnergyKwh: rows.reduce((total, row) => total + (row.humifogPumpEnergyKwh || 0), 0),
    netFreeCoolingSavingsKwh: rows.reduce((total, row) => total + (row.netFreeCoolingSavingsKwh || 0), 0),
    heatingCost: rows.reduce((total, row) => total + (row.heatingCost || 0), 0),
    humidificationCost: rows.reduce((total, row) => total + (row.humidificationCost || 0), 0),
    reheatCost: rows.reduce((total, row) => total + (row.reheatCost || 0), 0),
    totalCost: rows.reduce((total, row) => total + (row.totalCost || 0), 0),
  }
}

function reheatSourceType(selectedReheatSystem) {
  const source = String(selectedReheatSystem?.energie || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (source.includes('gaz') || source.includes('natural gas')) return 'naturalGas'
  if (source.includes('recuperation') || source.includes('recovery') || source.includes('passive')) return 'passiveRecovery'
  if (source.includes('thermopompe') || source.includes('heat pump')) return 'heatPump'
  return 'electricity'
}

function reheatEnergyCost(energyKwh, selectedReheatSystem, electricityRate, naturalGasRate) {
  const sourceType = reheatSourceType(selectedReheatSystem)

  if (sourceType === 'naturalGas') return (energyKwh / 10.35) * naturalGasRate
  if (sourceType === 'passiveRecovery') return 0
  return energyKwh * electricityRate
}

function reheatInputKw(thermalKw, selectedReheatSystem, heatPumpCOP) {
  const sourceType = reheatSourceType(selectedReheatSystem)

  if (sourceType === 'heatPump') return thermalKw / Math.max(heatPumpCOP, 0.1)
  if (sourceType === 'naturalGas') {
    const efficiency = Number.isFinite(Number(selectedReheatSystem?.rendement))
      ? Number(selectedReheatSystem.rendement) / 100
      : 0.88
    return thermalKw / Math.max(efficiency, 0.01)
  }
  return thermalKw * (selectedReheatSystem?.facteur ?? 1)
}

function waterLoadLbHr(airflowCfm, deltaHumidityRatio) {
  return Math.max(0, 4.5 * airflowCfm * deltaHumidityRatio)
}

function normalizeBins(bins) {
  return (bins || []).map((bin) => {
    if (Array.isArray(bin)) {
      const [tempC, hours, rh] = bin
      return {
        tempC,
        hours,
        rh: rh ?? estimateBinRh(tempC),
      }
    }

    return {
      tempC: bin.tempC,
      hours: bin.hours,
      rh: bin.rh ?? estimateBinRh(bin.tempC),
    }
  })
}

function estimateBinRh(tempC) {
  return Math.round(clamp(78 - tempC * 0.55, 35, 90))
}

function normalizeRecoveryType(recoveryType) {
  const value = String(recoveryType || 'none')
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized.includes('none') || normalized.includes('aucun')) return 'none'
  if (normalized.includes('enthalpy') || normalized.includes('enthalp')) return 'enthalpyWheel'
  if (normalized.includes('sensible') || normalized.includes('sensible_wheel')) return 'sensibleWheel'
  if (normalized.includes('plate') || normalized.includes('cross') || normalized.includes('plaque')) return 'crossflowPlate'
  if (normalized.includes('wheel') || normalized.includes('roue')) return 'enthalpyWheel'
  return 'none'
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
