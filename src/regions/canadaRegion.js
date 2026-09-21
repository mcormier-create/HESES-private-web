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

// One-time, explicit migration table for the 7 legacy climateCities names that existed before
// the certified regional catalog. Each maps to exactly one unambiguous, certified station.
// This is the ONLY legacy-name migration HESA performs; any other/unknown legacy city is left
// unresolved on purpose (no first-station fallback, no Montreal default).
const LEGACY_CANADA_CITY_MIGRATION = Object.freeze({
  'montreal': { provinceCode: 'QC', cityId: 'qc-montreal-intl-a-716270' },
  'quebec': { provinceCode: 'QC', cityId: 'qc-quebec-intl-a-999999' },
  'ottawa': { provinceCode: 'ON', cityId: 'on-ottawa-intl-a-716280' },
  'toronto': { provinceCode: 'ON', cityId: 'on-toronto-city-715080' },
  'vancouver': { provinceCode: 'BC', cityId: 'bc-vancouver-intl-a-718920' },
  'calgary': { provinceCode: 'AB', cityId: 'ab-calgary-intl-a-718770' },
  'winnipeg': { provinceCode: 'MB', cityId: 'mb-winnipeg-intl-a-999999' },
})

function normalizeLegacyCityName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Returns { provinceCode, cityId } for a legacy climateCities name with a unique, reliable
// mapping, or null if none exists. Callers must never substitute a fallback when this is null.
export function migrateLegacyCanadaCityName(legacyCityName) {
  const key = normalizeLegacyCityName(legacyCityName)
  return LEGACY_CANADA_CITY_MIGRATION[key] || null
}
