import { CANADA_WEATHER_CATALOG_INDEX } from './canadaWeatherCatalog.js'

export const CANADA_PROVINCES = CANADA_WEATHER_CATALOG_INDEX.provinces
export const CANADA_CITIES_BY_PROVINCE = CANADA_WEATHER_CATALOG_INDEX.citiesByProvince

export const CANADA_REGION = Object.freeze({
  countryCode: 'CA',
  countryName: 'Canada',
  currency: 'CAD',
  locale: 'en-CA',
  defaultLanguage: 'en',
  defaultUnits: 'metric',
  provinces: CANADA_PROVINCES,
  citiesByProvince: CANADA_CITIES_BY_PROVINCE,
})

export function getCanadaProvince(provinceCode) {
  return CANADA_PROVINCES.find((province) => province.code === provinceCode) || null
}

export function getCanadaCities(provinceCode) {
  return CANADA_CITIES_BY_PROVINCE[provinceCode] || []
}

export function getCanadaCity(provinceCode, cityId) {
  return getCanadaCities(provinceCode).find((city) => city.id === cityId) || null
}
