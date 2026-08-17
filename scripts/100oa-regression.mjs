import { readFileSync } from 'node:fs'

function loadHvacEngine() {
  const psychrometricsSource = readFileSync('src/calculations/psychrometrics.js', 'utf8')
    .replace(/export /g, '')
  const serviceSource = readFileSync('src/services/hvacEngineeringService.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics(?:\.js)?'\s*/m, '')
    .replace(/export /g, '')

  return Function(`
    ${psychrometricsSource}
    ${serviceSource}
    return {
      calculateHvacDashboardMetrics,
      moistAirEnthalpyBtuLb,
      humidityRatioFromRH,
      moistAirEnthalpyKjKg,
      dryBulbFromEnthalpyHumidityRatio,
      psychrometricState,
      stateFromDbW,
    }
  `)()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function almostEqual(left, right, tolerance = 1e-9) {
  return Math.abs(left - right) <= tolerance
}

function closePercent(left, right, percentTolerance = 0.2) {
  const denominator = Math.max(Math.abs(right), 1e-9)
  return Math.abs(left - right) / denominator <= percentTolerance
}

function assertApprox(actual, expected, tolerance, label) {
  const diff = Math.abs(actual - expected)
  assert(
    diff <= tolerance,
    `${label} out of tolerance: expected ${expected}, got ${actual}, tolerance ${tolerance}`
  )
}

function getScheduleDaysPerWeek(option, customDays) {
  if (option === 'mon-sat') return 6
  if (option === 'seven-days') return 7
  if (option === 'custom') return Object.values(customDays).filter(Boolean).length
  return 5
}

function computeScheduleDailyHours(startTime, endTime, mode) {
  if (mode === '24-7') return 24
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  const start = startHours * 60 + startMinutes
  const end = endHours * 60 + endMinutes
  if (start === end) return 24
  if (end > start) return (end - start) / 60
  return ((24 * 60 - start) + end) / 60
}

function deriveBinRh(cityRh, binTempC) {
  return Math.round(Math.max(35, Math.min(90, cityRh + (10 - binTempC) * 0.45)))
}

const BIN_WEEKS_PER_YEAR = 52.142857

const {
  calculateHvacDashboardMetrics,
  moistAirEnthalpyBtuLb,
  humidityRatioFromRH,
  moistAirEnthalpyKjKg,
  dryBulbFromEnthalpyHumidityRatio,
} = loadHvacEngine()

const CANONICAL_100OA_FIXTURE = {
  city: { nom: 'Montreal', hiver: -23, humidite: 65 },
  outdoorDesignTemperatureC: -23,
  outdoorDesignRelativeHumidity: 65,
  roomTemperatureC: 22,
  roomRelativeHumidity: 35,
  totalAirflowCfm: 12500,
  supplyTemperatureC: 22,
  recoveryType: 'Thermal Wheel',
  sensibleEfficiencyPercent: 78,
  latentEfficiencyPercent: 70,
  humidificationTechnology: 'Humifog',
  heatingSource: 'Electricity',
  heatPumpCop: 3.8,
  electricityTariffPerKwh: 0.12,
  gasTariffPerM3: 0.45,
  steamBoilerEfficiencyPercent: 68,
  atmosphericGasHumidifierEfficiencyPercent: 82,
  operatingDays: 'mon-fri',
  scheduleMode: 'custom',
  scheduleStartTime: '06:00',
  scheduleEndTime: '18:00',
  calculationMethod: 'bin',
  scheduleCustomDays: {
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
  },
  selectedReheatSystemElectric: {
    nom: 'Electric',
    rendement: 100,
    facteur: 1,
    energie: 'Electricity',
  },
  selectedReheatSystemHeatPump: {
    nom: 'Air/Water Heat Pump',
    cop: 3.8,
    facteur: 0.32,
    energie: 'Heat Pump',
  },
  selectedRecoveries: [{ nom: 'Thermal Wheel' }],
  selectedBinData: [
    [-30, 42], [-25, 115], [-20, 245], [-15, 420],
    [-10, 680], [-5, 920], [0, 1150], [5, 760],
  ],
}

function canonicalScheduleState(fixture) {
  const operatingDaysPerWeek = fixture.scheduleMode === '24-7'
    ? 7
    : getScheduleDaysPerWeek(fixture.operatingDays, fixture.scheduleCustomDays)
  const dailyOperatingHours = computeScheduleDailyHours(
    fixture.scheduleStartTime,
    fixture.scheduleEndTime,
    fixture.scheduleMode
  )
  const weeklyOperatingHours = dailyOperatingHours * operatingDaysPerWeek
  const scheduleFactor = fixture.scheduleMode === '24-7'
    ? 1
    : Number((weeklyOperatingHours / 168).toFixed(4))
  const annualOperatingHours = Math.round(weeklyOperatingHours * BIN_WEEKS_PER_YEAR)

  return {
    dailyOperatingHours,
    operatingDaysPerWeek,
    weeklyOperatingHours,
    scheduleFactor,
    annualOperatingHours,
  }
}

function canonicalBaseInput(fixture, selectedReheatSystem, overrides = {}) {
  return {
    outsideAirCFM: fixture.totalAirflowCfm,
    effectiveOutsideAirCFM: fixture.totalAirflowCfm,
    roomTemperature: fixture.roomTemperatureC,
    roomRelativeHumidity: fixture.roomRelativeHumidity,
    supplyAirTemperature: fixture.supplyTemperatureC,
    outsideWinterTemp: fixture.outdoorDesignTemperatureC,
    selectedRecoveries: fixture.selectedRecoveries,
    wheelEfficiency: fixture.sensibleEfficiencyPercent,
    latentRecoveryEfficiency: fixture.latentEfficiencyPercent,
    selectedReheatSystem,
    heatPumpCOP: fixture.heatPumpCop,
    steamBoilerEfficiency: fixture.steamBoilerEfficiencyPercent,
    atmosphericGasHumidifierEfficiency: fixture.atmosphericGasHumidifierEfficiencyPercent,
    electricityRate: fixture.electricityTariffPerKwh,
    naturalGasRate: fixture.gasTariffPerM3,
    selectedCity: { nom: fixture.city.nom, hiver: fixture.outdoorDesignTemperatureC },
    economizerTargetTemp: 12,
    is100OA: true,
    outsideRelativeHumidity: fixture.outdoorDesignRelativeHumidity,
    scheduleFactor: 1,
    ...overrides,
  }
}

function computeCanonicalRun(fixture) {
  const schedule = canonicalScheduleState(fixture)

  const designElectric = calculateHvacDashboardMetrics(
    canonicalBaseInput(fixture, fixture.selectedReheatSystemElectric)
  )

  const designHeatPump = calculateHvacDashboardMetrics(
    canonicalBaseInput(fixture, fixture.selectedReheatSystemHeatPump)
  )

  const effectiveBinData = fixture.selectedBinData.map(([tempC, hours]) => {
    return [tempC, Number((hours * schedule.scheduleFactor).toFixed(3))]
  })

  const annualRows = effectiveBinData.map(([tempC, effectiveHours], index) => {
    const originalHours = fixture.selectedBinData[index][1]
    const rh = deriveBinRh(fixture.city.humidite, tempC)

    const electric = calculateHvacDashboardMetrics(canonicalBaseInput(
      fixture,
      fixture.selectedReheatSystemElectric,
      {
        outsideWinterTemp: tempC,
        outsideRelativeHumidity: rh,
        selectedCity: { nom: fixture.city.nom, hiver: tempC },
        scheduleFactor: schedule.scheduleFactor,
      }
    ))

    const heatPump = calculateHvacDashboardMetrics(canonicalBaseInput(
      fixture,
      fixture.selectedReheatSystemHeatPump,
      {
        outsideWinterTemp: tempC,
        outsideRelativeHumidity: rh,
        selectedCity: { nom: fixture.city.nom, hiver: tempC },
        scheduleFactor: schedule.scheduleFactor,
      }
    ))

    const steamKw = Number(electric.steamEnergyKWRaw || 0)
    const humidificationLoadLbH = Number(electric.steamHumidificationLoadRaw || 0)
    const baseHvacHeatingKw = Number(electric.baseHvacHeatingThermalKWRaw || 0)
    const totalHumifogPreheatKw = Number(electric.grossHumifogPreheatKWRaw || 0)
    const additionalHumifogPreheatKw = Number(electric.grossReheatKWRaw || 0)
    const humifogPumpKw = Number(electric.adiabaticPumpKWRaw || 0)

    const steamBinKwh = steamKw * effectiveHours
    const humifogElectricBinKwh = (humifogPumpKw + additionalHumifogPreheatKw) * effectiveHours
    const humifogCopBinKwh = (humifogPumpKw + Number(heatPump.reheatEnergyKWRaw || 0)) * effectiveHours

    const naturalGasSteamInputKw = Number(electric.naturalGasSteamInputKWRaw || 0)
    const naturalGasSteamEnergyBinKwh = naturalGasSteamInputKw * effectiveHours
    const naturalGasSteamVolumeBinM3 = Number(electric.naturalGasM3PerHourRaw || 0) * effectiveHours

    const atmosphericGasInputKw = Number(electric.atmosphericGasHumidifierInputKWRaw || 0)
    const atmosphericGasEnergyBinKwh = atmosphericGasInputKw * effectiveHours
    const atmosphericGasVolumeBinM3 = Number(electric.atmosphericGasHumidifierM3PerHourRaw || 0) * effectiveHours

    return {
      tempC,
      rh,
      originalHours,
      effectiveHours,
      humidificationLoadLbH,
      steamKw,
      steamBinKwh,
      humifogPumpKw,
      additionalHumifogPreheatKw,
      electricHumifogBinKwh: humifogElectricBinKwh,
      copHeatPumpBinKwh: humifogCopBinKwh,
      naturalGasSteamEnergyBinKwh,
      naturalGasSteamVolumeBinM3,
      atmosphericGasEnergyBinKwh,
      atmosphericGasVolumeBinM3,
      humifogPumpBinKwh: humifogPumpKw * effectiveHours,
      additionalElectricPreheatBinKwh: additionalHumifogPreheatKw * effectiveHours,
      additionalThermalPreheatBinKwh: additionalHumifogPreheatKw * effectiveHours,
      heatPumpElectricPreheatBinKwh: Number(heatPump.reheatEnergyKWRaw || 0) * effectiveHours,
      commonBaseHeatingBinKwh: baseHvacHeatingKw * effectiveHours,
    }
  })

  const sum = (key) => annualRows.reduce((acc, row) => acc + Number(row[key] || 0), 0)

  const roomW = humidityRatioFromRH(fixture.roomTemperatureC, fixture.roomRelativeHumidity)
  const roomHkJKg = moistAirEnthalpyKjKg(fixture.roomTemperatureC, roomW)
  const preheatDbC = dryBulbFromEnthalpyHumidityRatio(roomHkJKg, designElectric.enteringHumidityRatio)
  const afterHumifogDbC = dryBulbFromEnthalpyHumidityRatio(roomHkJKg, roomW)
  const adiabaticDeltaC = Math.max(0, preheatDbC - afterHumifogDbC)
  const hfgKjKg = 2501 - 2.381 * afterHumifogDbC
  const waterKgH = designElectric.steamHumidificationLoadRaw * 0.45359237
  const waterSideAdiabaticKw = (waterKgH * hfgKjKg) / 3600

  const airSideAdiabaticKw =
    (1.08 * fixture.totalAirflowCfm * (adiabaticDeltaC * 1.8)) / 3412

  const annual = {
    sumOriginalBinHours: fixture.selectedBinData.reduce((acc, [, h]) => acc + h, 0),
    sumEffectiveBinHours: sum('effectiveHours'),
    annualOperatingHours: schedule.annualOperatingHours,
    scheduleFactor: schedule.scheduleFactor,
    electricSteamKwh: sum('steamBinKwh'),
    electricSteamCost: sum('steamBinKwh') * fixture.electricityTariffPerKwh,
    naturalGasSteamAnnualGasEnergyKwh: sum('naturalGasSteamEnergyBinKwh'),
    naturalGasSteamAnnualGasVolumeM3: sum('naturalGasSteamVolumeBinM3'),
    naturalGasSteamCost: sum('naturalGasSteamVolumeBinM3') * fixture.gasTariffPerM3,
    atmosphericGasAnnualGasEnergyKwh: sum('atmosphericGasEnergyBinKwh'),
    atmosphericGasAnnualGasVolumeM3: sum('atmosphericGasVolumeBinM3'),
    atmosphericGasCost: sum('atmosphericGasVolumeBinM3') * fixture.gasTariffPerM3,
    humifogPumpKwh: sum('humifogPumpBinKwh'),
    humifogAdditionalElectricPreheatKwh: sum('additionalElectricPreheatBinKwh'),
    humifogElectricTotalKwh: sum('electricHumifogBinKwh'),
    humifogElectricCost: sum('electricHumifogBinKwh') * fixture.electricityTariffPerKwh,
    humifogAdditionalThermalPreheatKwh: sum('additionalThermalPreheatBinKwh'),
    humifogHeatPumpElectricPreheatKwh: sum('heatPumpElectricPreheatBinKwh'),
    humifogCopTotalElectricKwh: sum('copHeatPumpBinKwh'),
    humifogCopCost: sum('copHeatPumpBinKwh') * fixture.electricityTariffPerKwh,
    annualCommonHvacHeatingKwh: sum('commonBaseHeatingBinKwh'),
  }

  const designPoint = {
    humidificationLoadLbHrRaw: Number(designElectric.steamHumidificationLoadRaw || 0),
    electricSteamKwRaw: Number(designElectric.steamEnergyKWRaw || 0),
    baseHvacHeatingKwRaw: Number(designElectric.baseHvacHeatingThermalKWRaw || 0),
    totalHumifogPreheatKwRaw: Number(designElectric.grossHumifogPreheatKWRaw || 0),
    additionalHumifogPreheatKwRaw: Number(designElectric.grossReheatKWRaw || 0),
    preHumifogTempC: Number(designElectric.preHumifogTemp || 0),
    preHumifogRh: Number(designElectric.preHumifogRh || 0),
    afterHumifogTempC: Number(designElectric.afterHumifogTemp || 0),
    afterHumifogRh: Number(designElectric.afterHumifogRh || 0),
    waterSideAdiabaticKwRaw: Number(waterSideAdiabaticKw || 0),
    airSideAdiabaticKwRaw: Number(airSideAdiabaticKw || 0),
    humifogPumpKwRaw: Number(designElectric.adiabaticPumpKWRaw || 0),
    humifogElectricTotalKwRaw: Number((designElectric.adiabaticPumpKWRaw || 0) + (designElectric.grossReheatKWRaw || 0)),
    humifogCopTotalKwRaw: Number((designHeatPump.adiabaticPumpKWRaw || 0) + (designHeatPump.reheatEnergyKWRaw || 0)),
  }

  const reductions = {
    humifogElectricReductionKwhVsSteam: annual.electricSteamKwh - annual.humifogElectricTotalKwh,
    humifogElectricReductionPercentVsSteam: annual.electricSteamKwh > 0
      ? ((annual.electricSteamKwh - annual.humifogElectricTotalKwh) / annual.electricSteamKwh) * 100
      : 0,
    humifogCopReductionKwhVsSteam: annual.electricSteamKwh - annual.humifogCopTotalElectricKwh,
    humifogCopReductionPercentVsSteam: annual.electricSteamKwh > 0
      ? ((annual.electricSteamKwh - annual.humifogCopTotalElectricKwh) / annual.electricSteamKwh) * 100
      : 0,
  }

  return {
    fixture,
    schedule,
    designElectric,
    designHeatPump,
    designPoint,
    annual,
    reductions,
    annualRows,
  }
}

function assertDeterministic(runA, runB, tolerance = 1e-9) {
  const keys = [
    'humidificationLoadLbHrRaw',
    'electricSteamKwRaw',
    'baseHvacHeatingKwRaw',
    'totalHumifogPreheatKwRaw',
    'additionalHumifogPreheatKwRaw',
    'humifogPumpKwRaw',
    'humifogElectricTotalKwRaw',
    'humifogCopTotalKwRaw',
  ]

  for (const key of keys) {
    assert(
      almostEqual(runA.designPoint[key], runB.designPoint[key], tolerance),
      `Determinism failure for design metric ${key}: ${runA.designPoint[key]} vs ${runB.designPoint[key]}`
    )
  }

  const annualKeys = [
    'electricSteamKwh',
    'humifogElectricTotalKwh',
    'humifogCopTotalElectricKwh',
  ]

  for (const key of annualKeys) {
    assert(
      almostEqual(runA.annual[key], runB.annual[key], tolerance),
      `Determinism failure for annual metric ${key}: ${runA.annual[key]} vs ${runB.annual[key]}`
    )
  }
}

const canonicalRunA = computeCanonicalRun(CANONICAL_100OA_FIXTURE)
const canonicalRunB = computeCanonicalRun(CANONICAL_100OA_FIXTURE)

// TEST A - canonical fixture deterministic across repeated runs
assertDeterministic(canonicalRunA, canonicalRunB, 1e-9)

const design = canonicalRunA.designElectric
const fixture = CANONICAL_100OA_FIXTURE

// TEST B - design point validity and no NaN
assert(Number.isFinite(design.steamHumidificationLoadRaw), 'Design point steam load raw should be finite.')
assert(Number.isFinite(design.indoorEnthalpyRaw), 'Design point indoor enthalpy raw should be finite.')
assert(Number.isFinite(design.grossHumifogPreheatKWRaw), 'Design point Humifog preheat raw should be finite.')
assert(design.steamHumidificationLoadRaw > 0, 'Design point steam load should be positive.')
assert(design.recoveryEnergyReductionKWRaw > 0, 'Sensible recovery should be active at design point.')

const designNoLatent = calculateHvacDashboardMetrics(canonicalBaseInput(
  fixture,
  fixture.selectedReheatSystemElectric,
  {
    latentRecoveryEfficiency: 0,
  }
))

assert(
  design.enteringHumidityRatio > designNoLatent.enteringHumidityRatio,
  'Latent recovery should increase entering humidity ratio when outdoor air is drier than room target.'
)

// TEST C - BIN RH sensitivity at same BIN temperature
const lowRh = calculateHvacDashboardMetrics(canonicalBaseInput(
  fixture,
  fixture.selectedReheatSystemElectric,
  {
    outsideWinterTemp: -10,
    outsideRelativeHumidity: 40,
    selectedCity: { nom: fixture.city.nom, hiver: -10 },
  }
))

const highRh = calculateHvacDashboardMetrics(canonicalBaseInput(
  fixture,
  fixture.selectedReheatSystemElectric,
  {
    outsideWinterTemp: -10,
    outsideRelativeHumidity: 90,
    selectedCity: { nom: fixture.city.nom, hiver: -10 },
  }
))

assert(
  Math.abs(lowRh.enteringHumidityRatio - highRh.enteringHumidityRatio) > 1e-6,
  'BIN RH sensitivity failed: entering humidity ratio is unchanged when BIN RH changes.'
)

assert(
  Math.abs(lowRh.steamEnergyKWRaw - highRh.steamEnergyKWRaw) > 1e-3,
  'BIN RH sensitivity failed: steam energy is unchanged when BIN RH changes.'
)

// TEST D - no premature enthalpy rounding in preheat chain
const indoorEnthalpyRoundedLegacy = Math.round(moistAirEnthalpyBtuLb(fixture.roomTemperatureC, design.indoorHumidityRatio))
const enteringHumifogEnthalpy = moistAirEnthalpyBtuLb(design.afterWheelTempRaw, design.enteringHumidityRatio)
const legacyPreheatKW = Math.max(
  0,
  (4.5 * fixture.totalAirflowCfm * (indoorEnthalpyRoundedLegacy - enteringHumifogEnthalpy)) / 3412
)
const precisionDeltaKw = Math.abs(design.grossHumifogPreheatKWRaw - legacyPreheatKW)

assert(
  precisionDeltaKw > 0.5,
  'Premature enthalpy rounding regression: raw and rounded-enthalpy preheat chains are effectively identical.'
)

// TEST E - adiabatic energy conservation check
assert(
  closePercent(
    canonicalRunA.designPoint.airSideAdiabaticKwRaw,
    canonicalRunA.designPoint.waterSideAdiabaticKwRaw,
    0.1
  ),
  `Adiabatic energy conservation failed: air-side ${canonicalRunA.designPoint.airSideAdiabaticKwRaw.toFixed(3)} kW vs water-side ${canonicalRunA.designPoint.waterSideAdiabaticKwRaw.toFixed(3)} kW.`
)

// TEST F - heat pump COP only applies to additional preheat input
assert(
  almostEqual(
    canonicalRunA.designHeatPump.adiabaticPumpKWRaw,
    canonicalRunA.designElectric.adiabaticPumpKWRaw,
    1e-9
  ),
  'COP regression: Humifog pump power changed between electric and heat-pump runs.'
)

assert(
  closePercent(
    canonicalRunA.designHeatPump.reheatEnergyKWRaw,
    canonicalRunA.designElectric.grossReheatKWRaw / fixture.heatPumpCop,
    0.03
  ),
  'COP regression: heat pump input is not equal to additional thermal preheat divided by COP.'
)

// TEST G - annual BIN summation uses full precision
const annualRoundedSteamKwh = canonicalRunA.annualRows.reduce((sum, row) => {
  return sum + Math.round(row.steamKw) * row.effectiveHours
}, 0)

assert(
  Math.abs(canonicalRunA.annual.electricSteamKwh - annualRoundedSteamKwh) > 1,
  'Precision regression: annual BIN steam total is identical to rounded-per-bin accumulation.'
)

assert(
  canonicalRunA.annual.humifogCopTotalElectricKwh < canonicalRunA.annual.humifogElectricTotalKwh,
  'COP regression: annual heat-pump Humifog energy should be below annual electric-preheat Humifog energy.'
)

// TEST H - gas efficiencies are independent
assert(
  design.naturalGasSteamInputKWRaw > design.atmosphericGasHumidifierInputKWRaw,
  'Gas efficiency regression: natural-gas steam input should exceed atmospheric gas input for the same useful steam load when boiler efficiency is lower.'
)

const expectedInputRatio =
  (1 / (fixture.steamBoilerEfficiencyPercent / 100)) /
  (1 / (fixture.atmosphericGasHumidifierEfficiencyPercent / 100))
const actualInputRatio = design.naturalGasSteamInputKWRaw / Math.max(design.atmosphericGasHumidifierInputKWRaw, 1e-9)

assert(
  closePercent(actualInputRatio, expectedInputRatio, 0.02),
  'Gas efficiency regression: boiler and atmospheric humidifier efficiency paths appear coupled or swapped.'
)

// TEST I - zero-humidification boundary should produce zero Humifog incremental energy
const zeroLoadCase = calculateHvacDashboardMetrics(canonicalBaseInput(
  fixture,
  fixture.selectedReheatSystemElectric,
  {
    roomRelativeHumidity: 10,
    outsideWinterTemp: 5,
    outsideRelativeHumidity: 100,
    selectedCity: { nom: fixture.city.nom, hiver: 5 },
  }
))

assert(
  almostEqual(zeroLoadCase.steamHumidificationLoadRaw, 0, 1e-9),
  `Zero-load boundary failed: steam humidification load should be 0, got ${zeroLoadCase.steamHumidificationLoadRaw}`
)
assert(
  almostEqual(zeroLoadCase.steamEnergyKWRaw, 0, 1e-9),
  `Zero-load boundary failed: steam power should be 0, got ${zeroLoadCase.steamEnergyKWRaw}`
)
assert(
  almostEqual(zeroLoadCase.adiabaticPumpKWRaw, 0, 1e-9),
  `Zero-load boundary failed: Humifog pump should be 0, got ${zeroLoadCase.adiabaticPumpKWRaw}`
)
assert(
  almostEqual(zeroLoadCase.adiabaticTemperatureDropRaw, 0, 1e-9),
  `Zero-load boundary failed: adiabatic delta-T should be 0, got ${zeroLoadCase.adiabaticTemperatureDropRaw}`
)
assert(
  almostEqual(zeroLoadCase.grossReheatKWRaw, 0, 1e-9),
  `Zero-load boundary failed: additional Humifog preheat should be 0, got ${zeroLoadCase.grossReheatKWRaw}`
)
assert(
  almostEqual(zeroLoadCase.rawAdiabaticEnergyKW, 0, 1e-9),
  `Zero-load boundary failed: Humifog incremental energy should be 0, got ${zeroLoadCase.rawAdiabaticEnergyKW}`
)

// TEST J - automatic pre-Humifog calculation reaches the selected final target
assertApprox(canonicalRunA.designPoint.afterHumifogTempC, fixture.roomTemperatureC, 0.05, 'Final Humifog temperature')
assertApprox(canonicalRunA.designPoint.afterHumifogRh, fixture.roomRelativeHumidity, 0.05, 'Final Humifog RH')
assert(
  Math.abs(canonicalRunA.designPoint.preHumifogTempC - 30) > 0.1,
  'Automatic pre-Humifog calculation incorrectly assumes a fixed 30 C / 86 F temperature.'
)
assertApprox(canonicalRunA.designPoint.humidificationLoadLbHrRaw, 91.56737803233806, 0.05, 'Canonical humidification load')
assertApprox(canonicalRunA.designPoint.electricSteamKwRaw, 31.590745421156626, 0.05, 'Canonical electric steam')
assertApprox(canonicalRunA.designPoint.baseHvacHeatingKwRaw, 99.61298984319217, 0.05, 'Canonical base HVAC heating')
assertApprox(canonicalRunA.designPoint.additionalHumifogPreheatKwRaw, 0.7567356984388454, 0.05, 'Canonical additional Humifog preheat')
assertApprox(canonicalRunA.designPoint.humifogElectricTotalKwRaw, 1.7567356984388454, 0.05, 'Canonical Humifog electric total')
assertApprox(canonicalRunA.designPoint.humifogCopTotalKwRaw, 1.1991409732733804, 0.05, 'Canonical Humifog COP total')
assertApprox(
  canonicalRunA.designPoint.baseHvacHeatingKwRaw,
  (1.08 * fixture.totalAirflowCfm * (canonicalRunA.designElectric.preHumifogTempRaw - canonicalRunA.designElectric.afterWheelTemp) * 1.8) / 3412,
  0.05,
  'Calculated pre-Humifog temperature drives base heating'
)
assertApprox(canonicalRunA.annual.electricSteamKwh, 33536.22357209672, 0.2, 'Canonical annual electric steam')
assertApprox(canonicalRunA.annual.humifogElectricTotalKwh, 2359.976288074787, 0.2, 'Canonical annual Humifog electric')
assertApprox(canonicalRunA.annual.humifogCopTotalElectricKwh, 1760.908707388102, 0.2, 'Canonical annual Humifog COP')

for (const target of [
  { supplyAirTemperature: 20, roomRelativeHumidity: 30 },
  { supplyAirTemperature: 22, roomRelativeHumidity: 35 },
  { supplyAirTemperature: 24, roomRelativeHumidity: 45 },
]) {
  const targetRun = calculateHvacDashboardMetrics(canonicalBaseInput(
    fixture,
    fixture.selectedReheatSystemElectric,
    target
  ))
  assertApprox(targetRun.afterHumifogTemp, target.supplyAirTemperature, 0.05, `Final Humifog temperature target ${target.supplyAirTemperature} C`)
  assertApprox(targetRun.afterHumifogRh, target.roomRelativeHumidity, 0.05, `Final Humifog RH target ${target.roomRelativeHumidity}%`)
  assert(
    Math.abs(targetRun.preHumifogTemp - 30) > 0.1 || target.supplyAirTemperature !== 22 || target.roomRelativeHumidity !== 35,
    `Automatic pre-Humifog temperature unexpectedly fixed at 30 C for target ${target.supplyAirTemperature} C / ${target.roomRelativeHumidity}%.`
  )
}

console.log('100% OA regression checks passed.')
console.log(JSON.stringify({
  canonicalFixture: {
    city: fixture.city,
    outdoorDesignTemperatureC: fixture.outdoorDesignTemperatureC,
    outdoorDesignRelativeHumidity: fixture.outdoorDesignRelativeHumidity,
    roomTemperatureC: fixture.roomTemperatureC,
    roomRelativeHumidity: fixture.roomRelativeHumidity,
    totalAirflowCfm: fixture.totalAirflowCfm,
    supplyTemperatureC: fixture.supplyTemperatureC,
    recoveryType: fixture.recoveryType,
    sensibleEfficiencyPercent: fixture.sensibleEfficiencyPercent,
    latentEfficiencyPercent: fixture.latentEfficiencyPercent,
    humidificationTechnology: fixture.humidificationTechnology,
    heatingSource: fixture.heatingSource,
    heatPumpCop: fixture.heatPumpCop,
    electricityTariffPerKwh: fixture.electricityTariffPerKwh,
    gasTariffPerM3: fixture.gasTariffPerM3,
    steamBoilerEfficiencyPercent: fixture.steamBoilerEfficiencyPercent,
    atmosphericGasHumidifierEfficiencyPercent: fixture.atmosphericGasHumidifierEfficiencyPercent,
    operatingDays: fixture.operatingDays,
    scheduleMode: fixture.scheduleMode,
    scheduleStartTime: fixture.scheduleStartTime,
    scheduleEndTime: fixture.scheduleEndTime,
    calculationMethod: fixture.calculationMethod,
  },
  deterministicCheck: {
    tolerance: 1e-9,
    comparedMetrics: [
      'humidificationLoadLbHrRaw',
      'electricSteamKwRaw',
      'baseHvacHeatingKwRaw',
      'totalHumifogPreheatKwRaw',
      'additionalHumifogPreheatKwRaw',
      'humifogPumpKwRaw',
      'humifogElectricTotalKwRaw',
      'humifogCopTotalKwRaw',
      'electricSteamKwh',
      'humifogElectricTotalKwh',
      'humifogCopTotalElectricKwh',
    ],
    pass: true,
  },
  schedule: canonicalRunA.schedule,
  designPoint: canonicalRunA.designPoint,
  annual: canonicalRunA.annual,
  reductions: canonicalRunA.reductions,
  annualBinRows: canonicalRunA.annualRows.map((row) => ({
    tempC: row.tempC,
    rh: row.rh,
    originalHours: row.originalHours,
    effectiveHours: row.effectiveHours,
    humidificationLoadLbH: row.humidificationLoadLbH,
    steamKw: row.steamKw,
    steamBinKwh: row.steamBinKwh,
    humifogPumpKw: row.humifogPumpKw,
    additionalHumifogPreheatKw: row.additionalHumifogPreheatKw,
    electricHumifogBinKwh: row.electricHumifogBinKwh,
    copHeatPumpBinKwh: row.copHeatPumpBinKwh,
  })),
}, null, 2))