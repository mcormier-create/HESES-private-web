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
  Object.freeze({ locationKey: 'boston-ma', country: 'US', state: 'MA', stateName: 'Massachusetts', city: 'Boston', stationName: 'Boston-Logan Intl AP', stationId: '725090', latitude: 42.367, longitude: -71.017, elevation: 6, timezone: -5, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/MA_Massachusetts/USA_MA_Boston-Logan.Intl.AP.725090_TMY3.zip', epwFile: 'public/weather/usa-ma-boston-logan-725090-tmy3.epw', sha256: '0df50c8fa8de523a73b6181b53f21ebca606e114f53ee171ff38a426b2447f97', ashraeClimateZone: '5A', ashraeMoistureRegime: 'Moist (Cool Humid)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'detroit-mi', country: 'US', state: 'MI', stateName: 'Michigan', city: 'Detroit', stationName: 'Detroit Metro Wayne County AP', stationId: '725370', latitude: 42.217, longitude: -83.35, elevation: 194, timezone: -5, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/MI_Michigan/USA_MI_Detroit.Metro.Wayne.County.AP.725370_TMY3.zip', epwFile: 'public/weather/usa-mi-detroit-metro-725370-tmy3.epw', sha256: 'd0a9776868b515bedc39f97344ed0ae62410ca2cf19950ddbc579ff1ab9a9973', ashraeClimateZone: '5A', ashraeMoistureRegime: 'Moist (Cool Humid)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'minneapolis-mn', country: 'US', state: 'MN', stateName: 'Minnesota', city: 'Minneapolis', stationName: 'Minneapolis-St Paul Intl AP', stationId: '726580', latitude: 44.883, longitude: -93.233, elevation: 254, timezone: -6, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/MN_Minnesota/USA_MN_Minneapolis-St.Paul.Intl.AP.726580_TMY3.zip', epwFile: 'public/weather/usa-mn-minneapolis-st-paul-726580-tmy3.epw', sha256: 'c92efe507ecc06263b92e3f01b59e503a37b0fcde70b035caae657517264c4e4', ashraeClimateZone: '6A', ashraeMoistureRegime: 'Moist (Cold Humid)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'atlanta-ga', country: 'US', state: 'GA', stateName: 'Georgia', city: 'Atlanta', stationName: 'Atlanta-Hartsfield-Jackson Intl AP', stationId: '722190', latitude: 33.633, longitude: -84.433, elevation: 308, timezone: -5, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/GA_Georgia/USA_GA_Atlanta-Hartsfield-Jackson.Intl.AP.722190_TMY3.zip', epwFile: 'public/weather/usa-ga-atlanta-hartsfield-722190-tmy3.epw', sha256: '418df31cd62bcee8072d2b436b8fc65936eda449cdf4416fd310c543fd249355', ashraeClimateZone: '3A', ashraeMoistureRegime: 'Moist (Warm Humid)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'houston-tx', country: 'US', state: 'TX', stateName: 'Texas', city: 'Houston', stationName: 'Houston-Bush Intercontinental AP', stationId: '722430', latitude: 30, longitude: -95.367, elevation: 29, timezone: -6, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/TX_Texas/USA_TX_Houston-Bush.Intercontinental.AP.722430_TMY3.zip', epwFile: 'public/weather/usa-tx-houston-bush-722430-tmy3.epw', sha256: 'ea9d0a627725874894ed05f97828dedbdec06d102d20720292cb820b6d754592', ashraeClimateZone: '2A', ashraeMoistureRegime: 'Moist (Hot Humid)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'miami-fl', country: 'US', state: 'FL', stateName: 'Florida', city: 'Miami', stationName: 'Miami Intl AP', stationId: '722020', latitude: 25.8, longitude: -80.3, elevation: 11, timezone: -5, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/FL_Florida/USA_FL_Miami.Intl.AP.722020_TMY3.zip', epwFile: 'public/weather/usa-fl-miami-intl-722020-tmy3.epw', sha256: 'e0fff5174a6e4360821555dd6ce4c4872e12e7da342f1cf87d90f0628d89bcbf', ashraeClimateZone: '1A', ashraeMoistureRegime: 'Moist (Very Hot Humid)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'denver-co', country: 'US', state: 'CO', stateName: 'Colorado', city: 'Denver', stationName: 'Denver Intl AP', stationId: '725650', latitude: 39.833, longitude: -104.65, elevation: 1650, timezone: -7, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/CO_Colorado/USA_CO_Denver.Intl.AP.725650_TMY3.zip', epwFile: 'public/weather/usa-co-denver-intl-725650-tmy3.epw', sha256: 'e52fbedd6593b004794ab84126b05737dd2343343660e8f2c09e0eccfcb1aed3', ashraeClimateZone: '5B', ashraeMoistureRegime: 'Dry (Cool Dry)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'phoenix-az', country: 'US', state: 'AZ', stateName: 'Arizona', city: 'Phoenix', stationName: 'Phoenix-Sky Harbor Intl AP', stationId: '722780', latitude: 33.45, longitude: -111.983, elevation: 337, timezone: -7, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/AZ_Arizona/USA_AZ_Phoenix-Sky.Harbor.Intl.AP.722780_TMY3.zip', epwFile: 'public/weather/usa-az-phoenix-sky-harbor-722780-tmy3.epw', sha256: '640d66f72c4f8f3eebb00ac4a2cd093e06522422a3154e6dcfba98425093e42c', ashraeClimateZone: '2B', ashraeMoistureRegime: 'Dry (Hot Dry)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'los-angeles-ca', country: 'US', state: 'CA', stateName: 'California', city: 'Los Angeles', stationName: 'Los Angeles Intl AP', stationId: '722950', latitude: 33.933, longitude: -118.4, elevation: 30, timezone: -8, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/CA_California/USA_CA_Los.Angeles.Intl.AP.722950_TMY3.zip', epwFile: 'public/weather/usa-ca-los-angeles-intl-722950-tmy3.epw', sha256: '6544af9e96c02c65a241a81f316b75a4c1a868d0e421cec344cf80655c2ce48d', ashraeClimateZone: '3B', ashraeMoistureRegime: 'Dry (Warm Dry)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
  Object.freeze({ locationKey: 'seattle-wa', country: 'US', state: 'WA', stateName: 'Washington', city: 'Seattle', stationName: 'Seattle-Tacoma Intl AP', stationId: '727930', latitude: 47.443, longitude: -122.306, elevation: 122, timezone: -8, weatherDataset: 'NREL TMY3', weatherPeriod: '1973-2005 (Generally)', sourceName: 'Climate.OneBuilding TMY3 / NREL', sourceURL: 'https://climate.onebuilding.org/WMO_Region_4_North_and_Central_America/USA_United_States_of_America/WA_Washington/USA_WA_Seattle-Tacoma.Intl.AP.727930_TMY3.zip', epwFile: 'public/weather/usa-wa-seattle-tacoma-727930-tmy3.epw', sha256: '74fa926cdd50a2c581b76e6b4be9d1b5b6b763488a34a6924a30722b2f48bf53', ashraeClimateZone: '4C', ashraeMoistureRegime: 'Marine (Marine)', ashraeSource: 'https://ashrae.iwrapper.com/ASHRAE_PREVIEW_ONLY_STANDARDS/STD_169_2021', ashraeEdition: 'ANSI/ASHRAE Standard 169-2021', ashraeCorroboratingSource: 'https://www.energycodes.gov/prototype-building-models', certificationStatus: USA_WEATHER_CERTIFICATION_STATUS.CERTIFIED, expectedRecordCount: 8760 }),
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
