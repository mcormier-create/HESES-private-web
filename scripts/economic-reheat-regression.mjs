import {
  summarizeBuildingSavings,
  summarizeProjectEnergy,
} from '../src/reports/projectEnergySummary.js'
import { calculateAppliedReheatEnergyKwh } from '../src/services/freeCoolingHumifogService.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function closeEnough(left, right, tolerance = 0.001) {
  return Math.abs(left - right) <= tolerance
}

const referenceGasSystem = createSystem({
  name: 'H-1',
  reference: 'naturalGasSteam',
  selectedHumifog: 'humifogFreeCooling',
  results: {
    electricSteam: result(835000, 42000, 35000),
    naturalGasSteam: result(835007, 36305, 65000),
    atmosphericGas: result(835007, 36305, 20398),
    humifogFreeCooling: result(835007 - 240345, 12000, 55503),
  },
  mode: { isFreeCoolingMode: true },
})
const savings = summarizeBuildingSavings([referenceGasSystem])
const h1 = savings.bySystem[0].savings
assert(h1.referenceTechnology === 'naturalGasSteam', 'H-1 must use the selected natural-gas reference.')
assert(h1.incrementalInvestment === -9497, 'H-1 Humifog incremental investment must be 55,503 - 65,000.')
assert(h1.costSavings === 24305, 'H-1 cost savings must use the selected gas reference cost.')

const mixed = summarizeProjectEnergy([
  referenceGasSystem,
  createSystem({
    name: 'H-2',
    reference: 'electricSteam',
    selectedHumifog: 'humifogElectric',
    results: {
      electricSteam: result(1000, 100, 1000),
      naturalGasSteam: result(900, 80, 1200),
      atmosphericGas: result(900, 80, 1200),
      humifogElectric: result(500, 60, 900),
    },
  }),
])
assert(mixed.referenceTechnology === null, 'Mixed selected references must not claim one building technology.')
assert(mixed.referenceEnergy === 836007, 'Building reference energy must sum each UTA selected reference.')
assert(mixed.referenceCost === 36405, 'Building reference cost must sum each UTA selected reference.')

const missingInstalled = summarizeBuildingSavings([createSystem({
  name: 'Missing cost',
  reference: 'naturalGasSteam',
  selectedHumifog: 'humifogFreeCooling',
  results: {
    naturalGasSteam: result(1000, 100, null),
    humifogFreeCooling: result(500, 50, 5000),
  },
  mode: { isFreeCoolingMode: true },
})]).bySystem[0].savings
assert(missingInstalled.incrementalInvestment === null, 'Missing installed cost must remain null.')
assert(missingInstalled.paybackStatus === 'notAvailable', 'Missing installed cost must produce notAvailable payback.')

assert(closeEnough(calculateAppliedReheatEnergyKwh(1000, { energie: 'Électricité', facteur: 1 }), 1000), 'Electric reheat must preserve thermal kWh.')
assert(closeEnough(calculateAppliedReheatEnergyKwh(1000, { energie: 'Thermopompe' }, 4), 250), 'Heat-pump reheat must divide by COP.')
assert(closeEnough(calculateAppliedReheatEnergyKwh(1000, { energie: 'Gaz naturel', rendement: 80 }), 1250), 'Gas reheat must divide by efficiency.')
const pumpEnergy = 688
const appliedReheatEnergy = calculateAppliedReheatEnergyKwh(1000, { energie: 'Électricité', facteur: 1 })
const freeCoolingSavingsIndicator = 240345
const humifogTotalEnergy = pumpEnergy + appliedReheatEnergy
assert(humifogTotalEnergy === 1688, 'Humifog total energy must contain pump plus applied reheat only.')
assert(![pumpEnergy, appliedReheatEnergy].includes(freeCoolingSavingsIndicator), 'Free Cooling savings must not be added to Humifog consumption.')

console.log('Economic and reheat regression checks passed.')

function result(annualEnergyKWh, annualOperatingCost, installedInvestmentCost) {
  return { annualEnergyKWh, annualOperatingCost, installedInvestmentCost }
}

function createSystem({ name, reference, selectedHumifog, results, mode = {} }) {
  return {
    name,
    mode,
    economics: { annualComparisonReference: reference },
    system: { reheatEnergySource: selectedHumifog === 'humifogHeatPump' ? 'Heat Pump' : '' },
    results,
  }
}
