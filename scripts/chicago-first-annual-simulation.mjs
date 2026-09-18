import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAndValidateEpw, toHesaWeatherContract } from '../src/services/epwImportService.js'
import { CHICAGO_WEATHER_MANIFEST } from '../src/regions/weatherStationManifest.js'

function loadHourlyEngine() {
  const psychrometricsSource = readFileSync('src/calculations/psychrometrics.js', 'utf8').replace(/export /g, '')
  const hvacSource = readFileSync('src/services/hvacEngineeringService.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics(?:\.js)?'\s*/m, '')
    .replace(/export /g, '')
  const hourlySource = readFileSync('src/services/hourlyWeatherSimulation.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics'\s*/m, '')
    .replace(/import[\s\S]*?from '\.\/hvacEngineeringService'\s*/m, '')
    .replace(/export /g, '')
    .replace('function calculateHourlySimulation(records, options) {', 'function calculateHourlySimulation(records, options) {\n  const auditTrace = []')
    .replace('    totalWaterKg += waterKg', '    totalWaterKg += waterKg\n    auditTrace.push({ correctedHumidificationLoad })')
  const returnIndex = hourlySource.lastIndexOf('  return {')
  const instrumentedHourlySource = hourlySource.slice(0, returnIndex) + hourlySource.slice(returnIndex).replace('  return {', '  return {\n    auditTrace,', 1)
  return Function(`${psychrometricsSource}\n${hvacSource}\n${instrumentedHourlySource}\nreturn { calculateHourlySimulation, isEpwRecordOperating }`)()
}

function loadFreeCoolingEngine() {
  const psychrometricsSource = readFileSync('src/calculations/psychrometrics.js', 'utf8').replace(/export /g, '')
  const serviceSource = readFileSync('src/services/freeCoolingHumifogService.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics(?:\.js)?'\s*/m, '')
    .replace(/export /g, '')
  return Function(`${psychrometricsSource}\n${serviceSource}\nreturn { calculateFreeCoolingHumifogComparison }`)()
}

const imported = parseAndValidateEpw(readFileSync(CHICAGO_WEATHER_MANIFEST.epwFile, 'utf8'), { fileName: CHICAGO_WEATHER_MANIFEST.epwFile })
const weather = toHesaWeatherContract(imported)
const scenario = {
  scheduleMode: 'custom', scheduleStartTime: '06:00', scheduleEndTime: '18:00', scheduleDaysOption: 'mon-fri',
  scheduleCustomDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  outsideAirCFM: 12500, activeFraction: 0.2, roomTemperature: 22, roomRelativeHumidity: 35, supplyAirTemperature: 22,
  selectedRecoveries: [{ nom: 'Thermal Wheel', type: 'Thermal Wheel' }], wheelEfficiency: 78, latentRecoveryEfficiency: 70,
  selectedReheatSystem: { nom: 'Air/Water Heat Pump', energie: 'Heat Pump', cop: 3.8, facteur: 0.32 }, heatPumpCOP: 3.8,
  steamBoilerEfficiency: 68, electricHumidifierEfficiency: 100, atmosphericGasHumidifierEfficiency: 82,
  electricityRate: 0.12, naturalGasRate: 0.45,
}
const { calculateHourlySimulation, isEpwRecordOperating } = loadHourlyEngine()
const hourly = calculateHourlySimulation(weather.records, scenario)
assert.equal(hourly.recordsLoaded, 8760)
const operatingRecords = weather.records.filter((record) => isEpwRecordOperating(record, scenario.scheduleMode, scenario.scheduleStartTime, scenario.scheduleEndTime, scenario.scheduleDaysOption, scenario.scheduleCustomDays))
assert.equal(hourly.operatingHoursUsed, operatingRecords.length)

const { calculateFreeCoolingHumifogComparison } = loadFreeCoolingEngine()
const minimumOutsideAirPercent = 20
const freeCooling = calculateFreeCoolingHumifogComparison({
  bins: operatingRecords.map((record) => ({ tempC: record.dryBulbC, rh: record.relativeHumidity, hours: 1 })),
  roomDb: 22, roomRh: 35, minimumOutdoorAirPercent: minimumOutsideAirPercent, mixedAirTargetDb: 18, humifogEffectiveness: 0.72,
  airflowCfm: 12500, selectedReheatSystem: scenario.selectedReheatSystem, heatPumpCOP: 3.8,
  electricityRate: 0.12, naturalGasRate: 0.45, includeOptimizationRows: false, includeRowPoints: false,
})
assert(freeCooling.isComplete)
const rows = freeCooling.binValidationRows
const oaValues = rows.map((row) => row.appliedOutdoorAirPercent)
const elevatedOaRows = rows.filter((row) => row.appliedOutdoorAirPercent > minimumOutsideAirPercent + 0.05)
const violations = elevatedOaRows.filter((row) => row.reheatLoadKw > 0.05).length
assert(oaValues.every((value) => value >= minimumOutsideAirPercent - 0.05))
assert.equal(violations, 0)

console.log('Chicago first annual simulation completed with the unchanged HVAC engines.')
console.log(JSON.stringify({
  station: CHICAGO_WEATHER_MANIFEST.stationName,
  stationId: CHICAGO_WEATHER_MANIFEST.stationId,
  dataset: CHICAGO_WEATHER_MANIFEST.weatherDataset,
  weatherRecords: hourly.recordsLoaded,
  operatingHours: hourly.operatingHoursUsed,
  humidificationActiveHours: hourly.hoursWithHumidificationRequired,
  positiveLoadHours: hourly.auditTrace.filter((row) => row.correctedHumidificationLoad > 0).length,
  pumpEnergyKwh: hourly.annualHumifogPumpKwh,
  steamEnergyKwh: hourly.annualSteamKwh,
  humifogComparativeEnergyKwh: hourly.annualHumifogKwh,
  residualHumifogReheatKwh: hourly.annualHumifogReheatKwh,
  annualSavings: hourly.annualSavings,
  minimumOutsideAirPercent,
  finalOutsideAirRangePercent: [Math.min(...oaValues), Math.max(...oaValues)],
  hoursFinalOaAboveMinimum: elevatedOaRows.length,
  finalOaAboveMinimumResidualReheatViolations: violations,
}, null, 2))
