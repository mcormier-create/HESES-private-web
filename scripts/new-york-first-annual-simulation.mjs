import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseAndValidateEpw, toHesaWeatherContract } from '../src/services/epwImportService.js'
import { NEW_YORK_WEATHER_MANIFEST } from '../src/regions/weatherStationManifest.js'

function loadHourlyEngine() {
  const psychrometricsSource = readFileSync('src/calculations/psychrometrics.js', 'utf8').replace(/export /g, '')
  const hvacSource = readFileSync('src/services/hvacEngineeringService.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics(?:\.js)?'\s*/m, '')
    .replace(/export /g, '')
  const hourlySource = readFileSync('src/services/hourlyWeatherSimulation.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics'\s*/m, '')
    .replace(/import[\s\S]*?from '\.\/hvacEngineeringService'\s*/m, '')
    .replace(/export /g, '')

  return Function(`${psychrometricsSource}\n${hvacSource}\n${hourlySource}\nreturn { calculateHourlySimulation, isEpwRecordOperating }`)()
}

function loadFreeCoolingEngine() {
  const psychrometricsSource = readFileSync('src/calculations/psychrometrics.js', 'utf8').replace(/export /g, '')
  const serviceSource = readFileSync('src/services/freeCoolingHumifogService.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics(?:\.js)?'\s*/m, '')
    .replace(/export /g, '')

  return Function(`${psychrometricsSource}\n${serviceSource}\nreturn { calculateFreeCoolingHumifogComparison }`)()
}

const epwBytes = readFileSync(NEW_YORK_WEATHER_MANIFEST.epwFile)
const actualSha256 = createHash('sha256').update(epwBytes).digest('hex')
assert.equal(actualSha256, NEW_YORK_WEATHER_MANIFEST.sha256, 'Certified JFK EPW SHA-256 changed.')

const imported = parseAndValidateEpw(epwBytes.toString('utf8'), { fileName: NEW_YORK_WEATHER_MANIFEST.epwFile })
const weather = toHesaWeatherContract(imported)
assert.equal(imported.qualityReport.recordCount, weather.records.length, 'EPW-to-HESA cardinality changed.')

const scenario = {
  scheduleMode: 'custom',
  scheduleStartTime: '06:00',
  scheduleEndTime: '18:00',
  scheduleDaysOption: 'mon-fri',
  scheduleCustomDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  outsideAirCFM: 12500,
  activeFraction: 0.2,
  roomTemperature: 22,
  roomRelativeHumidity: 35,
  supplyAirTemperature: 22,
  selectedRecoveries: [{ nom: 'Thermal Wheel', type: 'Thermal Wheel' }],
  wheelEfficiency: 78,
  latentRecoveryEfficiency: 70,
  selectedReheatSystem: { nom: 'Air/Water Heat Pump', energie: 'Heat Pump', cop: 3.8, facteur: 0.32 },
  heatPumpCOP: 3.8,
  steamBoilerEfficiency: 68,
  electricHumidifierEfficiency: 100,
  atmosphericGasHumidifierEfficiency: 82,
  electricityRate: 0.12,
  naturalGasRate: 0.45,
}

const { calculateHourlySimulation, isEpwRecordOperating } = loadHourlyEngine()
const hourly = calculateHourlySimulation(weather.records, scenario)
const operatingRecords = weather.records.filter((record) => isEpwRecordOperating(
  record,
  scenario.scheduleMode,
  scenario.scheduleStartTime,
  scenario.scheduleEndTime,
  scenario.scheduleDaysOption,
  scenario.scheduleCustomDays
))
assert.equal(hourly.operatingHoursUsed, operatingRecords.length, 'Hourly schedule count mismatch.')

