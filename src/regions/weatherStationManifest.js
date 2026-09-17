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
])

export const NEW_YORK_WEATHER_MANIFEST = Object.freeze({
  locationKey: 'new-york-ny',
  country: 'US',
  state: 'NY',
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
  status: 'validated-connected',
})

export const UNITED_STATES_WEATHER_MANIFEST = Object.freeze([
  NEW_YORK_WEATHER_MANIFEST,
])

export const WEATHER_STATION_MANIFEST_BY_CITY_ID = Object.freeze({
  'new-york-ny': NEW_YORK_WEATHER_MANIFEST,
})
