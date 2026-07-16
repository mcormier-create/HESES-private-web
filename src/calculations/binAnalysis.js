import {
  applyHeatingToDryBulb,
  applyHeatRecovery,
  applyHumifogCooling,
  applySteamHumidification,
  mixAirStates,
  psychrometricState,
} from './psychrometrics'

export const cityBinData = {
  montreal: {
    label: 'Montreal',
    bins: [
      { tempC: -25, rh: 78, hours: 120 },
      { tempC: -20, rh: 76, hours: 220 },
      { tempC: -15, rh: 74, hours: 360 },
      { tempC: -10, rh: 72, hours: 520 },
      { tempC: -5, rh: 70, hours: 740 },
      { tempC: 0, rh: 68, hours: 880 },
      { tempC: 5, rh: 66, hours: 760 },
      { tempC: 10, rh: 64, hours: 520 },
    ],
  },
  quebec: {
    label: 'Quebec',
    bins: [
      { tempC: -30, rh: 78, hours: 150 },
      { tempC: -25, rh: 76, hours: 260 },
      { tempC: -20, rh: 74, hours: 430 },
      { tempC: -15, rh: 72, hours: 620 },
      { tempC: -10, rh: 70, hours: 820 },
      { tempC: -5, rh: 68, hours: 790 },
      { tempC: 0, rh: 66, hours: 540 },
      { tempC: 5, rh: 64, hours: 360 },
    ],
  },
  ottawa: {
    label: 'Ottawa',
    bins: [
      { tempC: -25, rh: 76, hours: 95 },
      { tempC: -20, rh: 74, hours: 190 },
      { tempC: -15, rh: 72, hours: 350 },
      { tempC: -10, rh: 70, hours: 560 },
      { tempC: -5, rh: 68, hours: 760 },
      { tempC: 0, rh: 66, hours: 880 },
      { tempC: 5, rh: 64, hours: 760 },
      { tempC: 10, rh: 62, hours: 520 },
    ],
  },
  toronto: {
    label: 'Toronto',
    bins: [
      { tempC: -15, rh: 74, hours: 120 },
      { tempC: -10, rh: 72, hours: 260 },
      { tempC: -5, rh: 70, hours: 520 },
      { tempC: 0, rh: 68, hours: 780 },
      { tempC: 5, rh: 66, hours: 1050 },
      { tempC: 10, rh: 64, hours: 920 },
      { tempC: 15, rh: 62, hours: 620 },
      { tempC: 20, rh: 60, hours: 360 },
    ],
  },
  vancouver: {
    label: 'Vancouver',
    bins: [
      { tempC: -5, rh: 82, hours: 40 },
      { tempC: 0, rh: 80, hours: 180 },
      { tempC: 5, rh: 78, hours: 760 },
      { tempC: 10, rh: 76, hours: 1320 },
      { tempC: 15, rh: 72, hours: 1180 },
      { tempC: 20, rh: 68, hours: 620 },
      { tempC: 25, rh: 62, hours: 220 },
      { tempC: 30, rh: 58, hours: 60 },
    ],
  },
}

export const oaOptimizationPercents = [20, 25, 30, 35, 40, 50, 60]

export function calculateBinAnalysis({
  cityKey,
  roomDb,
  roomRh,
  outdoorAirPercent,
  recoveryType,
  humidificationType,
  humidificationTargetRh,
  humifogEffectiveness,
}) {
  const city = cityBinData[cityKey] ?? cityBinData.montreal
  const ra = psychrometricState({ dryBulbC: roomDb, relativeHumidity: roomRh })
  const rows = city.bins.map((bin) => calculateBinRow({
    bin,
    ra,
    roomDb,
    outdoorAirPercent,
    recoveryType,
    humidificationType,
    humidificationTargetRh,
    humifogEffectiveness,
  }))
  const summary = summarizeRows(rows)
  const matrix = oaOptimizationPercents.map((oaPercent) => {
    const matrixRows = city.bins.map((bin) => calculateBinRow({
      bin,
      ra,
      roomDb,
      outdoorAirPercent: oaPercent,
      recoveryType,
      humidificationType,
      humidificationTargetRh,
      humifogEffectiveness,
    }))
    const matrixSummary = summarizeRows(matrixRows)

    return {
      oaPercent,
      raPercent: 100 - oaPercent,
      tmix: matrixSummary.averageTmix,
      heating: matrixSummary.heatingKwh,
      humifog: matrixSummary.humidificationKwh,
      total: matrixSummary.totalKwh,
    }
  })
  const optimal = matrix.reduce((best, item) => (item.total < best.total ? item : best), matrix[0])
  const comparison = compareFreeCoolingHumifog({
    city,
    ra,
    roomDb,
    recoveryType,
    humidificationTargetRh,
    humifogEffectiveness,
  })

  return {
    city,
    rows,
    summary,
    matrix,
    optimal,
    comparison,
  }
}

function calculateBinRow({
  bin,
  ra,
  roomDb,
  outdoorAirPercent,
  recoveryType,
  humidificationType,
  humidificationTargetRh,
  humifogEffectiveness,
}) {
  const oa = psychrometricState({ dryBulbC: bin.tempC, relativeHumidity: bin.rh })
  const mixed = mixAirStates(oa, ra, outdoorAirPercent)
  const recovered = applyHeatRecovery(mixed, ra, recoveryType)
  const humidified = humidificationType === 'humifog'
    ? applyHumifogCooling(recovered, humifogEffectiveness / 100)
    : applySteamHumidification(recovered, humidificationTargetRh)
  const heated = applyHeatingToDryBulb(humidified, roomDb)
  const heatingKwh = Math.max(0, heated.h - humidified.h) * bin.hours
  const humidificationKwh = Math.max(0, humidified.h - recovered.h) * bin.hours
  const totalKwh = heatingKwh + humidificationKwh

  return {
    bin,
    oa,
    ra,
    mixed,
    recovered,
    humidified,
    heated,
    outdoorAirPercent,
    returnAirPercent: 100 - outdoorAirPercent,
    heatingKwh,
    humidificationKwh,
    totalKwh,
  }
}

function summarizeRows(rows) {
  const totalHours = rows.reduce((total, row) => total + row.bin.hours, 0)
  const weighted = (selector) =>
    rows.reduce((total, row) => total + selector(row) * row.bin.hours, 0) / Math.max(totalHours, 1)

  return {
    totalHours,
    averageOa: weighted((row) => row.outdoorAirPercent),
    averageTmix: weighted((row) => row.mixed.db),
    heatingKwh: rows.reduce((total, row) => total + row.heatingKwh, 0),
    humidificationKwh: rows.reduce((total, row) => total + row.humidificationKwh, 0),
    totalKwh: rows.reduce((total, row) => total + row.totalKwh, 0),
  }
}

function compareFreeCoolingHumifog({ city, ra, roomDb, recoveryType, humidificationTargetRh, humifogEffectiveness }) {
  const freeCoolingRows = city.bins.map((bin) => calculateBinRow({
    bin,
    ra,
    roomDb,
    outdoorAirPercent: bin.tempC <= 15 ? 60 : 30,
    recoveryType,
    humidificationType: 'steam',
    humidificationTargetRh,
    humifogEffectiveness,
  }))
  const humifogRows = city.bins.map((bin) => calculateBinRow({
    bin,
    ra,
    roomDb,
    outdoorAirPercent: 30,
    recoveryType,
    humidificationType: 'humifog',
    humidificationTargetRh,
    humifogEffectiveness,
  }))

  return {
    freeCooling: summarizeRows(freeCoolingRows),
    humifog: summarizeRows(humifogRows),
  }
}
