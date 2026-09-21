import assert from 'node:assert/strict'
import { calculateHourlySimulation } from '../src/services/hourlyWeatherSimulation.js'

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

function record({ hour, dryBulbC, relativeHumidity }) {
  return {
    year: 2021, month: 1, day: 5, hour, minute: 0,
    dryBulbC, dewPointC: dryBulbC - 2, relativeHumidity, pressurePa: 101325,
  }
}

// Case 1: operating hour, cold/dry outdoor air => real humidification load => pump must be > 0.
const loadPositive = calculateHourlySimulation(
  [record({ hour: 10, dryBulbC: -20, relativeHumidity: 70 })],
  baseOptions
)
assert.ok(loadPositive.annualHumifogPumpKwh > 0, `Expected pump energy > 0 with active load, got ${loadPositive.annualHumifogPumpKwh}`)

// Case 2: operating hour, zero effective outside airflow => structurally zero humidification load => pump must be 0.
// Note: the pre-existing deltaW floor (Math.max(0.00001, ...)) means real weather alone never rounds
// the load to exactly zero under active airflow; zero airflow is the valid way to reach load = 0.
const loadZero = calculateHourlySimulation(
  [record({ hour: 10, dryBulbC: 22, relativeHumidity: 90 })],
  { ...baseOptions, activeFraction: 0 }
)
assert.equal(loadZero.annualHumifogPumpKwh, 0, `Expected pump energy = 0 with no load, got ${loadZero.annualHumifogPumpKwh}`)

// Case 3: building OFF (hour outside the 08:00-19:00 schedule) => record excluded => pump energy = 0.
const buildingOff = calculateHourlySimulation(
  [record({ hour: 2, dryBulbC: -20, relativeHumidity: 70 })],
  baseOptions
)
assert.equal(buildingOff.annualHumifogPumpKwh, 0, `Expected pump energy = 0 while building OFF, got ${buildingOff.annualHumifogPumpKwh}`)

// Case 4: 24/7 schedule, zero effective outside airflow (no humidification requirement) => pump energy = 0.
const alwaysOnNoLoad = calculateHourlySimulation(
  [record({ hour: 2, dryBulbC: 22, relativeHumidity: 90 })],
  { ...baseOptions, scheduleMode: '24-7', scheduleDaysOption: 'seven-days', activeFraction: 0 }
)
assert.equal(alwaysOnNoLoad.annualHumifogPumpKwh, 0, `Expected pump energy = 0 for 24/7 no-load hour, got ${alwaysOnNoLoad.annualHumifogPumpKwh}`)

console.log('Pump activation regression passed.')
console.log(JSON.stringify({
  loadPositivePumpKwh: loadPositive.annualHumifogPumpKwh,
  loadZeroPumpKwh: loadZero.annualHumifogPumpKwh,
  buildingOffPumpKwh: buildingOff.annualHumifogPumpKwh,
  alwaysOnNoLoadPumpKwh: alwaysOnNoLoad.annualHumifogPumpKwh,
}, null, 2))
