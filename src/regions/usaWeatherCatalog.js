export const USA_WEATHER_CERTIFICATION_STATUS = Object.freeze({
  CERTIFIED: 'CERTIFIED',
  UNCERTIFIED: 'UNCERTIFIED',
})

export const USA_WEATHER_CATALOG = Object.freeze([
  Object.freeze({
    locationKey: 'new-york-ny',
    country: 'US',
    state: 'NY',
    stateName: 'New York',
    city: 'New York',
    stationName: 'New York-John F Kennedy Intl AP',
    stationId: '744860',
    latitude: 40.65,
    longitude: -73.8,
    elevation: 5,
    timezone: -5,
    weatherDataset: 'NREL TMY3',
    weatherPeriod: '1973-2005 (Generally)',
    sourceName: 'U.S. DOE Building Energy Codes Program / PNNL Prototype Building Models',
    sourceURL: 'https://www.energycodes.gov/sites/default/files/2023-10/USA_NY_New.York-John.F.Kennedy.Intl_.AP_.744860_TMY3.epw',
    epwFile: 'public/weather/usa-ny-new-york-jfk-744860-tmy3.epw',
    sha256: '821f2f1a2d5f462955b41597df0bf247f981b7c61d9032f4696eed68cd892537',
    ashraeClimateZone: '4A',
    ashraeMoistureRegime: 'Moist (Mixed Humid)',
    ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021',
    ashraeEdition: 'ANSI/ASHRAE Standard 169-2021',
    ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models',
    certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED,
    expectedRecordCount: 8760,
  }),
  Object.freeze({
    locationKey: 'chicago-il',
    country: 'US',
    state: 'IL',
    stateName: 'Illinois',
    city: 'Chicago',
    stationName: 'Chicago Ohare Intl Ap',
    stationId: '725300',
    latitude: 41.98,
    longitude: -87.92,
    elevation: 201,
    timezone: -6,
    weatherDataset: 'NREL TMY3',
    weatherPeriod: '1973-2005 (Generally)',
    sourceName: 'U.S. DOE Building Energy Codes Program / PNNL Prototype Building Models',
    sourceURL: 'https://www.energycodes.gov/sites/default/files/2022-09/USA_IL_Chicago-OHare.Intl_.AP_.725300_TMY3.epw',
    epwFile: 'public/weather/usa-il-chicago-ohare-725300-tmy3.epw',
    sha256: 'c7d4efcf93ba316a1d874352e743df5cf137ba5c0e3459eb2dc4b5442d5b7f5c',
    ashraeClimateZone: '5A',
    ashraeMoistureRegime: 'Moist (Cool Humid)',
    ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021',
    ashraeEdition: 'ANSI/ASHRAE Standard 169-2021',
    ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models',
    certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED,
    expectedRecordCount: 8760,
  }),
])

export function createUsaWeatherCatalog(entries = USA_WEATHER_CATALOG) {
  const records = entries.map((entry) => Object.freeze({ ...entry }))
  const states = [...new Map(records.map((entry) => [entry.state, { code: entry.state, name: entry.stateName }])).values()]
  const citiesByState = Object.fromEntries(states.map((state) => [
    state.code,
    records
      .filter((entry) => entry.state === state.code)
      .map((entry) => ({
        id: entry.locationKey,
        name: entry.city,
        weatherStation: entry.stationName,
        climateZone: entry.ashraeClimateZone || null,
        weatherManifestKey: entry.locationKey,
      })),
  ]))
  const manifestsByCityId = Object.fromEntries(records.map((entry) => [entry.locationKey, entry]))
  return Object.freeze({
    records: Object.freeze(records),
    states: Object.freeze(states),
    citiesByState: Object.freeze(citiesByState),
    manifestsByCityId: Object.freeze(manifestsByCityId),
  })
}

export const USA_WEATHER_CATALOG_INDEX = createUsaWeatherCatalog()

export function getUsaWeatherCatalogRecord(locationKey) {
  return USA_WEATHER_CATALOG_INDEX.manifestsByCityId[locationKey] || null
}

export function isCertifiedUsaWeatherRecord(record) {
  return record?.certificationStatus === USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED
}

export function createCertifiedUsaWeatherIndex(entries = USA_WEATHER_CATALOG) {
  return createUsaWeatherCatalog(entries.filter(isCertifiedUsaWeatherRecord))
}
