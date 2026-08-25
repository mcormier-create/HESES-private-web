import assert from 'node:assert/strict'
import { calculateHvacDashboardMetrics } from '../src/services/hvacEngineeringService.js'
import { humifogReheatLabel } from '../src/reports/projectEnergySummary.js'

const base = {
  outsideAirCFM: 12500,
  effectiveOutsideAirCFM: 12500,
  roomTemperature: 22,
  roomRelativeHumidity: 35,
  supplyAirTemperature: 22,
  outsideWinterTemp: -23,
  selectedRecoveries: [{ nom: 'None', noRecovery: true }],
  wheelEfficiency: 0,
  latentRecoveryEfficiency: 0,
  heatPumpCOP: 4,
  steamBoilerEfficiency: 82,
  atmosphericGasHumidifierEfficiency: 82,
  electricityRate: 0.07,
  naturalGasRate: 0.45,
  selectedCity: { nom: 'Montreal', hiver: -23, humidite: 65 },
  economizerTargetTemp: 18,
  is100OA: true,
  outsideRelativeHumidity: 65,
  scheduleFactor: 1,
}

const selections = [
  { key: 'electric', system: { nom: 'Electric', energie: 'Electricity', rendement: 100, facteur: 1 } },
  { key: 'gas', system: { nom: 'Natural Gas Hot Water', energie: 'Natural Gas', rendement: 88, facteur: 0.82 } },
  { key: 'heatPump', system: { nom: 'Air/Water Heat Pump', energie: 'Heat Pump', cop: 4, facteur: 0.25 } },
]
const results = selections.map(({ key, system }) => {
  const metrics = calculateHvacDashboardMetrics({ ...base, selectedReheatSystem: system })
  return { key, system, metrics, label: humifogReheatLabel({ system: { reheatEnergySource: system.energie } }, 'en') }
})

const thermalRequirement = results[0].metrics.grossReheatKWRaw
for (const result of results) {
  assert(Math.abs(result.metrics.grossReheatKWRaw - thermalRequirement) < 1e-9, `${result.key}: thermal reheat changed`)
}
assert.equal(results[0].label, 'Humifog + Electric Reheat')
assert.equal(results[1].label, 'Humifog + Natural Gas Reheat')
assert.equal(results[2].label, 'Humifog + Heat Pump')
assert.equal(results[0].metrics.reheatEnergyKWRaw, thermalRequirement)
assert(Math.abs(results[2].metrics.reheatEnergyKWRaw - thermalRequirement / 4) < 1e-9)
assert.notEqual(results[0].metrics.reheatEnergyKWRaw, results[2].metrics.reheatEnergyKWRaw)

console.log('Reheat selection regression checks passed.')
console.table(results.map(({ key, metrics, label }) => ({
  key,
  label,
  thermalReheatKw: metrics.grossReheatKWRaw,
  inputReheatKw: metrics.reheatEnergyKWRaw,
  pumpKw: metrics.adiabaticHumidificationKWRaw,
})))
