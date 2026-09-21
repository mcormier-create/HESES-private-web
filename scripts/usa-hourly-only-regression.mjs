import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { USA_WEATHER_CERTIFICATION_STATUS, createCertifiedUsaWeatherIndex, createUsaWeatherCatalog } from '../src/regions/usaWeatherCatalog.js'

const source = readFileSync('src/HVACDashboardVisual.jsx', 'utf8')
assert(source.includes("const selectedBinData = isUsaRegion ? []"), 'USA BIN guard is missing.')
assert(source.includes("setCalculationMethod('hourly')"), 'USA hourly enforcement is missing.')
assert(!source.includes("isUsaRegion ? (binDataByCity[selectedCity.nom] || binDataByCity['Montréal'])"), 'USA can still reach the Montreal fallback.')

const certifiedCatalog = createCertifiedUsaWeatherIndex()
for (const cityId of ['new-york-ny', 'chicago-il', 'miami-fl', 'minneapolis-mn']) {
  const station = certifiedCatalog.manifestsByCityId[cityId]
  assert(station, `${cityId} is missing from the certified catalog.`)
  assert.equal(station.certificationStatus, USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED)
  assert.equal(station.expectedRecordCount, 8760)
}

const uncertifiedFixture = {
  locationKey: 'uncertified-usa-fixture', country: 'US', state: 'ZZ', stateName: 'Fixture State', city: 'Fixture City',
  stationName: 'Fixture Station', stationId: 'FIXTURE', latitude: 0, longitude: 0, elevation: 0, timezone: 0,
  weatherDataset: 'Fixture', weatherPeriod: 'Fixture', sourceName: 'Fixture', sourceURL: 'https://example.invalid',
  epwFile: 'fixture.epw', sha256: 'fixture', ashraeClimateZone: null, ashraeSource: null, ashraeEdition: null,
  certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.UNCERTIFIED, expectedRecordCount: 8760,
}
const allCatalog = createUsaWeatherCatalog([...certifiedCatalog.records, uncertifiedFixture])
const certifiedOnly = createCertifiedUsaWeatherIndex(allCatalog.records)
assert(allCatalog.citiesByState.ZZ.some((city) => city.id === uncertifiedFixture.locationKey))
assert.equal(certifiedOnly.manifestsByCityId[uncertifiedFixture.locationKey], undefined)

console.log('USA hourly-only and no-Montreal-fallback regression passed.')