const { calculateFreeCoolingHumifogComparison } = loadFreeCoolingEngine()
const scenarioMinimumOaPercent = 20
const freeCooling = calculateFreeCoolingHumifogComparison({
  bins: operatingRecords.map((record) => ({ tempC: record.dryBulbC, rh: record.relativeHumidity, hours: 1 })),
  roomDb: 22,
  roomRh: 35,
  minimumOutdoorAirPercent: scenarioMinimumOaPercent,
  mixedAirTargetDb: 18,
  humifogEffectiveness: 0.72,
  airflowCfm: 12500,
  selectedReheatSystem: scenario.selectedReheatSystem,
  heatPumpCOP: 3.8,
  electricityRate: 0.12,
  naturalGasRate: 0.45,
  includeOptimizationRows: false,
  includeRowPoints: false,
})
assert(freeCooling.isComplete, freeCooling.incompleteReason || 'Free Cooling annual comparison is incomplete.')

const rows = freeCooling.binValidationRows
const oaValues = rows.map((row) => row.appliedOutdoorAirPercent)
assert(oaValues.every((value) => value >= scenarioMinimumOaPercent - 0.05), 'Applied OA fell below the configured minimum.')
const elevatedOaRows = rows.filter((row) => row.appliedOutdoorAirPercent > scenarioMinimumOaPercent + 0.05)
const elevatedOaWithResidualReheat = elevatedOaRows.filter((row) => row.reheatLoadKw > 0.05)

function timestamp(record) {
  return `${record.year}-${String(record.month).padStart(2, '0')}-${String(record.day).padStart(2, '0')} hour ${record.hour}`
}

function indexedExtreme(items, selector, compare) {
  return items.reduce((best, item, index) => compare(selector(item), selector(items[best.index])) ? { item, index } : best, { item: items[0], index: 0 })
}

const coldest = indexedExtreme(operatingRecords, (record) => record.dryBulbC, (left, right) => left < right)
const hottest = indexedExtreme(operatingRecords, (record) => record.dryBulbC, (left, right) => left > right)
const maxHumidification = indexedExtreme(rows, (row) => row.humidificationLoadKw, (left, right) => left > right)
const maxResidualReheat = indexedExtreme(rows, (row) => row.reheatLoadKw, (left, right) => left > right)

const report = {
  certification: {
    station: NEW_YORK_WEATHER_MANIFEST.stationName,
    stationId: NEW_YORK_WEATHER_MANIFEST.stationId,
    dataset: NEW_YORK_WEATHER_MANIFEST.weatherDataset,
    epwSha256: actualSha256,
    sourceMinuteConvention: imported.qualityReport.sourceMinuteConvention,
    normalizedMinute: imported.qualityReport.normalizedMinute,
  },
  scenario,
  annualHourlySimulation: {
    weatherRecords: hourly.recordsLoaded,
    operatingHours: hourly.operatingHoursUsed,
    humidificationHours: hourly.hoursWithHumidificationRequired,
    steamAnnualEnergyKwh: hourly.annualSteamKwh,
    humifogAnnualEnergyKwh: hourly.annualHumifogKwh,
    residualHumifogReheatKwh: hourly.annualHumifogReheatKwh,
    annualSavingsCurrency: hourly.annualSavings,
  },
  outdoorAirValidation: {
    minimumOutsideAirPercent: scenarioMinimumOaPercent,
    finalOutsideAirRangePercent: [Math.min(...oaValues), Math.max(...oaValues)],
    hoursAboveMinimum: elevatedOaRows.length,
    hoursAboveMinimumWithResidualReheat: elevatedOaWithResidualReheat.length,
    expectedInvariantSatisfied: elevatedOaWithResidualReheat.length === 0,
  },
  extremes: {
    coldest: { timestamp: timestamp(coldest.item), dryBulbC: coldest.item.dryBulbC, relativeHumidity: coldest.item.relativeHumidity },
    hottest: { timestamp: timestamp(hottest.item), dryBulbC: hottest.item.dryBulbC, relativeHumidity: hottest.item.relativeHumidity },
    maximumHumidificationLoad: { timestamp: timestamp(operatingRecords[maxHumidification.index]), loadKw: maxHumidification.item.humidificationLoadKw },
    maximumResidualReheat: { timestamp: timestamp(operatingRecords[maxResidualReheat.index]), loadKw: maxResidualReheat.item.reheatLoadKw },
  },
}

console.log('First certified HESA USA annual simulation completed with the unchanged HVAC engines.')
console.log(JSON.stringify(report, null, 2))
