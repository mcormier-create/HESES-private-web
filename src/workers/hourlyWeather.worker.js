import { calculateHourlySimulation } from '../services/hourlyWeatherSimulation'

let cachedHourlyRecords = []
let cachedRecordsToken = ''

self.onmessage = (event) => {
  const { id, type, records, recordsToken, options } = event.data || {}

  if (type === 'set-records') {
    cachedHourlyRecords = Array.isArray(records) ? records : []
    cachedRecordsToken = String(recordsToken || '')
    self.postMessage({ id, ok: true, type: 'set-records', recordsToken: cachedRecordsToken })
    return
  }

  try {
    const sourceRecords = Array.isArray(records)
      ? records
      : cachedHourlyRecords
    const summary = calculateHourlySimulation(sourceRecords || [], options || {})
    self.postMessage({ id, ok: true, summary })
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error || 'Hourly worker error'),
    })
  }
}
