const REQUIRED_HEADER_KEYWORDS = [
  'LOCATION',
  'DESIGN CONDITIONS',
  'TYPICAL/EXTREME PERIODS',
  'GROUND TEMPERATURES',
  'HOLIDAYS/DAYLIGHT SAVINGS',
  'COMMENTS 1',
  'COMMENTS 2',
  'DATA PERIODS',
]

const NORMAL_YEAR_HOURS = 8760
const LEAP_YEAR_HOURS = 8784
const STANDARD_EPW_FIELD_COUNT = 35
const MAX_REPORTED_ERRORS = 100
const HESA_NORMALIZED_MINUTE = 0

export const HESA_EPW_CALENDAR_POLICY = Object.freeze({
  normalYearHours: NORMAL_YEAR_HOURS,
  leapYearHours: LEAP_YEAR_HOURS,
  acceptedRecordCounts: Object.freeze([NORMAL_YEAR_HOURS, LEAP_YEAR_HOURS]),
  interpolation: 'none',
  droppedHours: 'none',
})

export class EpwImportError extends Error {
  constructor(message, qualityReport) {
    super(message)
    this.name = 'EpwImportError'
    this.qualityReport = qualityReport
  }
}

function addError(report, code, message, lineNumber = null) {
  report.errorCount += 1
  if (report.errors.length < MAX_REPORTED_ERRORS) {
    report.errors.push({ code, message, lineNumber })
  }
}

function parseRequiredNumber(text, fieldName, lineNumber, report) {
  if (String(text ?? '').trim() === '') {
    addError(report, 'EMPTY_FIELD', `${fieldName} is empty.`, lineNumber)
    return null
  }

  const value = Number(text)
  if (!Number.isFinite(value)) {
    addError(report, 'INVALID_NUMBER', `${fieldName} is not numeric.`, lineNumber)
    return null
  }
  return value
}

function parseLocation(parts, lineNumber, report) {
  if (parts.length < 10) {
    addError(report, 'INVALID_LOCATION', 'LOCATION must include city, region, country, source, station ID, latitude, longitude, timezone, and elevation.', lineNumber)
  }

  const latitude = parseRequiredNumber(parts[6], 'LOCATION latitude', lineNumber, report)
  const longitude = parseRequiredNumber(parts[7], 'LOCATION longitude', lineNumber, report)
  const timezone = parseRequiredNumber(parts[8], 'LOCATION timezone', lineNumber, report)
  const elevation = parseRequiredNumber(parts[9], 'LOCATION elevation', lineNumber, report)

  ;[
    ['city', parts[1]],
    ['country', parts[3]],
    ['source', parts[4]],
    ['station ID', parts[5]],
  ].forEach(([fieldName, value]) => {
    if (!String(value || '').trim()) {
      addError(report, 'EMPTY_LOCATION_FIELD', `LOCATION ${fieldName} is empty.`, lineNumber)
    }
  })

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    addError(report, 'LOCATION_RANGE', 'LOCATION latitude must be between -90 and 90 degrees.', lineNumber)
  }
  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    addError(report, 'LOCATION_RANGE', 'LOCATION longitude must be between -180 and 180 degrees.', lineNumber)
  }
  if (timezone !== null && (timezone < -12 || timezone > 14)) {
    addError(report, 'LOCATION_RANGE', 'LOCATION timezone must be between -12 and +14 hours from GMT.', lineNumber)
  }
  if (elevation !== null && (elevation < -1000 || elevation >= 9999.9)) {
    addError(report, 'LOCATION_RANGE', 'LOCATION elevation is outside the EPW range.', lineNumber)
  }

  return {
    city: parts[1] || '',
    stateProvinceRegion: parts[2] || '',
    country: parts[3] || '',
    source: parts[4] || '',
    stationId: parts[5] || '',
    latitude,
    longitude,
    timezone,
    elevation,
  }
}

function validateWeatherValue(value, field, lineNumber, report) {
  const rules = {
    dryBulbC: { missing: 99.9, minExclusive: -70, maxExclusive: 70, label: 'Dry bulb temperature' },
    dewPointC: { missing: 99.9, minExclusive: -70, maxExclusive: 70, label: 'Dew point temperature' },
    relativeHumidity: { missing: 999, minInclusive: 0, maxInclusive: 100, label: 'Relative humidity' },
    pressurePa: { missing: 999999, minExclusive: 31000, maxExclusive: 120000, label: 'Atmospheric station pressure' },
  }
  const rule = rules[field]

  if (value === null) return
  if (value >= rule.missing) {
    addError(report, 'EPW_SENTINEL', `${rule.label} contains the EPW missing-value sentinel.`, lineNumber)
    return
  }
  if (rule.minExclusive !== undefined && value <= rule.minExclusive) {
    addError(report, 'PHYSICAL_RANGE', `${rule.label} is below its valid EPW range.`, lineNumber)
  }
  if (rule.maxExclusive !== undefined && value >= rule.maxExclusive) {
    addError(report, 'PHYSICAL_RANGE', `${rule.label} is above its valid EPW range.`, lineNumber)
  }
  if (rule.minInclusive !== undefined && value < rule.minInclusive) {
    addError(report, 'PHYSICAL_RANGE', `${rule.label} is below its physical range.`, lineNumber)
  }
  if (rule.maxInclusive !== undefined && value > rule.maxInclusive) {
    addError(report, 'PHYSICAL_RANGE', `${rule.label} is above its physical range.`, lineNumber)
  }
}

