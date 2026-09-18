import { USA_WEATHER_CATALOG_INDEX, createCertifiedUsaWeatherIndex } from './usaWeatherCatalog.js'

export const WEATHER_STATION_MANIFEST_FIELDS = Object.freeze([
  'country',
  'state',
  'city',
  'stationName',
  'stationId',
  'latitude',
  'longitude',
  'elevation',
  'timezone',
  'weatherDataset',
  'weatherPeriod',
  'sourceName',
  'sourceURL',
  'epwFile',
  'sha256',
  'ashraeClimateZone',
  'ashraeSource',
  'ashraeEdition',
  'certificationStatus',
  'expectedRecordCount',
])

export const NEW_YORK_WEATHER_MANIFEST = USA_WEATHER_CATALOG_INDEX.manifestsByCityId['new-york-ny']
export const CHICAGO_WEATHER_MANIFEST = USA_WEATHER_CATALOG_INDEX.manifestsByCityId['chicago-il']
export const UNITED_STATES_WEATHER_MANIFEST = USA_WEATHER_CATALOG_INDEX.records
export const CERTIFIED_USA_WEATHER_CATALOG_INDEX = createCertifiedUsaWeatherIndex()
export const WEATHER_STATION_MANIFEST_BY_CITY_ID = CERTIFIED_USA_WEATHER_CATALOG_INDEX.manifestsByCityId
