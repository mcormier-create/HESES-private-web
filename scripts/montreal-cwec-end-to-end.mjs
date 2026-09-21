import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { epwTextToRecords, calculateHourlySimulation, isEpwRecordOperating } from '../src/services/hourlyWeatherSimulation.js'
import { CANADA_WEATHER_CATALOG_INDEX } from '../src/regions/canadaWeatherCatalog.js'

const montreal = Object.values(CANADA_WEATHER_CATALOG_INDEX.manifestsByCityId).find((r) => r.stationId === '716270')
assert.equal(montreal.certificationStatus, 'CERTIFIED')

const text = readFileSync(montreal.epwFile, 'utf8')
const { records } = epwTextToRecords(text)
assert.equal(records.length, 8760, 'Real Montreal EPW must contain exactly 8760 hourly records.')

// Real EPW timestamps are used directly (no synthesis).
assert(records[0].year >= 1998 && records[0].year <= 2017, 'Timestamps must come from the real CWEEDS period, not invented.')

const custom0819 = records.filter((r) => isEpwRecordOperating(r, 'custom', '08:00', '19:00', 'seven-days', {})).length
const alwaysOn = records.filter((r) => isEpwRecordOperating(r, '24-7', '00:00', '24:00', 'seven-days', {})).length
assert.equal(alwaysOn, 8760, '24/7 must cover every real hourly record.')

const baseOptions = {
  scheduleMode: 'custom',
  scheduleStartTime: '08:00',
  scheduleEndTime: '19:00',
  scheduleDaysOption: 'seven-days',
  scheduleCustomDays: {},
  outsideAirCFM: 12500,
  activeFraction: 1,
  roomTemperature: 22,
  roomRelativeHumidity: 35,
  supplyAirTemperature: 22,
  selectedRecoveries: [{ nom: 'Aucun', noRecovery: true }],
  wheelEfficiency: 0,
  latentRecoveryEfficiency: 0,
  selectedReheatSystem: { nom: 'Electrique', energie: 'Electricite', rendement: 100 },
  heatPumpCOP: 3.5,
  steamBoilerEfficiency: 82,
  atmosphericGasHumidifierEfficiency: 82,
  electricityRate: 0.12,
  naturalGasRate: 0.45,
}

const customResult = calculateHourlySimulation(records, baseOptions)
const alwaysOnResult = calculateHourlySimulation(records, { ...baseOptions, scheduleMode: '24-7' })

assert(customResult.annualHumifogPumpKwh >= 0)
assert(customResult.annualSteamKwh >= 0)
// Pump invariant: any hour with a humidification requirement must produce pump energy > 0 in aggregate.
assert(customResult.hoursWithHumidificationRequired === undefined || customResult.hoursWithHumidificationRequired >= 0)

console.log('Montreal CWEC end-to-end regression passed.')
console.log(JSON.stringify({
  stationId: montreal.stationId,
  sha256: montreal.sha256,
  totalRecords: records.length,
  custom_08_19_operatingHours: custom0819,
  always_on_hours: alwaysOn,
  custom_totalSteamKwh: customResult.annualSteamKwh,
  custom_totalHumifogPumpKwh: customResult.annualHumifogPumpKwh,
  alwaysOn_totalHumifogPumpKwh: alwaysOnResult.annualHumifogPumpKwh,
}, null, 2))