function canonicalHourIndex(month, day, hour, leapYear, lineNumber, report) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(hour)) {
    addError(report, 'INVALID_TIMESTAMP', 'Month, day, and hour must be integers.', lineNumber)
    return null
  }
  if (hour < 1 || hour > 24) {
    addError(report, 'INVALID_TIMESTAMP', 'EPW hour must be between 1 and 24.', lineNumber)
    return null
  }

  const anchorYear = leapYear ? 2000 : 2001
  const date = new Date(Date.UTC(anchorYear, month - 1, day, hour - 1))
  if (
    date.getUTCFullYear() !== anchorYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour - 1
  ) {
    addError(report, 'INVALID_CALENDAR', 'Timestamp is not valid for the declared HESA calendar.', lineNumber)
    return null
  }

  return Math.round((date.getTime() - Date.UTC(anchorYear, 0, 1)) / 3600000)
}

function parseHeaders(lines, report) {
  const headers = {}

  for (let index = 0; index < REQUIRED_HEADER_KEYWORDS.length; index += 1) {
    const line = lines[index]
    const parts = line?.text.split(',').map((part) => part.trim()) || []
    const keyword = String(parts[0] || '').toUpperCase()
    const expectedKeyword = REQUIRED_HEADER_KEYWORDS[index]

    if (keyword !== expectedKeyword) {
      addError(report, 'MISSING_HEADER', `Expected EPW header ${expectedKeyword} at header position ${index + 1}.`, line?.lineNumber || null)
      continue
    }

    headers[expectedKeyword] = parts
  }

  const locationParts = headers.LOCATION || []
  const location = parseLocation(locationParts, lines[0]?.lineNumber || 1, report)
  const dataPeriods = headers['DATA PERIODS'] || []
  const recordsPerHour = parseRequiredNumber(dataPeriods[2], 'DATA PERIODS records per hour', lines[7]?.lineNumber || 8, report)
  if (recordsPerHour !== null && recordsPerHour !== 1) {
    addError(report, 'RECORDS_PER_HOUR', 'HESA requires exactly one EPW observation per hour.', lines[7]?.lineNumber || 8)
  }

  return { headers, location, recordsPerHour }
}

function buildWeatherLocation(location) {
  return [
    location.city,
    location.stateProvinceRegion,
    location.country,
    location.source,
    location.stationId,
    location.latitude,
    location.longitude,
    location.timezone,
    location.elevation,
  ].filter((value) => value !== null && value !== '').join(', ')
}

