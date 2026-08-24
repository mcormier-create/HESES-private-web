import { humidityRatioFromRH, moistAirEnthalpyBtuLb, sensibleHeatingKw } from '../calculations/psychrometrics'
import { calculateAutomaticPreHumifogTemperature } from './hvacEngineeringService'

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isThermalWheelRecovery(recovery) {
  const label = normalizeLabel(`${recovery?.nom || ''} ${recovery?.type || ''}`)
  return label.includes('roue thermique') || label.includes('thermal wheel')
}

function isEnthalpyCassetteRecovery(recovery) {
  const label = normalizeLabel(`${recovery?.nom || ''} ${recovery?.type || ''}`)
  return label.includes('cassette') && (label.includes('enthalpique') || label.includes('enthalpy'))
}

function supportsLatentRecovery(recovery) {
  if (!recovery) return false
  if (recovery.noRecovery) return false
  if (typeof recovery.latentCapable === 'boolean') return recovery.latentCapable
  return isThermalWheelRecovery(recovery) || isEnthalpyCassetteRecovery(recovery)
}

function epwRecordHour(hour) {
  const epwHour = Number(hour)
  if (!Number.isFinite(epwHour)) return 0
  return epwHour >= 1 && epwHour <= 24 ? epwHour - 1 : epwHour
}

export function isEpwRecordOperating(record, scheduleMode, scheduleStartTime, scheduleEndTime, scheduleDaysOption, scheduleCustomDays) {
  if (scheduleMode === '24-7') return true

  const normalizedDaysOption = ['mon-fri', 'mon-sat', 'seven-days', 'custom'].includes(scheduleDaysOption)
    ? scheduleDaysOption
    : 'mon-fri'
  const resolvedCustomDays = {
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
    ...(scheduleCustomDays && typeof scheduleCustomDays === 'object' ? scheduleCustomDays : {}),
  }

  const hourOfDay = epwRecordHour(record.hour)
  const date = new Date(record.year, record.month - 1, record.day)
  const dayOfWeek = date.getDay()
  const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek]

  let enabledDay = false
  if (normalizedDaysOption === 'mon-fri') {
    enabledDay = dayOfWeek >= 1 && dayOfWeek <= 5
  } else if (normalizedDaysOption === 'mon-sat') {
    enabledDay = dayOfWeek >= 1 && dayOfWeek <= 6
  } else if (normalizedDaysOption === 'seven-days') {
    enabledDay = true
  } else {
    enabledDay = Boolean(resolvedCustomDays[dayName])
  }

  if (!enabledDay) return false

  const [startHours, startMinutes] = scheduleStartTime.split(':').map(Number)
  const [endHours, endMinutes] = scheduleEndTime.split(':').map(Number)
  const start = startHours * 60 + startMinutes
  let end = endHours * 60 + endMinutes
  if (end === 0) end = 24 * 60
  const recordMinutes = hourOfDay * 60

  if (start === end) return true
  if (start < end) return recordMinutes >= start && recordMinutes < end
  return recordMinutes >= start || recordMinutes < end
}

export function epwTextToRecords(text) {
  const lines = text.split(/\r?\n/)
  let weatherLocation = ''
  const records = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('!')) continue
    const parts = line.split(',').map((item) => item.trim())
    const keyword = parts[0]?.toUpperCase()

    if (keyword === 'LOCATION') {
      weatherLocation = parts.slice(1).join(', ').trim()
      continue
    }

    if (parts.length < 10) continue
    const [yearText, monthText, dayText, hourText, minuteText, , dryBulbText, dewPointText, rhText, pressureText] = parts
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const hour = Number(hourText)
    const minute = Number(minuteText)
    const dryBulbC = Number(dryBulbText)
    const dewPointC = Number(dewPointText)
    const relativeHumidity = Number(rhText)
    const pressurePa = Number(pressureText)

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour)) continue
    if (!Number.isFinite(dryBulbC) || !Number.isFinite(relativeHumidity) || !Number.isFinite(pressurePa)) continue

    records.push({ year, month, day, hour, minute: Number.isFinite(minute) ? minute : 0, dryBulbC, dewPointC, relativeHumidity, pressurePa, weatherLocation })
  }

  if (!records.length) {
    throw new Error('EPW file did not contain any valid hourly records.')
  }

  return { weatherLocation, records }
}

