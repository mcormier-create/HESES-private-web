import assert from 'node:assert/strict'
import {
  EpwImportError,
  HESA_EPW_CALENDAR_POLICY,
  parseAndValidateEpw,
  toHesaWeatherContract,
} from '../src/services/epwImportService.js'
import { NEW_YORK_WEATHER_MANIFEST, WEATHER_STATION_MANIFEST_FIELDS } from '../src/regions/weatherStationManifest.js'

const TEST_FIXTURE_LOCATION = Object.freeze({
  city: 'TEST FIXTURE CITY',
  state: 'NY',
  country: 'USA',
  source: 'TEST FIXTURE SOURCE',
  stationId: 'TEST-FIXTURE-STATION-ID',
  latitude: 40,
  longitude: -74,
  timezone: -5,
  elevation: 10,
})

function buildFixture({ leapYear = false, recordsPerHour = 1 } = {}) {
  const year = leapYear ? 2000 : 2001
  const hours = leapYear
    ? HESA_EPW_CALENDAR_POLICY.leapYearHours
    : HESA_EPW_CALENDAR_POLICY.normalYearHours
  const headers = [
    `LOCATION,${TEST_FIXTURE_LOCATION.city},${TEST_FIXTURE_LOCATION.state},${TEST_FIXTURE_LOCATION.country},${TEST_FIXTURE_LOCATION.source},${TEST_FIXTURE_LOCATION.stationId},${TEST_FIXTURE_LOCATION.latitude},${TEST_FIXTURE_LOCATION.longitude},${TEST_FIXTURE_LOCATION.timezone},${TEST_FIXTURE_LOCATION.elevation}`,
    'DESIGN CONDITIONS,0',
    'TYPICAL/EXTREME PERIODS,0',
    'GROUND TEMPERATURES,0',
    `HOLIDAYS/DAYLIGHT SAVINGS,${leapYear ? 'Yes' : 'No'},0,0,0`,
    'COMMENTS 1,SYNTHETIC TEST FIXTURE - NOT REAL WEATHER',
    'COMMENTS 2,GENERATED ONLY FOR EPW IMPORT REGRESSION TESTS',
    `DATA PERIODS,1,${recordsPerHour},TEST FIXTURE DATA,Monday,1/1,12/31`,
  ]
  const records = []

  for (let index = 0; index < hours; index += 1) {
    const date = new Date(Date.UTC(year, 0, 1, index))
    const fields = [
      year,
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours() + 1,
      60,
      'TEST',
      5,
      1,
      75,
      100800,
      ...Array(25).fill(0),
    ]
    records.push(fields.join(','))
  }

  return [...headers, ...records]
}

function importFixture(lines, fileName = 'SYNTHETIC_TEST_FIXTURE.epw') {
  return parseAndValidateEpw(lines.join('\n'), { fileName })
}

function expectQualityError(lines, expectedCode) {
  assert.throws(
    () => importFixture(lines),
    (error) => {
      assert(error instanceof EpwImportError)
      assert.equal(error.qualityReport.valid, false)
      assert(
        error.qualityReport.errors.some((item) => item.code === expectedCode),
        `Expected quality error ${expectedCode}; received ${JSON.stringify(error.qualityReport.errors.slice(0, 10))}`
      )
      return true
    }
  )
}

const normalLines = buildFixture()
const normalImport = importFixture(normalLines)
const normalContract = toHesaWeatherContract(normalImport)

