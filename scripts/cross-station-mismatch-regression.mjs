import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAndValidateEpw } from '../src/services/epwImportService.js'
import { CANADA_WEATHER_CATALOG_INDEX } from '../src/regions/canadaWeatherCatalog.js'

// Reproduces, outside the UI, the exact cross-station guard used by the hourly weather
// loading effect in HVACDashboardVisual.jsx: the EPW actually fetched must match the
// station the user selected, or the simulation must be blocked (no fallback, no HVAC run).

function crossStationGuard(expectedStationId, epwText, fileName) {
  const regionalImport = parseAndValidateEpw(epwText, { fileName })
  const parsedStationId = String(regionalImport?.metadata?.location?.stationId || '').trim()
  if (String(expectedStationId).trim() && parsedStationId && String(expectedStationId).trim() !== parsedStationId) {
    throw new Error(`CROSS_STATION_MISMATCH::expected ${expectedStationId} got ${parsedStationId}`)
  }
  return regionalImport
}

const montreal = Object.values(CANADA_WEATHER_CATALOG_INDEX.manifestsByCityId).find((r) => r.stationId === '716270')
const calgary = Object.values(CANADA_WEATHER_CATALOG_INDEX.manifestsByCityId).find((r) => r.stationId === '718770')
assert.ok(montreal && calgary, 'Montreal (716270) and Calgary (718770) manifest entries must exist.')

const calgaryText = readFileSync(calgary.epwFile, 'utf8')

// Case 1: selected station = Montreal (716270), but the fetched file is Calgary's -> must throw.
let blocked = false
let annualHvacRecordsUsed = 0
try {
  const result = crossStationGuard(montreal.stationId, calgaryText, calgary.epwFile)
  // If the guard did not throw, records would incorrectly flow into the annual simulation.
  annualHvacRecordsUsed = result.records?.length || 0
} catch (error) {
  blocked = error.message.startsWith('CROSS_STATION_MISMATCH')
}
assert.equal(blocked, true, 'Mismatched station/file must be BLOCKED (CROSS_STATION_MISMATCH), not silently loaded.')
assert.equal(annualHvacRecordsUsed, 0, 'No annual HVAC calculation input must be produced on a cross-station mismatch.')

// Case 2: selected station = Calgary (718770), fetched file = Calgary's own file -> must pass.
let matchedOk = false
try {
  const result = crossStationGuard(calgary.stationId, calgaryText, calgary.epwFile)
  matchedOk = result.records.length === 8760
} catch (error) {
  matchedOk = false
}
assert.equal(matchedOk, true, 'A correctly matched station/file pair must load its real 8760 hourly records.')

console.log('Cross-station mismatch regression passed.')
console.log(JSON.stringify({
  montrealStationId: montreal.stationId,
  calgaryStationId: calgary.stationId,
  mismatchBlocked: blocked,
  matchedCaseRecords: 8760,
}, null, 2))
