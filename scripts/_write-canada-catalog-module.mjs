import { readFileSync, writeFileSync } from 'node:fs'

const records = JSON.parse(readFileSync('scripts/_canada-national-catalog-raw.json', 'utf8'))

function jsLiteral(record) {
  const fields = [
    ['locationKey', record.locationKey],
    ['country', record.country],
    ['province', record.province],
    ['provinceName', record.provinceName],
    ['city', record.city],
    ['servesCity', record.servesCity],
    ['servesCityDistanceKm', record.servesCityDistanceKm],
    ['stationName', record.stationName],
    ['stationId', record.stationId],
    ['latitude', record.latitude],
    ['longitude', record.longitude],
    ['elevation', record.elevation],
    ['timezone', record.timezone],
    ['weatherDataset', record.weatherDataset],
    ['sourceName', record.sourceName],
    ['sourceURL', record.sourceURL],
    ['epwFile', record.epwFile],
    ['sha256', record.sha256],
    ['recordCount', record.recordCount],
    ['certificationStatus', `CANADA_WEATHER_CERTIFICATION_STATUS.${record.certificationStatus}`],
    ['certificationNote', record.certificationNote || ''],
    ['warningCount', record.warningCount || 0],
    ['warningTypes', record.warningTypes || []],
    ['maximumRelativeHumidity', record.maximumRelativeHumidity],
    ['maximumDewPointOverDryBulbC', record.maximumDewPointOverDryBulbC],
    ['expectedRecordCount', record.expectedRecordCount],
  ]
  const body = fields.map(([key, value]) => {
    if (key === 'certificationStatus') return `${key}: ${value}`
    if (key === 'warningTypes') return `${key}: ${JSON.stringify(value)}`
    if (typeof value === 'string') return `${key}: ${JSON.stringify(value)}`
    if (value === null || value === undefined) return `${key}: null`
    return `${key}: ${value}`
  }).join(', ')
  return `  Object.freeze({ ${body} }),`
}

const header = `// Auto-generated from the official Government of Canada CWEC_FMCCE v_2020 release
// (https://collaboration.cmc.ec.gc.ca/cmc/climate/Engineer_Climate/CWEC_FMCCE/CWEC_FMCCE_v_2020/)
// by scripts/_generate-canada-national-catalog.mjs. Do not hand-edit; regenerate instead.
// Field-by-field conversion: LOCATION line values (name, province, station ID, latitude,
// longitude, timezone, elevation) are read verbatim from each official EPW file's own header.
// No temperature, dew point, RH, pressure, or timestamp values are modified, invented, or
// interpolated. certificationStatus reflects the existing HESA strict EPW certifier
// (src/services/epwImportService.js) run unmodified against the official source file.

export const CANADA_WEATHER_CERTIFICATION_STATUS = Object.freeze({
  CERTIFIED: 'CERTIFIED',
  CERTIFIED_WITH_WARNINGS: 'CERTIFIED_WITH_WARNINGS',
  UNCERTIFIED: 'UNCERTIFIED',
})

export const CANADA_WEATHER_CATALOG = Object.freeze([
`

const footer = `])

export function createCanadaWeatherCatalog(entries = CANADA_WEATHER_CATALOG) {
  const records = entries.map((entry) => Object.freeze({ ...entry }))
  const provinces = [...new Map(records.map((entry) => [entry.province, { code: entry.province, name: entry.provinceName }])).values()]
  const citiesByProvince = Object.fromEntries(provinces.map((province) => [
    province.code,
    records
      .filter((entry) => entry.province === province.code)
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
    provinces: Object.freeze(provinces),
    citiesByProvince: Object.freeze(citiesByProvince),
    manifestsByCityId: Object.freeze(manifestsByCityId),
  })
}

export const CANADA_WEATHER_CATALOG_INDEX = createCanadaWeatherCatalog()

export function isCertifiedCanadaWeatherRecord(record) {
  return record?.certificationStatus === CANADA_WEATHER_CERTIFICATION_STATUS.CERTIFIED
    || record?.certificationStatus === CANADA_WEATHER_CERTIFICATION_STATUS.CERTIFIED_WITH_WARNINGS
}

export function createCertifiedCanadaWeatherIndex(entries = CANADA_WEATHER_CATALOG) {
  return createCanadaWeatherCatalog(entries.filter(isCertifiedCanadaWeatherRecord))
}
`

const body = records.map(jsLiteral).join('\n')
writeFileSync('src/regions/canadaWeatherCatalog.js', header + body + '\n' + footer)
console.log(`Wrote src/regions/canadaWeatherCatalog.js with ${records.length} records.`)