assert.equal(normalImport.qualityReport.valid, true)
assert.equal(normalImport.qualityReport.recordCount, 8760)
assert.equal(normalImport.qualityReport.calendarType, 'normal-year')
assert.equal(normalImport.qualityReport.sourceMinuteConvention, 60)
assert.equal(normalImport.qualityReport.normalizedMinute, 0)
assert.equal(normalImport.qualityReport.normalizedRecordCount, 8760)
assert.equal(normalImport.metadata.location.city, TEST_FIXTURE_LOCATION.city)
assert.equal(normalImport.metadata.location.stateProvinceRegion, 'NY')
assert.equal(normalImport.metadata.location.country, 'USA')
assert.equal(normalImport.metadata.location.source, TEST_FIXTURE_LOCATION.source)
assert.equal(normalImport.metadata.location.stationId, TEST_FIXTURE_LOCATION.stationId)
assert.equal(normalImport.metadata.location.latitude, 40)
assert.equal(normalImport.metadata.location.longitude, -74)
assert.equal(normalImport.metadata.location.timezone, -5)
assert.equal(normalImport.metadata.location.elevation, 10)
assert.deepEqual(Object.keys(normalContract).sort(), ['records', 'weatherLocation'])
assert.equal(normalContract.records.length, 8760)
assert.deepEqual(normalContract.records[0], {
  year: 2001,
  month: 1,
  day: 1,
  hour: 1,
  minute: 0,
  dryBulbC: 5,
  dewPointC: 1,
  relativeHumidity: 75,
  pressurePa: 100800,
  weatherLocation: normalImport.weatherLocation,
})

const leapImport = importFixture(buildFixture({ leapYear: true }))
assert.equal(leapImport.qualityReport.valid, true)
assert.equal(leapImport.qualityReport.recordCount, 8784)
assert.equal(leapImport.qualityReport.calendarType, 'leap-year')
assert(leapImport.records.some((record) => record.month === 2 && record.day === 29))

const minuteZeroLines = buildFixture().map((line, index) => {
  if (index < 8) return line
  return line.split(',').map((value, fieldIndex) => fieldIndex === 4 ? '0' : value).join(',')
})
const minuteZeroImport = importFixture(minuteZeroLines)
assert.equal(minuteZeroImport.qualityReport.sourceMinuteConvention, 0)
assert.equal(minuteZeroImport.qualityReport.normalizedMinute, 0)
assert.equal(minuteZeroImport.qualityReport.normalizedRecordCount, 8760)
assert.equal(minuteZeroImport.records.length, 8760)
assert.equal(normalImport.records.length, 8760)
assert(normalImport.records.every((record) => record.minute === 0))
assert(minuteZeroImport.records.every((record) => record.minute === 0))
assert.deepEqual(
  minuteZeroImport.records.map(({ month, day, hour }) => [month, day, hour]),
  normalImport.records.map(({ month, day, hour }) => [month, day, hour])
)

;[
  { fieldIndex: 6, sentinel: '99.9' },
  { fieldIndex: 7, sentinel: '99.9' },
  { fieldIndex: 8, sentinel: '999' },
  { fieldIndex: 9, sentinel: '999999' },
].forEach(({ fieldIndex, sentinel }) => {
  const sentinelLines = [...normalLines]
  sentinelLines[8] = sentinelLines[8].split(',').map((value, index) => index === fieldIndex ? sentinel : value).join(',')
  expectQualityError(sentinelLines, 'EPW_SENTINEL')
})

const missingFieldLines = [...normalLines]
missingFieldLines[8] = missingFieldLines[8].split(',').map((value, index) => index === 7 ? '' : value).join(',')
expectQualityError(missingFieldLines, 'EMPTY_FIELD')

const missingLocationFieldLines = [...normalLines]
missingLocationFieldLines[0] = missingLocationFieldLines[0].split(',').map((value, index) => index === 5 ? '' : value).join(',')
expectQualityError(missingLocationFieldLines, 'EMPTY_LOCATION_FIELD')

const truncatedRecordLines = [...normalLines]
truncatedRecordLines[8] = truncatedRecordLines[8].split(',').slice(0, 10).join(',')
expectQualityError(truncatedRecordLines, 'MISSING_COLUMNS')

const invalidDryBulbLines = [...normalLines]
invalidDryBulbLines[8] = invalidDryBulbLines[8].split(',').map((value, index) => index === 6 ? '75' : value).join(',')
expectQualityError(invalidDryBulbLines, 'PHYSICAL_RANGE')

const invalidDewPointLines = [...normalLines]
invalidDewPointLines[8] = invalidDewPointLines[8].split(',').map((value, index) => index === 7 ? '10' : value).join(',')
expectQualityError(invalidDewPointLines, 'PHYSICAL_CONSISTENCY')

