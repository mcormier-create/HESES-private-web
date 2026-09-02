import { calculateFreeCoolingHumifogComparison } from '../services/freeCoolingHumifogService.js'

self.onmessage = (event) => {
  const { requestId, inputs } = event.data || {}

  try {
    const result = calculateFreeCoolingHumifogComparison(inputs || {})
    const stripRowPoints = (rows) => (rows || []).map(({ points, ...row }) => row)
    result.binRows = stripRowPoints(result.binRows)
    result.conventionalRows = stripRowPoints(result.conventionalRows)
    result.optimizedHumifogRows = stripRowPoints(result.optimizedHumifogRows)
    result.optimizationRows = (result.optimizationRows || []).map(({ rows, ...summary }) => summary)
    const compactState = (state) => state
      ? (({ db, rh, w, h, wb, dp, v }) => ({ db, rh, w, h, wb, dp, v }))(state)
      : state
    const compactRows = (rows) => (rows || []).map((row) => {
      const {
        ...displayRow
      } = row
      return {
      ...displayRow,
      mixed: compactState(row.mixed),
      inletToHumifog: compactState(row.inletToHumifog),
      afterHumifog: compactState(row.afterHumifog),
      }
    })
    result.binRows = compactRows(result.binRows)
    result.conventionalRows = compactRows(result.conventionalRows)
    result.optimizedHumifogRows = compactRows(result.optimizedHumifogRows)
    result.bins = []
    result.binValidationRows = []
    self.postMessage({ requestId, ok: true, result })
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error || 'Free Cooling Humifog worker error'),
    })
  }
}
