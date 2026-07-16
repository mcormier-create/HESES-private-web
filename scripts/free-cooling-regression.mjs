import { readFileSync } from 'node:fs'

function loadFreeCoolingEngine() {
  const psychrometricsSource = readFileSync('src/calculations/psychrometrics.js', 'utf8')
    .replace(/export /g, '')
  const serviceSource = readFileSync('src/services/freeCoolingHumifogService.js', 'utf8')
    .replace(/import[\s\S]*?from '\.\.\/calculations\/psychrometrics'\s*/m, '')
    .replace(/export /g, '')

  return Function(`
    ${psychrometricsSource}
    ${serviceSource}
    return { calculateFreeCoolingHumifogComparison }
  `)()
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function closeEnough(left, right, tolerance = 0.2) {
  return Math.abs(left - right) <= tolerance
}

const { calculateFreeCoolingHumifogComparison } = loadFreeCoolingEngine()
const minimumOa = 20
const result = calculateFreeCoolingHumifogComparison({
  bins: [
    { tempC: -20, rh: 80, hours: 100 },
    { tempC: 0, rh: 80, hours: 100 },
    { tempC: 5, rh: 80, hours: 100 },
    { tempC: 10, rh: 80, hours: 100 },
  ],
  roomDb: 22,
  roomRh: 35,
  minimumOutdoorAirPercent: minimumOa,
  mixedAirTargetDb: 18,
  humifogEffectiveness: 0.72,
  airflowCfm: 12500,
  selectedReheatSystem: { energie: 'Thermopompe' },
  heatPumpCOP: 3.8,
})

assert(result.isComplete, 'Free Cooling comparison should be complete for valid BIN data.')
assert(result.annualTotalsValidation.energyTotalsMatch, 'Annual kWh must equal the sum of all BIN kWh.')
assert(result.annualTotalsValidation.costTotalsMatch, 'Annual cost must equal the sum of all BIN costs.')

for (const row of result.binValidationRows) {
  assert(
    row.steamReference.theoreticalOaPercent >= minimumOa - 0.05,
    `Steam theoretical OA went below minimum at BIN ${row.tempC} C.`
  )
  assert(
    row.steamReference.appliedOaPercent >= minimumOa - 0.05,
    `Steam applied OA went below minimum at BIN ${row.tempC} C.`
  )
  assert(
    row.theoreticalOutdoorAirPercent >= minimumOa - 0.05,
    `Humifog theoretical OA went below minimum at BIN ${row.tempC} C.`
  )
  assert(
    row.appliedOutdoorAirPercent >= minimumOa - 0.05,
    `Humifog applied OA went below minimum at BIN ${row.tempC} C.`
  )
  assert(
    closeEnough(row.outdoorAirPercent, row.appliedOutdoorAirPercent),
    `Humifog energy OA must use the applied OA at BIN ${row.tempC} C.`
  )
  assert(
    closeEnough(
      row.steamReference.binCost,
      (row.steamReference.heatingCost || 0) +
        (row.steamReference.humidificationCost || 0) +
        (row.steamReference.reheatCost || 0),
      0.05
    ),
    `Steam BIN cost breakdown does not sum at BIN ${row.tempC} C.`
  )
  assert(
    closeEnough(
      row.humifogOptimized.binCost,
      (row.humifogOptimized.heatingCost || 0) +
        (row.humifogOptimized.humidificationCost || 0) +
        (row.humifogOptimized.reheatCost || 0),
      0.05
    ),
    `Humifog BIN cost breakdown does not sum at BIN ${row.tempC} C.`
  )
}

const coldLockedRow = result.binValidationRows.find((row) => row.tempC === -20)
assert(coldLockedRow, 'Missing -20 C regression BIN.')
assert(
  closeEnough(coldLockedRow.steamReference.appliedOaPercent, minimumOa, 0.05),
  'Steam should be limited to selected minimum OA at -20 C.'
)
assert(
  closeEnough(coldLockedRow.appliedOutdoorAirPercent, minimumOa, 0.05),
  'Humifog should be limited to selected minimum OA at -20 C.'
)
assert(
  closeEnough(coldLockedRow.steamReference.tmix, coldLockedRow.mixedDb, 0.05),
  'When both scenarios are minimum-limited, applied mixed temperatures should match.'
)

const modulatingRow = result.binValidationRows.find((row) => row.tempC === 5)
assert(modulatingRow, 'Missing 5 C regression BIN.')
assert(
  modulatingRow.steamReference.appliedOaPercent > modulatingRow.appliedOutdoorAirPercent + 0.5,
  'At 5 C, Humifog should close the OA damper more than steam while respecting the minimum.'
)
assert(
  modulatingRow.targetMixedDb > modulatingRow.steamReference.targetMixedDb + 0.2,
  'Humifog target mixed temperature must be warmer before atomization.'
)
assert(
  modulatingRow.mixedDb > modulatingRow.steamReference.tmix + 0.2,
  'At 5 C, Humifog applied mixed temperature should be warmer than steam.'
)
assert(
  modulatingRow.difference.binEnergyKwh > 0,
  'At 5 C, Humifog should produce positive BIN energy savings in this regression case.'
)

const impactRows = result.optimizationRows || []
assert(impactRows.length >= 3, 'OA / RA impact table must include multiple tested OA points.')

const distinctImpactTotals = new Set(
  impactRows.map((row) => Math.round((row.totalEnergyKwh || 0) * 10) / 10)
)
const distinctImpactMixedTemps = new Set(
  impactRows.map((row) => Math.round((row.tmix || 0) * 10) / 10)
)

assert(
  distinctImpactTotals.size > 1,
  'OA / RA impact rows must not all have identical total energy.'
)
assert(
  distinctImpactMixedTemps.size > 1,
  'OA / RA impact rows must not all have identical mixed air temperatures.'
)

for (const row of impactRows) {
  for (const binRow of row.rows || []) {
    assert(
      binRow.appliedOutdoorAirPercent >= row.oaPercent - 0.05,
      `OA / RA impact row ${row.oaPercent}% used an applied OA below its tested minimum.`
    )
  }
}

console.log('Free Cooling regression checks passed.')