const invalidRhLines = [...normalLines]
invalidRhLines[8] = invalidRhLines[8].split(',').map((value, index) => index === 8 ? '101' : value).join(',')
expectQualityError(invalidRhLines, 'PHYSICAL_RANGE')

const invalidPressureLines = [...normalLines]
invalidPressureLines[8] = invalidPressureLines[8].split(',').map((value, index) => index === 9 ? '20000' : value).join(',')
expectQualityError(invalidPressureLines, 'PHYSICAL_RANGE')

const invalidCountLines = normalLines.slice(0, -1)
expectQualityError(invalidCountLines, 'RECORD_COUNT')

const invalidCalendarLines = [...normalLines]
invalidCalendarLines[8] = invalidCalendarLines[8].split(',').map((value, index) => index === 1 ? '13' : value).join(',')
expectQualityError(invalidCalendarLines, 'INVALID_CALENDAR')

const fractionalYearLines = [...normalLines]
fractionalYearLines[8] = fractionalYearLines[8].split(',').map((value, index) => index === 0 ? '2001.5' : value).join(',')
expectQualityError(fractionalYearLines, 'INVALID_TIMESTAMP')

const nonHourlyMinuteLines = [...normalLines]
nonHourlyMinuteLines[8] = nonHourlyMinuteLines[8].split(',').map((value, index) => index === 4 ? '30' : value).join(',')
expectQualityError(nonHourlyMinuteLines, 'INVALID_TIMESTAMP')

const mixedMinuteLines = [...normalLines]
mixedMinuteLines[8] = mixedMinuteLines[8].split(',').map((value, index) => index === 4 ? '0' : value).join(',')
expectQualityError(mixedMinuteLines, 'MIXED_MINUTE_CONVENTION')

const duplicateLines = [...normalLines]
duplicateLines[9] = duplicateLines[8]
expectQualityError(duplicateLines, 'DUPLICATE_TIMESTAMP')

const discontinuousLines = [...normalLines]
;[discontinuousLines[9], discontinuousLines[10]] = [discontinuousLines[10], discontinuousLines[9]]
expectQualityError(discontinuousLines, 'HOURLY_CONTINUITY')

expectQualityError(buildFixture({ recordsPerHour: 2 }), 'RECORDS_PER_HOUR')

assert(WEATHER_STATION_MANIFEST_FIELDS.every((field) => Object.hasOwn(NEW_YORK_WEATHER_MANIFEST, field)))
assert.equal(NEW_YORK_WEATHER_MANIFEST.country, 'US')
assert.equal(NEW_YORK_WEATHER_MANIFEST.state, 'NY')
assert.equal(NEW_YORK_WEATHER_MANIFEST.city, 'New York')
assert.equal(NEW_YORK_WEATHER_MANIFEST.stationName, 'New York-John F Kennedy Intl AP')
assert.equal(NEW_YORK_WEATHER_MANIFEST.stationId, '744860')
assert.equal(NEW_YORK_WEATHER_MANIFEST.epwFile, 'public/weather/usa-ny-new-york-jfk-744860-tmy3.epw')
assert.match(NEW_YORK_WEATHER_MANIFEST.sourceName, /DOE/)
assert.equal(NEW_YORK_WEATHER_MANIFEST.ashraeClimateZone, '4A')
assert.match(NEW_YORK_WEATHER_MANIFEST.ashraeSource, /STD_169_2021/)
assert.equal(NEW_YORK_WEATHER_MANIFEST.ashraeEdition, 'ANSI/ASHRAE Standard 169-2021')

console.log('EPW import regression checks passed.')
console.log(JSON.stringify({
  fixture: 'SYNTHETIC TEST FIXTURE - NOT REAL NEW YORK WEATHER',
  normalYearHours: normalImport.records.length,
  leapYearHours: leapImport.records.length,
  locationParsed: normalImport.metadata.location,
  contractKeys: Object.keys(normalContract),
}, null, 2))
