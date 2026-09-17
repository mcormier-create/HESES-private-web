import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseAndValidateEpw } from '../src/services/epwImportService.js'
import { humidityRatioFromRH } from '../src/calculations/psychrometrics.js'
import { NEW_YORK_WEATHER_MANIFEST } from '../src/regions/weatherStationManifest.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const epwPath = fileURLToPath(new URL(`../${NEW_YORK_WEATHER_MANIFEST.epwFile}`, import.meta.url))
const epwBuffer = readFileSync(epwPath)
const actualSha256 = createHash('sha256').update(epwBuffer).digest('hex')
const result = parseAndValidateEpw(epwBuffer.toString('utf8'), {
  fileName: NEW_YORK_WEATHER_MANIFEST.epwFile,
})

assert.equal(actualSha256, NEW_YORK_WEATHER_MANIFEST.sha256)
assert.equal(result.qualityReport.valid, true)
assert.equal(result.qualityReport.recordCount, 8760)
assert.deepEqual(result.metadata.location, {
  city: NEW_YORK_WEATHER_MANIFEST.stationName,
  stateProvinceRegion: NEW_YORK_WEATHER_MANIFEST.state,
  country: 'USA',
  source: 'TMY3',
  stationId: NEW_YORK_WEATHER_MANIFEST.stationId,
  latitude: NEW_YORK_WEATHER_MANIFEST.latitude,
  longitude: NEW_YORK_WEATHER_MANIFEST.longitude,
  timezone: NEW_YORK_WEATHER_MANIFEST.timezone,
  elevation: NEW_YORK_WEATHER_MANIFEST.elevation,
})

const records = result.records
const winterRecords = records.filter((record) => [12, 1, 2].includes(record.month))
const summerRecords = records.filter((record) => [6, 7, 8].includes(record.month))
const sortedWinterRecords = [...winterRecords].sort((left, right) => left.dryBulbC - right.dryBulbC)
const coldWinter = sortedWinterRecords[0]
const typicalWinter = sortedWinterRecords[Math.floor(sortedWinterRecords.length / 2)]
const shoulderSeason = records
  .filter((record) => [4, 10].includes(record.month))
  .reduce((best, record) => Math.abs(record.dryBulbC - 15) < Math.abs(best.dryBulbC - 15) ? record : best)
const hotSummer = [...summerRecords].sort((left, right) => right.dryBulbC - left.dryBulbC)[0]
const deterministicRandomSample = records[4321]

function summarizeObservation(label, record) {
  const humidityRatio = humidityRatioFromRH(
    record.dryBulbC,
    record.relativeHumidity,
    record.pressurePa / 1000
  )

  return {
    label,
    originalEpwTimestamp: `${record.year}-${String(record.month).padStart(2, '0')}-${String(record.day).padStart(2, '0')} hour ${record.hour} minute ${result.qualityReport.sourceMinuteConvention}`,
    normalizedHesaTimestamp: `${record.year}-${String(record.month).padStart(2, '0')}-${String(record.day).padStart(2, '0')} hour ${record.hour} minute ${record.minute}`,
    dryBulbF: Number((record.dryBulbC * 9 / 5 + 32).toFixed(1)),
    dewPointF: Number((record.dewPointC * 9 / 5 + 32).toFixed(1)),
    relativeHumidityPercent: record.relativeHumidity,
    pressurePa: record.pressurePa,
    pressureInHg: Number((record.pressurePa / 3386.389).toFixed(3)),
    humidityRatioLbLb: Number(humidityRatio.toFixed(6)),
    humidityRatioGrainsLb: Number((humidityRatio * 7000).toFixed(1)),
  }
}

const statistics = {
  dryBulbC: {
    min: Math.min(...records.map((record) => record.dryBulbC)),
    max: Math.max(...records.map((record) => record.dryBulbC)),
  },
  dewPointC: {
    min: Math.min(...records.map((record) => record.dewPointC)),
    max: Math.max(...records.map((record) => record.dewPointC)),
  },
  relativeHumidityPercent: {
    min: Math.min(...records.map((record) => record.relativeHumidity)),
    max: Math.max(...records.map((record) => record.relativeHumidity)),
  },
  pressurePa: {
    min: Math.min(...records.map((record) => record.pressurePa)),
    max: Math.max(...records.map((record) => record.pressurePa)),
  },
}

console.log('New York JFK EPW certification passed. No HESA annual simulation was executed.')
console.log(JSON.stringify({
  projectRoot,
  epwFile: NEW_YORK_WEATHER_MANIFEST.epwFile,
  sha256: actualSha256,
  manifest: NEW_YORK_WEATHER_MANIFEST,
  location: result.metadata.location,
  qualityReport: result.qualityReport,
  statistics,
  observations: [
    summarizeObservation('cold winter extreme', coldWinter),
    summarizeObservation('typical winter', typicalWinter),
    summarizeObservation('spring/autumn', shoulderSeason),
    summarizeObservation('hot summer extreme', hotSummer),
    summarizeObservation('deterministic random sample', deterministicRandomSample),
  ],
}, null, 2))
