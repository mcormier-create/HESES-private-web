import { USA_WEATHER_CATALOG_INDEX, createCertifiedUsaWeatherIndex } from './usaWeatherCatalog.js'
import { CANADA_WEATHER_CATALOG_INDEX, createCertifiedCanadaWeatherIndex } from './canadaWeatherCatalog.js'

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

export const MONTREAL_WEATHER_MANIFEST = CANADA_WEATHER_CATALOG_INDEX.manifestsByCityId['montreal-qc']
export const OTTAWA_WEATHER_MANIFEST = CANADA_WEATHER_CATALOG_INDEX.manifestsByCityId['ottawa-on']
export const CANADA_WEATHER_MANIFEST = CANADA_WEATHER_CATALOG_INDEX.records
export const CERTIFIED_CANADA_WEATHER_CATALOG_INDEX = createCertifiedCanadaWeatherIndex()
export const CANADA_WEATHER_STATION_MANIFEST_BY_CITY_ID = CERTIFIED_CANADA_WEATHER_CATALOG_INDEX.manifestsByCityId
