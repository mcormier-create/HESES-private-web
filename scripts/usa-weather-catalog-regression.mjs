import assert from 'node:assert/strict'
import {
  USA_WEATHER_CERTIFICATION_STATUS,
  createCertifiedUsaWeatherIndex,
  createUsaWeatherCatalog,
} from '../src/regions/usaWeatherCatalog.js'

const fixture = {
  locationKey: 'fixture-test-city',
  country: 'US',
  state: 'ZZ',
  stateName: 'Fixture State',
  city: 'Fixture City',
  stationName: 'Fixture Weather Station',
  stationId: 'FIXTURE-001',
  latitude: 40,
  longitude: -87,
  elevation: 100,
  timezone: -6,
  weatherDataset: 'Synthetic fixture',
  weatherPeriod: 'Synthetic fixture',
  sourceName: 'Test fixture only',
  sourceURL: 'https://example.invalid/fixture.epw',
  epwFile: 'fixture-not-for-production.epw',
  sha256: 'fixture-not-for-production',
  ashraeClimateZone: null,
  ashraeSource: null,
  ashraeEdition: null,
  certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.UNCERTIFIED,
  expectedRecordCount: 8760,
}

const catalog = createUsaWeatherCatalog([
  ...createCertifiedUsaWeatherIndex().records,
  fixture,
])
const certifiedCatalog = createCertifiedUsaWeatherIndex([...catalog.records])

assert(catalog.states.some((state) => state.code === 'ZZ' && state.name === 'Fixture State'))
assert(catalog.citiesByState.ZZ.some((city) => city.id === 'fixture-test-city' && city.name === 'Fixture City'))
assert.equal(catalog.citiesByState.ZZ[0].weatherStation, 'Fixture Weather Station')
assert.equal(certifiedCatalog.manifestsByCityId['fixture-test-city'], undefined)
assert.equal(certifiedCatalog.manifestsByCityId['new-york-ny'].certificationStatus, USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED)

console.log('USA weather catalog scalability regression passed.')
console.log(JSON.stringify({
  fixtureState: catalog.states.find((state) => state.code === 'ZZ'),
  fixtureCity: catalog.citiesByState.ZZ[0],
  fixtureAvailableForSimulation: Boolean(certifiedCatalog.manifestsByCityId['fixture-test-city']),
  certifiedStationCount: certifiedCatalog.records.length,
}, null, 2))
