import { CANADA_REGION } from './canadaRegion.js'
import { UNITED_STATES_REGION } from './unitedStatesRegion.js'

export const COUNTRY_CODES = Object.freeze({
  CANADA: 'CA',
  UNITED_STATES: 'US',
})

export const REGION_CONFIGS = Object.freeze({
  [COUNTRY_CODES.CANADA]: CANADA_REGION,
  [COUNTRY_CODES.UNITED_STATES]: UNITED_STATES_REGION,
})

export const HESA_USA_REGION = REGION_CONFIGS[COUNTRY_CODES.UNITED_STATES]

export function getRegionConfig(countryCode) {
  return REGION_CONFIGS[countryCode] || null
}