export function calculateHourlySimulation(records, options) {
  const {
    scheduleMode,
    scheduleStartTime,
    scheduleEndTime,
    scheduleDaysOption,
    scheduleCustomDays,
    outsideAirCFM,
    activeFraction,
    roomTemperature,
    roomRelativeHumidity,
    supplyAirTemperature,
    selectedRecoveries,
    wheelEfficiency,
    latentRecoveryEfficiency,
    selectedReheatSystem,
    heatPumpCOP,
    steamBoilerEfficiency,
    atmosphericGasHumidifierEfficiency,
    electricityRate,
    naturalGasRate,
  } = options

  const indoorHumidityRatio = humidityRatioFromRH(supplyAirTemperature, roomRelativeHumidity)
  const selectedRecovery = selectedRecoveries[0]
  const isNoRecovery = Boolean(selectedRecovery?.noRecovery)
  const latentRecoverySupported = supportsLatentRecovery(selectedRecovery)
  const sensibleRecoveryEfficiency = isNoRecovery
    ? 0
    : clampValue(Number(wheelEfficiency), 0, 95)
  const effectiveLatentRecoveryEfficiency = isNoRecovery || !latentRecoverySupported
    ? 0
    : clampValue(Number(latentRecoveryEfficiency), 0, 95)
  const indoorEnthalpy = moistAirEnthalpyBtuLb(supplyAirTemperature, indoorHumidityRatio)
  const effectiveOutsideAirCFM = Math.round(outsideAirCFM * activeFraction)
  const reheatEnergySource = String(selectedReheatSystem?.energie || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const usesNaturalGasReheat = reheatEnergySource.includes('gaz') || reheatEnergySource.includes('natural gas')
  const usesPassiveRecoveryReheat = reheatEnergySource.includes('recuperation') || reheatEnergySource.includes('recovery') || reheatEnergySource.includes('passive')
  const usesHeatPumpReheat = reheatEnergySource.includes('thermopompe') || reheatEnergySource.includes('heat pump')

  const firstRecord = records[0]
  const lastRecord = records[records.length - 1]
  const firstDate = firstRecord
    ? new Date(firstRecord.year, firstRecord.month - 1, firstRecord.day, epwRecordHour(firstRecord.hour), firstRecord.minute || 0)
    : null
  const lastDate = lastRecord
    ? new Date(lastRecord.year, lastRecord.month - 1, lastRecord.day, epwRecordHour(lastRecord.hour), lastRecord.minute || 0)
    : null

  let operatingCount = 0
  let outdoorTempSum = 0
  let outdoorRhSum = 0
  let minOutdoorTemp = Number.POSITIVE_INFINITY
  let maxOutdoorTemp = Number.NEGATIVE_INFINITY

  let totalSteamKwh = 0
  let totalGasKwh = 0
  let totalHumifogKwh = 0
  let totalCost = 0
  let totalSteamCost = 0
  let totalNaturalGasGES = 0
  let totalAtmosphericGasGES = 0
  let totalAdiabaticGES = 0
  let totalWaterKg = 0
  let totalHumifogPumpKwh = 0
  let totalHumifogReheatKwh = 0
  let totalHumifogPumpCost = 0
  let totalHumifogReheatCost = 0

  let hoursBelowZero = 0
  let hoursBelowMinusTen = 0
  let hoursBelowMinusTwenty = 0
  let hoursWithHumidificationRequired = 0

  for (const record of records) {
    if (!isEpwRecordOperating(record, scheduleMode, scheduleStartTime, scheduleEndTime, scheduleDaysOption, scheduleCustomDays)) {
      continue
    }

    operatingCount += 1
    outdoorTempSum += record.dryBulbC
    outdoorRhSum += record.relativeHumidity
    if (record.dryBulbC < minOutdoorTemp) minOutdoorTemp = record.dryBulbC
    if (record.dryBulbC > maxOutdoorTemp) maxOutdoorTemp = record.dryBulbC
    if (record.dryBulbC < 0) hoursBelowZero += 1
    if (record.dryBulbC < -10) hoursBelowMinusTen += 1
    if (record.dryBulbC < -20) hoursBelowMinusTwenty += 1

    const pressureKPa = record.pressurePa / 1000
    const outdoorHumidityRatio = humidityRatioFromRH(record.dryBulbC, record.relativeHumidity, pressureKPa)
    const recoveredHumidityRatioRaw = outdoorHumidityRatio +
      (effectiveLatentRecoveryEfficiency / 100) * (indoorHumidityRatio - outdoorHumidityRatio)
    const recoveredHumidityRatio = clampValue(
      recoveredHumidityRatioRaw,
      Math.max(0, Math.min(outdoorHumidityRatio, indoorHumidityRatio)),
      Math.max(outdoorHumidityRatio, indoorHumidityRatio)
    )
    const deltaW = Math.max(0.00001, indoorHumidityRatio - recoveredHumidityRatio)
    const steamHumidificationLoad = Math.max(0, Math.round(4.5 * effectiveOutsideAirCFM * deltaW))
    const correctedHumidificationLoad = steamHumidificationLoad
    const steamEnergyKW = Math.round(correctedHumidificationLoad * 0.345)
    const adiabaticLoad = correctedHumidificationLoad
    const adiabaticPumpKW = Math.max(1, Math.round(adiabaticLoad * 0.0009))
    const recoveredDryBulbC = record.dryBulbC + (sensibleRecoveryEfficiency / 100) * (roomTemperature - record.dryBulbC)
    const enteringHumifogEnthalpy = moistAirEnthalpyBtuLb(recoveredDryBulbC, recoveredHumidityRatio)
    const preheatBtuPerHr = Math.max(0, 4.5 * effectiveOutsideAirCFM * (indoorEnthalpy - enteringHumifogEnthalpy))
    const grossHumifogPreheatKW = Math.round(preheatBtuPerHr / 3412)
    const preheatTargetTempC = calculateAutomaticPreHumifogTemperature(indoorEnthalpy, recoveredHumidityRatio)
    const baseHvacHeatingThermalKW = Math.round(
      sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, preheatTargetTempC - recoveredDryBulbC))
    )
    const grossReheatKW = Math.max(0, grossHumifogPreheatKW - baseHvacHeatingThermalKW)
    const netReheatKW = grossReheatKW
    const reheatEnergyKW = usesPassiveRecoveryReheat
      ? 0
      : usesHeatPumpReheat
        ? Number((netReheatKW / Math.max(heatPumpCOP, 0.1)).toFixed(2))
        : usesNaturalGasReheat
          ? Number((netReheatKW / Math.max((Number(selectedReheatSystem?.rendement) || 88) / 100, 0.01)).toFixed(2))
          : Number((netReheatKW * (selectedReheatSystem?.facteur ?? 1)).toFixed(2))
    const adiabaticEnergyKW = Number(Math.max(0, adiabaticPumpKW + reheatEnergyKW).toFixed(2))
    const naturalGasSteamInputKW = Math.round(steamEnergyKW / Math.max(steamBoilerEfficiency / 100, 0.01))
    const atmosphericGasHumidifierInputKW = Math.round(steamEnergyKW / Math.max(atmosphericGasHumidifierEfficiency / 100, 0.01))
    const atmosphericGasHumidifierM3PerHour = Number((atmosphericGasHumidifierInputKW / 10.35).toFixed(1))
    const naturalGasM3PerHour = Number((naturalGasSteamInputKW / 10.35).toFixed(1))
    // Keep hourly costs as decimals; rounding each hour can zero-out valid annual costs.
    const steamCost = steamEnergyKW * electricityRate
    const humifogPumpCost = adiabaticPumpKW * electricityRate
    const humifogReheatCost = usesNaturalGasReheat
      ? (reheatEnergyKW / 10.35) * naturalGasRate
      : usesPassiveRecoveryReheat
        ? 0
        : reheatEnergyKW * electricityRate
    const adiabaticCost = humifogPumpCost + humifogReheatCost
    const gasCost = (naturalGasM3PerHour + atmosphericGasHumidifierM3PerHour) * naturalGasRate
    const naturalGasGES = Number(((naturalGasSteamInputKW * 0.182) / 1000).toFixed(6))
    const atmosphericGasHumidifierGES = Number(((atmosphericGasHumidifierInputKW * 0.182) / 1000).toFixed(6))
    const adiabaticGES = usesHeatPumpReheat ? Number(((reheatEnergyKW * 0.182) / 1000).toFixed(6)) : 0
    const waterKg = Number((correctedHumidificationLoad * 0.453592).toFixed(3))

    if (steamEnergyKW > 0) hoursWithHumidificationRequired += 1

    totalSteamKwh += steamEnergyKW
    totalGasKwh += naturalGasSteamInputKW + atmosphericGasHumidifierInputKW
    totalHumifogKwh += adiabaticEnergyKW
    totalHumifogPumpKwh += adiabaticPumpKW
    totalHumifogReheatKwh += reheatEnergyKW
    totalCost += adiabaticCost
    totalHumifogPumpCost += humifogPumpCost
    totalHumifogReheatCost += humifogReheatCost
    totalSteamCost += steamCost
    totalNaturalGasGES += naturalGasGES
    totalAtmosphericGasGES += atmosphericGasHumidifierGES
    totalAdiabaticGES += adiabaticGES
    totalWaterKg += waterKg
    void gasCost
  }

  return {
    weatherLocation: records[0]?.weatherLocation || '',
    recordsLoaded: records.length,
    operatingHoursUsed: operatingCount,
    firstDate,
    lastDate,
    averageOutdoorTemp: operatingCount ? outdoorTempSum / operatingCount : 0,
    minOutdoorTemp: operatingCount ? minOutdoorTemp : 0,
    maxOutdoorTemp: operatingCount ? maxOutdoorTemp : 0,
    averageOutdoorRh: operatingCount ? outdoorRhSum / operatingCount : 0,
    annualSteamKwh: totalSteamKwh,
    annualGasKwh: totalGasKwh,
    annualHumifogKwh: totalHumifogKwh,
    annualCost: totalCost,
    annualHumifogPumpKwh: totalHumifogPumpKwh,
    annualHumifogReheatKwh: totalHumifogReheatKwh,
    annualHumifogPumpCost: totalHumifogPumpCost,
    annualHumifogReheatCost: totalHumifogReheatCost,
    annualSavings: totalSteamCost - totalCost,
    annualGhgReduction: Math.max(0, totalNaturalGasGES + totalAtmosphericGasGES - totalAdiabaticGES),
    annualWaterConsumptionKg: totalWaterKg,
    hoursBelowZero,
    hoursBelowMinusTen,
    hoursBelowMinusTwenty,
    hoursWithHumidificationRequired,
  }
}
