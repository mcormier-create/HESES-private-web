export const STANDARD_PRESSURE_KPA = 101.325

const DRY_AIR_WATER_MOLECULAR_WEIGHT_RATIO = 0.621945
const MIN_TEMP_C = -100
const MAX_TEMP_C = 200

export function saturationPressureKPa(tempC) {
  const temperatureK = clamp(tempC, MIN_TEMP_C, MAX_TEMP_C) + 273.15
  const coefficients = tempC < 0
    ? [
      -5.6745359e3,
      6.3925247,
      -9.677843e-3,
      0.62215701e-6,
      2.0747825e-9,
      -9.484024e-13,
      4.1635019,
    ]
    : [
      -5.8002206e3,
      1.3914993,
      -4.8640239e-2,
      4.1764768e-5,
      -1.4452093e-8,
      6.5459673,
    ]

  const lnPressurePa = tempC < 0
    ? coefficients[0] / temperatureK +
      coefficients[1] +
      coefficients[2] * temperatureK +
      coefficients[3] * temperatureK ** 2 +
      coefficients[4] * temperatureK ** 3 +
      coefficients[5] * temperatureK ** 4 +
      coefficients[6] * Math.log(temperatureK)
    : coefficients[0] / temperatureK +
      coefficients[1] +
      coefficients[2] * temperatureK +
      coefficients[3] * temperatureK ** 2 +
      coefficients[4] * temperatureK ** 3 +
      coefficients[5] * Math.log(temperatureK)

  return Math.exp(lnPressurePa) / 1000
}

export function saturationHumidityRatio(tempC, pressureKPa = STANDARD_PRESSURE_KPA) {
  const saturationPressure = Math.min(saturationPressureKPa(tempC), pressureKPa * 0.999)
  return DRY_AIR_WATER_MOLECULAR_WEIGHT_RATIO * saturationPressure / (pressureKPa - saturationPressure)
}

export function humidityRatioFromRH(tempC, relativeHumidity, pressureKPa = STANDARD_PRESSURE_KPA) {
  const pws = saturationPressureKPa(tempC)
  const pw = (clamp(relativeHumidity, 0, 100) / 100) * pws
  return humidityRatioFromVaporPressure(pw, pressureKPa)
}

export function relativeHumidityFromHumidityRatio(tempC, humidityRatio, pressureKPa = STANDARD_PRESSURE_KPA) {
  const humidityRatioClamped = clampHumidityRatio(tempC, humidityRatio, pressureKPa)
  const vaporPressure = vaporPressureFromHumidityRatio(humidityRatioClamped, pressureKPa)
  return clamp((vaporPressure / saturationPressureKPa(tempC)) * 100, 0, 100)
}

export function grainsFromHumidityRatio(humidityRatio) {
  return humidityRatio * 7000
}

export function moistAirEnthalpyKjKg(tempC, humidityRatio) {
  return 1.006 * tempC + humidityRatio * (2501 + 1.86 * tempC)
}

export function moistAirEnthalpyBtuLb(tempC, humidityRatio) {
  const tempF = (tempC * 9) / 5 + 32
  return 0.24 * tempF + humidityRatio * (1061 + 0.444 * tempF)
}

export function dryBulbFromEnthalpyHumidityRatio(enthalpyKjKg, humidityRatio) {
  const safeW = Math.max(0, Number(humidityRatio) || 0)
  const safeH = Number(enthalpyKjKg) || 0
  const denominator = 1.006 + 1.86 * safeW
  if (Math.abs(denominator) < 1e-9) return 0
  return (safeH - 2501 * safeW) / denominator
}

export function dewPointC(tempC, relativeHumidity, pressureKPa = STANDARD_PRESSURE_KPA) {
  const humidityRatio = humidityRatioFromRH(tempC, relativeHumidity, pressureKPa)
  return dewPointFromHumidityRatioC(humidityRatio, pressureKPa, tempC)
}

export function wetBulbC(tempC, relativeHumidity, pressureKPa = STANDARD_PRESSURE_KPA) {
  const humidityRatio = humidityRatioFromRH(tempC, relativeHumidity, pressureKPa)
  return wetBulbFromHumidityRatioC(tempC, humidityRatio, pressureKPa)
}

