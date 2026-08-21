import { calculateHourlySimulation } from '../services/hourlyWeatherSimulation'

self.onmessage = (event) => {
  const { id, records, options } = event.data || {}

  try {
    const summary = calculateHourlySimulation(records || [], options || {})
    self.postMessage({ id, ok: true, summary })
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error || 'Hourly worker error'),
    })
  }
}
