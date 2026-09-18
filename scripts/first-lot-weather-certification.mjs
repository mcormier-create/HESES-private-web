import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseAndValidateEpw } from '../src/services/epwImportService.js'
import { USA_WEATHER_CATALOG_INDEX, USA_WEATHER_CERTIFICATION_STATUS } from '../src/regions/usaWeatherCatalog.js'

const results = USA_WEATHER_CATALOG_INDEX.records.map((station) => {
  const buffer = readFileSync(station.epwFile)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const imported = parseAndValidateEpw(buffer.toString('utf8'), { fileName: station.epwFile })
  assert.equal(station.certificationStatus, USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED)
  assert.equal(sha256, station.sha256)
  assert.equal(imported.qualityReport.valid, true)
  assert.equal(imported.qualityReport.recordCount, station.expectedRecordCount)
  assert.equal(imported.qualityReport.errorCount, 0)
  assert.equal(imported.qualityReport.duplicateCount, 0)
  assert.equal(imported.qualityReport.continuityErrorCount, 0)
  assert.equal(imported.metadata.location.stationId, station.stationId)
  assert.equal(imported.metadata.location.latitude, station.latitude)
  assert.equal(imported.metadata.location.longitude, station.longitude)
  assert.equal(imported.metadata.location.timezone, station.timezone)
  return {
    city: station.city,
    state: station.state,
    station: station.stationName,
    stationId: station.stationId,
    dataset: station.weatherDataset,
    ashraeClimateZone: station.ashraeClimateZone,
    records: imported.qualityReport.recordCount,
    sha256,
    certification: station.certificationStatus,
  }
})

console.log('First-lot USA weather certification passed.')
console.log(JSON.stringify(results, null, 2))
