import { USA_WEATHER_CATALOG_INDEX } from './usaWeatherCatalog.js'

export const UNITED_STATES_STATES = USA_WEATHER_CATALOG_INDEX.states
export const UNITED_STATES_DEMO_CITIES = USA_WEATHER_CATALOG_INDEX.citiesByState

export const UNITED_STATES_REGION = Object.freeze({
  countryCode: 'US',
  countryName: 'United States',
  currency: 'USD',
  locale: 'en-US',
  defaultLanguage: 'en',
  defaultUnits: 'imperial',
  states: UNITED_STATES_STATES,
  citiesByState: UNITED_STATES_DEMO_CITIES,
})

export function getUnitedStatesState(stateCode) {
  return UNITED_STATES_STATES.find((state) => state.code === stateCode) || null
}

export function getUnitedStatesCities(stateCode) {
  return UNITED_STATES_DEMO_CITIES[stateCode] || []
}

export function getUnitedStatesCity(stateCode, cityId) {
  return getUnitedStatesCities(stateCode).find((city) => city.id === cityId) || null
}