export function psychrometricState({ dryBulbC, relativeHumidity, pressureKPa = STANDARD_PRESSURE_KPA }) {
  const humidityRatio = humidityRatioFromRH(dryBulbC, relativeHumidity, pressureKPa)
  return stateFromDbW({ dryBulbC, humidityRatio, pressureKPa })
}

export function stateFromDbW({ dryBulbC, humidityRatio, pressureKPa = STANDARD_PRESSURE_KPA }) {
  const safeDb = Number.isFinite(Number(dryBulbC)) ? Number(dryBulbC) : 0
  const safeW = clampHumidityRatio(safeDb, humidityRatio, pressureKPa)
  const rh = relativeHumidityFromHumidityRatio(safeDb, safeW, pressureKPa)

  return {
    db: safeDb,
    rh,
    w: safeW,
    h: moistAirEnthalpyKjKg(safeDb, safeW),
    wb: wetBulbFromHumidityRatioC(safeDb, safeW, pressureKPa),
    dp: dewPointFromHumidityRatioC(safeW, pressureKPa, safeDb),
    v: specificVolumeM3KgDa(safeDb, safeW, pressureKPa),
  }
}

export function mixAirStates(outdoorAir, returnAir, outdoorAirPercent) {
  const oaFraction = clamp(outdoorAirPercent / 100, 0, 1)
  const raFraction = 1 - oaFraction
  const mixedHumidityRatio = outdoorAir.w * oaFraction + returnAir.w * raFraction
  const mixedEnthalpy = outdoorAir.h * oaFraction + returnAir.h * raFraction
  const mixedDb = (mixedEnthalpy - mixedHumidityRatio * 2501) / (1.006 + 1.86 * mixedHumidityRatio)

  return stateFromDbW({
    dryBulbC: mixedDb,
    humidityRatio: mixedHumidityRatio,
  })
}

export function overrideDryBulbKeepingHumidityRatio(airState, dryBulbC) {
  return stateFromDbW({
    dryBulbC,
    humidityRatio: airState.w,
  })
}

export function applyHeatRecovery(outdoorAir, returnAir, recoveryType) {
  const recoveryMap = {
    none: { sensible: 0, latent: 0 },
    sensibleWheel: { sensible: 0.72, latent: 0 },
    enthalpyWheel: { sensible: 0.72, latent: 0.62 },
    crossflowPlate: { sensible: 0.55, latent: 0 },
  }
  const recovery = recoveryMap[recoveryType] ?? recoveryMap.none
  const recoveredDb = outdoorAir.db + recovery.sensible * (returnAir.db - outdoorAir.db)
  const recoveredW = outdoorAir.w + recovery.latent * (returnAir.w - outdoorAir.w)

  return stateFromDbW({
    dryBulbC: recoveredDb,
    humidityRatio: recoveredW,
  })
}

export function applyHumifogCooling(airState, effectiveness = 0.85) {
  const leavingDb = airState.db - clamp(effectiveness, 0, 1) * Math.max(airState.db - airState.wb, 0)
  const leavingHumidityRatio = Math.max(
    airState.w,
    (airState.h - 1.006 * leavingDb) / (2501 + 1.86 * leavingDb)
  )

  return {
    ...stateFromDbW({
      dryBulbC: leavingDb,
      humidityRatio: leavingHumidityRatio,
    }),
    addedWaterGKg: Math.max(0, (leavingHumidityRatio - airState.w) * 1000),
  }
}

export function applySteamHumidification(airState, targetRh = 45) {
  const targetW = humidityRatioFromRH(airState.db, targetRh)
  const humidifiedW = Math.max(airState.w, targetW)
  const humidityIncrease = Math.max(0, humidifiedW - airState.w)

  if (humidityIncrease <= 1e-9) {
    return {
      ...airState,
      addedWaterGKg: 0,
    }
  }

  return {
    ...stateFromDbW({
      dryBulbC: airState.db,
      humidityRatio: humidifiedW,
    }),
    addedWaterGKg: humidityIncrease * 1000,
  }
}

export function applyHeatingToDryBulb(airState, dryBulbC) {
  return stateFromDbW({
    dryBulbC,
    humidityRatio: airState.w,
  })
}

