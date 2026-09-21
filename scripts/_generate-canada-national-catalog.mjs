import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { parseAndValidateEpw, EpwImportError } from '../src/services/epwImportService.js'

const scratchDir = 'scripts/_cwec-national-scratch'
const publicWeatherDir = 'public/weather/canada-cwec'
const provinces = readdirSync(scratchDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)

const PROVINCE_NAMES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const records = []
let certifiedCount = 0
let certifiedWithWarningsCount = 0
let uncertifiedCount = 0

// Explicit, documented city associations. The station itself is never renamed; this only adds an
// optional "serves this nearby municipality" note, recorded here so it is traceable and reviewable.
const DOCUMENTED_CITY_ASSOCIATIONS = {
  '716110': { servesCity: 'Sherbrooke', servesCityDistanceKm: 7.1 },
  '717230': { servesCity: 'Trois-Rivieres', servesCityDistanceKm: 15.8 },
}

for (const prov of provinces) {
  const dir = path.join(scratchDir, prov)
  const files = readdirSync(dir).filter((name) => name.endsWith('.epw'))
  for (const fileName of files) {
    const fullPath = path.join(dir, fileName)
    const text = readFileSync(fullPath, 'utf8')
    const locationLine = text.split(/\r?\n/, 1)[0]
    const locationParts = locationLine.split(',')
    const stationName = (locationParts[1] || '').trim()
    const stationId = (locationParts[5] || '').trim()
    const latitude = Number(locationParts[6])
    const longitude = Number(locationParts[7])
    const timezone = Number(locationParts[8])
    const elevation = Number(locationParts[9])

    let certificationStatus = 'UNCERTIFIED'
    let certificationNote = ''
    let recordCount = null
    let warningCount = 0
    let warningTypes = []
    let maximumRelativeHumidity = null
    let maximumDewPointOverDryBulbC = null
    try {
      const result = parseAndValidateEpw(text, { fileName })
      warningCount = result.qualityReport.warningCount
      warningTypes = [...new Set(result.qualityReport.warnings.map((item) => item.code))]
      maximumRelativeHumidity = result.qualityReport.maximumRelativeHumidity
      maximumDewPointOverDryBulbC = result.qualityReport.maximumDewPointOverDryBulbC
      certificationStatus = warningCount > 0 ? 'CERTIFIED_WITH_WARNINGS' : 'CERTIFIED'
      recordCount = result.qualityReport.recordCount
      if (certificationStatus === 'CERTIFIED') certifiedCount += 1
      else certifiedWithWarningsCount += 1
    } catch (error) {
      uncertifiedCount += 1
      if (error instanceof EpwImportError) {
        const codes = [...new Set(error.qualityReport.errors.map((item) => item.code))]
        certificationNote = `${error.qualityReport.errorCount} error(s): ${codes.join(', ')}`
        recordCount = error.qualityReport.recordCount
      } else {
        certificationNote = error.message
      }
    }

    const sha256 = createHash('sha256').update(text, 'utf8').digest('hex')
    const locationKey = `${slug(prov)}-${slug(stationName)}-${stationId}`
    const epwRelativePath = `public/weather/canada-cwec/${prov}/can-${slug(prov)}-${slug(stationName)}-${stationId}-cwec.epw`
    const usable = certificationStatus === 'CERTIFIED' || certificationStatus === 'CERTIFIED_WITH_WARNINGS'

    if (usable) {
      const destDir = path.join(publicWeatherDir, prov)
      mkdirSync(destDir, { recursive: true })
      copyFileSync(fullPath, path.join(process.cwd(), epwRelativePath))
    }

    const association = DOCUMENTED_CITY_ASSOCIATIONS[stationId] || null

    records.push({
      locationKey,
      country: 'CA',
      province: prov,
      provinceName: PROVINCE_NAMES[prov],
      city: stationName,
      servesCity: association?.servesCity || null,
      servesCityDistanceKm: association?.servesCityDistanceKm ?? null,
      stationName,
      stationId,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      elevation: Number.isFinite(elevation) ? elevation : null,
      timezone: Number.isFinite(timezone) ? timezone : null,
      weatherDataset: 'CWEC2011 (Government of Canada CWEC_FMCCE v_2020 release)',
      sourceName: 'Environment and Climate Change Canada / Natural Resources Canada - Canadian Weather Year for Energy Calculation (CWEC)',
      sourceURL: 'https://collaboration.cmc.ec.gc.ca/cmc/climate/Engineer_Climate/CWEC_FMCCE/CWEC_FMCCE_v_2020/CWEC-FMCCE_by-par_prov.epw-20221229T203439Z-001.zip',
      epwFile: usable ? epwRelativePath : null,
      sha256,
      recordCount,
      certificationStatus,
      certificationNote,
      warningCount,
      warningTypes,
      maximumRelativeHumidity,
      maximumDewPointOverDryBulbC,
      expectedRecordCount: 8760,
    })
  }
}

writeFileSync('scripts/_canada-national-catalog-raw.json', JSON.stringify(records, null, 2))

const summary = {
  totalDiscovered: records.length,
  totalCertified: certifiedCount,
  totalCertifiedWithWarnings: certifiedWithWarningsCount,
  totalUncertified: uncertifiedCount,
  provincesRepresented: [...new Set(records.map((r) => r.province))].sort(),
  byProvince: Object.fromEntries(
    [...new Set(records.map((r) => r.province))].sort().map((prov) => [
      prov,
      {
        total: records.filter((r) => r.province === prov).length,
        certified: records.filter((r) => r.province === prov && r.certificationStatus === 'CERTIFIED').length,
        certifiedWithWarnings: records.filter((r) => r.province === prov && r.certificationStatus === 'CERTIFIED_WITH_WARNINGS').length,
      },
    ])
  ),
}
console.log(JSON.stringify(summary, null, 2))
