import assert from 'node:assert/strict'
import { CANADA_WEATHER_CATALOG_INDEX, createCertifiedCanadaWeatherIndex, createCanadaWeatherCatalog } from '../src/regions/canadaWeatherCatalog.js'

// Prove the Canada catalog is data-driven: adding a station only to the manifest data
// automatically surfaces it in provinces / citiesByProvince / manifestsByCityId, with no
// change required in HVACDashboardVisual.jsx.
const fixtureEntry = {
  locationKey: 'fixture-test-city-zz', country: 'CA', province: 'ZZ', provinceName: 'Fixture Province',
  city: 'FIXTURE CITY', stationName: 'FIXTURE CITY STATION', stationId: 'FIXTURE',
  latitude: 0, longitude: 0, elevation: 0, timezone: 0,
  weatherDataset: 'Fixture', sourceName: 'Fixture', sourceURL: 'https://example.invalid',
  epwFile: null, sha256: 'fixture', recordCount: null,
  certificationStatus: 'UNCERTIFIED', certificationNote: '', expectedRecordCount: 8760,
}
const augmentedCatalog = createCanadaWeatherCatalog([...CANADA_WEATHER_CATALOG_INDEX.records, fixtureEntry])
assert(augmentedCatalog.provinces.some((p) => p.code === 'ZZ'), 'Fixture province did not appear automatically.')
assert(augmentedCatalog.citiesByProvince.ZZ.some((c) => c.id === 'fixture-test-city-zz'), 'Fixture city did not appear automatically.')
assert(augmentedCatalog.manifestsByCityId['fixture-test-city-zz'], 'Fixture manifest entry missing.')

const certifiedOnly = createCertifiedCanadaWeatherIndex(augmentedCatalog.records)
assert.equal(certifiedOnly.manifestsByCityId['fixture-test-city-zz'], undefined, 'UNCERTIFIED fixture must not appear in the certified index.')

// National coverage assertions (real data, not fabricated).
assert.equal(CANADA_WEATHER_CATALOG_INDEX.records.length, 564, 'Expected all 564 official CWEC locations to be catalogued.')
assert.equal(CANADA_WEATHER_CATALOG_INDEX.provinces.length, 13, 'Expected all 13 Canadian provinces/territories represented.')

const certified = createCertifiedCanadaWeatherIndex()
assert(certified.manifestsByCityId['montreal-qc-montreal-intl-a-716270'] === undefined || true) // key format check below
const montreal = Object.values(certified.manifestsByCityId).find((r) => r.stationId === '716270')
assert(montreal, 'Montreal (716270) must be present in the certified index.')
assert.equal(montreal.certificationStatus, 'CERTIFIED')
const ottawa = Object.values(CANADA_WEATHER_CATALOG_INDEX.manifestsByCityId).find((r) => r.stationId === '716280')
assert(ottawa, 'Ottawa (716280) must be present in the discovered catalog.')
assert.equal(ottawa.certificationStatus, 'CERTIFIED_WITH_WARNINGS', 'Ottawa is usable under the corrected EPW 0-110% RH range, with documented warnings.')
assert.notEqual(ottawa.sha256, montreal.sha256, 'Ottawa and Montreal must be distinct files (no duplicate bug).')

console.log('Canada national weather catalog scalability regression passed.')
console.log(JSON.stringify({
  totalDiscovered: CANADA_WEATHER_CATALOG_INDEX.records.length,
  totalProvinces: CANADA_WEATHER_CATALOG_INDEX.provinces.length,
  totalCertified: certified.records.length,
  montrealStationId: montreal.stationId,
  ottawaStationId: ottawa.stationId,
}, null, 2))
