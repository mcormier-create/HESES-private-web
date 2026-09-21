import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseAndValidateEpw } from '../src/services/epwImportService.js'
import { CHICAGO_WEATHER_MANIFEST } from '../src/regions/weatherStationManifest.js'

const epwBuffer = readFileSync(CHICAGO_WEATHER_MANIFEST.epwFile)
const actualSha256 = createHash('sha256').update(epwBuffer).digest('hex')
assert.equal(actualSha256, CHICAGO_WEATHER_MANIFEST.sha256)
const result = parseAndValidateEpw(epwBuffer.toString('utf8'), { fileName: CHICAGO_WEATHER_MANIFEST.epwFile })
assert.equal(result.qualityReport.valid, true)
assert.equal(result.qualityReport.recordCount, 8760)
assert.deepEqual(result.metadata.location, {
  city: CHICAGO_WEATHER_MANIFEST.stationName,
  stateProvinceRegion: CHICAGO_WEATHER_MANIFEST.state,
  country: 'USA',
  source: 'TMY3',
  stationId: CHICAGO_WEATHER_MANIFEST.stationId,
  latitude: CHICAGO_WEATHER_MANIFEST.latitude,
  longitude: CHICAGO_WEATHER_MANIFEST.longitude,
  timezone: CHICAGO_WEATHER_MANIFEST.timezone,
  elevation: CHICAGO_WEATHER_MANIFEST.elevation,
})

console.log("Chicago O'Hare EPW certification passed.")
console.log(JSON.stringify({
  station: CHICAGO_WEATHER_MANIFEST.stationName,
  stationId: CHICAGO_WEATHER_MANIFEST.stationId,
  dataset: CHICAGO_WEATHER_MANIFEST.weatherDataset,
  ashraeClimateZone: CHICAGO_WEATHER_MANIFEST.ashraeClimateZone,
  sha256: actualSha256,
  location: result.metadata.location,
  qualityReport: result.qualityReport,
}, null, 2))
