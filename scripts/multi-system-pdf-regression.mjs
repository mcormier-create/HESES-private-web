import { summarizeBuildingSavings, summarizeProjectEnergy } from '../src/reports/projectEnergySummary.js'

const systems = [
  createSystem('UTA-1', 'BIN Hours', 12500, [120000, 104000, 98000, 110000, 69000]),
  createSystem('UTA-2', 'Custom Operating Hours', 35000, [310000, 268000, 251000, 282000, 176000], null, 'Heat Pump'),
  createSystem('UTA-3', 'Custom Operating Hours', 90000, [720000, 624000, 586000, 646000, 402000], 388000, '', true),
]

const uta1Before = { ...systems[0].settings }
systems[1].settings.outsideAirCFM = 36000
systems[2].settings.outsideAirCFM = 95000
if (JSON.stringify(systems[0].settings) !== JSON.stringify(uta1Before)) {
  throw new Error('UTA-1 settings changed when UTA-2 or UTA-3 was changed.')
}

const summary = summarizeProjectEnergy(systems)
const savings = summarizeBuildingSavings(systems)
const expected = {
  electricSteam: 1150000,
  naturalGasSteam: 996000,
  atmosphericGas: 935000,
  humifogSelected: 674000,
}

for (const [technology, annualEnergyKWh] of Object.entries(expected)) {
  if (summary.totals[technology].annualEnergyKWh !== annualEnergyKWh) {
    throw new Error(`${technology} building total did not equal the sum of UTA-1, UTA-2, and UTA-3.`)
  }
}

if (summary.operatingHourBasis !== 'mixed') {
  throw new Error('Mixed BIN/custom operating-hour basis was not retained in the building summary.')
}

const expectedSavings = [10000, 134000, 332000]
const expectedCostSavings = [1200, 16080, 39840]
savings.bySystem.forEach(({ savings: systemSavings }, index) => {
  if (systemSavings.energySavings !== expectedSavings[index]) {
    throw new Error(`UTA-${index + 1} energy savings did not match its authoritative reference and selected Humifog results.`)
  }
  if (systemSavings.costSavings !== expectedCostSavings[index]) {
    throw new Error(`UTA-${index + 1} cost savings did not match its authoritative reference and selected Humifog results.`)
  }
})
if (savings.totals.energySavings !== expectedSavings.reduce((sum, value) => sum + value, 0)) {
  throw new Error('Building energy savings did not equal the sum of individual UTA savings.')
}
if (savings.totals.costSavings !== expectedCostSavings.reduce((sum, value) => sum + value, 0)) {
  throw new Error('Building cost savings did not equal the sum of individual UTA savings.')
}
const expectedBuildingReduction = savings.totals.energySavings / savings.totals.referenceEnergy * 100
if (Math.abs(savings.totals.energyReductionPercent - expectedBuildingReduction) > 1e-9) {
  throw new Error('Building energy reduction percentage was not calculated from building totals.')
}

console.log('Multi-system PDF annual-total proof passed.')
for (const technology of Object.keys(expected)) {
  console.log(`${technology}: ${summary.totals[technology].annualEnergyKWh.toLocaleString('en-CA')} kWh/year`)
}
for (const [index, entry] of savings.bySystem.entries()) {
  console.log(`UTA-${index + 1} savings: ${entry.savings.energySavings.toLocaleString('en-CA')} kWh/year; ${entry.savings.costSavings.toLocaleString('en-CA')} $/year`)
}
console.log(`Building savings: ${savings.totals.energySavings.toLocaleString('en-CA')} kWh/year; ${savings.totals.costSavings.toLocaleString('en-CA')} $/year`)

function createSystem(name, hoursBasis, airflow, energy, humifogFreeCooling = null, reheatEnergySource = '', isFreeCoolingMode = false) {
  const [electricSteam, naturalGasSteam, atmosphericGas, humifogElectric, humifogHeatPump] = energy
  return {
    name,
    hoursBasis,
    settings: { outsideAirCFM: airflow },
    mode: { isFreeCoolingMode },
    system: { supplyAirflowCfm: airflow, reheatEnergySource },
    results: {
      electricSteam: { annualEnergyKWh: electricSteam, annualOperatingCost: electricSteam * 0.12 },
      naturalGasSteam: { annualEnergyKWh: naturalGasSteam, annualOperatingCost: naturalGasSteam * 0.08 },
      atmosphericGas: { annualEnergyKWh: atmosphericGas, annualOperatingCost: atmosphericGas * 0.085 },
      humifogElectric: { annualEnergyKWh: humifogElectric, annualOperatingCost: humifogElectric * 0.12 },
      humifogHeatPump: { annualEnergyKWh: humifogHeatPump, annualOperatingCost: humifogHeatPump * 0.12 },
      ...(humifogFreeCooling === null ? {} : {
        humifogFreeCooling: { annualEnergyKWh: humifogFreeCooling, annualOperatingCost: humifogFreeCooling * 0.12 },
      }),
    },
  }
}