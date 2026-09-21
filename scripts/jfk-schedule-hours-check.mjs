import { epwTextToRecords } from '../src/services/hourlyWeatherSimulation.js'
import { isEpwRecordOperating } from '../src/services/hourlyWeatherSimulation.js'
import { readFileSync } from 'node:fs'

const text = readFileSync('public/weather/usa-ny-new-york-jfk-744860-tmy3.epw', 'utf8')
const { records } = epwTextToRecords(text)

const customCount = records.filter((record) =>
  isEpwRecordOperating(record, 'custom', '08:00', '19:00', 'seven-days', {})
).length

const alwaysOnCount = records.filter((record) =>
  isEpwRecordOperating(record, '24-7', '00:00', '24:00', 'seven-days', {})
).length

console.log(JSON.stringify({
  totalRecords: records.length,
  jfk_08_19_hours: customCount,
  jfk_24_7_hours: alwaysOnCount,
}, null, 2))