export function applyHumidification(airState, humidificationType, targetRh = 45) {
  if (humidificationType === 'none') return airState

  const targetW = humidityRatioFromRH(airState.db, targetRh)
  const humidifiedW = Math.max(airState.w, targetW)
  const humidified = stateFromDbW({
    dryBulbC: airState.db,
    humidityRatio: humidifiedW,
  })

  return {
    ...humidified,
    addedWaterGKg: Math.max(0, (humidifiedW - airState.w) * 1000),
    humidificationType,
  }
}

export function sensibleHeatingKw(airflowCfm, deltaTC) {
  return (1.08 * airflowCfm * (deltaTC * 1.8)) / 3412
}

function wetBulbFromHumidityRatioC(tempC, humidityRatio, pressureKPa) {
  const safeDb = Number(tempC)
  const targetW = clampHumidityRatio(safeDb, humidityRatio, pressureKPa)

  if (targetW >= saturationHumidityRatio(safeDb, pressureKPa) * 0.9999) {
    return safeDb
  }

  let lower = Math.max(MIN_TEMP_C, dewPointFromHumidityRatioC(targetW, pressureKPa, safeDb) - 5)
  let upper = safeDb

  for (let index = 0; index < 80; index += 1) {
    const mid = (lower + upper) / 2
    const calculatedW = humidityRatioFromWetBulb(safeDb, mid, pressureKPa)

    if (calculatedW > targetW) {
      upper = mid
    } else {
      lower = mid
    }
  }

  return (lower + upper) / 2
}

function humidityRatioFromWetBulb(dryBulbC, wetBulbCValue, pressureKPa) {
  const saturatedW = saturationHumidityRatio(wetBulbCValue, pressureKPa)

  if (wetBulbCValue >= 0) {
    return (
      ((2501 - 2.326 * wetBulbCValue) * saturatedW - 1.006 * (dryBulbC - wetBulbCValue)) /
      (2501 + 1.86 * dryBulbC - 4.186 * wetBulbCValue)
    )
  }

  return (
    ((2830 - 0.24 * wetBulbCValue) * saturatedW - 1.006 * (dryBulbC - wetBulbCValue)) /
    (2830 + 1.86 * dryBulbC - 2.1 * wetBulbCValue)
  )
}

function dewPointFromHumidityRatioC(humidityRatio, pressureKPa, dryBulbLimitC = MAX_TEMP_C) {
  const safeW = Math.max(0, Number(humidityRatio) || 0)
  const vaporPressure = vaporPressureFromHumidityRatio(safeW, pressureKPa)

  if (vaporPressure <= saturationPressureKPa(MIN_TEMP_C)) return MIN_TEMP_C

  let lower = MIN_TEMP_C
  let upper = clamp(dryBulbLimitC, MIN_TEMP_C, MAX_TEMP_C)

  if (saturationPressureKPa(upper) < vaporPressure) {
    upper = MAX_TEMP_C
  }

  for (let index = 0; index < 80; index += 1) {
    const mid = (lower + upper) / 2

    if (saturationPressureKPa(mid) > vaporPressure) {
      upper = mid
    } else {
      lower = mid
    }
  }

  return (lower + upper) / 2
}

function specificVolumeM3KgDa(tempC, humidityRatio, pressureKPa) {
  const dryAirGasConstant = 0.287042
  return dryAirGasConstant * (tempC + 273.15) * (1 + 1.607858 * humidityRatio) / pressureKPa
}

function humidityRatioFromVaporPressure(vaporPressureKPa, pressureKPa) {
  const safeVaporPressure = clamp(vaporPressureKPa, 0, pressureKPa * 0.999)
  return DRY_AIR_WATER_MOLECULAR_WEIGHT_RATIO * safeVaporPressure / (pressureKPa - safeVaporPressure)
}

function vaporPressureFromHumidityRatio(humidityRatio, pressureKPa) {
  const safeW = Math.max(0, Number(humidityRatio) || 0)
  return pressureKPa * safeW / (DRY_AIR_WATER_MOLECULAR_WEIGHT_RATIO + safeW)
}

function clampHumidityRatio(tempC, humidityRatio, pressureKPa) {
  const safeW = Math.max(0, Number(humidityRatio) || 0)
  return Math.min(safeW, saturationHumidityRatio(tempC, pressureKPa))
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max)
}