export function parseAndValidateEpw(text, { fileName = '' } = {}) {
  const sourceLines = String(text || '')
    .split(/\r?\n/)
    .map((textValue, index) => ({ text: textValue.trim(), lineNumber: index + 1 }))
    .filter((line) => line.text && !line.text.startsWith('!'))

  const report = {
    fileName,
    valid: false,
    errorCount: 0,
    errors: [],
    recordCount: 0,
    calendarType: null,
    expectedHours: null,
    recordsPerHour: null,
    sourceMinuteConvention: null,
    normalizedMinute: HESA_NORMALIZED_MINUTE,
    normalizedRecordCount: 0,
    timestampNormalization: 'EPW year/month/day/hour retained; minute normalized to 0 for the HESA hourly interval',
    duplicateCount: 0,
    continuityErrorCount: 0,
  }

  if (sourceLines.length < REQUIRED_HEADER_KEYWORDS.length) {
    addError(report, 'INCOMPLETE_FILE', 'EPW file does not contain all eight required header lines.')
    throw new EpwImportError('EPW import failed quality validation.', report)
  }

  const { headers, location, recordsPerHour } = parseHeaders(sourceLines, report)
  report.recordsPerHour = recordsPerHour
  const dataLines = sourceLines.slice(REQUIRED_HEADER_KEYWORDS.length)
  report.recordCount = dataLines.length

  if (![NORMAL_YEAR_HOURS, LEAP_YEAR_HOURS].includes(dataLines.length)) {
    addError(report, 'RECORD_COUNT', `HESA accepts exactly ${NORMAL_YEAR_HOURS} or ${LEAP_YEAR_HOURS} hourly EPW records; received ${dataLines.length}.`)
  }

  const leapYear = dataLines.length === LEAP_YEAR_HOURS
  report.calendarType = leapYear ? 'leap-year' : dataLines.length === NORMAL_YEAR_HOURS ? 'normal-year' : 'unsupported'
  report.expectedHours = leapYear ? LEAP_YEAR_HOURS : dataLines.length === NORMAL_YEAR_HOURS ? NORMAL_YEAR_HOURS : null

  const weatherLocation = buildWeatherLocation(location)
  const records = []
  const observedHourIndexes = new Set()
  const observedMinutes = new Set()

  dataLines.forEach((line, recordIndex) => {
    const parts = line.text.split(',').map((part) => part.trim())
    if (parts.length < STANDARD_EPW_FIELD_COUNT) {
      addError(report, 'MISSING_COLUMNS', `Hourly EPW record must contain all ${STANDARD_EPW_FIELD_COUNT} standard fields.`, line.lineNumber)
      return
    }

    const year = parseRequiredNumber(parts[0], 'Year', line.lineNumber, report)
    const month = parseRequiredNumber(parts[1], 'Month', line.lineNumber, report)
    const day = parseRequiredNumber(parts[2], 'Day', line.lineNumber, report)
    const hour = parseRequiredNumber(parts[3], 'Hour', line.lineNumber, report)
    const minute = parseRequiredNumber(parts[4], 'Minute', line.lineNumber, report)
    const dryBulbC = parseRequiredNumber(parts[6], 'Dry bulb temperature', line.lineNumber, report)
    const dewPointC = parseRequiredNumber(parts[7], 'Dew point temperature', line.lineNumber, report)
    const relativeHumidity = parseRequiredNumber(parts[8], 'Relative humidity', line.lineNumber, report)
    const pressurePa = parseRequiredNumber(parts[9], 'Atmospheric station pressure', line.lineNumber, report)

    validateWeatherValue(dryBulbC, 'dryBulbC', line.lineNumber, report)
    validateWeatherValue(dewPointC, 'dewPointC', line.lineNumber, report)
    validateWeatherValue(relativeHumidity, 'relativeHumidity', line.lineNumber, report)
    validateWeatherValue(pressurePa, 'pressurePa', line.lineNumber, report)

    if (year !== null && !Number.isInteger(year)) {
      addError(report, 'INVALID_TIMESTAMP', 'EPW year must be an integer.', line.lineNumber)
    }
    if (minute !== null) {
      if (![0, 60].includes(minute)) {
        addError(report, 'INVALID_TIMESTAMP', 'Hourly EPW minute must use the 0 or 60 convention.', line.lineNumber)
      }
      observedMinutes.add(minute)
    }
    if (dryBulbC !== null && dewPointC !== null && dewPointC > dryBulbC) {
      addError(report, 'PHYSICAL_CONSISTENCY', 'Dew point temperature cannot exceed dry bulb temperature.', line.lineNumber)
    }

    const hourIndex = canonicalHourIndex(month, day, hour, leapYear, line.lineNumber, report)
    if (hourIndex !== null) {
      if (observedHourIndexes.has(hourIndex)) {
        report.duplicateCount += 1
        addError(report, 'DUPLICATE_TIMESTAMP', 'Duplicate month/day/hour observation.', line.lineNumber)
      }
      observedHourIndexes.add(hourIndex)
      if (hourIndex !== recordIndex) {
        report.continuityErrorCount += 1
        addError(report, 'HOURLY_CONTINUITY', `Expected canonical hour index ${recordIndex}, received ${hourIndex}.`, line.lineNumber)
      }
    }

    if ([year, month, day, hour, minute, dryBulbC, dewPointC, relativeHumidity, pressurePa].every((value) => value !== null)) {
      records.push({
        year,
        month,
        day,
        hour,
        minute: HESA_NORMALIZED_MINUTE,
        dryBulbC,
        dewPointC,
        relativeHumidity,
        pressurePa,
        weatherLocation,
      })
    }
  })

  if (observedMinutes.size > 1) {
    addError(report, 'MIXED_MINUTE_CONVENTION', 'EPW records must use one consistent hourly minute convention: 0 or 60.')
  }
  report.sourceMinuteConvention = observedMinutes.size === 1 ? [...observedMinutes][0] : null
  report.normalizedRecordCount = records.length

  if (records.length !== dataLines.length) {
    addError(report, 'NORMALIZED_RECORD_COUNT', `Expected ${dataLines.length} normalized HESA records; produced ${records.length}.`)
  }

  if (report.errorCount > 0) {
    throw new EpwImportError('EPW import failed quality validation.', report)
  }

  report.valid = true
  return {
    weatherLocation,
    records,
    metadata: {
      location,
      headers,
      calendarType: report.calendarType,
      recordCount: report.recordCount,
      timestampNormalization: {
        sourceMinuteConvention: report.sourceMinuteConvention,
        normalizedMinute: HESA_NORMALIZED_MINUTE,
        hourMapping: 'EPW hour 1-24 retained; HESA interprets it as interval 0-23',
      },
    },
    qualityReport: report,
  }
}

export function toHesaWeatherContract(importResult) {
  return {
    weatherLocation: importResult.weatherLocation,
    records: importResult.records.map((record) => ({ ...record })),
  }
}
