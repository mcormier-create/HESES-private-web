import { useState, useRef, useEffect } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import HVACSystemImage from './components/HVACSystemImage'
import PsychrometricChart from './components/PsychrometricChart'
import HvacEnergyOptimizationReport from './reports/HvacEnergyOptimizationReport'
import { BASELINE_TECHNOLOGIES, selectedHumifogTechnology } from './reports/projectEnergySummary'
import { calculateFreeCoolingHumifogComparison } from './services/freeCoolingHumifogService'
import { calculateAutomaticPreHumifogTemperature, calculateHvacDashboardMetrics } from './services/hvacEngineeringService'
import { dryBulbFromEnthalpyHumidityRatio, humidityRatioFromRH, mixAirStates, moistAirEnthalpyBtuLb, psychrometricState, sensibleHeatingKw, stateFromDbW } from './calculations/psychrometrics'
import { getSystemSchematic, resolveSystemSchematicId, systemImages } from './utils/systemImages'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts'

const WEATHER_PRODUCTION_MODE = false
const BIN_WEEKS_PER_YEAR = 52.142857

const monthlyFactors = [1, 0.95, 0.83, 0.64, 0.44, 0.28, 0.18, 0.2, 0.36, 0.58, 0.82, 0.96]
const DEFAULT_SCHEDULE_CUSTOM_DAYS = {
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
  sat: false,
  sun: false,
}
const SCHEDULE_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const PRESET_SCHEDULE_DAYS = {
  'mon-fri': { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  'mon-sat': { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false },
  'seven-days': { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
}

const BUILT_IN_EPW_FILES = {
  'Montréal': 'montreal.epw',
  Montreal: 'montreal.epw',
  'Québec': 'quebec.epw',
  Quebec: 'quebec.epw',
  Ottawa: 'ottawa.epw',
  Toronto: 'toronto.epw',
  Vancouver: 'vancouver.epw',
  Calgary: 'calgary.epw',
  Winnipeg: 'winnipeg.epw',
}

const WEATHER_UNVERIFIED_WARNING = {
  fr: '',
  en: ''
}

const CUSTOM_WEATHER_WARNING = {
  fr: '',
  en: ''
}
const OFFICIAL_BUILT_IN_EPW_FILES = new Set([
  'montreal.epw',
  'quebec.epw',
  'ottawa.epw',
  'toronto.epw',
  'vancouver.epw',
  'calgary.epw',
  'winnipeg.epw',
])

const weatherMetadata = {
  Montreal: {
    file: '/weather/montreal.epw',
    dataSource: 'Government of Canada CWEC_FMCCE',
    sourceOrganization: 'Environment and Climate Change Canada',
    stationName: 'Montreal',
    stationId: '',
    climateFileType: 'CWEC_FMCCE / EPW hourly weather file',
    periodOfRecord: '',
    fileYearType: 'Typical meteorological year',
    recordCount: 8760,
    validationStatus: 'official',
  },
  Quebec: {
    file: '/weather/quebec.epw',
    dataSource: 'Government of Canada CWEC_FMCCE',
    sourceOrganization: 'Environment and Climate Change Canada',
    stationName: 'Quebec',
    stationId: '',
    climateFileType: 'CWEC_FMCCE / EPW hourly weather file',
    periodOfRecord: '',
    fileYearType: 'Typical meteorological year',
    recordCount: 8760,
    validationStatus: 'official',
  },
  Ottawa: {
    file: '/weather/ottawa.epw',
    dataSource: 'Government of Canada CWEC_FMCCE',
    sourceOrganization: 'Environment and Climate Change Canada',
    stationName: 'Ottawa',
    stationId: '',
    climateFileType: 'CWEC_FMCCE / EPW hourly weather file',
    periodOfRecord: '',
    fileYearType: 'Typical meteorological year',
    recordCount: 8760,
    validationStatus: 'official',
  },
  Toronto: {
    file: '/weather/toronto.epw',
    dataSource: 'Government of Canada CWEC_FMCCE',
    sourceOrganization: 'Environment and Climate Change Canada',
    stationName: 'Toronto',
    stationId: '',
    climateFileType: 'CWEC_FMCCE / EPW hourly weather file',
    periodOfRecord: '',
    fileYearType: 'Typical meteorological year',
    recordCount: 8760,
    validationStatus: 'official',
  },
  Vancouver: {
    file: '/weather/vancouver.epw',
    dataSource: 'Government of Canada CWEC_FMCCE',
    sourceOrganization: 'Environment and Climate Change Canada',
    stationName: 'Vancouver',
    stationId: '',
    climateFileType: 'CWEC_FMCCE / EPW hourly weather file',
    periodOfRecord: '',
    fileYearType: 'Typical meteorological year',
    recordCount: 8760,
    validationStatus: 'official',
  },
  Calgary: {
    file: '/weather/calgary.epw',
    dataSource: 'Government of Canada CWEC_FMCCE',
    sourceOrganization: 'Environment and Climate Change Canada',
    stationName: 'Calgary',
    stationId: '',
    climateFileType: 'CWEC_FMCCE / EPW hourly weather file',
    periodOfRecord: '',
    fileYearType: 'Typical meteorological year',
    recordCount: 8760,
    validationStatus: 'official',
  },
  Winnipeg: {
    file: '/weather/winnipeg.epw',
    dataSource: 'Government of Canada CWEC_FMCCE',
    sourceOrganization: 'Environment and Climate Change Canada',
    stationName: 'Winnipeg',
    stationId: '',
    climateFileType: 'CWEC_FMCCE / EPW hourly weather file',
    periodOfRecord: '',
    fileYearType: 'Typical meteorological year',
    recordCount: 8760,
    validationStatus: 'official',
  },
}

const builtInWeatherFilesByCityKey = Object.fromEntries(
  Object.entries(BUILT_IN_EPW_FILES).map(([cityName, fileName]) => [normalizeCityKey(cityName), fileName])
)

function normalizeCityKey(cityName) {
  return String(cityName || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getBuiltInHourlyWeatherFilePath(cityName) {
  const fileName = getBuiltInEpwFileName(cityName)
  return fileName ? `/weather/${fileName}` : ''
}

function getBuiltInEpwFileName(cityName) {
  const normalizedCity = String(cityName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return BUILT_IN_EPW_FILES[cityName] || BUILT_IN_EPW_FILES[normalizedCity] || builtInWeatherFilesByCityKey[normalizeCityKey(cityName)] || ''
}

function getBuiltInHourlyWeatherFileName(cityName) {
  return getBuiltInEpwFileName(cityName)
}

function buildEpwUrl(fileName) {
  if (!fileName) return ''
  return `${window.location.origin}/weather/${fileName}`
}

function formatWeatherValidationStatus(status, language) {
  const normalized = String(status || '').toLowerCase()

  if (language === 'fr' && normalized === 'official') {
    return 'officiel'
  }
  if (language === 'fr' && normalized === 'unverified') {
    return 'non officiel'
  }

  return status || '-'
}

function getWeatherUnverifiedWarning(language) {
  return language === 'fr' ? WEATHER_UNVERIFIED_WARNING.fr : WEATHER_UNVERIFIED_WARNING.en
}

function getCustomWeatherWarning(language) {
  return language === 'fr' ? CUSTOM_WEATHER_WARNING.fr : CUSTOM_WEATHER_WARNING.en
}

function isOfficialBuiltInWeatherFileMatch(fileName, recordsCount) {
  const normalizedFileName = String(fileName || '').toLowerCase().trim()
  return OFFICIAL_BUILT_IN_EPW_FILES.has(normalizedFileName) && Number(recordsCount) === 8760
}

function localizeWeatherMetadataValue(label, value, language) {
  if (language !== 'fr') return value || ''

  if (label === 'dataSource' && String(value || '').includes('Government of Canada')) {
    return 'Gouvernement du Canada CWEC_FMCCE'
  }
  if (label === 'sourceOrganization' && String(value || '').includes('Environment and Climate Change Canada')) {
    return 'Environnement et Changement climatique Canada'
  }
  if (label === 'climateFileType' && String(value || '').includes('CWEC_FMCCE / EPW hourly weather file')) {
    return 'CWEC_FMCCE / fichier météo horaire EPW'
  }
  return value || ''
}

function getBuiltInHourlyFallbackMessage(cityName, translations) {
  const normalized = normalizeCityKey(cityName)
  if (normalized === normalizeCityKey('Ottawa')) {
    return 'Le fichier météo horaire intégré pour Ottawa est introuvable. HESA continue avec la méthode des heures BIN.'
  }
  return translations.noBuiltInWeatherAvailable
}

function getWeatherMetadataForCity(cityName) {
  const normalized = normalizeCityKey(cityName)
  const entry = Object.entries(weatherMetadata).find(([name]) => normalizeCityKey(name) === normalized)
  return entry ? entry[1] : null
}

function validateHourlyWeatherRecords(records) {
  if (!Array.isArray(records) || records.length !== 8760) {
    return {
      isValid: false,
      error: 'EPW weather file validation failed: expected exactly 8760 hourly records.',
    }
  }

  const hasRequiredFields = records.every((record) => (
    Number.isFinite(record?.dryBulbC) &&
    Number.isFinite(record?.relativeHumidity) &&
    Number.isFinite(record?.pressurePa)
  ))

  if (!hasRequiredFields) {
    return {
      isValid: false,
      error: 'EPW weather file validation failed: dry bulb temperature, relative humidity, and pressure are required for all hourly records.',
    }
  }

  const hasDewPointOrHumidityBasis = records.every((record) => (
    Number.isFinite(record?.dewPointC) ||
    (Number.isFinite(record?.dryBulbC) && Number.isFinite(record?.relativeHumidity) && Number.isFinite(record?.pressurePa))
  ))

  if (!hasDewPointOrHumidityBasis) {
    return {
      isValid: false,
      error: 'EPW weather file validation failed: dew point or sufficient humidity-ratio input data is required for all hourly records.',
    }
  }

  return { isValid: true, error: '' }
}

const HESES_ASSISTANT_ENDPOINT = '/api/heses-assistant'
const HESES_ASSISTANT_HEALTH_ENDPOINT = '/api/heses-assistant/health'
const FREE_COOLING_ROUTE = '/'
const HESES_PROJECT_PROFILE_STORAGE_KEY = 'heses-project-profile'
const HESES_PROJECT_SETTINGS_STORAGE_KEY = 'heses-project-settings'
const HESES_MULTI_SYSTEM_STORAGE_KEY = 'heses-multi-system-project'
const HESES_PRINT_REPORT_STORAGE_KEY = 'heses-print-report-html'

function returnToHesesApp() {
  if (typeof window === 'undefined') return
  window.location.assign(`${window.location.origin}/`)
}

function parseObjectSetting(settings, key, fallback) {
  const value = settings?.[key]
  return value && typeof value === 'object'
    ? { ...fallback, ...value }
    : fallback
}

function getScheduleDaysPerWeek(option, customDays) {
  if (option === 'mon-sat') return 6
  if (option === 'seven-days') return 7
  if (option === 'custom') return Object.values(customDays).filter(Boolean).length
  return 5
}

function computeScheduleDailyHours(startTime, endTime, mode) {
  if (mode === '24-7') return 24
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  const start = startHours * 60 + startMinutes
  const end = endHours * 60 + endMinutes
  if (start === end) return 24
  if (end > start) return (end - start) / 60
  return ((24 * 60 - start) + end) / 60
}

function resolveScheduleActiveDays(option, customDays) {
  if (option === 'custom') return { ...DEFAULT_SCHEDULE_CUSTOM_DAYS, ...customDays }
  return { ...PRESET_SCHEDULE_DAYS[option] }
}

function epwTextToRecords(text) {
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

function epwRecordHour(hour) {
  const epwHour = Number(hour)
  if (!Number.isFinite(epwHour)) return 0
  return epwHour >= 1 && epwHour <= 24 ? epwHour - 1 : epwHour
}

function isEpwRecordOperating(record, scheduleMode, scheduleStartTime, scheduleEndTime, scheduleDaysOption, scheduleCustomDays) {
  if (scheduleMode === '24-7') return true

  const hourOfDay = epwRecordHour(record.hour)
  const date = new Date(record.year, record.month - 1, record.day)
  const dayOfWeek = date.getDay()
  const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek]

  let enabledDay = false
  if (scheduleDaysOption === 'mon-fri') {
    enabledDay = dayOfWeek >= 1 && dayOfWeek <= 5
  } else if (scheduleDaysOption === 'mon-sat') {
    enabledDay = dayOfWeek >= 1 && dayOfWeek <= 6
  } else if (scheduleDaysOption === 'seven-days') {
    enabledDay = true
  } else {
    enabledDay = Boolean(scheduleCustomDays[dayName])
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

function isEnthalpyCassette(recoveryInput) {
  const recoveries = Array.isArray(recoveryInput)
    ? recoveryInput
    : [recoveryInput]

  return recoveries.some((recovery) => {
    if (!recovery) return false

    const name = String(recovery.nom || recovery.name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    return (
      name === 'echangeur a cassette enthalpique' ||
      name === 'enthalpy cassette heat exchanger' ||
      (name.includes('cassette') && name.includes('enthalp'))
    )
  })
}

function calculateHourlySimulation(records, options) {
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
  const usesHeatPumpReheat = reheatEnergySource.includes('thermopompe') || reheatEnergySource.includes('heat pump')

  const filtered = records.filter((record) => isEpwRecordOperating(record, scheduleMode, scheduleStartTime, scheduleEndTime, scheduleDaysOption, scheduleCustomDays))

  const hourlyRows = filtered.map((record) => {
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
    const adiabaticTemperatureDrop = Number(
      Math.max(0.3, Math.min(12, deltaW * 7000 * 0.22)).toFixed(1)
    )
    const recoveredDryBulbC = record.dryBulbC + (sensibleRecoveryEfficiency / 100) * (roomTemperature - record.dryBulbC)
    const enteringHumifogEnthalpy = moistAirEnthalpyBtuLb(recoveredDryBulbC, recoveredHumidityRatio)
    const preheatBtuPerHr = Math.max(0, 4.5 * effectiveOutsideAirCFM * (indoorEnthalpy - enteringHumifogEnthalpy))
    const grossHumifogPreheatKW = Math.round(preheatBtuPerHr / 3412)
    const preheatTargetTempC = calculateAutomaticPreHumifogTemperature(indoorEnthalpy, recoveredHumidityRatio)
    const baseHvacHeatingThermalKW = Math.round(
      sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, preheatTargetTempC - recoveredDryBulbC))
    )
    const grossReheatKW = Math.max(0, grossHumifogPreheatKW - baseHvacHeatingThermalKW)
    const recoveryEnergyReductionKW = isNoRecovery
      ? 0
      : Math.round(sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, recoveredDryBulbC - record.dryBulbC)))
    const netReheatKW = grossReheatKW
    const reheatEnergyKW = usesHeatPumpReheat
      ? Number((netReheatKW / Math.max(heatPumpCOP, 0.1)).toFixed(2))
      : Number((netReheatKW * (selectedReheatSystem?.facteur ?? 1)).toFixed(2))
    const adiabaticEnergyKW = Number(Math.max(0, adiabaticPumpKW + reheatEnergyKW).toFixed(2))
    const naturalGasSteamInputKW = Math.round(steamEnergyKW / Math.max(steamBoilerEfficiency / 100, 0.01))
    const atmosphericGasHumidifierInputKW = Math.round(steamEnergyKW / Math.max(atmosphericGasHumidifierEfficiency / 100, 0.01))
    const atmosphericGasHumidifierM3PerHour = Number((atmosphericGasHumidifierInputKW / 10.35).toFixed(1))
    const naturalGasM3PerHour = Number((naturalGasSteamInputKW / 10.35).toFixed(1))
    const steamCost = Math.round(steamEnergyKW * electricityRate)
    const adiabaticCost = Math.round(adiabaticEnergyKW * electricityRate)
    const gasCost = Math.round((naturalGasM3PerHour + atmosphericGasHumidifierM3PerHour) * naturalGasRate)
    const naturalGasGES = Number(((naturalGasSteamInputKW * 0.182) / 1000).toFixed(6))
    const atmosphericGasHumidifierGES = Number(((atmosphericGasHumidifierInputKW * 0.182) / 1000).toFixed(6))
    const adiabaticGES = usesHeatPumpReheat ? Number(((reheatEnergyKW * 0.182) / 1000).toFixed(6)) : 0
    const waterKg = Number((correctedHumidificationLoad * 0.453592).toFixed(3))

    return {
      date: new Date(record.year, record.month - 1, record.day, epwRecordHour(record.hour), record.minute || 0),
      dryBulbC: record.dryBulbC,
      relativeHumidity: record.relativeHumidity,
      steamEnergyKW,
      adiabaticEnergyKW,
      naturalGasSteamInputKW,
      atmosphericGasHumidifierInputKW,
      annualGasKwh: naturalGasSteamInputKW + atmosphericGasHumidifierInputKW,
      steamCost,
      adiabaticCost,
      gasCost,
      naturalGasGES,
      atmosphericGasHumidifierGES,
      adiabaticGES,
      waterKg,
    }
  })

  const orderedAll = records.map((record) => ({
    ...record,
    date: new Date(record.year, record.month - 1, record.day, epwRecordHour(record.hour), record.minute || 0),
  })).sort((a, b) => a.date - b.date)
  const firstDate = orderedAll[0].date
  const lastDate = orderedAll[orderedAll.length - 1].date

  const operatingCount = hourlyRows.length
  const outdoorTemps = hourlyRows.map((row) => row.dryBulbC)
  const outdoorRhs = hourlyRows.map((row) => row.relativeHumidity)

  const totalSteamKwh = hourlyRows.reduce((sum, row) => sum + row.steamEnergyKW, 0)
  const totalGasKwh = hourlyRows.reduce((sum, row) => sum + row.annualGasKwh, 0)
  const totalHumifogKwh = hourlyRows.reduce((sum, row) => sum + row.adiabaticEnergyKW, 0)
  const totalCost = hourlyRows.reduce((sum, row) => sum + row.adiabaticCost, 0)
  const totalSteamCost = hourlyRows.reduce((sum, row) => sum + row.steamCost, 0)
  const totalNaturalGasGES = hourlyRows.reduce((sum, row) => sum + row.naturalGasGES, 0)
  const totalAtmosphericGasGES = hourlyRows.reduce((sum, row) => sum + row.atmosphericGasHumidifierGES, 0)
  const totalAdiabaticGES = hourlyRows.reduce((sum, row) => sum + row.adiabaticGES, 0)
  const totalWaterKg = hourlyRows.reduce((sum, row) => sum + row.waterKg, 0)
  const hoursBelowZero = hourlyRows.filter((row) => row.dryBulbC < 0).length
  const hoursBelowMinusTen = hourlyRows.filter((row) => row.dryBulbC < -10).length
  const hoursBelowMinusTwenty = hourlyRows.filter((row) => row.dryBulbC < -20).length
  const hoursWithHumidificationRequired = hourlyRows.filter((row) => row.steamEnergyKW > 0).length

  return {
    weatherLocation: records[0]?.weatherLocation || '',
    recordsLoaded: records.length,
    operatingHoursUsed: operatingCount,
    firstDate,
    lastDate,
    averageOutdoorTemp: operatingCount ? outdoorTemps.reduce((sum, value) => sum + value, 0) / operatingCount : 0,
    minOutdoorTemp: operatingCount ? Math.min(...outdoorTemps) : 0,
    maxOutdoorTemp: operatingCount ? Math.max(...outdoorTemps) : 0,
    averageOutdoorRh: operatingCount ? outdoorRhs.reduce((sum, value) => sum + value, 0) / operatingCount : 0,
    annualSteamKwh: totalSteamKwh,
    annualGasKwh: totalGasKwh,
    annualHumifogKwh: totalHumifogKwh,
    annualCost: totalCost,
    annualSavings: totalSteamCost - totalCost,
    annualGhgReduction: Math.max(0, totalNaturalGasGES + totalAtmosphericGasGES - totalAdiabaticGES),
    annualWaterConsumptionKg: totalWaterKg,
    hoursBelowZero,
    hoursBelowMinusTen,
    hoursBelowMinusTwenty,
    hoursWithHumidificationRequired,
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function HesesPrintableReportPage() {
  const reportHtml = typeof window === 'undefined'
    ? ''
    : window.sessionStorage.getItem(HESES_PRINT_REPORT_STORAGE_KEY) || ''
  const [htmlReportUrl, setHtmlReportUrl] = useState('')
  const [pdfReportUrl, setPdfReportUrl] = useState('')
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState('')
  const [localPdfPath, setLocalPdfPath] = useState('')
  const [currentReportId, setCurrentReportId] = useState('')
  const [pdfReportStatus, setPdfReportStatus] = useState('')

  const printCurrentReport = () => {
    if (typeof window === 'undefined') return
    setPdfReportStatus('Ouverture de la fenetre d impression du rapport original...')
    window.focus()
    window.print()
  }

  const openLocalPdfInWindows = () => {
    setPdfReportStatus('Ouverture du fichier PDF dans Windows...')
    fetch('/api/heses-report-open-local-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentReportId }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Impossible douvrir le PDF dans Windows.')
        if (payload.localPdfPath) setLocalPdfPath(payload.localPdfPath)
        setPdfReportStatus('PDF ouvert dans Windows. Utilisez Ctrl+P dans le lecteur PDF externe.')
      })
      .catch((error) => {
        console.error('Erreur ouverture PDF Windows:', error)
        setPdfReportStatus(`Impossible douvrir le PDF dans Windows. ${error.message || ''}`.trim())
      })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.location.search.includes('print=1')) return
    window.history.replaceState(null, '', '/heses-report-print')
  }, [])

  useEffect(() => {
    if (!reportHtml) return undefined

    const htmlUrl = URL.createObjectURL(new Blob([reportHtml], { type: 'text/html;charset=utf-8' }))
    let isCancelled = false

    setHtmlReportUrl(htmlUrl)
    setPdfReportUrl('')
    setPdfDownloadUrl('')
    setLocalPdfPath('')
    setCurrentReportId('')
    setPdfReportStatus('Rapport original en préparation...')

    fetch('/api/heses-report-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: reportHtml,
        title: 'Rapport HESA',
      }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Erreur PDF serveur.')
        return payload
      })
      .then((payload) => {
        if (isCancelled) return
        if (payload.id) setCurrentReportId(payload.id)
        if (payload.htmlUrl) setHtmlReportUrl(payload.htmlUrl)
        if (payload.localPdfPath) setLocalPdfPath(payload.localPdfPath)
        if (payload.pdfReady && payload.pdfUrl) {
          setPdfReportUrl(payload.pdfUrl)
          setPdfDownloadUrl(payload.apiPdfUrl || payload.pdfUrl)
          setPdfReportStatus('PDF Chrome au format original prêt au téléchargement.')
          return null
        }

        setPdfReportStatus('PDF Chrome non disponible. Tentative de rendu visuel navigateur...')
        return createVisualPdfBlobFromReportHtml(reportHtml)
          .then(blobToBase64)
          .then((pdfBase64) => fetch('/api/heses-report-pdf-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: payload.id,
              pdfBase64,
            }),
          }))
          .then(async (uploadResponse) => {
            const uploadPayload = await uploadResponse.json().catch(() => ({}))
            if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'Erreur PDF visuel.')
            if (uploadPayload.id) setCurrentReportId(uploadPayload.id)
            return {
              pdfUrl: uploadPayload.pdfUrl || payload.pdfUrl || '',
              downloadUrl: payload.apiPdfUrl || uploadPayload.pdfUrl || payload.pdfUrl || '',
              localPdfPath: uploadPayload.localPdfPath || payload.localPdfPath || '',
            }
          })
          .catch((error) => {
            console.error('Erreur PDF visuel:', error)
            return {
              pdfUrl: '',
              fallback: true,
              message: payload.pdfError || error.message,
            }
          })
      })
      .then((result) => {
        if (isCancelled || !result) return
        setPdfReportUrl(result.pdfUrl || '')
        setPdfDownloadUrl(result.downloadUrl || result.pdfUrl || '')
        if (result.localPdfPath) setLocalPdfPath(result.localPdfPath)
        setPdfReportStatus(result.fallback
          ? `PDF non disponible au format original. Utilisez le rapport HTML original. ${result.message || ''}`.trim()
          : 'PDF au format visuel original prêt au téléchargement.')
      })
      .catch((error) => {
        console.error('Erreur PDF serveur:', error)
        if (!isCancelled) {
          setPdfReportStatus('PDF serveur non disponible. Téléchargez le rapport original HTML.')
        }
      })

    return () => {
      isCancelled = true
      URL.revokeObjectURL(htmlUrl)
    }
  }, [reportHtml])

  if (!reportHtml) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-slate-900">Rapport HESA non disponible</h1>
          <p className="mt-2 font-semibold text-slate-600">
            Retournez dans HESA et cliquez de nouveau sur Générer rapport PDF.
          </p>
          <button
            type="button"
            onClick={returnToHesesApp}
            className="mt-5 rounded-xl bg-sky-700 px-5 py-3 font-bold text-white hover:bg-sky-800"
          >
            Retour à HESA
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <style>{`
        @page { size: letter; margin: 14mm; }
        body {
          background: #f1f5f9;
        }
        .report-page-content {
          max-width: 1060px;
          margin: 24px auto;
          background: white;
        }
        @media print {
          html, body, #root {
            background: white !important;
          }
          .report-page-actions { display: none !important; }
          .report-page-content {
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .report-page-content .engineering-report {
            margin: 0 auto !important;
            padding: 0 !important;
          }
        }
      `}</style>
      <div className="report-page-actions sticky top-0 z-20 flex flex-wrap items-center justify-center gap-3 bg-slate-950 p-4 shadow-xl">
        <button
          type="button"
          onClick={returnToHesesApp}
          className="rounded-xl bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600"
        >
          Retour à HESA
        </button>
        <button
          type="button"
          onClick={printCurrentReport}
          className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
        >
          Imprimer ce rapport
        </button>
        <button
          type="button"
          onClick={openLocalPdfInWindows}
          className={`rounded-xl px-5 py-3 font-bold text-white ${
            localPdfPath ? 'bg-orange-600 hover:bg-orange-700' : 'pointer-events-none bg-slate-500'
          }`}
        >
          Ouvrir PDF dans Windows
        </button>
        <span className="text-sm font-semibold text-slate-200">
          {pdfReportStatus || 'PDF disponible après génération.'}
        </span>
        {localPdfPath && (
          <span className="w-full text-center text-xs font-semibold text-slate-300">
            Fichier local : {localPdfPath}
          </span>
        )}
      </div>
      <section
        className="report-page-content shadow-xl"
        dangerouslySetInnerHTML={{ __html: reportHtml }}
      />
      {localPdfPath && (
        <aside className="mx-auto mb-8 max-w-5xl rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm font-semibold text-cyan-900">
          <div className="text-lg font-bold">Fichier PDF local prêt</div>
          <div className="mt-2 break-all">{localPdfPath}</div>
          <div className="mt-2">
            Cliquez sur Ouvrir PDF dans Windows, puis utilisez Ctrl+P dans le lecteur PDF externe. Le lecteur PDF intégré peut bloquer l’impression.
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={pdfDownloadUrl || '#'}
              download="HESA_Energy_Analysis_Report.pdf"
              className={`rounded-lg px-4 py-2 font-bold text-white ${
                pdfDownloadUrl ? 'bg-cyan-700 hover:bg-cyan-800' : 'pointer-events-none bg-slate-500'
              }`}
            >
              Télécharger PDF
            </a>
            <a
              href={htmlReportUrl || '#'}
              download="HESA_Energy_Analysis_Report.html"
              className="rounded-lg bg-sky-700 px-4 py-2 font-bold text-white hover:bg-sky-800"
            >
              Télécharger HTML
            </a>
          </div>
        </aside>
      )}
    </main>
  )
}

export default function HVACDashboardVisual() {
  if (typeof window !== 'undefined' && window.location.pathname === '/heses-report-print') {
    return <HesesPrintableReportPage />
  }

  return <HesaMultiSystemApp />
}

function HesaMultiSystemApp() {
  const initialSettings = getInitialProjectSettings()
  const initialLanguage = initialSettings.language || 'fr'
  const [systemControlsLanguage, setSystemControlsLanguage] = useState(initialLanguage)
  const [systems, setSystems] = useState(() => loadMultiSystemState(initialSettings, initialLanguage))
  const [activeSystemId, setActiveSystemId] = useState(() => systems[0]?.id || 'system-1')
  const [showBuildingSummary, setShowBuildingSummary] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [isRenamingSystem, setIsRenamingSystem] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')

  const activeSystem = systems.find((system) => system.id === activeSystemId) || systems[0]
  const systemControlLabels = {
    addSystem: systemControlsLanguage === 'en' ? '+ Add System' : '+ Ajouter un système',
    rename: systemControlsLanguage === 'en' ? 'Rename' : 'Renommer',
    duplicate: systemControlsLanguage === 'en' ? 'Duplicate' : 'Dupliquer',
    delete: systemControlsLanguage === 'en' ? 'Delete' : 'Supprimer',
    buildingSummary: systemControlsLanguage === 'en' ? 'Building Summary' : 'Bilan du bâtiment',
    defaultSystemName: (index) => (systemControlsLanguage === 'en' ? `AHU-${index}` : `UTA-${index}`),
    renamePrompt: systemControlsLanguage === 'en' ? 'AHU name' : 'Nom de l’UTA',
  }

  useEffect(() => {
    if (!activeSystem) return
    try {
      window.localStorage.setItem(HESES_MULTI_SYSTEM_STORAGE_KEY, JSON.stringify(persistableSystems(systems)))
    } catch (error) {
      if (isQuotaExceededStorageError(error)) {
        try {
          // Emergency fallback keeps project settings usable while dropping heavy computed payloads.
          window.localStorage.setItem(HESES_MULTI_SYSTEM_STORAGE_KEY, JSON.stringify(minimalPersistableSystems(systems)))
        } catch {
          // Ignore final failure to avoid blocking app rendering.
        }
      }
    }
  }, [systems, activeSystem])

  const updateActiveSystem = (settings) => {
    setSystems((current) => {
      let changed = false
      const next = current.map((system) => {
      if (system.id !== activeSystem.id) return system
      if (JSON.stringify(system.settings) === JSON.stringify(settings)) return system
      changed = true
      return { ...system, settings }
      })
      return changed ? next : current
    })
  }

  const addSystem = () => {
    if (systems.length >= 6) return
    const id = `system-${Date.now()}`
    const next = {
      id,
      name: systemControlLabels.defaultSystemName(systems.length + 1),
      settings: getInitialProjectSettings(),
    }
    setSystems((current) => [...current, next])
    setActiveSystemId(id)
    setShowBuildingSummary(false)
  }

  const duplicateSystem = () => {
    if (systems.length >= 6 || !activeSystem) return
    const id = `system-${Date.now()}`
    const next = {
      id,
      name: systemControlsLanguage === 'en' ? `${activeSystem.name} copy` : `${activeSystem.name} copie`,
      settings: activeSystem.settings,
    }
    setSystems((current) => [...current, next])
    setActiveSystemId(id)
    setShowBuildingSummary(false)
  }

  const deleteSystem = () => {
    if (systems.length <= 1 || !activeSystem) return
    const remaining = systems.filter((system) => system.id !== activeSystem.id)
    setSystems(remaining)
    setActiveSystemId(remaining[0].id)
    setShowBuildingSummary(false)
  }

  const startRenameSystem = () => {
    if (!activeSystem) return
    setRenameDraft(activeSystem.name)
    setIsRenamingSystem(true)
  }

  const commitRenameSystem = () => {
    if (!activeSystem) return
    const nextName = renameDraft.trim()
    if (!nextName) {
      setIsRenamingSystem(false)
      return
    }
    setSystems((current) => current.map((system) => system.id === activeSystem.id ? { ...system, name: nextName } : system))
    setIsRenamingSystem(false)
  }

  const cancelRenameSystem = () => {
    setIsRenamingSystem(false)
    setRenameDraft(activeSystem?.name || '')
  }

  if (showBuildingSummary) {
    return (
      <BuildingSummary
        systems={systems}
        language={systemControlsLanguage}
        onSelectSystem={(id) => { setActiveSystemId(id); setShowBuildingSummary(false) }}
      />
    )
  }

  if (!activeSystem) return null

  if (!analysisOpen) {
    return (
      <HesesLandingPage
        language={systemControlsLanguage}
        setLanguage={setSystemControlsLanguage}
        onStartAnalysis={() => setAnalysisOpen(true)}
      />
    )
  }

  return (
    <>
      <nav className="sticky top-0 z-50 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur">
        {systems.map((system) => (
          <button
            key={system.id}
            type="button"
            onClick={() => setActiveSystemId(system.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${system.id === activeSystem.id ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {system.name}
          </button>
        ))}
        <button type="button" onClick={addSystem} disabled={systems.length >= 6} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">{systemControlLabels.addSystem}</button>
        {isRenamingSystem ? (
          <>
            <input
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none"
              aria-label={systemControlLabels.renamePrompt}
              autoFocus
            />
            <button type="button" onClick={commitRenameSystem} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white">OK</button>
            <button type="button" onClick={cancelRenameSystem} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">{systemControlsLanguage === 'en' ? 'Cancel' : 'Annuler'}</button>
          </>
        ) : (
          <button type="button" onClick={startRenameSystem} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">{systemControlLabels.rename}</button>
        )}
        <button type="button" onClick={duplicateSystem} disabled={systems.length >= 6} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">{systemControlLabels.duplicate}</button>
        <button type="button" onClick={deleteSystem} disabled={systems.length <= 1} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-40">{systemControlLabels.delete}</button>
        <button type="button" onClick={() => setShowBuildingSummary(true)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{systemControlLabels.buildingSummary}</button>
      </nav>
      <HvacDashboardApp
        key={activeSystem.id}
        showLandingPage={false}
        onStartAnalysis={() => setAnalysisOpen(true)}
        onLanguageChange={setSystemControlsLanguage}
        systemSettings={activeSystem.settings}
        onSettingsChange={updateActiveSystem}
        onAnnualResults={(results) => {
          setSystems((current) => {
            const next = current.map((system) => system.id === activeSystem.id && JSON.stringify(system.results) !== JSON.stringify(results) ? { ...system, results } : system)
            return next.some((system, index) => system !== current[index]) ? next : current
          })
        }}
        onReportSnapshot={(snapshot) => {
          setSystems((current) => {
            const active = current.find((system) => system.id === activeSystem.id)
            if (snapshotSignature(active?.reportSnapshot) === snapshotSignature(snapshot)) return current
            return current.map((system) => system.id === activeSystem.id ? { ...system, reportSnapshot: snapshot } : system)
          })
        }}
        projectSystems={systems}
        activeSystemName={activeSystem.name}
        activeSystemId={activeSystem.id}
      />
    </>
  )
}

function persistableSystems(systems = []) {
  return (systems || []).map((system) => ({
    id: system.id,
    name: system.name,
    settings: system.settings,
    results: system.results,
  }))
}

function minimalPersistableSystems(systems = []) {
  return (systems || []).map((system) => ({
    id: system.id,
    name: system.name,
    settings: system.settings,
  }))
}

function snapshotSignature(snapshot) {
  if (!snapshot) return ''
  const settings = snapshot.settings || {}
  const metrics = snapshot.metrics || {}
  return [
    snapshot.id,
    snapshot.name,
    settings.calculationMethod,
    settings.scheduleMode,
    settings.hourlyWeatherFileName,
    metrics.annualHumidificationHours,
    metrics.correctedHumidificationLoadRaw,
    snapshot.annualComparison?.savingsKwh,
  ].map((value) => String(value ?? '')).join('|')
}

function isQuotaExceededStorageError(error) {
  if (!error) return false
  return error.name === 'QuotaExceededError' || String(error.message || '').toLowerCase().includes('quota')
}

function compactWeatherBins(records = [], targetCount = 96) {
  if (records.length <= targetCount) return records
  const chunkSize = Math.ceil(records.length / targetCount)
  const compacted = []
  for (let start = 0; start < records.length; start += chunkSize) {
    const chunk = records.slice(start, start + chunkSize)
    const hours = chunk.reduce((total, record) => total + Number(record.hours || 1), 0)
    compacted.push({
      tempC: chunk.reduce((total, record) => total + Number(record.tempC || 0), 0) / chunk.length,
      rh: chunk.reduce((total, record) => total + Number(record.rh || 0), 0) / chunk.length,
      hours,
    })
  }
  return compacted
}

function aggregateFreeCoolingComparisonRows(humifogRows = [], steamRows = [], binSizeC = 5) {
  const groups = new Map()
  humifogRows.forEach((humifogRow, index) => {
    const steamRow = steamRows[index] || {}
    const key = Math.floor(Number(humifogRow.tempC || 0) / binSizeC) * binSizeC
    const group = groups.get(key) || { weight: 0, humifog: [], steam: [] }
    const weight = Math.max(0, Number(humifogRow.hours || 0))
    group.weight += weight
    group.humifog.push({ row: humifogRow, weight })
    group.steam.push({ row: steamRow, weight })
    groups.set(key, group)
  })

  const weighted = (entries, selector, weight) => {
    if (!weight) return 0
    return entries.reduce((total, entry) => total + Number(selector(entry.row) || 0) * entry.weight, 0) / weight
  }
  const stateAverage = (entries, selector, weight) => {
    const source = entries.find((entry) => selector(entry.row))?.row
    const state = source ? selector(source) : null
    if (!state || !weight) return null
    return Object.fromEntries(Object.keys(state).map((key) => [
      key,
      weighted(entries, (row) => selector(row)?.[key], weight),
    ]))
  }
  const rowAverage = (entries, weight, tempC) => ({
    tempC,
    hours: weight,
    outdoorAirPercent: weighted(entries, (row) => row.outdoorAirPercent, weight),
    appliedOutdoorAirPercent: weighted(entries, (row) => row.appliedOutdoorAirPercent, weight),
    mixed: stateAverage(entries, (row) => row.mixed, weight),
    inletToHumifog: stateAverage(entries, (row) => row.inletToHumifog, weight),
    afterHumifog: stateAverage(entries, (row) => row.afterHumifog, weight),
  })

  return [...groups.entries()].sort(([left], [right]) => left - right).map(([tempC, group]) => ({
    humifogRow: rowAverage(group.humifog, group.weight, tempC),
    steamRow: rowAverage(group.steam, group.weight, tempC),
  }))
}

function loadMultiSystemState(initialSettings, language = 'fr') {
  if (typeof window !== 'undefined') {
    try {
      const saved = JSON.parse(window.localStorage.getItem(HESES_MULTI_SYSTEM_STORAGE_KEY) || 'null')
      if (Array.isArray(saved) && saved.length > 0) {
        return saved.slice(0, 6).map((system, index) => ({
          id: system.id || `system-${index + 1}`,
          name: system.name || (language === 'en' ? `AHU-${index + 1}` : `UTA-${index + 1}`),
          settings: system.settings || initialSettings,
          results: system.results,
        }))
      }
    } catch {
      // Fall back to the legacy single-system settings.
    }
  }
  return [{ id: 'system-1', name: language === 'en' ? 'AHU-1' : 'UTA-1', settings: initialSettings }]
}

function BuildingSummary({ systems, onSelectSystem, language = 'fr' }) {
  const technologyKeys = [...BASELINE_TECHNOLOGIES, 'humifogSelected']
  const technologyLabels = {
    electricSteam: language === 'en' ? 'Electric steam' : 'Vapeur électrique',
    naturalGasSteam: language === 'en' ? 'Natural gas steam' : 'Vapeur gaz naturel',
    atmosphericGas: language === 'en' ? 'Atmospheric gas' : 'Gaz atmosphérique',
    humifogSelected: language === 'en' ? 'Humifog - Selected Solution' : 'Humifog - solution sélectionnée',
  }
  const humifogLabels = {
    humifogElectric: language === 'en' ? 'Humifog + Electric Reheat' : 'Humifog + réchauffage électrique',
    humifogHeatPump: language === 'en' ? 'Humifog + Air/Water Heat Pump' : 'Humifog + thermopompe Air/Eau',
    humifogFreeCooling: 'Humifog + Free Cooling',
  }
  const resultForTechnology = (system, key) => {
    const results = system.results || {}
    return key === 'humifogSelected'
      ? results[selectedHumifogTechnology(system.reportSnapshot || system)]
      : results[key]
  }
  const buildingTotals = technologyKeys.reduce((totals, key) => {
    totals[key] = systems.reduce((sum, system) => sum + Number(resultForTechnology(system, key)?.annualEnergyKWh || 0), 0)
    return totals
  }, {})

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black">{language === 'en' ? 'Building Summary' : 'Bilan du bâtiment'}</h1>
          <button type="button" onClick={() => onSelectSystem(systems[0].id)} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">{language === 'en' ? 'Back to AHU' : 'Retour aux UTA'}</button>
        </div>
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-bold text-slate-500">{language === 'en' ? 'HVAC systems' : 'Systèmes HVAC'}</div>
          <div className="mt-2 text-4xl font-black">{systems.length} / 6</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {systems.map((system) => (
            <button key={system.id} type="button" onClick={() => onSelectSystem(system.id)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-cyan-400">
              <div className="text-xl font-black">{system.name}</div>
              <div className="mt-2 text-sm text-slate-600">{system.settings?.scheduleMode === '24-7' ? (language === 'en' ? 'BIN / 24-7 hours' : 'Heures BIN / 24-7') : (language === 'en' ? 'Custom hours' : 'Heures personnalisées')}</div>
              <div className="text-sm text-slate-600">{system.settings?.outsideAirCFM || 0} CFM</div>
            </button>
          ))}
        </div>
        <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-black">{language === 'en' ? 'Building energy comparison' : 'Comparaison énergétique du bâtiment'}</h2>
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left"><th className="p-3">{language === 'en' ? 'System' : 'Système'}</th><th className="p-3">{language === 'en' ? 'Selected Humifog' : 'Humifog sélectionné'}</th>{technologyKeys.map((key) => <th key={key} className="p-3 text-right">{technologyLabels[key]}</th>)}</tr></thead>
            <tbody>
              {systems.map((system) => (
                <tr key={system.id} className="border-b border-slate-100"><td className="p-3 font-bold">{system.name}</td><td className="p-3">{humifogLabels[selectedHumifogTechnology(system.reportSnapshot || system)]}</td>{technologyKeys.map((key) => { const result = resultForTechnology(system, key); return <td key={key} className="p-3 text-right">{result ? `${Math.round(result.annualEnergyKWh).toLocaleString()} kWh` : (language === 'en' ? 'Pending' : 'En attente')}</td> })}</tr>
              ))}
              <tr className="bg-slate-50 font-black"><td className="p-3">{language === 'en' ? 'TOTAL BUILDING' : 'TOTAL BÂTIMENT'}</td><td className="p-3">-</td>{technologyKeys.map((key) => <td key={key} className="p-3 text-right">{buildingTotals[key].toLocaleString()} kWh</td>)}</tr>
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}

function getInitialProjectProfile() {
  const fallback = {
    name: '',
    owner: '',
    engineer: '',
  }

  if (typeof window === 'undefined') return fallback

  try {
    const savedProfile = window.localStorage.getItem(HESES_PROJECT_PROFILE_STORAGE_KEY)
    if (!savedProfile) return fallback

    return {
      ...fallback,
      ...JSON.parse(savedProfile),
    }
  } catch {
    return fallback
  }
}

function getInitialProjectSettings() {
  if (typeof window === 'undefined') return {}

  try {
    const savedSettings = window.localStorage.getItem(HESES_PROJECT_SETTINGS_STORAGE_KEY)
    return savedSettings ? JSON.parse(savedSettings) : {}
  } catch {
    return {}
  }
}

function finiteSetting(settings, key, fallback) {
  const value = Number(settings?.[key])
  return Number.isFinite(value) ? value : fallback
}

function booleanSetting(settings, key, fallback) {
  return typeof settings?.[key] === 'boolean' ? settings[key] : fallback
}

function getInitialVentilationMode(language, savedType = '') {
  if (typeof window === 'undefined') return ventilationModes[language][0]

  const params = new URLSearchParams(window.location.search)
  const requestedMode = String(params.get('mode') || window.location.hash || window.location.pathname)
    .toLowerCase()

  if (
    requestedMode.includes('free-cooling') ||
    requestedMode.includes('freecooling') ||
    requestedMode.includes('humifog')
  ) {
    return ventilationModes[language].find((mode) => mode.type === 'free-cooling-evaporative') || ventilationModes[language][0]
  }

  if (savedType) {
    const savedMode = ventilationModes[language].find((mode) => mode.type === savedType)
    if (savedMode) return savedMode
  }

  return ventilationModes[language][0]
}

function updateVentilationModeUrl(mode) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (mode?.type === 'free-cooling-evaporative') {
    url.pathname = FREE_COOLING_ROUTE
    url.searchParams.set('mode', 'free-cooling')
    url.hash = 'free-cooling'
  } else {
    url.pathname = '/'
    url.searchParams.delete('mode')
    url.hash = ''
  }
  window.history.replaceState({}, '', url)
}

const REPORT_FR_REPLACEMENTS = [
  ['HVAC ENERGY OPTIMIZATION REPORT', 'RAPPORT D’OPTIMISATION ÉNERGÉTIQUE HVAC'],
  ['Professional HVAC Engineering Report', 'Rapport professionnel d’ingénierie HVAC'],
  ['HVAC Engineering Report', 'Rapport d’ingénierie HVAC'],
  ['Technical Energy Analysis', 'Analyse énergétique technique'],
  ['Project Profile', 'Profil du projet'],
  ['Selected System', 'Système sélectionné'],
  ['Project Scope', 'Portée du projet'],
  ['100% outdoor air system report. Free Cooling / OA optimization sections are not included for this configuration.', 'Rapport système 100 % air extérieur. Les sections Free Cooling / optimisation OA ne sont pas incluses pour cette configuration.'],
  ['Free Cooling + Humifog optimization report for a mixed air AHU.', 'Rapport d’optimisation Free Cooling + Humifog pour une CTA à air mélangé.'],
  ['Generated by HVAC Analyzer', 'Généré par HVAC Analyzer'],
  ['Prepared for engineering review', 'Préparé pour revue d’ingénierie'],
  ['Airflow Mode', 'Mode de débit d’air'],
  ['Instantaneous Power', 'Puissance instantanée'],
  ['Annual Estimate', 'Estimation annuelle'],
  ['Electric Steam Humidifier', 'Humidificateur vapeur électrique'],
  ['Natural Gas Steam Boiler', 'Bouilloire vapeur gaz naturel'],
  ['Atmospheric Gas Humidifier', 'Humidificateur gaz atmosphérique'],
  ['Humifog Adiabatic System', 'Système adiabatique Humifog'],
  ['Annual Operating Cost', 'Coût annuel d’exploitation'],
  ['Annual Savings vs Electric Steam', 'Économies annuelles vs vapeur électrique'],
  ['Free Cooling sections not applicable', 'Sections Free Cooling non applicables'],
  ['EXECUTIVE SUMMARY', 'SOMMAIRE EXÉCUTIF'],
  ['TABLE OF CONTENTS', 'TABLE DES MATIÈRES'],
  ['SECTION 1 - DESIGN CONDITIONS', 'SECTION 1 - CONDITIONS DE CONCEPTION'],
  ['SECTION 2 - HVAC SYSTEM SCHEMATIC', 'SECTION 2 - SCHÉMA DU SYSTÈME HVAC'],
  ['SECTION 3 - PSYCHROMETRIC ANALYSIS', 'SECTION 3 - ANALYSE PSYCHROMÉTRIQUE'],
  ['SECTION 4 - PSYCHROMETRIC CALCULATIONS', 'SECTION 4 - CALCULS PSYCHROMÉTRIQUES'],
  ['SECTION 5 - BIN WEATHER ANALYSIS', 'SECTION 5 - ANALYSE MÉTÉO BIN'],
  ['SECTION 6 - OA / RA OPTIMIZATION', 'SECTION 6 - OPTIMISATION OA / RA'],
  ['SECTION 7 - FREE COOLING ANALYSIS', 'SECTION 7 - ANALYSE FREE COOLING'],
  ['SECTION 8 - ENERGY RECOVERY ANALYSIS', 'SECTION 8 - ANALYSE DE RÉCUPÉRATION D’ÉNERGIE'],
  ['SECTION 9 - ENERGY ANALYSIS', 'SECTION 9 - ANALYSE ÉNERGÉTIQUE'],
  ['SECTION 10 - ECONOMIC ANALYSIS', 'SECTION 10 - ANALYSE ÉCONOMIQUE'],
  ['SECTION 11 - GREENHOUSE GAS ANALYSIS', 'SECTION 11 - ANALYSE DES GAZ À EFFET DE SERRE'],
  ['SECTION 12 - GRAPHS', 'SECTION 12 - GRAPHIQUES'],
  ['SECTION 13 - ENGINEERING RECOMMENDATION', 'SECTION 13 - RECOMMANDATION D’INGÉNIERIE'],
  ['APPENDIX A - PSYCHROMETRIC EQUATIONS', 'ANNEXE A - ÉQUATIONS PSYCHROMÉTRIQUES'],
  ['APPENDIX B - BIN WEATHER DATA', 'ANNEXE B - DONNÉES MÉTÉO BIN'],
  ['APPENDIX C - PDF DATA VALIDATION', 'ANNEXE C - VALIDATION DES DONNÉES PDF'],
  ['APPENDIX D - CALCULATION ASSUMPTIONS', 'ANNEXE D - HYPOTHÈSES DE CALCUL'],
  ['APPENDIX E - ENGINEERING NOTES', 'ANNEXE E - NOTES D’INGÉNIERIE'],
  ['DESIGN CONDITIONS', 'CONDITIONS DE CONCEPTION'],
  ['HVAC SYSTEM SCHEMATIC', 'SCHÉMA DU SYSTÈME HVAC'],
  ['PSYCHROMETRIC ANALYSIS', 'ANALYSE PSYCHROMÉTRIQUE'],
  ['PSYCHROMETRIC CALCULATIONS', 'CALCULS PSYCHROMÉTRIQUES'],
  ['BIN WEATHER ANALYSIS', 'ANALYSE MÉTÉO BIN'],
  ['OA / RA OPTIMIZATION', 'OPTIMISATION OA / RA'],
  ['FREE COOLING ANALYSIS', 'ANALYSE FREE COOLING'],
  ['ENERGY RECOVERY ANALYSIS', 'ANALYSE DE RÉCUPÉRATION D’ÉNERGIE'],
  ['ENERGY ANALYSIS', 'ANALYSE ÉNERGÉTIQUE'],
  ['ECONOMIC ANALYSIS', 'ANALYSE ÉCONOMIQUE'],
  ['GREENHOUSE GAS ANALYSIS', 'ANALYSE DES GAZ À EFFET DE SERRE'],
  ['GRAPHS', 'GRAPHIQUES'],
  ['ENGINEERING RECOMMENDATION', 'RECOMMANDATION D’INGÉNIERIE'],
  ['Design Conditions', 'Conditions de conception'],
  ['HVAC System Schematic', 'Schéma du système HVAC'],
  ['Psychrometric Analysis', 'Analyse psychrométrique'],
  ['Psychrometric Calculations', 'Calculs psychrométriques'],
  ['BIN Weather Analysis', 'Analyse météo BIN'],
  ['OA / RA Optimization', 'Optimisation OA / RA'],
  ['Free Cooling Analysis', 'Analyse Free Cooling'],
  ['Energy Recovery Analysis', 'Analyse de récupération d’énergie'],
  ['Energy Analysis', 'Analyse énergétique'],
  ['Economic Analysis', 'Analyse économique'],
  ['Greenhouse Gas Analysis', 'Analyse des gaz à effet de serre'],
  ['Engineering Recommendation', 'Recommandation d’ingénierie'],
  ['Psychrometric Equations', 'Équations psychrométriques'],
  ['BIN Weather Data', 'Données météo BIN'],
  ['Calculation Assumptions', 'Hypothèses de calcul'],
  ['Engineering Notes', 'Notes d’ingénierie'],
  ['Project Overview', 'Aperçu du projet'],
  ['System Description', 'Description du système'],
  ['Summary of Results', 'Sommaire des résultats'],
  ['Project Name', 'Nom du projet'],
  ['Project Location', 'Emplacement du projet'],
  ['Prepared For', 'Préparé pour'],
  ['Prepared By', 'Préparé par'],
  ['Engineer / Representative', 'Ingénieur / représentant'],
  ['Software Version', 'Version du logiciel'],
  ['System Type', 'Type de système'],
  ['Selected Technology', 'Technologie sélectionnée'],
  ['Energy Recovery Type', 'Type de récupération d’énergie'],
  ['Heating Type', 'Type de chauffage'],
  ['Annual Energy Savings', 'Économies d’énergie annuelles'],
  ['Annual Cost Savings', 'Économies annuelles de coût'],
  ['GHG Reduction', 'Réduction des GES'],
  ['Estimated Payback', 'Retour sur investissement estimé'],
  ['Recommended Solution', 'Solution recommandée'],
  ['Outdoor Design Conditions', 'Conditions extérieures de conception'],
  ['Room Design Conditions', 'Conditions de pièce'],
  ['System Design Parameters', 'Paramètres de conception du système'],
  ['Airflow', 'Débit d’air'],
  ['Recovery Type', 'Type de récupération'],
  ['Recovery Efficiency', 'Efficacité de récupération'],
  ['Humidification Technology', 'Technologie d’humidification'],
  ['Heating Technology', 'Technologie de chauffage'],
  ['Airflow Paths', 'Parcours des flux d’air'],
  ['Component Sequence', 'Séquence des composants'],
  ['Design Temperatures', 'Températures de conception'],
  ['Selected system image', 'Image du système sélectionné'],
  ['AHU 3D Image', 'Image CTA'],
  ['Point', 'Point'],
  ['Air State', 'État de l’air'],
  ['Temperature', 'Température'],
  ['Relative Humidity', 'Humidité relative'],
  ['Humidity Ratio', 'Ratio d’humidité'],
  ['Enthalpy', 'Enthalpie'],
  ['Wet Bulb', 'Bulbe humide'],
  ['Dew Point', 'Point de rosée'],
  ['Specific Volume', 'Volume spécifique'],
  ['Actual Numerical Values', 'Valeurs numériques calculées'],
  ['Outdoor Air Temperature', 'Température air extérieur'],
  ['Return Air Temperature', 'Température air de retour'],
  ['Mixed Air Temperature', 'Température air mélangé'],
  ['Mixed Air Humidity Ratio', 'Ratio d’humidité air mélangé'],
  ['Mixed Air Enthalpy', 'Enthalpie air mélangé'],
  ['After Recovery Temperature', 'Température après récupération'],
  ['Mixed Air Wet Bulb Reference', 'Référence bulbe humide air mélangé'],
  ['After Humifog Temperature', 'Température après Humifog'],
  ['After Heating Temperature', 'Température après chauffage'],
  ['Calculated Mixed Air Temperature', 'Température d’air mélangé calculée'],
  ['Active Mixed Air Temperature', 'Température d’air mélangé active'],
  ['Mixed Air Override', 'Validation de l’air mélangé'],
  ['Weather BIN Summary', 'Sommaire météo BIN'],
  ['Complete BIN Table', 'Tableau BIN complet'],
  ['Hours', 'Heures'],
  ['Humifog Load', 'Charge Humifog'],
  ['Heating Load', 'Charge de chauffage'],
  ['Reheat Load', 'Charge de réchauffage'],
  ['Total Energy', 'Énergie totale'],
  ['Optimization Matrix', 'Matrice d’optimisation'],
  ['Automatically Determined Optimal Point', 'Point optimal calculé automatiquement'],
  ['Optimal OA %', 'OA optimal %'],
  ['Optimal RA %', 'RA optimal %'],
  ['Minimum Annual Energy', 'Énergie annuelle minimale'],
  ['Annual Cost', 'Coût annuel'],
  ['ASHRAE Compliance', 'Conformité ASHRAE'],
  ['Strategy', 'Stratégie'],
  ['Average OA %', 'OA moyen %'],
  ['Average Mixed Air Temperature', 'Température moyenne d’air mélangé'],
  ['Annual Energy', 'Énergie annuelle'],
  ['Traditional Strategy', 'Scénario vapeur'],
  ['Humifog Optimization Strategy', 'Scénario Humifog'],
  ['Recovery Device', 'Équipement de récupération'],
  ['Recovered Energy', 'Énergie récupérée'],
  ['Annual Savings', 'Économies annuelles'],
  ['Comparison with No Recovery', 'Comparaison sans récupération'],
  ['No Recovery', 'Aucune récupération'],
  ['Selected Recovery', 'Récupération sélectionnée'],
  ['Metric', 'Paramètre'],
  ['Traditional Strategy', 'Scénario vapeur'],
  ['Humifog Optimization', 'Scénario Humifog'],
  ['Annual Heating Energy', 'Énergie annuelle de chauffage'],
  ['Annual Humidification Energy', 'Énergie annuelle d’humidification'],
  ['Annual Reheat Energy', 'Énergie annuelle de réchauffage'],
  ['Annual Total Energy', 'Énergie annuelle totale'],
  ['Utility Rate - Electricity', 'Tarif électricité'],
  ['Utility Rate - Natural Gas', 'Tarif gaz naturel'],
  ['Annual Energy Cost - Traditional', 'Coût annuel - scénario vapeur'],
  ['Annual Energy Cost - Humifog', 'Coût annuel - Humifog'],
  ['Annual Energy Cost - Electric Steam', 'Coût annuel - Vapeur électrique'],
  ['Annual Energy Cost - Natural Gas Steam', 'Coût annuel - Vapeur gaz naturel'],
  ['Annual Energy Cost - Atmospheric Gas Humidifier', 'Coût annuel - Humidificateur gaz atmosphérique'],
  ['Simple Payback', 'Retour simple'],
  ['10-Year Savings', 'Économies sur 10 ans'],
  ['20-Year Savings', 'Économies sur 20 ans'],
  ['Installed Cost and ROI Inputs', 'Coûts installés et données ROI'],
  ['Installed Cost', 'Coût installé'],
  ['Annual Energy Cost', 'Coût annuel'],
  ['Incremental Cost', 'Coût additionnel'],
  ['System', 'Système'],
  ['Reference', 'Référence'],
  ['Immediate', 'Immédiat'],
  ['Not economical', 'Non rentable'],
  [' years', ' ans'],
  ['Electric steam humidifier', 'Humidificateur électrique vapeur'],
  ['Natural gas steam boiler', 'Bouilloire vapeur gaz naturel'],
  ['Atmospheric gas humidifier', 'Humidificateur gaz atmosphérique'],
  ['Humifog optimized + Free Cooling', 'Humifog optimisé + Free Cooling'],
  ['Humifog adiabatic', 'Humifog adiabatique'],
  ['Steam System Emissions', 'Émissions système vapeur'],
  ['Humifog System Emissions', 'Émissions système Humifog'],
  ['Emission Reduction', 'Réduction des émissions'],
  ['Equivalent Trees', 'Équivalent arbres'],
  ['Equivalent CO2 Reduction', 'Réduction équivalente CO2'],
  ['Advantages', 'Avantages'],
  ['Limitations', 'Limites'],
  ['Recommended Configuration', 'Configuration recommandée'],
  ['Expected Annual Savings', 'Économies annuelles prévues'],
  ['Expected Payback', 'Retour prévu'],
  ['Final Recommendation', 'Recommandation finale'],
  ['Outdoor air', 'Air extérieur'],
  ['Return air', 'Air de retour'],
  ['Mixed air', 'Air mélangé'],
  ['After recovery', 'Après récupération'],
  ['After Humifog', 'Après Humifog'],
  ['After heating', 'Après chauffage'],
  ['Outdoor Air', 'Air extérieur'],
  ['Return Air', 'Air de retour'],
  ['Mixed Air', 'Air mélangé'],
  ['After Energy Recovery', 'Après récupération d’énergie'],
  ['After Heating', 'Après chauffage'],
  ['Room Conditions', 'Conditions de pièce'],
  ['Room', 'Pièce'],
  ['Dry Bulb', 'Température sèche'],
  ['Heating Energy', 'Énergie de chauffage'],
  ['Humifog Pump Energy', 'Énergie pompe Humifog'],
  ['This report compares steam humidification with Humifog adiabatic humidification for an HVAC air handling unit using the room condition as the design target.', 'Ce rapport compare l’humidification vapeur avec l’humidification adiabatique Humifog pour une centrale de traitement d’air, en utilisant la condition de la pièce comme cible de conception.'],
  ['Humifog adiabatic humidification with optimized outdoor air control', 'Humidification adiabatique Humifog avec contrôle optimisé de l’air extérieur'],
  ['Humifog adiabatic humidification on the selected AHU configuration', 'Humidification adiabatique Humifog selon la configuration UTA sélectionnée'],
  ['This report documents the selected 100% outdoor air AHU configuration. Free Cooling and OA / RA optimization results are intentionally excluded because the system does not operate as a mixed air economizer.', 'Ce rapport documente la configuration CTA 100 % air extérieur sélectionnée. Les résultats Free Cooling et optimisation OA / RA sont exclus volontairement, car ce système ne fonctionne pas comme un économiseur à air mélangé.'],
  ['Outdoor air psychrometric state is calculated from dry bulb temperature and relative humidity.', 'L’état psychrométrique de l’air extérieur est calculé à partir de la température sèche et de l’humidité relative.'],
  ['Air extérieur psychrometric state is calculated from dry bulb temperature and relative humidity.', 'L’état psychrométrique de l’air extérieur est calculé à partir de la température sèche et de l’humidité relative.'],
  ['Recovery: Trec = Tinlet + recovery_efficiency x available temperature difference', 'Récupération : Trec = Tentrée + efficacité_récupération x différence de température disponible'],
  ['Humifog: adiabatic outlet state is calculated from the actual entering air condition.', 'Humifog : l’état de sortie adiabatique est calculé à partir des conditions réelles de l’air entrant.'],
  ['Humifog: adiabatic outlet state is recalculated from the actual entering air condition.', 'Humifog : l’état de sortie adiabatique est recalculé à partir de la condition réelle d’entrée d’air.'],
  ['Steam Load: lb/hr = 4.5 x CFM x Deltaw', 'Charge vapeur : lb/h = 4,5 × CFM × DeltaW'],
  ['Steam Load: lb/hr = 4.5 x CFM x DeltaW', 'Charge vapeur : lb/h = 4,5 × CFM × DeltaW'],
  ['Air extérieur Température', 'Température de l’air extérieur'],
  ['After Recovery Température', 'Température après récupération'],
  ['Après Humifog Température', 'Température après Humifog'],
  ['Après chauffage Température', 'Température après chauffage'],
  ['Atmospheric Gas Humidifier Emissions', 'Émissions humidificateur gaz atmosphérique'],
  ['The selected 100% outdoor air system should be evaluated as a dedicated outside air AHU. Outdoor air is fixed at 100%, so OA / RA optimization and Free Cooling economizer comparisons are not applicable to this project configuration.', 'Le système 100 % air extérieur sélectionné doit être évalué comme une CTA dédiée à l’air extérieur. L’air extérieur est fixé à 100 %, donc l’optimisation OA / RA et les comparaisons d’économiseur Free Cooling ne s’appliquent pas à cette configuration de projet.'],
  ['Clear 100% outdoor air operating sequence', 'Séquence d’opération 100 % air extérieur claire'],
  ['No mixed air or return air assumption in the report', 'Aucune hypothèse d’air mélangé ou d’air de retour dans le rapport'],
  ['Humifog and heating results are aligned with the selected AHU configuration', 'Les résultats Humifog et chauffage sont alignés avec la configuration CTA sélectionnée'],
  ['Energy recovery and humidification technologies remain documented for design review', 'Les technologies de récupération d’énergie et d’humidification restent documentées pour la revue de conception'],
  ['Free Cooling savings are not calculated because the selected system is not a mixed air economizer', 'Les économies Free Cooling ne sont pas calculées parce que le système sélectionné n’est pas un économiseur à air mélangé'],
  ['Final equipment selection must be coordinated with manufacturer data', 'La sélection finale des équipements doit être coordonnée avec les données du manufacturier'],
  ['Proceed with the selected 100% outdoor air AHU configuration and exclude Free Cooling OA/RA optimization from this project report.', 'Procéder avec la configuration CTA 100 % air extérieur sélectionnée et exclure l’optimisation Free Cooling OA/RA de ce rapport de projet.'],
  ['Humifog outlet temperature is recalculated after evaporative cooling.', 'La température de sortie Humifog est recalculée après refroidissement évaporatif.'],
  ['Free Cooling operation is not included for the selected 100% outdoor air report scope.', 'L’opération Free Cooling n’est pas incluse dans la portée du rapport 100 % air extérieur sélectionné.'],
  ['Humifog optimization at minimum required OA', 'Optimisation Humifog au minimum d’air extérieur requis'],
  ['OA minimum maintained at', 'Minimum OA maintenu à'],
  ['Final code compliance to be verified by the engineer of record.', 'La conformité finale au code doit être vérifiée par l’ingénieur responsable.'],
  ['Case', 'Cas'],
  ['Graph 1 - Energy vs OA %', 'Graphique 1 - Énergie vs OA %'],
  ['Graph 2 - Mixed Air Temperature vs OA %', 'Graphique 2 - Température d’air mélangé vs OA %'],
  ['Graph 3 - Annual Savings by BIN', 'Graphique 3 - Économies annuelles par BIN'],
  ['Graph 4 - OA / Temperature Heat Map', 'Graphique 4 - Carte thermique OA / température'],
  ['Graph 5 - Annual Energy Breakdown', 'Graphique 5 - Répartition de l’énergie annuelle'],
  ['The Humifog optimized strategy recalculates evaporative cooling, then adjusts outdoor air or reheat to meet the target condition.', 'La stratégie Humifog optimisée recalcule le refroidissement évaporatif, puis ajuste l’air extérieur ou le réchauffage pour atteindre la condition cible.'],
  ['Reduced outdoor air load during cold weather operation', 'Réduction de la charge d’air extérieur en période froide'],
  ['Lower annual heating and humidification energy', 'Réduction de l’énergie annuelle de chauffage et d’humidification'],
  ['Lower operating cost with optimized OA/RA control', 'Réduction du coût d’exploitation avec contrôle OA/RA optimisé'],
  ['Improved integration with heat recovery and mixed air AHU operation', 'Meilleure intégration avec la récupération de chaleur et l’opération CTA à air mélangé'],
  ['Final ventilation minimum must be confirmed against applicable code and occupancy', 'Le minimum de ventilation doit être confirmé selon le code applicable et l’occupation'],
  ['Installed cost is required for final simple payback', 'Le coût installé est requis pour calculer le retour simple final'],
  ['BIN data should be validated against project-specific weather files', 'Les données BIN doivent être validées avec les fichiers météo propres au projet'],
  ['Field mixed air measurements should be used when available', 'Les mesures d’air mélangé sur site doivent être utilisées lorsqu’elles sont disponibles'],
  ['Proceed with Humifog optimized outdoor air control at', 'Procéder avec le contrôle optimisé Humifog de l’air extérieur à'],
  ['subject to final design review.', 'sous réserve d’une révision finale de conception.'],
  ['Saturation vapor pressure is calculated from dry bulb temperature.', 'La pression de vapeur saturante est calculée à partir de la température sèche.'],
  ['Humidity ratio: W = 0.62198 x Pw / (P - Pw)', 'Ratio d’humidité : W = 0.62198 x Pw / (P - Pw)'],
  ['Relative humidity: RH = Pw / Pws', 'Humidité relative : HR = Pw / Pws'],
  ['Enthalpy: h = 1.006 x T + W x (2501 + 1.86 x T)', 'Enthalpie : h = 1.006 x T + W x (2501 + 1.86 x T)'],
  ['Wet bulb and dew point are calculated from psychrometric correlations.', 'Le bulbe humide et le point de rosée sont calculés avec des corrélations psychrométriques.'],
  ['Specific volume: v = Rda x Tdb,K x (1 + 1.6078W) / P', 'Volume spécifique : v = Rda x Tdb,K x (1 + 1.6078W) / P'],
  ['This audit lists the HESA software inputs and calculated values used directly by this PDF report.', 'Cet audit liste les intrants du logiciel HESA et les valeurs calculées utilisées directement par ce rapport PDF.'],
  ['Project location', 'Emplacement du projet'],
  ['Report mode', 'Mode du rapport'],
  ['100% Outdoor Air', '100 % air extérieur'],
  ['Ventilation mode selected', 'Mode de ventilation sélectionné'],
  ['Airflow entered in software', 'Débit entré dans le logiciel'],
  ['Minimum OA entered in software', 'OA minimum entré dans le logiciel'],
  ['OA entered in software', 'OA entré dans le logiciel'],
  ['RA available from software input', 'RA disponible selon l’intrant logiciel'],
  ['RA shown in report', 'RA affiché dans le rapport'],
  ['Outdoor design dry bulb used by PDF', 'Température sèche extérieure utilisée par le PDF'],
  ['Room dry bulb entered in software', 'Température sèche de pièce entrée dans le logiciel'],
  ['Room RH entered in software', 'HR de pièce entrée dans le logiciel'],
  ['Recovery type selected', 'Type de récupération sélectionné'],
  ['Recovery efficiency selected', 'Efficacité de récupération sélectionnée'],
  ['Reheat / preheat method selected', 'Mode de réchauffage / préchauffage sélectionné'],
  ['Electricity rate entered', 'Tarif électrique entré'],
  ['Natural gas rate entered', 'Tarif gaz naturel entré'],
  ['Annual humidification hours used', 'Heures annuelles d’humidification utilisées'],
  ['Calculated average Steam OA in report', 'OA vapeur moyen calculé dans le rapport'],
  ['Calculated average Humifog OA in report', 'OA Humifog moyen calculé dans le rapport'],
  ['Humifog reheat method used by PDF', 'Mode de réchauffage Humifog utilisé par le PDF'],
  ['Humifog reheat energy used by PDF', 'Énergie de réchauffage Humifog utilisée par le PDF'],
  ['Atmospheric pressure is assumed at 101.325 kPa.', 'La pression atmosphérique est supposée à 101.325 kPa.'],
  ['Room design condition is used as the return air condition.', 'La condition de conception de la pièce est utilisée comme condition d’air de retour.'],
  ['Humifog outlet temperature uses the mixed air wet bulb reference.', 'La température de sortie Humifog utilise le bulbe humide de l’air mélangé comme référence.'],
  ['Heating load uses Q = 1.08 x CFM x DeltaT for IP airflow basis.', 'La charge de chauffage utilise Q = 1.08 x CFM x DeltaT sur une base de débit IP.'],
  ['No Recovery comparison is estimated by adding recovered annual energy back to the selected recovery case.', 'La comparaison sans récupération est estimée en ajoutant l’énergie annuelle récupérée au cas de récupération sélectionné.'],
  ['Payback requires installed project cost and is therefore shown as a project input requirement.', 'Le retour sur investissement exige le coût installé et est donc présenté comme une donnée de projet requise.'],
  ['This report is intended for preliminary HVAC engineering comparison and energy optimization.', 'Ce rapport est destiné à une comparaison préliminaire d’ingénierie HVAC et à l’optimisation énergétique.'],
  ['Final equipment selection must be coordinated with manufacturer data and project specifications.', 'La sélection finale des équipements doit être coordonnée avec les données du manufacturier et les spécifications du projet.'],
  ['Ventilation rates, humidification loads, and energy recovery performance must be validated by the engineer of record.', 'Les débits de ventilation, les charges d’humidification et la performance de récupération d’énergie doivent être validés par l’ingénieur responsable.'],
  ['Free cooling operation must respect minimum outdoor air requirements and freeze protection controls.', 'L’opération free cooling doit respecter les exigences minimales d’air extérieur et les contrôles de protection contre le gel.'],
  ['Requires installed project cost', 'Coût installé requis'],
  ['No Recovery', 'Aucune récupération'],
  ['Heating', 'Chauffage'],
  ['Humidification', 'Humidification'],
  ['Reheat', 'Réchauffage'],
  ['Measured value used', 'Valeur mesurée utilisée'],
  ['Calculated value used', 'Valeur calculée utilisée'],
  ['HESA Energy Engineering Platform', 'Plateforme HESA d’analyse énergétique HVAC'],
  ['Prepared for technical review, energy comparison and preliminary decision support', 'Préparé pour revue technique, comparaison énergétique et aide à la décision préliminaire'],
  ['Document status: Preliminary engineering report', 'Statut du document : rapport d’ingénierie préliminaire'],
  ['Revision: HESA generated', 'Révision : générée par HESA'],
  ['Units:', 'Unités :'],
  ['Engineering Use Notice', 'Avis d’utilisation en ingénierie'],
  ['Results are generated from the displayed HESA inputs and are intended for preliminary HVAC comparison.', 'Les résultats sont générés à partir des données HESA affichées et servent à une comparaison HVAC préliminaire.'],
  ['Final equipment sizing, code compliance and stamped design remain by the engineer of record.', 'Le dimensionnement final des équipements, la conformité au code et les plans scellés demeurent sous la responsabilité de l’ingénieur responsable.'],
  ['Recommended annual cost basis', 'Base recommandée selon le coût annuel'],
  ['Modeled airflow', 'Débit d’air modélisé'],
  ['Report scope', 'Portée du rapport'],
  ['Free Cooling comparison', 'Comparaison Free Cooling'],
  ['100% OA comparison', 'Comparaison 100 % air extérieur'],
  ['Lowest Annual Cost', 'Coût annuel le plus bas'],
  ['Lowest Annual Cost Option', 'Option au coût annuel le plus bas'],
  ['The comparison is based only on values available in the HESA project dataset.', 'La comparaison utilise seulement les valeurs disponibles dans les données du projet HESA.'],
  ['Missing project-specific values are intentionally shown as project inputs or engineering assumptions rather than inferred values.', 'Les valeurs propres au projet qui sont manquantes sont indiquées comme intrants ou hypothèses d’ingénierie plutôt que d’être inventées.'],
  ['Steam + economizer', 'Vapeur + économiseur'],
  ['Electric Steam', 'Vapeur électrique'],
  ['Natural Gas Steam', 'Vapeur gaz naturel'],
  ['Atmospheric Gas', 'Gaz atmosphérique'],
  ['Pump + ', 'Pompe + '],
  ['Pump + heat pump reheat', 'Pompe + réchauffage thermopompe'],
  ['Humifog Reheat', 'Réchauffage Humifog'],
  ['Annual Humifog Reheat', 'Réchauffage annuel Humifog'],
  ['Humifog Reheat Detail', 'Détail du réchauffage Humifog'],
  ['Reheat applies', 'Réchauffage applicable'],
  ['Selected reheat method', 'Mode de réchauffage sélectionné'],
  ['Annual reheat thermal energy', 'Énergie thermique annuelle de réchauffage'],
  ['Applied reheat energy by selected method', 'Énergie de réchauffage appliquée selon la méthode sélectionnée'],
  ['Heat pump COP equivalent', 'Équivalent COP thermopompe'],
  ['Annual reheat electric energy', 'Énergie électrique annuelle de réchauffage'],
  ['Heat pump COP', 'COP thermopompe'],
  ['Maximum BIN reheat input', 'Puissance maximale de réchauffage BIN'],
  ['Critical BIN', 'BIN critique'],
  ['Not required', 'Non requis'],
  ['Yes', 'Oui'],
  ['No', 'Non'],
  ['boiler efficiency', 'rendement chaudière'],
  ['gas humidifier efficiency', 'rendement humidificateur gaz'],
  ['Calculation Basis', 'Base de calcul'],
  ['Annual Total Energy', 'Énergie annuelle totale'],
  ['Relative to Electric Steam', 'Comparaison avec vapeur électrique'],
  ['Steam Scenario', 'Scénario vapeur'],
  ['Humifog Scenario', 'Scénario Humifog'],
  ['Calculated Steam OA', 'OA vapeur calculé'],
  ['Calculated Humifog OA', 'OA Humifog calculé'],
  ['Selected Minimum OA', 'OA minimum sélectionné'],
  ['Selected Minimum OA %', 'OA minimum sélectionné %'],
  ['Selected RA Available %', 'RA disponible sélectionné %'],
  ['Calculated Average Humifog OA %', 'OA moyen Humifog calculé %'],
  ['Prepared by', 'Préparé par'],
  ['Reviewed by', 'Révisé par'],
  ['Engineer of record', 'Ingénieur responsable'],
  ['HESA - Humidification Energy System Analysis', 'HESA - Analyse énergétique des systèmes d’humidification'],
  ['Project report', 'Rapport de projet'],
  ['Auto', 'Auto'],
]

function localizeReportHtml(html, language) {
  const isFrench = String(language || '').toLowerCase().startsWith('fr')
  if (!isFrench) return html

  const replacements = [...REPORT_FR_REPLACEMENTS].sort((a, b) => b[0].length - a[0].length)

  const localized = replacements.reduce(
    (localized, [english, french]) => localized.split(english).join(french),
    html
  )

  const frenchFinalCleanup = [
    ['Nonnm', 'Nom'],
    ['Nonnn', 'Non'],
    ['Nonntes', 'Notes'],
    ['Comparaison Free Cooling', 'Comparaison en mode refroidissement gratuit'],
    ['This report compares steam humidification with Humifog adiabatique humidification for an HVAC air handling unit using the room condition as the design target.', 'Ce rapport compare l’humidification à vapeur avec l’humidification adiabatique Humifog pour une unité de traitement d’air, en utilisant les conditions de la pièce comme cible de conception.'],
    ['This report compares steam humidification with Humifog adiabatic humidification for an HVAC air handling unit using the room condition as the design target.', 'Ce rapport compare l’humidification à vapeur avec l’humidification adiabatique Humifog pour une unité de traitement d’air, en utilisant les conditions de la pièce comme cible de conception.'],
    ['Free Cooling', 'refroidissement gratuit'],
    ['steam humidification', 'humidification à vapeur'],
    ['Humifog adiabatique humidification', 'humidification adiabatique Humifog'],
    ['Humifog adiabatic humidification', 'humidification adiabatique Humifog'],
    ['HVAC air handling unit', 'unité de traitement d’air'],
    ['air handling unit', 'unité de traitement d’air'],
    ['AHU', 'UTA'],
    ['room condition', 'conditions de la pièce'],
    ['design target', 'cible de conception'],
    ['This report compares', 'Ce rapport compare'],
    ['Project Overview', 'Aperçu du projet'],
    ['Project overview', 'Aperçu du projet'],
    ['System Description', 'Description du système'],
    ['System description', 'Description du système'],
    ['Humifog adiabatique humidification on the selected AHU configuration', 'Humidification adiabatique Humifog selon la configuration UTA sélectionnée'],
    ['Humifog adiabatic humidification on the selected AHU configuration', 'Humidification adiabatique Humifog selon la configuration UTA sélectionnée'],
    ['selected AHU configuration', 'configuration UTA sélectionnée'],
    ['After Thermal Wheel', 'Après roue thermique'],
    ['After Recovery', 'Après récupération'],
    ['Temperature', 'Température'],
    ['Steam Load', 'Charge vapeur'],
    ['Efficiency', 'Rendement'],
    ['Cost', 'Coût'],
    ['Emissions', 'Émissions'],
    ['deg F', '°F'],
    ['deg C', '°C'],
    ['h/day', 'h/jour'],
    ['h/week', 'h/semaine'],
    ['h/year', 'h/an'],
    ['trees/year', 'arbres/an'],
    ['metric tonnes CO2e/year', 'tonnes métriques CO2e/an'],
    ['tCO2e/year', 'tCO2e/an'],
    ['Loaded file', 'Fichier chargé'],
    ['Weather source', 'Source météo'],
    ['Data source', 'Source de données'],
    ['Organization', 'Organisation'],
    ['File type', 'Type de fichier'],
    ['official', 'officiel'],
    ['Énergie annuelle Cost - Vapeur électrique', 'Coût annuel - Vapeur électrique'],
    ['Énergie annuelle Cost - Vapeur gaz naturel', 'Coût annuel - Vapeur gaz naturel'],
    ['Énergie annuelle Cost - Humidificateur gaz atmosphérique', 'Coût annuel - Humidificateur gaz atmosphérique'],
    ['Énergie annuelle Cost - Humifog', 'Coût annuel - Humifog'],
    ['Humidificateur gaz atmosphérique Efficiency', 'Rendement de l’humidificateur gaz atmosphérique'],
    ['Steam Boiler Efficiency', 'Rendement de la chaudière vapeur'],
    [' Efficiency', ' Rendement'],
    [' Cost', ' Coût'],
  ]

  const cleaned = frenchFinalCleanup.reduce(
    (value, [from, to]) => value.split(from).join(to),
    localized
  )

  return repairFrenchEncoding(cleaned)
}

function repairFrenchEncoding(text) {
  if (typeof text !== 'string') return text

  const replacements = [
    ['\u00c3\u00a9', '\u00e9'], ['\u00c3\u00a8', '\u00e8'], ['\u00c3\u00aa', '\u00ea'],
    ['\u00c3\u00a0', '\u00e0'], ['\u00c3\u00a2', '\u00e2'], ['\u00c3\u00a7', '\u00e7'],
    ['\u00c3\u00b4', '\u00f4'], ['\u00c3\u00bb', '\u00fb'], ['\u00c3\u00bc', '\u00fc'],
    ['\u00c3\u2030', '\u00c9'], ['\u00c3\u20ac', '\u00c0'], ['\u00c3\u2021', '\u00c7'],
    ['\u00e2\u20ac\u2122', '\u2019'], ['\u00e2\u20ac\u0153', '\u201c'], ['\u00e2\u20ac\u009d', '\u201d'],
    ['\u00e2\u20ac\u201c', '\u2013'], ['\u00e2\u20ac\u201d', '\u2014'], ['\u00e2\u20ac\u00a2', '\u2022'],
    ['\u00e2\u20ac\u00a6', '\u2026'], ['\u00c2\u00b0C', '\u00b0C'], ['\u00c2\u00b0F', '\u00b0F'],
    ['\u00c2\u00b0', '\u00b0'], ['\u00c2\u00b3', '\u00b3'], ['\u00c2\u00b2', '\u00b2'], ['\u00c2\u00a0', ' '],
  ]

  return replacements.reduce(
    (cleaned, [bad, good]) => cleaned.split(bad).join(good),
    text
  )
}

function repairDisplayEncodingInDom(root = document.body) {
  if (!root || typeof document === 'undefined' || typeof window === 'undefined') return

  const walker = document.createTreeWalker(
    root,
    window.NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parentName = node.parentElement?.tagName
        if (parentName === 'SCRIPT' || parentName === 'STYLE') {
          return window.NodeFilter.FILTER_REJECT
        }
        return window.NodeFilter.FILTER_ACCEPT
      },
    }
  )

  const textNodes = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode)
  }

  textNodes.forEach((node) => {
    const repaired = repairFrenchEncoding(node.nodeValue || '')
    if (repaired !== node.nodeValue) {
      node.nodeValue = repaired
    }
  })

  root.querySelectorAll('[placeholder], [title], [alt], [aria-label]').forEach((element) => {
    ;['placeholder', 'title', 'alt', 'aria-label'].forEach((attribute) => {
      const value = element.getAttribute(attribute)
      if (!value) return
      const repaired = repairFrenchEncoding(value)
      if (repaired !== value) {
        element.setAttribute(attribute, repaired)
      }
    })
  })
}

function normalizePdfText(text) {
  return repairFrenchEncoding(String(text || ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function wrapPdfLine(text, maxLength = 96) {
  const words = normalizePdfText(text).split(' ').filter(Boolean)
  const lines = []
  let current = ''

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxLength && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  })

  if (current) lines.push(current)
  return lines
}

function collectReportPdfLines(reportHtml) {
  const parser = new DOMParser()
  const document = parser.parseFromString(reportHtml, 'text/html')
  document.querySelectorAll('script, style, button, .print-actions').forEach((node) => node.remove())

  const lines = []
  const contentRoot = document.querySelector('.engineering-report') || document.body

  const pushWrapped = (text, options = {}) => {
    const clean = normalizePdfText(text)
    if (!clean) return
    lines.push({
      text: clean,
      size: options.size || 10,
      gapBefore: options.gapBefore || 0,
      bold: Boolean(options.bold),
    })
  }

  const visit = (node) => {
    if (node.nodeType !== 1) return
    const tag = node.tagName.toLowerCase()

    if (tag === 'h1') {
      pushWrapped(node.textContent, { size: 18, bold: true, gapBefore: 8 })
      return
    }

    if (tag === 'h2') {
      pushWrapped(node.textContent, { size: 14, bold: true, gapBefore: 8 })
      return
    }

    if (tag === 'h3') {
      pushWrapped(node.textContent, { size: 11, bold: true, gapBefore: 5 })
      return
    }

    if (tag === 'tr') {
      const cells = Array.from(node.children)
        .filter((child) => ['TH', 'TD'].includes(child.tagName))
        .map((child) => normalizePdfText(child.textContent))
        .filter(Boolean)
      if (cells.length) pushWrapped(cells.join(' | '), { size: 8.5 })
      return
    }

    if (tag === 'p' || tag === 'li') {
      pushWrapped(node.textContent, { size: 9.5 })
      return
    }

    Array.from(node.children).forEach(visit)
  }

  visit(contentRoot)
  return lines.length ? lines : [{ text: normalizePdfText(contentRoot.textContent), size: 10 }]
}

function stringToUtf16BeHex(text) {
  let hex = 'FEFF'
  for (let index = 0; index < text.length; index += 1) {
    hex += text.charCodeAt(index).toString(16).padStart(4, '0').toUpperCase()
  }
  return hex
}

function createPdfBlobFromReportHtml(reportHtml, title = 'HESA Report') {
  const encoder = new TextEncoder()
  const sourceLines = collectReportPdfLines(reportHtml)
  const pages = []
  let currentPage = []
  let y = 742

  sourceLines.forEach((line) => {
    const wrappedLines = wrapPdfLine(line.text, line.size <= 8.5 ? 112 : 96)
    wrappedLines.forEach((wrapped, lineIndex) => {
      const size = line.size
      const lineHeight = Math.max(11, size + 3)
      y -= lineIndex === 0 ? line.gapBefore : 0
      if (y < 54) {
        pages.push(currentPage)
        currentPage = []
        y = 742
      }
      currentPage.push({ text: wrapped, size, y, bold: line.bold && lineIndex === 0 })
      y -= lineHeight
    })
  })

  if (currentPage.length) pages.push(currentPage)
  if (!pages.length) pages.push([{ text: title, size: 18, y: 742, bold: true }])

  const objects = []
  const addObject = (body) => {
    objects.push(body)
    return objects.length
  }

  const catalogId = addObject('')
  const pagesId = addObject('')
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  const pageIds = []

  pages.forEach((pageLines, pageIndex) => {
    const content = [
      '0.2 w',
      'BT /F2 8 Tf 54 28 Td <' + stringToUtf16BeHex(`HESA - ${pageIndex + 1}/${pages.length}`) + '> Tj ET',
      ...pageLines.map((line) => {
        const font = line.bold ? 'F2' : 'F1'
        return `BT /${font} ${line.size} Tf 54 ${line.y.toFixed(1)} Td <${stringToUtf16BeHex(line.text)}> Tj ET`
      }),
    ].join('\n')
    const contentBytes = encoder.encode(content).length
    const contentId = addObject(`<< /Length ${contentBytes} >>\nstream\n${content}\nendstream`)
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    pageIds.push(pageId)
  })

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(encoder.encode(pdf).length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = encoder.encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([encoder.encode(pdf)], { type: 'application/pdf' })
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob)
  window.location.href = url
}

function bytesFromDataUrl(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function renderHtmlSliceToJpeg({ reportHtml, offsetY, viewportWidth, viewportHeight, totalHeight }) {
  const parser = new DOMParser()
  const parsedDocument = parser.parseFromString(reportHtml, 'text/html')
  parsedDocument.querySelectorAll('.print-actions, script').forEach((node) => node.remove())

  const styles = Array.from(parsedDocument.querySelectorAll('style'))
    .map((style) => style.textContent || '')
    .join('\n')
  const reportMarkup = parsedDocument.querySelector('.engineering-report')?.outerHTML || parsedDocument.body.innerHTML
  const xhtml = `
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${viewportWidth}px;height:${viewportHeight}px;overflow:hidden;background:white;">
      <style>
        ${styles}
        body { margin: 0; background: white; }
        .engineering-report { margin: 0 auto !important; padding: 0 !important; box-sizing: border-box; }
      </style>
      <div style="width:${viewportWidth}px;transform:translateY(-${offsetY}px);transform-origin:top left;">
        ${reportMarkup}
      </div>
    </div>`
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${viewportWidth}" height="${viewportHeight}" viewBox="0 0 ${viewportWidth} ${viewportHeight}">
      <foreignObject x="0" y="0" width="${viewportWidth}" height="${Math.max(viewportHeight, totalHeight)}">
        ${xhtml}
      </foreignObject>
    </svg>`
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = viewportWidth
    canvas.height = viewportHeight
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

async function measureReportHtml(reportHtml) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '1060px'
  iframe.style.height = '1200px'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  try {
    const iframeDocument = iframe.contentDocument
    iframeDocument.open()
    iframeDocument.write(reportHtml)
    iframeDocument.close()

    await new Promise((resolve) => {
      iframe.onload = resolve
      setTimeout(resolve, 700)
    })

    const images = Array.from(iframeDocument.images || [])
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve()
      return new Promise((resolve) => {
        image.onload = resolve
        image.onerror = resolve
      })
    }))

    const reportElement = iframeDocument.querySelector('.engineering-report') || iframeDocument.body
    return {
      width: Math.ceil(reportElement.scrollWidth || 1060),
      height: Math.ceil(reportElement.scrollHeight || iframeDocument.body.scrollHeight || 1200),
    }
  } finally {
    iframe.remove()
  }
}

function createImagePdfBlob(jpegDataUrls) {
  const encoder = new TextEncoder()
  const chunks = []
  const offsets = [0]
  let byteLength = 0

  const append = (chunk) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk
    chunks.push(bytes)
    byteLength += bytes.length
  }

  const objects = []
  const addObject = (bodyChunks) => {
    objects.push(Array.isArray(bodyChunks) ? bodyChunks : [bodyChunks])
    return objects.length
  }

  const catalogId = addObject('')
  const pagesId = addObject('')
  const pageIds = []

  jpegDataUrls.forEach((dataUrl, index) => {
    const imageBytes = bytesFromDataUrl(dataUrl)
    const imageId = addObject([
      `<< /Type /XObject /Subtype /Image /Width 1060 /Height 1372 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      imageBytes,
      '\nendstream',
    ])
    const content = `q\n612 0 0 792 0 0 cm\n/Im${index + 1} Do\nQ`
    const contentBytes = encoder.encode(content)
    const contentId = addObject(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`)
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    pageIds.push(pageId)
  })

  objects[catalogId - 1] = [`<< /Type /Catalog /Pages ${pagesId} 0 R >>`]
  objects[pagesId - 1] = [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`]

  append('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  objects.forEach((bodyChunks, index) => {
    offsets.push(byteLength)
    append(`${index + 1} 0 obj\n`)
    bodyChunks.forEach(append)
    append('\nendobj\n')
  })

  const xrefOffset = byteLength
  append(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)
  offsets.slice(1).forEach((offset) => {
    append(`${String(offset).padStart(10, '0')} 00000 n \n`)
  })
  append(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  return new Blob(chunks, { type: 'application/pdf' })
}

async function createVisualPdfBlobFromReportHtml(reportHtml) {
  const measured = await measureReportHtml(reportHtml)
  const viewportWidth = 1060
  const viewportHeight = Math.round(viewportWidth * 792 / 612)
  const totalHeight = Math.max(viewportHeight, measured.height)
  const pageCount = Math.max(1, Math.ceil(totalHeight / viewportHeight))
  const jpegDataUrls = []

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    jpegDataUrls.push(await renderHtmlSliceToJpeg({
      reportHtml,
      offsetY: pageIndex * viewportHeight,
      viewportWidth,
      viewportHeight,
      totalHeight,
    }))
  }

  return createImagePdfBlob(jpegDataUrls)
}

const monthLabels = {
  fr: ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
}

const translations = {
  fr: {
    title: 'HVAC Humidification Analyzer',
    subtitle: 'Calculs ASHRAE réalistes - vapeur électrique atmosphérique',
    generatePDF: 'Générer rapport PDF',
    climateConditions: 'Conditions climatiques régionales',
    climateDescription: 'Sélection ASHRAE des conditions climatiques',
    hvacRegions: 'Régions HVAC',
    heatRecovery: 'Systèmes de récupération de chaleur',
    heatRecoveryDescription: 'Sélection d\'un système de récupération d\'énergie CVAC',
    combinedRecovery: 'Une seule récupération',
    hvacParameters: 'Paramètres HVAC',
    reheatSystem: 'Mode préchauffage / chauffage',
    reheatDescription: 'La source de préchauffage influence directement la consommation énergétique',
    reheatHVAC: 'Préchauffage HVAC',
    naturalGasBoiler: 'Bouilloire vapeur gaz naturel',
    roomTemperature: 'Température pièce',
    relativeHumidity: 'Humidité relative',
    supplyAirTemperature: 'Température d\'air d\'alimentation',
    beforeHumifogTemperature: 'Température avant Humifog',
    afterHumifogTemperature: 'Température après Humifog',
    outsideAirFlow: 'Débit air extérieur',
    heatPumpCOP: 'COP thermopompe',
    thermalWheel: 'Roue thermique',
    electricity: 'Électricité',
    naturalGasCost: 'Coût gaz naturel',
    boilerEfficiency: 'Rendement chaudière',
    correctedHumidificationLoad: 'Charge humidification corrigée',
    steamConsumption: 'Consommation vapeur électrique réelle',
    adiabaticCooling: 'Refroidissement adiabatique',
    eliminatedGHG: 'GES éliminés',
    totalAdiabaticHP: 'Atomisation HP totale',
    airOutlet: 'Air sortie atomisation',
    energyComparison: 'Tableau comparatif énergétique',
    parameter: 'Paramètre',
    electricSteam: 'Vapeur électrique',
    naturalGasBoilerShort: 'Bouilloire vapeur gaz naturel',
    atmosphericGasHumidifier: 'Humidificateur gaz atmosph.',
    atmosphericGasHumidifierSettings: 'Paramètres humidificateur gaz atmosphérique',
    atmosphericGasHumidifierEfficiencyLabel: 'Rendement humidificateur gaz',
    adiabaticHP: 'Atomisation HP',
    humidificationLoad: 'Charge humidification',
    humidificationPower: 'Puissance humidification',
    grossReheat: 'Réchauffe brute',
    adiabaticCoolingShort: 'Refroidissement adiabatique',
    reheatMode: 'Mode de réchauffe HP',
    selectedRecoveries: 'Récupération sélectionnée',
    airWaterHeatPump: 'Thermopompe air/eau',
    annualCost: 'Coût annuel',
    energyHistory: 'Historique énergétique',
    energySavings: 'Économie énergétique',
    psychrometricChart: 'Charte psychrométrique HVAC',
    psychrometricDescription: 'Température sèche | Humidité absolue | Air alimentation | Zone occupée',
    realTime: 'Temps réel',
    outsideAir: 'Air extérieur',
    afterWheel: 'Après roue',
    afterHeatingCoil: 'Après serpentin',
    afterHumifog: 'Après Humifog',
    atomization: 'Atomisation',
    zone: 'Zone',
    supplyAir: 'Air d\'alimentation',
    absoluteHumidity: 'Humidité absolue',
    indoorEnthalpy: 'Enthalpie intérieure',
    outdoorEnthalpy: 'Enthalpie extérieure',
    binHoursAnalysis: 'Analyse des heures BIN',
    binHoursDescription: 'Répartition annuelle des températures extérieures - Méthode ASHRAE',
    binHours: 'BIN Hours',
    climateCity: 'Ville climatique',
    designTemperature: 'Température de conception',
    binTemperature: 'Température BIN',
    annualHours: 'Heures annuelles',
    correctedRecoveryLoad: 'Énergie vapeur après récupération',
    adiabaticLoad: 'Énergie électrique adiabatique',
    annualHeatingHours: 'Heures chauffage annuel',
    dominantTemperature: 'Température dominante',
    energyReduction: 'Réduction énergétique',
    globalPerformance: 'Performance globale',
    winter: 'hiver',
    summer: 'été',
    summerHumidity: 'Humidité été',
    efficiency: 'Efficacité',
    sensibleEfficiency: 'Efficacité sensible',
    latentEfficiency: 'Efficacité latente',
    designRecoveryEfficiency: 'Efficacité de récupération de conception',
    systemTotal: 'Total système',
    airBeforeReheat: 'Air avant réchauffe',
    reportNotFound: 'Rapport introuvable',
    allowPopups: 'Veuillez autoriser les fenêtres popup',
    pdfError: 'Erreur génération rapport PDF',
    reportTitle: 'Rapport HVAC Enersol',
    ventilationMode: 'Mode de ventilation',
    ventilationModeDescription: 'Impact direct sur la charge de débit d\'air extérieur',
    ventilationModeLabel: 'Mode actif',
    systemDiagram: 'Schéma du système sélectionné',
    outsideAirFraction: 'Fraction air extérieur',
    economizerSetpoint: 'Point de consigne économiseur',
    economizerSetpointDesc: 'Température de bascule - économiseur actif si T_ext < consigne',
    economizerActive: 'Économiseur ACTIF',
    economizerInactive: 'Économiseur INACTIF',
    economizerStatus: 'Statut économiseur',
    economizerNote: 'T_ext actuelle',
    metric: 'Métrique',
    imperial: 'Impérial',
    economizerBinAnalysis: 'Économiseur HVAC',
    economizerBinDesc: 'Fraction d\'air extérieur requise à chaque température BIN pour atteindre la consigne',
    oaPercent: '% AE',
    oaFlow: 'Débit AE',
    economizerTotalHours: 'Heures économiseur actif',
    economizerAvgOA: 'Débit OA moyen',
    economizerOAReduction: 'Réduction débit OA',
    economizerPotential: 'Potentiel récupération',
    economizerCard: 'Économiseur HVAC',
    economizerCardDesc: 'Calcul dynamique selon les heures BIN',
    evaporativeLeavingAir: 'Air sortie évaporatif',
    wetBulbEstimate: 'Bulbe humide estimé',
    evaporativeHours: 'Heures évaporatives',
    annualCoolingSavings: 'Économies refroidissement',
    economizerMixTarget: 'Température de consigne économiseur',
    economizerHoursLabel: 'Heures économiseur',
    economizerAvgOutsideAir: 'Air extérieur moyen',
    economizerOAReductionLabel: 'Réduction air extérieur',
    perYear: 'h/an',
    operatingSchedule: 'Plan d exploitation',
    operationMode24_7: 'Heures BIN complètes / 24/7',
    operationModeOffice: 'Horaire bureau',
    operationModeCustom: 'Horaire personnalisé',
    startTime: 'Heure de début',
    endTime: 'Heure de fin',
    operatingDays: 'Jours d exploitation',
    mondayToFriday: 'Lundi à vendredi',
    mondayToSaturday: 'Lundi à samedi',
    sevenDaysWeek: '7 jours/semaine',
    customDays: 'Personnalisé',
    originalBinHours: 'Heures BIN originales',
    effectiveBinHours: 'Heures BIN effectives',
    dailyOperatingHours: 'Heures d exploitation par jour',
    weeklyOperatingHours: 'Heures d exploitation par semaine',
    annualOperatingHours: 'Heures d exploitation annuelles',
    scheduleFactor: 'Facteur d exploitation',
    actualAnnualPercentage: 'Pourcentage annuel réel',
    calculationMode: 'Mode de calcul',
    methodSelection: 'Méthode de calcul',
    binHoursMethod: 'Méthode heures BIN',
    hourlyWeatherMethod: 'Simulation météo horaire 8760',
    hourlyWeatherPlaceholder: 'La simulation horaire charge automatiquement le fichier EPW intégré pour [ville] lorsque disponible. Un fichier EPW personnalisé peut remplacer ce fichier en mode avancé.',
    optionalHourlyWeatherFileLabel: 'Fichier météo EPW personnalisé optionnel',
    chooseFile: 'Choisir un fichier',
    noFileChosen: 'Aucun fichier choisi',
    weatherSource: 'Source météo',
    customUploadedWeatherFile: 'Fichier météo téléchargé personnalisé',
    builtInWeatherFile: 'Fichier météo intégré',
    noBuiltInWeatherAvailable: 'Le fichier météo horaire intégré pour cette ville est introuvable. HESA continue avec la méthode des heures BIN.',
    builtInWeatherLoadFailed: 'Le fichier météo horaire intégré pour cette ville est introuvable. HESA continue avec la méthode des heures BIN.',
    hourlyWeatherFileLabel: 'Fichier météo horaire',
    loadedFile: 'Fichier chargé',
    scheduleNote: 'HESA utilise les heures BIN annuelles. En mode BIN complet, les heures BIN originales sont utilisées. En mode horaire personnalisé, les heures BIN sont ajustées selon l horaire sélectionné. Le filtrage exact heure par heure nécessite un fichier météo horaire 8760.',
    mon: 'Lun',
    tue: 'Mar',
    wed: 'Mer',
    thu: 'Jeu',
    fri: 'Ven',
    sat: 'Sam',
    sun: 'Dim',
    schOA: 'OA damper',
    schMix: 'Mélange FC',
    schFilter: 'Filtres',
    schWheel: 'ERW wheel',
    schAtomization: 'Humifog',
    schHeatPump: 'Coil HP',
    schRecovery: 'Coil HP',
    schReheat: 'Coil HP',
    schSupply: 'SA ->',
    schFan: 'Fan',
  },
  en: {
    title: 'HESA',
    subtitle: 'Humidification Energy System Analysis',
    generatePDF: 'Generate PDF Report',
    climateConditions: 'Regional Climate Conditions',
    climateDescription: 'ASHRAE climate conditions selection',
    hvacRegions: 'HVAC Regions',
    heatRecovery: 'Heat Recovery Systems',
    heatRecoveryDescription: 'Single HVAC energy recovery system selection',
    combinedRecovery: 'Single recovery',
    hvacParameters: 'HVAC Parameters',
    reheatSystem: 'Preheat / Heating Mode',
    reheatDescription: 'Preheat source directly influences energy consumption',
    reheatHVAC: 'HVAC Preheat',
    naturalGasBoiler: 'Natural Gas Steam Boiler',
    roomTemperature: 'Room Temperature',
    relativeHumidity: 'Relative Humidity',
    supplyAirTemperature: 'Supply Air Temperature',
    beforeHumifogTemperature: 'Temperature Before Humifog',
    afterHumifogTemperature: 'Temperature After Humifog',
    outsideAirFlow: 'Outside Air Flow',
    heatPumpCOP: 'Heat Pump COP',
    thermalWheel: 'Thermal Wheel',
    electricity: 'Electricity',
    naturalGasCost: 'Natural Gas Cost',
    boilerEfficiency: 'Boiler Efficiency',
    correctedHumidificationLoad: 'Corrected Humidification Load',
    steamConsumption: 'Actual Electric Steam Consumption',
    adiabaticCooling: 'Adiabatic Cooling',
    eliminatedGHG: 'Eliminated GHG',
    totalAdiabaticHP: 'Total Adiabatic HP',
    airOutlet: 'Atomization air outlet',
    energyComparison: 'Energy Comparison Table',
    parameter: 'Parameter',
    electricSteam: 'Electric Steam',
    naturalGasBoilerShort: 'Natural Gas Steam Boiler',
    atmosphericGasHumidifier: 'Atmospheric Gas Humidifier',
    atmosphericGasHumidifierSettings: 'Atmospheric Gas Humidifier Settings',
    atmosphericGasHumidifierEfficiencyLabel: 'Gas humidifier efficiency',
    adiabaticHP: 'Adiabatic HP',
    humidificationLoad: 'Humidification Load',
    humidificationPower: 'Humidification Power',
    grossReheat: 'Gross Reheat',
    adiabaticCoolingShort: 'Adiabatic Cooling',
    reheatMode: 'HP Reheat Mode',
    selectedRecoveries: 'Selected Recovery',
    airWaterHeatPump: 'Air/Water Heat Pump',
    annualCost: 'Annual Cost',
    energyHistory: 'Energy History',
    energySavings: 'Energy Savings',
    psychrometricChart: 'HVAC Psychrometric Chart',
    psychrometricDescription: 'Dry temperature | Absolute humidity | Supply air | Occupied zone',
    realTime: 'Real Time',
    outsideAir: 'Outside Air',
    afterWheel: 'After Wheel',
    afterHeatingCoil: 'After Heating Coil',
    afterHumifog: 'After Humifog',
    atomization: 'Atomization',
    zone: 'Zone',
    supplyAir: 'Supply Air',
    absoluteHumidity: 'Absolute Humidity',
    indoorEnthalpy: 'Indoor Enthalpy',
    outdoorEnthalpy: 'Outdoor Enthalpy',
    binHoursAnalysis: 'BIN Hours Analysis',
    binHoursDescription: 'Annual outdoor temperature distribution - ASHRAE Method',
    binHours: 'BIN Hours',
    climateCity: 'Climate City',
    designTemperature: 'Design Temperature',
    binTemperature: 'BIN Temperature',
    annualHours: 'Annual Hours',
    correctedRecoveryLoad: 'Steam Energy After Recovery',
    adiabaticLoad: 'Adiabatic Electric Energy',
    annualHeatingHours: 'Annual Heating Hours',
    dominantTemperature: 'Dominant Temperature',
    energyReduction: 'Energy Reduction',
    globalPerformance: 'Global Performance',
    winter: 'winter',
    summer: 'summer',
    summerHumidity: 'Summer humidity',
    efficiency: 'Efficiency',
    sensibleEfficiency: 'Sensible efficiency',
    latentEfficiency: 'Latent efficiency',
    designRecoveryEfficiency: 'Design recovery efficiency',
    systemTotal: 'System total',
    airBeforeReheat: 'Air before reheat',
    reportNotFound: 'Report not found',
    allowPopups: 'Please allow popup windows',
    pdfError: 'PDF generation error',
    reportTitle: 'HVAC Enersol Report',
    ventilationMode: 'Ventilation Mode',
    ventilationModeDescription: 'Direct impact on outside air flow load',
    ventilationModeLabel: 'Active mode',
    systemDiagram: 'Selected system diagram',
    outsideAirFraction: 'Outside air fraction',
    economizerSetpoint: 'Economizer Setpoint',
    economizerSetpointDesc: 'Changeover temperature - economizer active when T_out < setpoint',
    economizerActive: 'Economizer ACTIVE',
    economizerInactive: 'Economizer INACTIVE',
    economizerStatus: 'Economizer Status',
    economizerNote: 'Current T_out',
    metric: 'Metric',
    imperial: 'Imperial',
    economizerBinAnalysis: 'HVAC Economizer',
    economizerBinDesc: 'Outside air fraction required at each BIN temperature to reach the setpoint',
    oaPercent: 'OA %',
    oaFlow: 'OA Flow',
    economizerTotalHours: 'Economizer active hours',
    economizerAvgOA: 'Average OA flow',
    economizerOAReduction: 'OA flow reduction',
    economizerPotential: 'Recovery potential',
    economizerCard: 'HVAC Economizer',
    economizerCardDesc: 'Dynamic calculation based on BIN hours',
    evaporativeLeavingAir: 'Evaporative leaving air',
    wetBulbEstimate: 'Estimated wet bulb',
    evaporativeHours: 'Evaporative hours',
    annualCoolingSavings: 'Cooling savings',
    economizerMixTarget: 'Economizer setpoint temperature',
    economizerHoursLabel: 'Economizer hours',
    economizerAvgOutsideAir: 'Average outside air',
    economizerOAReductionLabel: 'Outside air reduction',
    originalBinHours: 'Original BIN hours',
    effectiveBinHours: 'Effective BIN hours',
    perYear: 'h/yr',
    operatingSchedule: 'Operating schedule',
    startTime: 'Start time',
    endTime: 'End time',
    operatingDays: 'Operating days',
    mondayToFriday: 'Monday to Friday',
    mondayToSaturday: 'Monday to Saturday',
    sevenDaysWeek: '7 days/week',
    customDays: 'Custom',
    dailyOperatingHours: 'Operating hours per day',
    weeklyOperatingHours: 'Operating hours per week',
    annualOperatingHours: 'Annual operating hours',
    scheduleFactor: 'Operating factor',
    actualAnnualPercentage: 'Actual annual percentage',
    scheduleNote: 'HESA uses annual BIN hours. In full BIN mode, original BIN hours are used. In custom schedule mode, BIN hours are adjusted to the selected schedule. Exact hour-by-hour filtering requires an 8760 hourly weather file.',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
    calculationMode: 'Calculation mode',
    methodSelection: 'Calculation method',
    binHoursMethod: 'BIN hours method',
    hourlyWeatherMethod: 'Hourly weather simulation 8760',
    hourlyWeatherPlaceholder: 'Hourly weather simulation automatically loads the built-in Montréal EPW file when available. An advanced custom EPW upload can override it.',
    optionalHourlyWeatherFileLabel: 'Optional custom EPW weather file',
    chooseFile: 'Choose File',
    noFileChosen: 'No file chosen',
    weatherSource: 'Weather source',
    customUploadedWeatherFile: 'Custom uploaded weather file',
    builtInWeatherFile: 'Built-in weather file',
    noBuiltInWeatherAvailable: 'Built-in hourly weather file for this city was not found. HESA is continuing with the BIN hours method.',
    builtInWeatherLoadFailed: 'Built-in hourly weather file for this city was not found. HESA is continuing with the BIN hours method.',
    hourlyWeatherFileLabel: 'Hourly weather file',
    loadedFile: 'Loaded file',
    schOA: 'Volet OA',
    schFilter: 'Filters',
    schWheel: 'Roue ERW',
    schAtomization: 'Humifog',
    schHeatPump: 'Coil HP',
    schRecovery: 'Coil HP',
    schReheat: 'Coil HP',
    schSupply: 'SA ->',
    schFan: 'Fan',
  }
}

const heatRecoverySystems = {
  fr: [
    { nom: 'Aucun', efficacite: 0, efficaciteSensible: 0, efficaciteLatente: 0, type: 'Aucune récupération de chaleur', couleur: 'slate', noRecovery: true, latentCapable: false },
    { nom: 'Roue thermique', efficacite: 78, efficaciteSensible: 78, efficaciteLatente: 70, type: 'Efficacité de récupération de conception', couleur: 'cyan', latentCapable: true },
    { nom: 'Échangeur à débit croisé', efficacite: 62, efficaciteSensible: 62, efficaciteLatente: 0, type: 'Efficacité de récupération de conception', couleur: 'sky', latentCapable: false },
    { nom: 'Échangeur à cassettes sensible', efficacite: 88, efficaciteSensible: 88, efficaciteLatente: 0, type: 'Efficacité de récupération de conception', couleur: 'indigo', latentCapable: false },
    { nom: 'Échangeur à cassettes enthalpique', efficacite: 92, efficaciteSensible: 92, efficaciteLatente: 75, type: 'Efficacité de récupération de conception', couleur: 'violet', latentCapable: true },
    { nom: 'Boucle glycolée', efficacite: 48, efficaciteSensible: 48, efficaciteLatente: 0, type: 'Efficacité de récupération de conception', couleur: 'slate', latentCapable: false },
  ],
  en: [
    { nom: 'None', efficacite: 0, efficaciteSensible: 0, efficaciteLatente: 0, type: 'No heat recovery', couleur: 'slate', noRecovery: true, latentCapable: false },
    { nom: 'Thermal Wheel', efficacite: 78, efficaciteSensible: 78, efficaciteLatente: 70, type: 'Design recovery efficiency', couleur: 'cyan', latentCapable: true },
    { nom: 'Cross-flow Exchanger', efficacite: 62, efficaciteSensible: 62, efficaciteLatente: 0, type: 'Design recovery efficiency', couleur: 'sky', latentCapable: false },
    { nom: 'Sensible Cassette Exchanger', efficacite: 88, efficaciteSensible: 88, efficaciteLatente: 0, type: 'Design recovery efficiency', couleur: 'indigo', latentCapable: false },
    { nom: 'Enthalpy Cassette Exchanger', efficacite: 92, efficaciteSensible: 92, efficaciteLatente: 75, type: 'Design recovery efficiency', couleur: 'violet', latentCapable: true },
    { nom: 'Glycol Loop', efficacite: 48, efficaciteSensible: 48, efficaciteLatente: 0, type: 'Design recovery efficiency', couleur: 'slate', latentCapable: false },
  ]
}

const reheatSystems = {
  fr: [
    { nom: 'Électrique', rendement: 100, facteur: 1.0, energie: 'Électricité' },
    { nom: 'Eau chaude gaz naturel', rendement: 88, facteur: 0.82, energie: 'Gaz naturel' },
    { nom: 'Thermopompe air/eau', cop: 3.2, facteur: 0.32, energie: 'Thermopompe' },
    { nom: 'Boucle récupération chaleur', rendement: 82, facteur: 0.18, energie: 'Récupération passive' },
  ],
  en: [
    { nom: 'Electric', rendement: 100, facteur: 1.0, energie: 'Electricity' },
    { nom: 'Natural Gas Hot Water', rendement: 88, facteur: 0.82, energie: 'Natural Gas' },
    { nom: 'Air/Water Heat Pump', cop: 3.2, facteur: 0.32, energie: 'Heat Pump' },
    { nom: 'Heat Recovery Loop', rendement: 82, facteur: 0.18, energie: 'Passive Recovery' },
  ]
}

const ventilationModes = {
  fr: [
    { nom: '100% Air extérieur', type: 'outside-air', fraction: 1.0, description: 'Tout air neuf - charge maximale', couleur: 'red' },
    { nom: 'Free Cooling + évaporatif', type: 'free-cooling-evaporative', fraction: 0.9, description: 'Phase 1 - économiseur avec refroidissement évaporatif direct', couleur: 'cyan', evaporativeEffectiveness: 0.72 },
  ],
  en: [
    { nom: '100% Outside Air', type: 'outside-air', fraction: 1.0, description: 'All fresh air - maximum load', couleur: 'red' },
    { nom: 'Free Cooling + evaporative', type: 'free-cooling-evaporative', fraction: 0.9, description: 'Phase 1 - economizer with direct evaporative cooling', couleur: 'cyan', evaporativeEffectiveness: 0.72 },
  ]
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function joinLocalizedList(items, language) {
  const values = items.filter(Boolean)
  if (values.length <= 1) return values[0] || ''
  const conjunction = language === 'fr' ? ' et ' : ' and '
  if (values.length === 2) return values.join(conjunction)
  return `${values.slice(0, -1).join(', ')}${conjunction}${values.at(-1)}`
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

function defaultSensibleRecoveryEfficiency(recovery) {
  if (!recovery) return 0
  if (Number.isFinite(Number(recovery.efficaciteSensible))) return Number(recovery.efficaciteSensible)
  if (Number.isFinite(Number(recovery.efficacite))) return Number(recovery.efficacite)
  return 0
}

function defaultLatentRecoveryEfficiency(recovery) {
  if (!supportsLatentRecovery(recovery)) return 0
  if (Number.isFinite(Number(recovery.efficaciteLatente))) return Number(recovery.efficaciteLatente)
  return isEnthalpyCassetteRecovery(recovery) ? 75 : 70
}

function heatRecoveryImageFor(recovery) {
  const label = normalizeLabel(`${recovery?.nom || ''} ${recovery?.type || ''}`)

  if (recovery?.noRecovery || label.includes('aucun') || label.includes('none')) return systemImages.basic
  if (label.includes('cassette')) return systemImages.cassette
  if (label.includes('crois') || label.includes('cross') || label.includes('cassette sensible')) return systemImages.crossflow
  if (label.includes('boucle') || label.includes('glycol')) return systemImages.glycolLoop
  if (isThermalWheelRecovery(recovery) || label.includes('enthalp')) return systemImages.thermalWheel
  return systemImages.basic
}

function localizeRecoveryDisplayName(recovery, language) {
  const label = normalizeLabel(`${recovery?.nom || ''} ${recovery?.type || ''}`)
  if (label.includes('none') || label.includes('aucun')) {
    return language === 'fr' ? 'Aucun' : 'None'
  }
  if (label.includes('thermal wheel') || label.includes('roue thermique')) {
    return language === 'fr' ? 'Roue thermique' : 'Thermal Wheel'
  }
  if (label.includes('cross') || label.includes('crois')) {
    return language === 'fr' ? 'Échangeur à débit croisé' : 'Cross-flow Exchanger'
  }
  if (label.includes('cassette') && (label.includes('enthalpique') || label.includes('enthalpy'))) {
    return language === 'fr' ? 'Échangeur à cassettes enthalpique' : 'Enthalpy Cassette Exchanger'
  }
  if (label.includes('cassette')) {
    return language === 'fr' ? 'Échangeur à cassettes sensible' : 'Sensible Cassette Exchanger'
  }
  if (label.includes('glycol') || label.includes('boucle')) {
    return language === 'fr' ? 'Boucle glycolée' : 'Glycol Loop'
  }
  return recovery?.nom || '-'
}

function calculateRecoveryChartState(inletState, returnAirState, {
  sensibleRecoveryEfficiency,
  latentRecoveryEfficiency,
  latentRecoverySupported,
  isNoRecovery,
}) {
  if (isNoRecovery || sensibleRecoveryEfficiency <= 0) return inletState

  const sensibleEffectiveness = clampValue(sensibleRecoveryEfficiency / 100, 0, 0.95)
  const latentEffectiveness = latentRecoverySupported
    ? clampValue(latentRecoveryEfficiency / 100, 0, 0.95)
    : 0
  const recoveredHumidityRatio = inletState.w + latentEffectiveness * (returnAirState.w - inletState.w)
  const boundedHumidityRatio = clampValue(
    recoveredHumidityRatio,
    Math.max(0, Math.min(inletState.w, returnAirState.w)),
    Math.max(inletState.w, returnAirState.w)
  )

  return stateFromDbW({
    dryBulbC: inletState.db + sensibleEffectiveness * (returnAirState.db - inletState.db),
    humidityRatio: boundedHumidityRatio,
  })
}

function calculateChartHumifogState(inletState, effectiveness = 0.72) {
  const normalizedEffectiveness = clampValue(effectiveness > 1 ? effectiveness / 100 : effectiveness, 0, 1)
  const leavingDb = inletState.db - normalizedEffectiveness * Math.max(inletState.db - inletState.wb, 0)
  const leavingHumidityRatio = Math.max(
    inletState.w,
    (inletState.h - 1.006 * leavingDb) / (2501 + 1.86 * leavingDb)
  )

  return stateFromDbW({
    dryBulbC: Number(leavingDb.toFixed(1)),
    humidityRatio: leavingHumidityRatio,
  })
}

function calculateHumifogAtomizationProcess(inletState, roomState, language = 'fr') {
  const enteringState = inletState
  const targetRoomState = roomState
  const enteringW = Math.max(0, enteringState.w)
  const roomTargetW = Math.max(0, targetRoomState.w)
  const preheatTargetH = enteringState.h < targetRoomState.h ? targetRoomState.h : enteringState.h
  const preheatDb = dryBulbFromEnthalpyHumidityRatio(preheatTargetH, enteringW)
  const preheatState = stateFromDbW({
    dryBulbC: Number(preheatDb.toFixed(1)),
    humidityRatio: enteringW,
  })

  const noHumidificationRequired = roomTargetW <= preheatState.w + 1e-9
  const requestedAfterW = noHumidificationRequired
    ? preheatState.w
    : clampValue(roomTargetW, preheatState.w, roomTargetW)
  const afterHumifogDb = dryBulbFromEnthalpyHumidityRatio(preheatState.h, requestedAfterW)
  const afterHumifogState = stateFromDbW({
    dryBulbC: Number(afterHumifogDb.toFixed(1)),
    humidityRatio: requestedAfterW,
  })

  const warning = noHumidificationRequired
    ? (language === 'fr'
      ? 'Aucune humidification requise parce que l humidité de l air entrant est déjà égale ou supérieure à la cible pièce.'
      : 'No humidification required because entering air humidity is already equal to or above the room target.')
    : ''

  return {
    enteringState,
    preheatState,
    afterHumifogState,
    noHumidificationRequired,
    preheatApplied: enteringState.h < targetRoomState.h,
    warning,
  }
}

function solvePreHumifogHeatingState(inletState, targetAfterHumifogDb, effectiveness = 0.72) {
  const targetDb = Number(targetAfterHumifogDb)
  const inletDb = Number(inletState?.db)

  if (!Number.isFinite(targetDb) || !Number.isFinite(inletDb)) return inletState

  const stateAt = (dryBulbC) => stateFromDbW({
    dryBulbC: Number(dryBulbC.toFixed(1)),
    humidityRatio: inletState.w,
  })
  const outletAt = (dryBulbC) => calculateChartHumifogState(stateAt(dryBulbC), effectiveness)
  const lowerDb = Math.max(inletDb, -40)

  if (outletAt(lowerDb).db >= targetDb - 0.05) return stateAt(lowerDb)

  let highDb = Math.max(targetDb + 5, lowerDb + 1)
  while (highDb < 70 && outletAt(highDb).db < targetDb) {
    highDb += 2
  }

  let lowDb = lowerDb
  for (let index = 0; index < 32; index += 1) {
    const midDb = (lowDb + highDb) / 2
    if (outletAt(midDb).db < targetDb) {
      lowDb = midDb
    } else {
      highDb = midDb
    }
  }

  return stateAt(highDb)
}

function HesesLandingPage({ language, setLanguage, onStartAnalysis }) {
  const isFrench = language === 'fr'
  const copy = isFrench ? {
    heroKicker: 'Plateforme d\'analyse HVAC et humidification',
    heroTitle: 'Analyse énergétique avancée de l\'humidification CVAC',
    heroLead: 'Comparez différentes technologies d\'humidification et stratégies de traitement d\'air à partir des conditions réelles de votre projet.',
    heroBody: 'HESA analyse les charges d\'humidification, la récupération de chaleur, le Free Cooling, les besoins de chauffage et de réchauffage, ainsi que la consommation énergétique annuelle afin de comparer objectivement différentes solutions.',
    slogan: 'Analysez. Comparez. Optimisez.',
    cta: 'DÉMARRER UNE ANALYSE',
    capabilitiesTitle: 'Capacités principales',
    engineeringTitle: 'Comparaison énergétique basée sur l\'ingénierie',
    engineeringBody: 'HESA évalue les technologies d\'humidification selon la configuration réelle du système CVAC plutôt que de présumer qu\'une technologie est toujours plus efficace.',
    engineeringDetail: 'L\'analyse tient compte du débit d\'air, du climat extérieur, des conditions intérieures, de la récupération de chaleur, des horaires d\'exploitation et de la technologie de réchauffage.',
    disclaimer: 'Les résultats produits par HESA sont fournis à des fins d\'analyse préliminaire et de comparaison énergétique. Les résultats dépendent des données saisies, des hypothèses de calcul et des conditions d\'exploitation sélectionnées. Ils ne remplacent pas la conception détaillée, la sélection d\'équipement ni la validation d\'un ingénieur qualifié.',
    languageLabel: 'Langue',
    detailsLabel: 'HESA | Version 1.1 | Enersol inc. | Carel Group | hesahvac.com',
    workflowTitle: 'Workflow d\'analyse',
    workflowBody: 'Lancez le tableau de bord existant pour comparer les charges, les coûts, les gains énergétiques et le rapport PDF sans modifier les calculs de base.',
    featureCards: [
      ['100 % air extérieur', 'Comparaison des scénarios 100 % OA'],
      ['Free Cooling', 'Analyse du mode Free Cooling'],
      ['Humidification vapeur', 'Référence de consommation vapeur'],
      ['Humidification adiabatique haute pression', 'Performance Humifog'],
      ['Récupération de chaleur', 'Effet de la récupération thermique'],
      ['Réchauffage thermopompe', 'Impact du réchauffage HP'],
      ['Analyse météo BIN', 'Base horaire climatique BIN'],
      ['Énergie et coût annuels', 'Résultats annuels consolidés'],
      ['Réduction des GES', 'Comparaison des émissions'],
      ['Rapport PDF d\'ingénierie', 'Sortie de rapport professionnelle'],
    ],
  } : {
    heroKicker: 'HVAC humidification analysis platform',
    heroTitle: 'Advanced HVAC Humidification Energy Analysis',
    heroLead: 'Compare humidification technologies and air-handling strategies using the actual operating conditions of your project.',
    heroBody: 'HESA evaluates humidification loads, heat recovery, free cooling, heating and reheat requirements, and annual energy consumption to provide an objective comparison of different HVAC solutions.',
    slogan: 'Analyze. Compare. Optimize.',
    cta: 'START ANALYSIS',
    capabilitiesTitle: 'Main capabilities',
    engineeringTitle: 'Engineering-Based Energy Comparison',
    engineeringBody: 'HESA evaluates humidification technologies based on the actual HVAC system configuration rather than assuming that one technology is always more efficient.',
    engineeringDetail: 'The analysis considers airflow, outdoor climate, indoor conditions, heat recovery, operating schedules and reheat technology.',
    disclaimer: 'HESA results are provided for preliminary engineering analysis and energy comparison purposes. Results depend on user inputs, calculation assumptions and selected operating conditions. They do not replace detailed engineering design, equipment selection or validation by a qualified engineer.',
    languageLabel: 'Language',
    detailsLabel: 'HESA | Version 1.1 | Enersol inc. | Carel Group | hesahvac.com',
    workflowTitle: 'Analysis workflow',
    workflowBody: 'Open the existing dashboard to compare loads, costs, energy savings and the PDF report without changing the core calculations.',
    featureCards: [
      ['100% Outdoor Air', 'Baseline outdoor-air comparison'],
      ['Free Cooling', 'Free Cooling analysis mode'],
      ['Steam Humidification', 'Steam energy reference'],
      ['High-Pressure Adiabatic Humidification', 'Humifog performance'],
      ['Heat Recovery', 'Thermal recovery impact'],
      ['Heat Pump Reheat', 'HP reheat impact'],
      ['BIN Weather Analysis', 'Hourly climate BIN foundation'],
      ['Annual Energy & Cost', 'Annual energy and cost results'],
      ['GHG Reduction', 'Emissions comparison'],
      ['Engineering PDF Report', 'Professional report output'],
    ],
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(180deg,#eef5fb_0%,#dbe5ef_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="logo-card" role="img" aria-label="HESA Humidification Energy System Analysis">
              <div className="logo-title">HESA</div>
              <div className="logo-accent" aria-hidden="true" />
              <div className="logo-subtitle">{isFrench ? 'Analyse énergétique des systèmes d’humidification' : 'Humidification Energy System Analysis'}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.4em] text-cyan-700">HESA</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                {isFrench ? 'Analyse énergétique des systèmes d’humidification' : 'Humidification Energy System Analysis'}
              </h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 shadow-sm">Version 1.1</span>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 shadow-sm">Enersol inc. | Carel Group</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-300 bg-white/90 p-2 shadow-sm backdrop-blur">
            <span className="px-2 text-xs font-black uppercase tracking-[0.28em] text-slate-500">{copy.languageLabel}</span>
            <button
              type="button"
              onClick={() => setLanguage('fr')}
              className={`rounded-xl px-4 py-2 font-semibold transition ${isFrench ? 'bg-cyan-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Français
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`rounded-xl px-4 py-2 font-semibold transition ${!isFrench ? 'bg-cyan-600 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              English
            </button>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-[0_28px_70px_rgba(15,23,42,0.14)] lg:p-10">
            <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-700">
              {copy.heroKicker}
            </div>
            <h2 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              {copy.heroTitle}
            </h2>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
              {copy.heroLead}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700 sm:text-lg">
              {copy.heroBody}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  onStartAnalysis()
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className="rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-black uppercase tracking-[0.22em] text-white shadow-[0_18px_30px_rgba(6,182,212,0.22)] transition hover:bg-cyan-700"
              >
                {copy.cta}
              </button>
              <div className="text-sm font-semibold text-slate-500 sm:text-base">{copy.slogan}</div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">01</div>
                <div className="mt-2 font-black text-slate-900">{copy.workflowTitle}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{copy.workflowBody}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">02</div>
                <div className="mt-2 font-black text-slate-900">{isFrench ? 'Langue bilingue' : 'Bilingual interface'}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{isFrench ? 'Passez instantanément entre le français et l\'anglais.' : 'Switch instantly between English and French.'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">03</div>
                <div className="mt-2 font-black text-slate-900">{isFrench ? 'Rapport d\'ingénierie' : 'Engineering report'}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{isFrench ? 'Les résultats alimentent le rapport PDF existant.' : 'Results feed the existing PDF report.'}</div>
              </div>
            </div>
          </div>

          <aside className="rounded-[30px] border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-[0_28px_70px_rgba(15,23,42,0.24)] lg:p-7">
            <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">{copy.capabilitiesTitle}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {copy.featureCards.map(([title, description]) => (
                <article key={title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_20px_rgba(15,23,42,0.15)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-sm font-black text-cyan-200">
                    {title.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300">{description}</div>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-900 p-8 text-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">{isFrench ? 'Message d\'ingénierie' : 'Engineering message'}</div>
            <h3 className="mt-4 text-3xl font-black tracking-tight text-white">{copy.engineeringTitle}</h3>
            <p className="mt-4 text-base leading-8 text-slate-300">{copy.engineeringBody}</p>
            <p className="mt-4 text-sm leading-7 font-semibold text-cyan-200">{copy.engineeringDetail}</p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
            <div className="text-xs font-black uppercase tracking-[0.35em] text-slate-500">HESA</div>
            <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-900">{copy.detailsLabel}</h3>
            <p className="mt-4 text-base leading-8 text-slate-600">{copy.heroBody}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">{isFrench ? 'Conditions réelles' : 'Actual operating conditions'}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{isFrench ? 'Les analyses reposent sur le climat, les horaires et les paramètres fournis.' : 'Analyses follow project climate, schedules and user inputs.'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">{isFrench ? 'Comparaison objective' : 'Objective comparison'}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{isFrench ? 'Les technologies sont évaluées sur une base commune et traçable.' : 'Technologies are evaluated on a consistent, traceable basis.'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">{isFrench ? 'Rapport PDF' : 'PDF report'}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{isFrench ? 'Le rapport d\'ingénierie existant demeure disponible.' : 'The existing engineering report remains available.'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-900">{isFrench ? 'Interface bilingue' : 'Bilingual interface'}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{isFrench ? 'Les libellés et le contenu suivent le mode de langue actuel.' : 'Labels and content follow the current language mode.'}</div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-300/80 pt-5 text-xs leading-6 text-slate-500">
          {copy.disclaimer}
          <div className="mt-2">© 2026 Enersol inc. / Carel Group. HESA - Humidification Energy System Analysis. All rights reserved.</div>
        </footer>
      </div>
    </main>
  )
}

function HvacDashboardApp({ showLandingPage: controlledShowLandingPage, onStartAnalysis: controlledStartAnalysis, onLanguageChange, systemSettings, onSettingsChange, onAnnualResults, onReportSnapshot, projectSystems, activeSystemName, activeSystemId }) {
  const reportRef = useRef(null)
  const hourlyWeatherFileInputRef = useRef(null)
  const initialProjectSettings = systemSettings || getInitialProjectSettings()
  const [language, setLanguage] = useState(initialProjectSettings.language || 'fr')
  const [units, setUnits] = useState(initialProjectSettings.units || 'metric')
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantAnswer, setAssistantAnswer] = useState('')
  const [assistantError, setAssistantError] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [reportPreviewVisible, setReportPreviewVisible] = useState(false)
  const [reportStatus, setReportStatus] = useState('')
  const [projectProfile, setProjectProfile] = useState(getInitialProjectProfile)
  const [projectSaveStatus, setProjectSaveStatus] = useState('')
  const [internalShowLandingPage, setInternalShowLandingPage] = useState(true)
  const showLandingPage = controlledShowLandingPage ?? internalShowLandingPage
  const setShowLandingPage = controlledStartAnalysis || setInternalShowLandingPage
  useEffect(() => {
    if (typeof onLanguageChange === 'function') {
      onLanguageChange(language)
    }
  }, [language, onLanguageChange])
  const [assistantHealth, setAssistantHealth] = useState({
    checked: false,
    online: false,
    configured: null,
    model: '',
  })
  const t = Object.fromEntries(
    Object.entries(translations[language]).map(([key, value]) => [
      key,
      typeof value === 'string' ? repairFrenchEncoding(value) : value,
    ])
  )

  useEffect(() => {
    repairDisplayEncodingInDom()
  })

  const updateProjectProfile = (field, value) => {
    setProjectProfile((current) => ({
      ...current,
      [field]: value,
    }))
    setProjectSaveStatus('')
  }

  const saveProjectProfile = async () => {
    try {
      window.localStorage.setItem(HESES_PROJECT_PROFILE_STORAGE_KEY, JSON.stringify(projectProfile))
      const settings = buildProjectSettingsSnapshot()
      if (!onSettingsChange) {
        window.localStorage.setItem(HESES_PROJECT_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      }

      const savedSystems = (() => {
        try {
          return JSON.parse(window.localStorage.getItem(HESES_MULTI_SYSTEM_STORAGE_KEY) || '[]')
        } catch {
          return []
        }
      })()
      const projectFile = {
        format: 'HESA project',
        version: 1,
        savedAt: new Date().toISOString(),
        profile: projectProfile,
        settings,
        systems: Array.isArray(savedSystems) ? savedSystems : [],
      }
      const projectBlob = new Blob([JSON.stringify(projectFile, null, 2)], { type: 'application/json' })
      const suggestedName = `${(projectProfile.name || 'HESA-project').trim().replace(/[^a-z0-9_-]+/gi, '-') || 'HESA-project'}.heses.json`
      const showSaveFilePicker = globalThis.showSaveFilePicker

      if (typeof showSaveFilePicker === 'function') {
        const fileHandle = await showSaveFilePicker({
          suggestedName,
          types: [{ description: 'HESA project', accept: { 'application/json': ['.heses.json', '.json'] } }],
        })
        const writable = await fileHandle.createWritable()
        await writable.write(projectBlob)
        await writable.close()
      } else {
        downloadBlob(projectBlob, suggestedName)
      }
      setProjectSaveStatus(language === 'fr' ? 'Projet sauvegardé dans le fichier choisi.' : 'Project saved to the selected file.')
    } catch (error) {
      if (error?.name === 'AbortError') return
      setProjectSaveStatus(language === 'fr'
        ? 'Impossible de sauvegarder le fichier du projet.'
        : 'Unable to save the project file.')
    }
  }

  useEffect(() => {
    let isMounted = true

    fetch(HESES_ASSISTANT_HEALTH_ENDPOINT)
      .then((response) => response.json())
      .then((payload) => {
        if (!isMounted) return
        setAssistantHealth({
          checked: true,
          online: true,
          configured: Boolean(payload.configured),
          model: payload.model || '',
        })
      })
      .catch(() => {
        if (!isMounted) return
        setAssistantHealth({
          checked: true,
          online: false,
          configured: null,
          model: '',
        })
      })

    return () => {
      isMounted = false
    }
  }, [])

  // All internal calculations stay in base units (deg C, CFM, lbs/hr, etc.)
  // These helpers convert only for display purposes
  const round1 = (value) => Math.round(value * 10) / 10
  const displayTemp = (c) => units === 'imperial' ? round1(c * 9 / 5 + 32) : round1(c)
  const displayDeltaTemp = (c) => units === 'imperial' ? round1(c * 9 / 5) : round1(c)
  const inputTempToC = (value) => units === 'imperial' ? round1((value - 32) * 5 / 9) : value
  const tempUnit = units === 'imperial' ? '\u00B0F' : '\u00B0C'
  const displayFlow = (cfm) => units === 'metric' ? Math.round(cfm * 0.47195) : cfm
  const inputFlowToCfm = (value) => units === 'metric' ? Math.round((value || 0) / 0.47195) : value
  const flowUnit = units === 'metric' ? 'L/s' : 'CFM'
  const displayGasFlow = (m3h) => units === 'imperial' ? Math.round(m3h * 35.3147 * 10) / 10 : m3h
  const gasFlowUnit = units === 'imperial' ? 'ft\u00B3/h' : 'm\u00B3/h'
  const displayGasRate = (rM3) => units === 'imperial' ? Math.round((rM3 / 0.0366) * 100) / 100 : rM3
  const inputGasRateToMetric = (value) => units === 'imperial' ? (value || 0) * 0.0366 : value
  const gasRateUnit = units === 'imperial' ? '$/MMBTU' : '$/m\u00B3'
  const displayHumidity = (grLb) => units === 'metric' ? Math.round(grLb * 0.142857 * 10) / 10 : grLb
  const humidityUnit = units === 'metric' ? 'g/kg' : 'gr/lb'
  const displayEnthalpy = (btu) => units === 'metric' ? Math.round(btu * 2.326) : btu
  const enthalpyUnit = units === 'metric' ? 'kJ/kg' : 'Btu/lb'

  const openPrintableReportPage = () => {
    persistProjectLocally()
    const html = buildPrintableReportHtml({ autoPrint: false })
    window.sessionStorage.setItem(HESES_PRINT_REPORT_STORAGE_KEY, html)
    window.location.href = '/heses-report-print'
  }

  const generatePDF = () => {
    try {
      setReportPreviewVisible(true)
      setReportStatus(language === 'fr'
        ? 'Rapport original ouvert. Utilisez les options de la page rapport pour imprimer ou télécharger.'
        : 'Original report opened. Use the report page options to print or download.')
      openPrintableReportPage()
    } catch (error) {
      console.error('Erreur PDF:', error)
      alert(t.pdfError)
    }
  }

  const printReportPreview = () => {
    try {
      setReportPreviewVisible(true)
      openPrintableReportPage()
    } catch (error) {
      console.error('Erreur impression rapport:', error)
      alert(t.pdfError)
    }
  }
  const buildPrintableReportMarkup = () => (
    localizeReportHtml(
      renderToStaticMarkup(<HvacEnergyOptimizationReport data={reportData} />),
      language
    )
      .replaceAll('src="/', `src="${window.location.origin}/`)
  )

  const buildPrintableReportHtml = ({ autoPrint = false } = {}) => {
    const reportTitle = language === 'fr' ? 'Rapport HVAC Enersol' : t.reportTitle
    const reportHtml = buildPrintableReportMarkup()
    const printLabel = language === 'fr' ? 'Imprimer / Enregistrer en PDF' : 'Print / Save as PDF'
    const openWindowsPdfLabel = language === 'fr' ? 'Ouvrir PDF dans Windows' : 'Open PDF in Windows'
    const printHint = language === 'fr'
      ? 'Si l impression ne s ouvre pas ici, ouvrez le PDF dans Windows et utilisez Ctrl+P.'
      : 'If printing does not open here, open the PDF in Windows and use Ctrl+P.'

    const printableHtml = `<!doctype html>
<html lang="${language === 'fr' ? 'fr-CA' : 'en-CA'}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${reportTitle}</title>
    <style>
      @page { size: letter; margin: 14mm; }
      body {
        margin: 0;
        background: #f1f5f9;
        color: #0f172a;
        font-family: Arial, sans-serif;
        line-height: 1.35;
      }
      .print-actions {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 12px;
        background: #0f172a;
      }
      .print-actions button {
        border: 0;
        border-radius: 10px;
        background: #0284c7;
        color: white;
        cursor: pointer;
        font-weight: 800;
        padding: 10px 16px;
      }
      .print-hint {
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 700;
      }
      .engineering-report {
        max-width: 1060px;
        margin: 24px auto;
        background: white;
        font-size: 12px;
        padding: 18px;
      }
      .report-cover {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #cbd5e1;
        border-top: 12px solid #0f3a5b;
        border-radius: 10px;
        padding: 24px;
        min-height: 700px;
        margin-bottom: 16px;
      }
      .report-cover h1 {
        color: #0f172a;
        font-size: 31px;
        line-height: 1.05;
        margin: 6px 0 8px;
      }
      .cover-topline { padding-bottom: 10px; margin-bottom: 14px; }
      .cover-logo { width: 135px; height: auto; display: block; }
      .cover-subtitle { font-size: 13px; margin-bottom: 10px; }
      .cover-badge, .document-meta-row span { padding: 4px 8px; font-size: 9px; }
      .document-meta-row { margin: 10px 0 12px; }
      .cover-grid, .two-column, .graph-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .cover-summary, .cover-certification { margin-top: 10px; padding: 8px 10px; }
      .cover-figure img { max-height: 240px; }
      .cover-meta .report-table th, .cover-meta .report-table td { padding: 5px 6px; font-size: 10px; }
      .cover-kpi-row, .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .report-section {
        break-inside: avoid;
        page-break-inside: avoid;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        margin-bottom: 16px;
        padding: 16px;
      }
      .report-section.allow-page-break {
        break-inside: auto;
        page-break-inside: auto;
      }
      .report-section h2 {
        border-bottom: 2px solid #0ea5e9;
        color: #0f3a5b;
        font-size: 18px;
        margin: 0 0 12px;
        padding-bottom: 6px;
      }
      .report-section h3 { color: #334155; font-size: 13px; margin: 12px 0 8px; }
      .report-table, .heatmap {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
      }
      .report-table th, .report-table td, .heatmap th, .heatmap td {
        border: 1px solid #cbd5e1;
        padding: 7px 8px;
        vertical-align: top;
      }
      .report-table th, .heatmap th { background: #eaf5fb; text-align: left; }
      .report-table.compact th, .report-table.compact td { font-size: 10.5px; text-align: center; }
      .toc-list { list-style: none; padding: 0; margin: 0; }
      .toc-list li { display: flex; gap: 8px; border-bottom: 1px solid #e2e8f0; padding: 7px 0; }
      .toc-dots { flex: 1; border-bottom: 1px dotted #94a3b8; transform: translateY(3px); }
      .kpi, .cover-kpi, .graph-card {
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 10px;
      }
      .formula-block {
        background: #f8fafc;
        border-left: 4px solid #0ea5e9;
        font-family: Consolas, monospace;
        margin-bottom: 12px;
        padding: 10px 12px;
      }
      img, svg { max-width: 100%; height: auto; }
      .page-break { break-before: auto; page-break-before: auto; }
      .report-cover.page-break { break-before: auto; page-break-before: auto; }
      @media print {
        body { background: white; }
        .print-actions { display: none; }
        .engineering-report { margin: 0 auto; padding: 0; }
        .report-cover {
          padding: 18px;
          min-height: auto;
          break-after: page;
          page-break-after: always;
        }
        .report-cover .cover-figure {
          display: none;
        }
        .report-cover .cover-grid {
          grid-template-columns: 1fr;
        }
        .report-cover .cover-summary,
        .report-cover .cover-certification {
          display: none;
        }
        .report-section h2,
        .report-section h3 {
          break-after: avoid;
          page-break-after: avoid;
        }
        .report-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .report-section.allow-page-break {
          break-inside: auto;
          page-break-inside: auto;
        }
        .report-table tr,
        .heatmap tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-actions">
      <button type="button" onclick="window.print()">${printLabel}</button>
      <button type="button" onclick="fetch('/api/heses-report-open-local-pdf', { method: 'POST' }).catch(function(){ window.location.href = '/api/heses-report-open-local-pdf'; })">${openWindowsPdfLabel}</button>
      <span class="print-hint">${printHint}</span>
    </div>
    ${reportHtml}
    ${autoPrint ? `
      <script>
        window.addEventListener('load', function () {
          var images = Array.prototype.slice.call(document.images || []);
          var waits = images.map(function (image) {
            if (image.complete) return Promise.resolve();
            return new Promise(function (resolve) {
              image.onload = resolve;
              image.onerror = resolve;
            });
          });

          Promise.all(waits).finally(function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 600);
          });
        });
      </script>
    ` : ''}
  </body>
</html>`
    return localizeReportHtml(printableHtml, language)
  }

  const downloadPrintableReport = ({ showPreview = true } = {}) => {
    try {
      if (showPreview) {
        setReportPreviewVisible(true)
      }
      setReportStatus(showPreview
        ? (language === 'fr'
          ? 'Rapport genere ci-dessous. Si le telechargement est bloque, utilisez l apercu et imprimez en PDF.'
          : 'Report generated below. If the download is blocked, use the preview and print to PDF.')
        : (language === 'fr'
          ? 'Fichier HTML imprimable genere. Ouvrez-le puis utilisez Imprimer / Enregistrer en PDF.'
          : 'Printable HTML file generated. Open it, then use Print / Save as PDF.'))

      const html = buildPrintableReportHtml()

      if (!html) {
        alert(t.reportNotFound)
        return
      }

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'HESA_Energy_Analysis_Report.html'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error('Erreur rapport imprimable:', error)
      alert(t.pdfError)
    }
  }

  const [outsideAirCFM, setOutsideAirCFM] = useState(() => finiteSetting(initialProjectSettings, 'outsideAirCFM', 12500))
  const [roomTemperature, setRoomTemperature] = useState(() => finiteSetting(initialProjectSettings, 'roomTemperature', 22))
  const [roomRelativeHumidity, setRoomRelativeHumidity] = useState(() => finiteSetting(initialProjectSettings, 'roomRelativeHumidity', 35))
  const [supplyAirTemperature, setSupplyAirTemperature] = useState(() => finiteSetting(initialProjectSettings, 'supplyAirTemperature', 22))
  const [heatPumpCOP, setHeatPumpCOP] = useState(() => finiteSetting(initialProjectSettings, 'heatPumpCOP', 3.8))

  const savedRecoveryName = normalizeLabel(initialProjectSettings.selectedRecoveryName)
  const savedRecoveryType = normalizeLabel(initialProjectSettings.selectedRecoveryType)
  const initialRecoverySelection = heatRecoverySystems[language].find((item) => {
    const itemName = normalizeLabel(item.nom)
    const itemType = normalizeLabel(item.type)
    return (
      itemType === savedRecoveryType ||
      itemName === savedRecoveryName ||
      (savedRecoveryName.includes('cassette sensible') && itemName.includes('cassettes sensible')) ||
      (savedRecoveryName.includes('cassette enthalpique') && itemName.includes('cassettes enthalpique'))
    )
  }) || heatRecoverySystems[language][1]
  const [selectedRecoveries, setSelectedRecoveries] = useState([initialRecoverySelection])

  const [wheelEfficiency, setWheelEfficiency] = useState(() => finiteSetting(
    initialProjectSettings,
    'recoverySensibleEfficiency',
    finiteSetting(initialProjectSettings, 'wheelEfficiency', defaultSensibleRecoveryEfficiency(initialRecoverySelection))
  ))
  const [latentRecoveryEfficiency, setLatentRecoveryEfficiency] = useState(() => {
    const savedLatentEfficiency = Number(initialProjectSettings?.recoveryLatentEfficiency)
    if (Number.isFinite(savedLatentEfficiency)) return savedLatentEfficiency
    return defaultLatentRecoveryEfficiency(initialRecoverySelection)
  })

  const climateCities = [
    { nom: 'Montr\u00E9al', hiver: -23, ete: 30, humidite: 65, zone: 'Zone 6' },
    { nom: 'Qu\u00E9bec', hiver: -28, ete: 28, humidite: 62, zone: 'Zone 7' },
    { nom: 'Ottawa', hiver: -25, ete: 30, humidite: 65, zone: 'Zone 6' },
    { nom: 'Toronto', hiver: -18, ete: 32, humidite: 70, zone: 'Zone 5' },
    { nom: 'Vancouver', hiver: -8, ete: 26, humidite: 72, zone: 'Zone 4' },
    { nom: 'Calgary', hiver: -30, ete: 27, humidite: 45, zone: 'Zone 7' },
    { nom: 'Winnipeg', hiver: -35, ete: 31, humidite: 55, zone: 'Zone 7' },
  ]

  const initialCity = climateCities.find((city) => city.nom === initialProjectSettings.selectedCityName) || climateCities[0]
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [electricityRate, setElectricityRate] = useState(() => finiteSetting(initialProjectSettings, 'electricityRate', 0.12))
  const [naturalGasRate, setNaturalGasRate] = useState(() => finiteSetting(initialProjectSettings, 'naturalGasRate', 0.45))
  const [steamBoilerEfficiency, setSteamBoilerEfficiency] = useState(() => finiteSetting(initialProjectSettings, 'steamBoilerEfficiency', 82))
  const [atmosphericGasHumidifierEfficiency, setAtmosphericGasHumidifierEfficiency] = useState(() => finiteSetting(initialProjectSettings, 'atmosphericGasHumidifierEfficiency', 82))
  const [electricSteamInstalledCost, setElectricSteamInstalledCost] = useState(() => finiteSetting(initialProjectSettings, 'electricSteamInstalledCost', 35000))
  const [naturalGasSteamInstalledCost, setNaturalGasSteamInstalledCost] = useState(() => finiteSetting(initialProjectSettings, 'naturalGasSteamInstalledCost', 65000))
  const [atmosphericGasHumidifierInstalledCost, setAtmosphericGasHumidifierInstalledCost] = useState(() => finiteSetting(initialProjectSettings, 'atmosphericGasHumidifierInstalledCost', 55000))
  const [humifogInstalledCost, setHumifogInstalledCost] = useState(() => finiteSetting(initialProjectSettings, 'humifogInstalledCost', 85000))
  const [freeCoolingControlsInstalledCost, setFreeCoolingControlsInstalledCost] = useState(() => finiteSetting(initialProjectSettings, 'freeCoolingControlsInstalledCost', 18000))
  const [heatRecoveryInstalledCost, setHeatRecoveryInstalledCost] = useState(() => finiteSetting(initialProjectSettings, 'heatRecoveryInstalledCost', 45000))

  const initialReheatSystem = reheatSystems[language].find((item) =>
    item.energie === initialProjectSettings.selectedReheatEnergy ||
    item.nom === initialProjectSettings.selectedReheatName
  ) || reheatSystems[language][0]
  const [selectedReheatSystem, setSelectedReheatSystem] = useState(initialReheatSystem)
  const [ventilationMode, setVentilationMode] = useState(() => getInitialVentilationMode(language, initialProjectSettings.ventilationModeType))
  const openVentilationMode = (mode) => {
    setVentilationMode(mode)
    updateVentilationModeUrl(mode)
  }
  const [economizerTargetTemp, setEconomizerTargetTemp] = useState(() => finiteSetting(initialProjectSettings, 'economizerTargetTemp', 18))
  const [minimumOutsideAirPercent, setMinimumOutsideAirPercent] = useState(() => finiteSetting(initialProjectSettings, 'minimumOutsideAirPercent', 20))
  const [annualComparisonReference, setAnnualComparisonReference] = useState(() => (
    BASELINE_TECHNOLOGIES.includes(initialProjectSettings.annualComparisonReference)
      ? initialProjectSettings.annualComparisonReference
      : 'electricSteam'
  ))
  const [scheduleMode, setScheduleMode] = useState(() => {
    const saved = initialProjectSettings.scheduleMode
    return saved === '24-7' ? '24-7' : 'custom'
  })
  const [calculationMethod, setCalculationMethod] = useState(() => {
    const saved = initialProjectSettings.calculationMethod
    return saved === 'hourly' ? 'hourly' : 'bin'
  })
  const [hourlyWeatherFileName, setHourlyWeatherFileName] = useState(() => initialProjectSettings.hourlyWeatherFileName || '')
  const [hourlyWeatherFileLocation, setHourlyWeatherFileLocation] = useState('')
  const [hourlyWeatherRecordsLoaded, setHourlyWeatherRecordsLoaded] = useState(0)
  const [hourlyWeatherOperatingHoursUsed, setHourlyWeatherOperatingHoursUsed] = useState(0)
  const [hourlyWeatherSummary, setHourlyWeatherSummary] = useState(null)
  const [hourlyWeatherParseError, setHourlyWeatherParseError] = useState('')
  const [hourlyWeatherSourceType, setHourlyWeatherSourceType] = useState('none')
  const [hourlyWeatherLoading, setHourlyWeatherLoading] = useState(false)
  const [hourlyWeatherRecords, setHourlyWeatherRecords] = useState([])
  const [hourlyWeatherMetadata, setHourlyWeatherMetadata] = useState(null)
  const [hourlyWeatherValidationWarning, setHourlyWeatherValidationWarning] = useState('')
  const [hourlyWeatherResolvedUrl, setHourlyWeatherResolvedUrl] = useState('')
  const [hourlyWeatherFetchStatus, setHourlyWeatherFetchStatus] = useState(0)
  const [hourlyWeatherDebugRecordCount, setHourlyWeatherDebugRecordCount] = useState(0)
  const [hourlyWeatherBuiltInMissing, setHourlyWeatherBuiltInMissing] = useState(false)
  const [scheduleStartTime, setScheduleStartTime] = useState(() => initialProjectSettings.scheduleStartTime || '06:00')
  const [scheduleEndTime, setScheduleEndTime] = useState(() => initialProjectSettings.scheduleEndTime || '18:00')
  const [scheduleDaysOption, setScheduleDaysOption] = useState(() => {
    const saved = initialProjectSettings.scheduleDaysOption
    return ['mon-fri', 'mon-sat', 'seven-days', 'custom'].includes(saved) ? saved : 'mon-fri'
  })
  const [scheduleCustomDays, setScheduleCustomDays] = useState(() => parseObjectSetting(initialProjectSettings, 'scheduleCustomDays', DEFAULT_SCHEDULE_CUSTOM_DAYS))
  const [useMeasuredMixedAirTemperature, setUseMeasuredMixedAirTemperature] = useState(() => booleanSetting(initialProjectSettings, 'useMeasuredMixedAirTemperature', false))
  const [measuredMixedAirTemperature, setMeasuredMixedAirTemperature] = useState(() => finiteSetting(initialProjectSettings, 'measuredMixedAirTemperature', 18))

  const economizerTargetOptions = units === 'imperial'
    ? [55, 57, 61, 64, 68]
    : [13, 14, 16, 18, 20]

  const clearHourlyWeatherState = () => {
    setHourlyWeatherFileName('')
    setHourlyWeatherFileLocation('')
    setHourlyWeatherRecordsLoaded(0)
    setHourlyWeatherOperatingHoursUsed(0)
    setHourlyWeatherSummary(null)
    setHourlyWeatherParseError('')
    setHourlyWeatherSourceType('none')
    setHourlyWeatherLoading(false)
    setHourlyWeatherRecords([])
    setHourlyWeatherMetadata(null)
    setHourlyWeatherValidationWarning('')
    setHourlyWeatherResolvedUrl('')
    setHourlyWeatherFetchStatus(0)
    setHourlyWeatherDebugRecordCount(0)
  }

  const buildProjectSettingsSnapshot = () => ({
    language,
    units,
    outsideAirCFM,
    roomTemperature,
    roomRelativeHumidity,
    supplyAirTemperature,
    heatPumpCOP,
    selectedRecoveryName: selectedRecoveries[0]?.nom || '',
    selectedRecoveryType: selectedRecoveries[0]?.type || '',
    wheelEfficiency,
    recoverySensibleEfficiency: wheelEfficiency,
    recoveryLatentEfficiency: latentRecoveryEfficiency,
    selectedCityName: selectedCity.nom,
    electricityRate,
    naturalGasRate,
    steamBoilerEfficiency,
    atmosphericGasHumidifierEfficiency,
    electricSteamInstalledCost,
    naturalGasSteamInstalledCost,
    atmosphericGasHumidifierInstalledCost,
    humifogInstalledCost,
    freeCoolingControlsInstalledCost,
    heatRecoveryInstalledCost,
    selectedReheatName: selectedReheatSystem?.nom || '',
    selectedReheatEnergy: selectedReheatSystem?.energie || '',
    ventilationModeType: ventilationMode.type,
    economizerTargetTemp,
    minimumOutsideAirPercent,
    annualComparisonReference,
    scheduleMode,
    calculationMethod,
    hourlyWeatherFileName,
    scheduleStartTime,
    scheduleEndTime,
    scheduleDaysOption,
    scheduleCustomDays,
    useMeasuredMixedAirTemperature,
    measuredMixedAirTemperature,
    savedAt: initialProjectSettings.savedAt || '',
  })

  const persistProjectLocally = () => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(HESES_PROJECT_PROFILE_STORAGE_KEY, JSON.stringify(projectProfile))
      const snapshot = buildProjectSettingsSnapshot()
      if (onSettingsChange) {
        onSettingsChange(snapshot)
      } else {
        window.localStorage.setItem(HESES_PROJECT_SETTINGS_STORAGE_KEY, JSON.stringify(snapshot))
      }
    } catch {
      // Local storage can be unavailable in restricted browser modes.
    }
  }

  useEffect(() => {
    persistProjectLocally()
  }, [
    onSettingsChange,
    language,
    units,
    projectProfile,
    outsideAirCFM,
    roomTemperature,
    roomRelativeHumidity,
    supplyAirTemperature,
    heatPumpCOP,
    selectedRecoveries,
    wheelEfficiency,
    latentRecoveryEfficiency,
    selectedCity,
    electricityRate,
    naturalGasRate,
    steamBoilerEfficiency,
    atmosphericGasHumidifierEfficiency,
    electricSteamInstalledCost,
    naturalGasSteamInstalledCost,
    atmosphericGasHumidifierInstalledCost,
    humifogInstalledCost,
    freeCoolingControlsInstalledCost,
    heatRecoveryInstalledCost,
    selectedReheatSystem,
    ventilationMode,
    economizerTargetTemp,
    minimumOutsideAirPercent,
    annualComparisonReference,
    scheduleMode,
    calculationMethod,
    hourlyWeatherFileName,
    scheduleStartTime,
    scheduleEndTime,
    scheduleDaysOption,
    scheduleCustomDays,
    useMeasuredMixedAirTemperature,
    measuredMixedAirTemperature,
  ])

  const handleHourlyWeatherFileChange = (file) => {
    if (!file) {
      setHourlyWeatherSourceType('none')
      setHourlyWeatherFileName('')
      setHourlyWeatherFileLocation('')
      setHourlyWeatherRecordsLoaded(0)
      setHourlyWeatherOperatingHoursUsed(0)
      setHourlyWeatherSummary(null)
      setHourlyWeatherParseError('')
      setHourlyWeatherRecords([])
      setHourlyWeatherMetadata(null)
      setHourlyWeatherValidationWarning('')
      return
    }

    setHourlyWeatherLoading(true)
    setHourlyWeatherFileName(file.name)
    setHourlyWeatherFileLocation('')
    setHourlyWeatherParseError('')
    setHourlyWeatherSummary(null)
    setHourlyWeatherRecordsLoaded(0)
    setHourlyWeatherOperatingHoursUsed(0)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const { weatherLocation, records } = epwTextToRecords(text)
        const validation = validateHourlyWeatherRecords(records)
        if (!validation.isValid) {
          setHourlyWeatherSourceType('none')
          setHourlyWeatherRecords([])
          setHourlyWeatherMetadata(null)
          setHourlyWeatherValidationWarning('')
          setHourlyWeatherParseError(validation.error)
          return
        }

        const customMetadata = {
          file: file.name,
          dataSource: 'User uploaded EPW weather file',
          sourceOrganization: 'User provided',
          stationName: weatherLocation || selectedCity.nom,
          stationId: '',
          climateFileType: 'EPW hourly weather file',
          periodOfRecord: '',
          fileYearType: 'User provided',
          recordCount: records.length,
          validationStatus: 'unverified',
        }

        if (WEATHER_PRODUCTION_MODE && customMetadata.validationStatus !== 'official') {
          setHourlyWeatherSourceType('none')
          setHourlyWeatherRecords([])
          setHourlyWeatherMetadata(null)
          setHourlyWeatherValidationWarning('')
          setHourlyWeatherParseError('Production mode requires an official CWEC / Government of Canada weather file (validationStatus = official).')
          return
        }

        setHourlyWeatherSourceType('custom')
        setCalculationMethod('hourly')
        setHourlyWeatherFileLocation(weatherLocation || '')
        setHourlyWeatherRecords(records)
        setHourlyWeatherMetadata(customMetadata)
        setHourlyWeatherValidationWarning(customMetadata.validationStatus === 'official' ? '' : getCustomWeatherWarning(language))
        setHourlyWeatherParseError('')
      } catch (error) {
        setHourlyWeatherSourceType('none')
        setHourlyWeatherRecords([])
        setHourlyWeatherMetadata(null)
        setHourlyWeatherValidationWarning('')
        setHourlyWeatherParseError(error?.message || 'Unable to parse hourly weather file.')
      } finally {
        setHourlyWeatherLoading(false)
      }
    }
    reader.onerror = () => {
      setHourlyWeatherSourceType('none')
      setHourlyWeatherRecords([])
      setHourlyWeatherMetadata(null)
      setHourlyWeatherValidationWarning('')
      setHourlyWeatherParseError('Failed to read the selected file.')
      setHourlyWeatherLoading(false)
    }
    reader.readAsText(file)
  }

  const outsideWinterTemp = selectedCity.hiver

  // Free Cooling is only available with the evaporative/atomization mode.
  const isFreeCoolingMode = ventilationMode.type === 'free-cooling-evaporative'
  const showFreeCoolingTables = isFreeCoolingMode && ventilationMode.type !== 'outside-air'
  const is100OA = ventilationMode.type === 'outside-air'
  const economizerActive = isFreeCoolingMode && outsideWinterTemp < economizerTargetTemp
  const activeFraction = isFreeCoolingMode ? minimumOutsideAirPercent / 100 : ventilationMode.fraction
  const effectiveOutsideAirCFM = Math.round(outsideAirCFM * activeFraction)
  const calculatedReturnAirCFM = Math.max(0, outsideAirCFM - effectiveOutsideAirCFM)
  const noRecoverySelection = heatRecoverySystems[language][0]
  const displayedHeatRecoverySystems = isFreeCoolingMode
    ? [noRecoverySelection]
    : heatRecoverySystems[language]
  const activeSelectedRecoveries = isFreeCoolingMode
    ? [noRecoverySelection]
    : selectedRecoveries
  const selectedReheatEnergySource = String(selectedReheatSystem?.energie || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const usesHeatPumpReheat = selectedReheatEnergySource.includes('thermopompe') ||
    selectedReheatEnergySource.includes('heat pump')
  const builtInHourlyWeatherFilePath = getBuiltInHourlyWeatherFilePath(selectedCity.nom)
  const builtInHourlyWeatherFileName = getBuiltInHourlyWeatherFileName(selectedCity.nom)
  const isHourlyMode = calculationMethod === 'hourly'
  const hasLoadedHourlyEpw =
    isHourlyMode &&
    Array.isArray(hourlyWeatherRecords) &&
    hourlyWeatherRecords.length >= 8750
  const scheduleStartHour = Number(String(scheduleStartTime || '00:00').split(':')[0] || 0)
  const scheduleEndHour = Number(String(scheduleEndTime || '00:00').split(':')[0] || 0)
  const filteredHourlyRecords = calculationMethod === 'hourly'
    ? hourlyWeatherRecords.filter((record) => isEpwRecordOperating(record, scheduleMode, scheduleStartTime, scheduleEndTime, scheduleDaysOption, scheduleCustomDays))
    : []
  const hasFilteredHourlyRecords =
    hasLoadedHourlyEpw &&
    Array.isArray(filteredHourlyRecords) &&
    filteredHourlyRecords.length > 0
  const hourlyWeatherFileFound = calculationMethod === 'hourly' && hasLoadedHourlyEpw
  const hourlyWeatherFileMissing = calculationMethod === 'hourly' && !hourlyWeatherFileFound
  const shouldShowBuiltInFileNotFound =
    calculationMethod === 'hourly' &&
    hourlyWeatherSourceType !== 'custom' &&
    !hasLoadedHourlyEpw &&
    !hourlyWeatherLoading &&
    hourlyWeatherBuiltInMissing
  const hourlyWeatherLoadError = hasLoadedHourlyEpw
    ? ''
    : (shouldShowBuiltInFileNotFound ? getBuiltInHourlyFallbackMessage(selectedCity.nom, t) : hourlyWeatherParseError)
  const noScheduleMatchMessage = language === 'fr'
    ? 'Le fichier EPW est chargé, mais aucun enregistrement ne correspond à l’horaire d’exploitation sélectionné.'
    : 'EPW file loaded, but no records match the selected operating schedule.'
  const hourlyWeatherWarning = hasLoadedHourlyEpw && !hasFilteredHourlyRecords
    ? noScheduleMatchMessage
    : (hasLoadedHourlyEpw ? '' : hourlyWeatherValidationWarning)
  const customWeatherFile = hourlyWeatherSourceType === 'custom'
  const loadedWeatherFileName = (hourlyWeatherFileName || builtInHourlyWeatherFileName || '').toLowerCase()
  const parsedWeatherRecordsCount = Number(hourlyWeatherRecordsLoaded || hourlyWeatherMetadata?.recordCount || 0)
  const isOfficialBuiltInHourlyFileLoaded =
    !customWeatherFile &&
    OFFICIAL_BUILT_IN_EPW_FILES.has(loadedWeatherFileName) &&
    parsedWeatherRecordsCount === 8760
  const validationDisplayLabel = language === 'fr' ? 'officiel' : 'official'
  const effectiveWeatherValidationStatus = isOfficialBuiltInHourlyFileLoaded
    ? 'official'
    : (hourlyWeatherMetadata?.validationStatus || '')
  const reheatInputKw = (thermalKw) => Math.round(
    usesHeatPumpReheat
      ? thermalKw / Math.max(heatPumpCOP, 0.1)
      : thermalKw * (selectedReheatSystem?.facteur ?? 1)
  )
  const weatherSourceCalculationLabel = calculationMethod === 'hourly'
    ? (hourlyWeatherSourceType === 'custom'
      ? (language === 'fr' ? 'EPW horaire personnalisé' : 'Custom hourly EPW')
      : (language === 'fr' ? 'EPW horaire intégré' : 'Built-in hourly EPW'))
    : (language === 'fr' ? 'Méthode heures BIN' : 'BIN hours method')

  useEffect(() => {
    if (calculationMethod !== 'hourly') return
    if (!hasLoadedHourlyEpw) return
    if (!hourlyWeatherParseError) return

    const normalized = String(hourlyWeatherParseError).toLowerCase()
    if (normalized.includes('built-in hourly weather file') || normalized.includes('fichier météo horaire intégré')) {
      setHourlyWeatherParseError('')
    }
  }, [calculationMethod, hasLoadedHourlyEpw, hourlyWeatherParseError])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (calculationMethod !== 'hourly') {
      setHourlyWeatherLoading(false)
      return
    }
    if (hourlyWeatherSourceType === 'custom') return

    if (!builtInHourlyWeatherFilePath) {
      const fallbackMessage = getBuiltInHourlyFallbackMessage(selectedCity.nom, t)
      setHourlyWeatherSourceType('none')
      setHourlyWeatherFileName('')
      setHourlyWeatherFileLocation('')
      setHourlyWeatherRecords([])
      setHourlyWeatherMetadata(null)
      setHourlyWeatherValidationWarning('')
      setHourlyWeatherSummary(null)
      setHourlyWeatherRecordsLoaded(0)
      setHourlyWeatherOperatingHoursUsed(0)
      setHourlyWeatherResolvedUrl('')
      setHourlyWeatherFetchStatus(0)
      setHourlyWeatherDebugRecordCount(0)
      setHourlyWeatherBuiltInMissing(true)
      setHourlyWeatherParseError(fallbackMessage)
      return
    }

    let isCancelled = false
    setHourlyWeatherSourceType('none')
    setHourlyWeatherFileName('')
    setHourlyWeatherFileLocation('')
    setHourlyWeatherRecords([])
    setHourlyWeatherMetadata(null)
    setHourlyWeatherValidationWarning('')
    setHourlyWeatherSummary(null)
    setHourlyWeatherRecordsLoaded(0)
    setHourlyWeatherOperatingHoursUsed(0)
    setHourlyWeatherResolvedUrl('')
    setHourlyWeatherFetchStatus(0)
    setHourlyWeatherDebugRecordCount(0)
    setHourlyWeatherBuiltInMissing(false)
    setHourlyWeatherLoading(true)
    setHourlyWeatherParseError('')

    const fileName = getBuiltInEpwFileName(selectedCity?.nom || '')
    if (!fileName) {
      const fallbackMessage = getBuiltInHourlyFallbackMessage(selectedCity.nom, t)
      setHourlyWeatherLoading(false)
      setHourlyWeatherBuiltInMissing(true)
      setHourlyWeatherParseError(fallbackMessage)
      return
    }

    const epwUrl = buildEpwUrl(fileName)
    setHourlyWeatherResolvedUrl(epwUrl)

    fetch(`${epwUrl}?v=${Date.now()}`, { cache: 'no-store' })
      .then(async (response) => {
        const text = await response.text()
        if (isCancelled) return null

        setHourlyWeatherFetchStatus(response.status)

        if (!response.ok) {
          throw new Error(`BUILT_IN_FETCH_NOT_OK::${response.status}`)
        }

        if (!String(text || '').trim()) {
          throw new Error('BUILT_IN_EMPTY_RESPONSE')
        }

        return text
      })
      .then((text) => {
        if (!text || isCancelled) return
        if (isCancelled) return
        const weatherLines = text
          .split(/\r?\n/)
          .filter((line) => /^\d{4},\d{1,2},\d{1,2},\d{1,2},/.test(String(line || '').trim()))

        setHourlyWeatherDebugRecordCount(weatherLines.length)

        if (weatherLines.length === 0) {
          throw new Error('BUILT_IN_ZERO_RECORDS')
        }

        const { weatherLocation, records } = epwTextToRecords(text)
        const metadata = getWeatherMetadataForCity(selectedCity.nom)

        if (!Array.isArray(records) || records.length === 0) {
          throw new Error('EPW weather file validation failed: unable to parse hourly records.')
        }

        if (weatherLines.length < 8750) {
          throw new Error('EPW weather file validation failed: expected at least 8750 valid hourly weather lines.')
        }

        if (WEATHER_PRODUCTION_MODE && metadata?.validationStatus !== 'official') {
          throw new Error('Production mode requires an official CWEC / Government of Canada weather file (validationStatus = official).')
        }

        const isOfficialBuiltIn = isOfficialBuiltInWeatherFileMatch(fileName, weatherLines.length)
        const resolvedMetadata = {
          ...(metadata || {}),
          validationStatus: isOfficialBuiltIn ? 'official' : (metadata?.validationStatus || ''),
          recordCount: weatherLines.length,
        }

        setHourlyWeatherFileName(fileName)
        setHourlyWeatherFileLocation(weatherLocation || selectedCity.nom)
        setHourlyWeatherRecords(records)
        setHourlyWeatherMetadata(resolvedMetadata)
        setHourlyWeatherValidationWarning('')
        setHourlyWeatherBuiltInMissing(false)
        const summary = calculateHourlySimulation(records, {
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
          selectedRecoveries: activeSelectedRecoveries,
          wheelEfficiency,
          latentRecoveryEfficiency,
          selectedReheatSystem,
          heatPumpCOP,
          steamBoilerEfficiency,
          atmosphericGasHumidifierEfficiency,
          electricityRate,
          naturalGasRate,
        })
        setHourlyWeatherSummary(summary)
        setHourlyWeatherRecordsLoaded(summary.recordsLoaded)
        setHourlyWeatherOperatingHoursUsed(summary.operatingHoursUsed)
        setHourlyWeatherParseError('')
      })
      .catch((error) => {
        if (isCancelled) return
        setHourlyWeatherSourceType('none')
        setHourlyWeatherRecords([])
        setHourlyWeatherMetadata(null)
        setHourlyWeatherValidationWarning('')
        setHourlyWeatherSummary(null)
        setHourlyWeatherRecordsLoaded(0)
        setHourlyWeatherOperatingHoursUsed(0)
        setHourlyWeatherDebugRecordCount(0)

        const errorMessage = String(error?.message || '')
        const shouldShowBuiltInFallbackMessage =
          errorMessage.startsWith('BUILT_IN_FETCH_NOT_OK') ||
          errorMessage === 'BUILT_IN_EMPTY_RESPONSE' ||
          errorMessage === 'BUILT_IN_ZERO_RECORDS'
        setHourlyWeatherBuiltInMissing(shouldShowBuiltInFallbackMessage)

        const fetchStatusFromError = errorMessage.startsWith('BUILT_IN_FETCH_NOT_OK::')
          ? errorMessage.split('::')[1]
          : ''

        setHourlyWeatherParseError(
          shouldShowBuiltInFallbackMessage
            ? `${getBuiltInHourlyFallbackMessage(selectedCity.nom, t)}${errorMessage.startsWith('BUILT_IN_FETCH_NOT_OK')
              ? ` (${language === 'fr' ? 'EPW introuvable' : 'EPW not found'}: ${epwUrl}; Status: ${fetchStatusFromError || hourlyWeatherFetchStatus || '-'})`
              : ''}`
            : (error?.message || t.builtInWeatherLoadFailed)
        )
      })
      .finally(() => {
        if (!isCancelled) setHourlyWeatherLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [
    calculationMethod,
    selectedCity.nom,
    scheduleMode,
    scheduleStartTime,
    scheduleEndTime,
    scheduleDaysOption,
    JSON.stringify(scheduleCustomDays),
    hourlyWeatherSourceType,
    t.noBuiltInWeatherAvailable,
    t.builtInWeatherLoadFailed,
  ])

  useEffect(() => {
    if (calculationMethod !== 'hourly') return
    if (!hourlyWeatherRecords.length) {
      setHourlyWeatherSummary(null)
      setHourlyWeatherRecordsLoaded(0)
      setHourlyWeatherOperatingHoursUsed(0)
      return
    }

    try {
      const summary = calculateHourlySimulation(hourlyWeatherRecords, {
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
        selectedRecoveries: activeSelectedRecoveries,
        wheelEfficiency,
        latentRecoveryEfficiency,
        selectedReheatSystem,
        heatPumpCOP,
        steamBoilerEfficiency,
        atmosphericGasHumidifierEfficiency,
        electricityRate,
        naturalGasRate,
      })
      setHourlyWeatherSummary(summary)
      setHourlyWeatherRecordsLoaded(summary.recordsLoaded)
      setHourlyWeatherOperatingHoursUsed(summary.operatingHoursUsed)
      setHourlyWeatherParseError('')
    } catch (error) {
      setHourlyWeatherSummary(null)
      setHourlyWeatherRecordsLoaded(hourlyWeatherRecords.length)
      setHourlyWeatherOperatingHoursUsed(0)
      setHourlyWeatherParseError(error?.message || 'Unable to calculate hourly simulation.')
    }
  }, [
    calculationMethod,
    hourlyWeatherRecords,
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
    activeSelectedRecoveries,
    wheelEfficiency,
    latentRecoveryEfficiency,
    selectedReheatSystem,
    heatPumpCOP,
    steamBoilerEfficiency,
    atmosphericGasHumidifierEfficiency,
    electricityRate,
    naturalGasRate,
  ])

  const operatingDaysPerWeek = scheduleMode === '24-7'
    ? 7
    : getScheduleDaysPerWeek(scheduleDaysOption, scheduleCustomDays)
  const dailyOperatingHours = computeScheduleDailyHours(scheduleStartTime, scheduleEndTime, scheduleMode)
  const weeklyOperatingHours = dailyOperatingHours * operatingDaysPerWeek
  const isCustomOperatingHoursMode = scheduleMode === 'custom'
  const baseScheduleFactor = scheduleMode === '24-7'
    ? 1
    : Number((weeklyOperatingHours / 168).toFixed(4))
  const hasHourlySimulationSummary = Boolean(hourlyWeatherSummary) && Number.isFinite(Number(hourlyWeatherSummary?.recordsLoaded))
  const isHourlySimulationActive = calculationMethod === 'hourly' && hasLoadedHourlyEpw && hasHourlySimulationSummary
  const scheduleFactor = isHourlySimulationActive ? 1 : baseScheduleFactor

  const metrics = calculateHvacDashboardMetrics({
    outsideAirCFM,
    effectiveOutsideAirCFM,
    roomTemperature,
    roomRelativeHumidity,
    supplyAirTemperature: is100OA ? supplyAirTemperature : roomTemperature,
    outsideWinterTemp,
    selectedRecoveries: activeSelectedRecoveries,
    wheelEfficiency,
    latentRecoveryEfficiency,
    selectedReheatSystem,
    heatPumpCOP,
    steamBoilerEfficiency,
    atmosphericGasHumidifierEfficiency,
    electricityRate,
    naturalGasRate,
    selectedCity,
    economizerTargetTemp,
    is100OA,
    outsideRelativeHumidity: 90,
    scheduleFactor,
  })

  const {
    indoorGrains,
    outdoorGrains,
    indoorHumidityRatio,
    outdoorHumidityRatio,
    indoorEnthalpy,
    outdoorEnthalpy,
    correctedHumidificationLoad,
    cappedRecoveryEfficiency,
    oaTempCalc,
    adiabaticTemperatureDrop,
    preHumifogTemp,
    preHumifogRh,
    afterHumifogTemp,
    afterHumifogRh,
    grossReheatKW,
    grossHumifogPreheatKW,
    baseHvacHeatingThermalKW,
    reheatEnergyKW,
    recoveryEnergyReductionKW,
    steamEnergyKW,
    recoveredHeatKW,
    netReheatKW,
    adiabaticHumidificationKW,
    adiabaticEnergyKW,
    naturalGasSteamInputKW,
    naturalGasM3PerHour,
    atmosphericGasHumidifierInputKW,
    atmosphericGasHumidifierM3PerHour,
    climateSeverityFactor,
    annualHumidificationHours,
    annualSteamCost,
    annualNaturalGasCost,
    annualAtmosphericGasHumidifierCost,
    annualAdiabaticCost,
    savings,
    steamEnergyKWRaw,
    adiabaticEnergyKWRaw,
    commonHvacHeatingThermalKW,
    commonHvacHeatingThermalKWRaw,
    naturalGasSteamInputKWRaw,
    atmosphericGasHumidifierInputKWRaw,
    adiabaticHumidificationKWRaw,
    reheatEnergyKWRaw,
    grossReheatKWRaw,
    annualHumidificationHoursRaw,
    annualSteamCostRaw,
    annualNaturalGasCostRaw,
    annualAtmosphericGasHumidifierCostRaw,
    annualAdiabaticCostRaw,
    annualAdiabaticPumpCostRaw,
    annualAdiabaticReheatCostRaw,
    naturalGasGESRaw,
    atmosphericGasHumidifierGESRaw,
    adiabaticGESRaw,
    eliminatedGESRaw,
  } = metrics

  const selectedRecovery = activeSelectedRecoveries[0]
  const selectedRecoveryDisplayName = localizeRecoveryDisplayName(selectedRecovery, language)
  const selectedRecoveryName = selectedRecovery?.nom ?? ''
  const selectedRecoveryNameLower = selectedRecoveryName.toLowerCase()
  const isNoRecovery = Boolean(selectedRecovery?.noRecovery)
  const selectedRecoverySupportsLatent = supportsLatentRecovery(selectedRecovery)
  const effectiveSensibleRecoveryEfficiency = isNoRecovery ? 0 : clampValue(Number(wheelEfficiency), 0, 95)
  const effectiveLatentRecoveryEfficiency = isNoRecovery || !selectedRecoverySupportsLatent
    ? 0
    : clampValue(Number(latentRecoveryEfficiency), 0, 95)
  const humidifierType = 'HUMIFOG'

  const recoveryGroup = isNoRecovery
    ? 'NONE'
    : selectedRecoveryNameLower.includes('cassette')
      ? 'CASSETTE'
    : selectedRecoveryNameLower.includes('crois') || selectedRecoveryNameLower.includes('cross') || selectedRecoveryNameLower.includes('cassette sensible')
        ? 'CROSSFLOW'
        : selectedRecoveryNameLower.includes('boucle') || selectedRecoveryNameLower.includes('glycol')
          ? 'GLYCOL'
          : 'WHEEL'

  const systemSchematicId = resolveSystemSchematicId({ recoveryGroup, isFreeCoolingMode })
  const selectedSystemSchematic = getSystemSchematic(systemSchematicId)
  const selectedSystemImageSrc = selectedSystemSchematic.imageSrc

  const systemImageLabels = {
    WHEEL: language === 'fr' ? 'Roue enthalpique' : 'Enthalpy Wheel',
    CROSSFLOW: language === 'fr' ? 'Échangeur à débit croisé' : 'Crossflow Plate HX',
    CASSETTE: language === 'fr' ? 'Échangeur à cassettes' : 'Cassette Exchanger',
    GLYCOL: language === 'fr' ? 'Boucle glycolée' : 'Run-around Glycol Loop',
    BASIC: language === 'fr' ? 'CTA de base' : 'Basic AHU',
    NONE: language === 'fr' ? 'Aucune récupération' : 'No recovery',
  }
  const systemImageLabel = systemImageLabels[recoveryGroup] || systemImageLabels.WHEEL
  const selectedSystemDiagramLabel = systemImageLabel
  const selectedReheatSystemDisplayName = selectedReheatEnergySource.includes('thermopompe') ||
    selectedReheatEnergySource.includes('heat pump')
    ? (language === 'fr' ? 'Thermopompe air/eau' : 'Air/Water Heat Pump')
    : selectedReheatEnergySource.includes('gaz') || selectedReheatEnergySource.includes('natural gas')
      ? (language === 'fr' ? 'Eau chaude gaz naturel' : 'Natural Gas Hot Water')
      : selectedReheatEnergySource.includes('recuperation') ||
          selectedReheatEnergySource.includes('recovery') ||
          selectedReheatEnergySource.includes('passive')
        ? (language === 'fr' ? 'Boucle récupération chaleur' : 'Heat Recovery Loop')
        : (language === 'fr' ? 'Électrique' : 'Electric')
  const electricityEquipmentLabels = [
    Number(steamEnergyKW) > 0 ? (language === 'fr' ? 'Vapeur électrique' : 'Electric steam') : '',
    humidifierType === 'HUMIFOG' ? 'Humifog' : '',
    usesHeatPumpReheat ? (language === 'fr' ? 'thermopompe' : 'heat pump') : '',
  ].filter(Boolean)
  const electricityEquipmentLabel = joinLocalizedList(electricityEquipmentLabels, language)
  const freeCoolingRecoveryType = {
    WHEEL: 'enthalpyWheel',
    CROSSFLOW: 'crossflowPlate',
    CASSETTE: 'crossflowPlate',
    GLYCOL: 'sensibleWheel',
    BASIC: 'sensibleWheel',
    NONE: 'none',
  }[recoveryGroup] || 'none'

  const binDataByCity = {
    'Montr\u00E9al': [
      [-30, 42], [-25, 115], [-20, 245], [-15, 420],
      [-10, 680], [-5, 920], [0, 1150], [5, 760],
    ],
    'Qu\u00E9bec': [
      [-35, 60], [-30, 140], [-25, 310], [-20, 520],
      [-15, 780], [-10, 980], [-5, 920], [0, 610],
    ],
    'Ottawa': [
      [-30, 55], [-25, 135], [-20, 275], [-15, 460],
      [-10, 720], [-5, 950], [0, 1120], [5, 730],
    ],
    'Toronto': [
      [-20, 35], [-15, 110], [-10, 260], [-5, 520],
      [0, 890], [5, 1220], [10, 980], [15, 640],
    ],
    'Vancouver': [
      [-10, 10], [-5, 55], [0, 220], [5, 880],
      [10, 1420], [15, 1180], [20, 620], [25, 180],
    ],
    'Calgary': [
      [-35, 80], [-30, 180], [-25, 360], [-20, 640],
      [-15, 920], [-10, 1040], [-5, 740], [0, 420],
    ],
    'Winnipeg': [
      [-40, 95], [-35, 220], [-30, 410], [-25, 720],
      [-20, 980], [-15, 1120], [-10, 760], [-5, 340],
    ],
  }

  const selectedBinData = binDataByCity[selectedCity.nom] || binDataByCity['Montr\u00E9al']
  const binOperatingDaysPerWeek = scheduleMode === '24-7'
    ? 7
    : getScheduleDaysPerWeek(scheduleDaysOption, scheduleCustomDays)
  const binDailyOperatingHours = computeScheduleDailyHours(scheduleStartTime, scheduleEndTime, scheduleMode)
  const binWeeklyOperatingHours = binDailyOperatingHours * binOperatingDaysPerWeek
  const originalBinHours = selectedBinData.reduce((total, [, hours]) => total + hours, 0)
  const binScheduleFactor = isHourlySimulationActive
    ? 1
    : scheduleMode === '24-7'
    ? 1
    : Number((binWeeklyOperatingHours / 168).toFixed(4))
  const annualOperatingHours = isHourlySimulationActive
    ? filteredHourlyRecords.length
    : Math.round(weeklyOperatingHours * BIN_WEEKS_PER_YEAR)
  const annualOperatingPercent = Number(((annualOperatingHours / 8760) * 100).toFixed(1))
  const activeScheduleDays = resolveScheduleActiveDays(scheduleDaysOption, scheduleCustomDays)
  const setQuickScheduleDays = (option) => {
    setScheduleDaysOption(option)
    if (option !== 'custom') {
      setScheduleCustomDays(resolveScheduleActiveDays(option, scheduleCustomDays))
    }
  }
  const toggleScheduleDay = (dayKey) => {
    if (scheduleMode === '24-7') return
    const baseDays = resolveScheduleActiveDays(scheduleDaysOption, scheduleCustomDays)
    const toggledDays = { ...baseDays, [dayKey]: !Boolean(baseDays[dayKey]) }
    setScheduleDaysOption('custom')
    setScheduleCustomDays(toggledDays)
  }
  const effectiveBinData = selectedBinData.map(([tempC, hours]) => [tempC, Number((hours * binScheduleFactor).toFixed(3))])
  const totalBinHours = Math.round(effectiveBinData.reduce((total, item) => total + item[1], 0))
  const dominantBin = effectiveBinData.reduce((max, item) => (item[1] > max[1] ? item : max), effectiveBinData[0])
  // Convert BIN temperature labels to the active unit system for display.
  const displayedBinData = effectiveBinData.map(([tempC, hours], index) => ({
    tempC,
    temperature: `${displayTemp(tempC)}${tempUnit}`,
    temperatureBin: `${displayTemp(tempC)}${tempUnit}`,
    originalHours: Number(selectedBinData[index][1].toFixed(1)),
    hoursUsed: Number(hours.toFixed(1)),
    heures: Number(hours.toFixed(1)),
  }))

  const hourlyHistogramBinSizeC = 5
  const hourlyWeatherHistogramData = calculationMethod === 'hourly'
    ? (() => {
      if (!hasFilteredHourlyRecords) return []

      const buckets = new Map()
      filteredHourlyRecords.forEach((record) => {
        if (!Number.isFinite(record?.dryBulbC)) return
        const binStart = Math.floor(record.dryBulbC / hourlyHistogramBinSizeC) * hourlyHistogramBinSizeC
        buckets.set(binStart, (buckets.get(binStart) || 0) + 1)
      })

      return [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([binStart, hours]) => ({
          tempC: binStart,
          temperatureBin: language === 'fr'
            ? `${displayTemp(binStart)}${tempUnit} à ${displayTemp(binStart + hourlyHistogramBinSizeC)}${tempUnit}`
            : `${displayTemp(binStart)}${tempUnit} to ${displayTemp(binStart + hourlyHistogramBinSizeC)}${tempUnit}`,
          hoursUsed: Number(hours),
        }))
    })()
    : []

  const weatherChartData = calculationMethod === 'hourly'
    ? hourlyWeatherHistogramData
    : displayedBinData
  const showOriginalBinHoursInChart = calculationMethod === 'bin' && !isCustomOperatingHoursMode
  const isWeatherChartEmpty = calculationMethod === 'hourly'
    ? (!hourlyWeatherRecords.length || !hasFilteredHourlyRecords || hourlyWeatherHistogramData.length === 0)
    : weatherChartData.length === 0
  const selectedBinWeatherData = effectiveBinData.map(([tempC, hours]) => ({
    tempC,
    hours,
    rh: Math.round(Math.max(35, Math.min(90, selectedCity.humidite + (10 - tempC) * 0.45))),
  }))
  const freeCoolingWeatherData = isHourlySimulationActive
    ? filteredHourlyRecords.map((record) => ({
      tempC: Number(record.dryBulbC),
      hours: 1,
      rh: Number(record.relativeHumidity),
    }))
    : selectedBinWeatherData
  const freeCoolingOptimizationWeatherData = isHourlySimulationActive
    ? compactWeatherBins(freeCoolingWeatherData, 96)
    : freeCoolingWeatherData
  const binEnergyRows = selectedBinWeatherData.map((bin) => {
    const binMetrics = calculateHvacDashboardMetrics({
      outsideAirCFM,
      effectiveOutsideAirCFM,
      roomTemperature,
      roomRelativeHumidity,
      supplyAirTemperature: is100OA ? supplyAirTemperature : roomTemperature,
      outsideWinterTemp: bin.tempC,
      selectedRecoveries: activeSelectedRecoveries,
      wheelEfficiency,
      latentRecoveryEfficiency,
      selectedReheatSystem,
      heatPumpCOP,
      steamBoilerEfficiency,
      atmosphericGasHumidifierEfficiency,
      electricityRate,
      naturalGasRate,
      selectedCity: { ...selectedCity, hiver: bin.tempC },
      economizerTargetTemp,
      is100OA,
      outsideRelativeHumidity: bin.rh,
      scheduleFactor: 1,
    })

    const steamPowerKW = Number(binMetrics.steamEnergyKWRaw || binMetrics.steamEnergyKW || 0)
    const adiabaticPumpPowerKW = Number(binMetrics.adiabaticPumpKWRaw || binMetrics.adiabaticPumpKW || 0)
    const additionalSelectedPreheatInputKW = Number(binMetrics.reheatEnergyKWRaw || binMetrics.reheatEnergyKW || 0)
    const additionalThermalPreheatKW = Number(binMetrics.grossReheatKWRaw || binMetrics.grossReheatKW || 0)
    const additionalElectricPreheatKW = additionalThermalPreheatKW
    const additionalHeatPumpPowerKW = additionalThermalPreheatKW / Math.max(heatPumpCOP, 0.1)
    const adiabaticTotalPowerKW = Number(binMetrics.adiabaticEnergyKWRaw || binMetrics.adiabaticEnergyKW || 0)
    const naturalGasSteamInputKWBin = Number(binMetrics.naturalGasSteamInputKWRaw || binMetrics.naturalGasSteamInputKW || 0)
    const atmosphericGasInputKWBin = Number(binMetrics.atmosphericGasHumidifierInputKWRaw || binMetrics.atmosphericGasHumidifierInputKW || 0)
    const steamBinEnergyKwh = steamPowerKW * bin.hours
    const adiabaticBinEnergyKwh = adiabaticTotalPowerKW * bin.hours
    const commonHeatingBinEnergyKwh = Number(binMetrics.commonHvacHeatingThermalKWRaw || 0) * bin.hours
    const naturalGasSteamEnergyKwhBin = naturalGasSteamInputKWBin * bin.hours
    const atmosphericGasEnergyKwhBin = atmosphericGasInputKWBin * bin.hours
    const adiabaticPumpEnergyKwhBin = adiabaticPumpPowerKW * bin.hours
    const selectedPreheatEnergyKwhBin = additionalSelectedPreheatInputKW * bin.hours
    const electricPreheatEnergyKwhBin = additionalElectricPreheatKW * bin.hours
    const heatPumpPreheatEnergyKwhBin = additionalHeatPumpPowerKW * bin.hours
    const adiabaticElectricTotalEnergyKwhBin = (adiabaticPumpPowerKW + additionalElectricPreheatKW) * bin.hours
    const adiabaticHeatPumpTotalEnergyKwhBin = (adiabaticPumpPowerKW + additionalHeatPumpPowerKW) * bin.hours

    return {
      tempC: bin.tempC,
      rh: bin.rh,
      hours: bin.hours,
      steamPowerKW,
      steamBinEnergyKwh,
      adiabaticPumpPowerKW,
      additionalThermalPreheatKW,
      additionalSelectedPreheatInputKW,
      additionalElectricPreheatKW,
      additionalHeatPumpPowerKW,
      adiabaticTotalPowerKW,
      adiabaticBinEnergyKwh,
      naturalGasSteamInputKWBin,
      atmosphericGasInputKWBin,
      naturalGasSteamEnergyKwhBin,
      atmosphericGasEnergyKwhBin,
      adiabaticPumpEnergyKwhBin,
      selectedPreheatEnergyKwhBin,
      electricPreheatEnergyKwhBin,
      heatPumpPreheatEnergyKwhBin,
      adiabaticElectricTotalEnergyKwhBin,
      adiabaticHeatPumpTotalEnergyKwhBin,
      baseHvacHeatingKwhBin: commonHeatingBinEnergyKwh,
      steamTotalBinEnergyKwh: steamBinEnergyKwh + commonHeatingBinEnergyKwh,
      adiabaticTotalBinEnergyKwh: adiabaticBinEnergyKwh + commonHeatingBinEnergyKwh,
      recoveryPowerKW: Number(binMetrics.recoveryEnergyReductionKW || 0),
      afterRecoveryTempC: Number(binMetrics.afterWheelTemp || 0),
      enteringHumidityRatio: Number(binMetrics.enteringHumidityRatio || 0),
    }
  })
  const binAnnualSteamEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.steamTotalBinEnergyKwh, 0)
  const binAnnualAdiabaticEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.adiabaticTotalBinEnergyKwh, 0)
  const binAnnualNaturalGasSteamEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.naturalGasSteamEnergyKwhBin, 0)
  const binAnnualAtmosphericGasEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.atmosphericGasEnergyKwhBin, 0)
  const binAnnualHumifogPumpEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.adiabaticPumpEnergyKwhBin, 0)
  const binAnnualHumifogSelectedPreheatEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.selectedPreheatEnergyKwhBin, 0)
  const binAnnualHumifogElectricPreheatEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.electricPreheatEnergyKwhBin, 0)
  const binAnnualHumifogHeatPumpPreheatEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.heatPumpPreheatEnergyKwhBin, 0)
  const binAnnualHumifogElectricTotalEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.adiabaticElectricTotalEnergyKwhBin, 0)
  const binAnnualHumifogHeatPumpTotalEnergyKwh = binEnergyRows.reduce((sum, row) => sum + row.adiabaticHeatPumpTotalEnergyKwhBin, 0)
  const binAnnualCommonHvacHeatingKwh = binEnergyRows.reduce((sum, row) => sum + row.baseHvacHeatingKwhBin, 0)
  const binEnergyReductionPercent = binAnnualSteamEnergyKwh > 0
    ? Math.round((1 - binAnnualAdiabaticEnergyKwh / binAnnualSteamEnergyKwh) * 100)
    : 0
  const usesBinAnnualTotals = calculationMethod === 'bin' && !isFreeCoolingMode
  const usesHourlyAnnualTotals = isHourlySimulationActive && !isFreeCoolingMode
  const hourlyAnnualSteamEnergyKwh = Number(hourlyWeatherSummary?.annualSteamKwh || 0)
  const hourlyAnnualHumifogEnergyKwh = Number(hourlyWeatherSummary?.annualHumifogKwh || 0)
  const hourlyAnnualGasEnergyKwh = Number(hourlyWeatherSummary?.annualGasKwh || 0)
  const selectedReheatEnergySourceNormalized = String(selectedReheatSystem?.energie || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const selectedReheatUsesNaturalGas = selectedReheatEnergySourceNormalized.includes('gaz naturel') ||
    selectedReheatEnergySourceNormalized.includes('natural gas')
  const annualSteamEnergyKwhResolved = usesHourlyAnnualTotals
    ? hourlyAnnualSteamEnergyKwh
    : usesBinAnnualTotals
      ? binAnnualSteamEnergyKwh
      : steamEnergyKWRaw * annualHumidificationHoursRaw
  const annualAdiabaticEnergyKwhResolved = usesHourlyAnnualTotals
    ? hourlyAnnualHumifogEnergyKwh
    : usesBinAnnualTotals
      ? binAnnualAdiabaticEnergyKwh
      : adiabaticEnergyKWRaw * annualHumidificationHoursRaw
  const annualNaturalGasSteamEnergyKwhResolved = usesHourlyAnnualTotals
    ? hourlyAnnualGasEnergyKwh
    : usesBinAnnualTotals
      ? binAnnualNaturalGasSteamEnergyKwh
      : naturalGasSteamInputKWRaw * annualHumidificationHoursRaw
  const annualAtmosphericGasHumidifierEnergyKwhResolved = usesHourlyAnnualTotals
    ? hourlyAnnualGasEnergyKwh
    : usesBinAnnualTotals
      ? binAnnualAtmosphericGasEnergyKwh
      : atmosphericGasHumidifierInputKWRaw * annualHumidificationHoursRaw
  const annualHumifogPumpEnergyKwhResolved = usesHourlyAnnualTotals
    ? hourlyAnnualHumifogEnergyKwh
    : usesBinAnnualTotals
      ? binAnnualHumifogPumpEnergyKwh
      : adiabaticHumidificationKWRaw * annualHumidificationHoursRaw
  const annualHumifogSelectedPreheatEnergyKwhResolved = usesHourlyAnnualTotals
    ? hourlyAnnualHumifogEnergyKwh
    : usesBinAnnualTotals
      ? binAnnualHumifogSelectedPreheatEnergyKwh
      : reheatEnergyKWRaw * annualHumidificationHoursRaw
  const annualHumifogElectricPreheatEnergyKwhResolved = usesBinAnnualTotals
    ? binAnnualHumifogElectricPreheatEnergyKwh
    : grossReheatKWRaw * annualHumidificationHoursRaw
  const annualHumifogHeatPumpPreheatEnergyKwhResolved = usesBinAnnualTotals
    ? binAnnualHumifogHeatPumpPreheatEnergyKwh
    : (grossReheatKWRaw / Math.max(heatPumpCOP, 0.1)) * annualHumidificationHoursRaw
  const annualHumifogElectricTotalEnergyKwhResolved = usesBinAnnualTotals
    ? binAnnualHumifogElectricTotalEnergyKwh
    : (adiabaticHumidificationKWRaw + grossReheatKWRaw) * annualHumidificationHoursRaw
  const annualHumifogHeatPumpTotalEnergyKwhResolved = usesBinAnnualTotals
    ? binAnnualHumifogHeatPumpTotalEnergyKwh
    : (adiabaticHumidificationKWRaw + grossReheatKWRaw / Math.max(heatPumpCOP, 0.1)) * annualHumidificationHoursRaw
  const annualCommonHvacHeatingKwhResolved = usesBinAnnualTotals
    ? binAnnualCommonHvacHeatingKwh
    : commonHvacHeatingThermalKWRaw * annualHumidificationHoursRaw
  const annualSteamCostResolved = usesBinAnnualTotals
    ? (annualCommonHvacHeatingKwhResolved + annualSteamEnergyKwhResolved) * electricityRate
    : usesHourlyAnnualTotals
      ? annualSteamEnergyKwhResolved * electricityRate
      : (commonHvacHeatingThermalKWRaw + steamEnergyKWRaw) * electricityRate * annualHumidificationHoursRaw
  const annualHumifogPumpCostResolved = usesBinAnnualTotals
    ? annualHumifogPumpEnergyKwhResolved * electricityRate
    : annualAdiabaticPumpCostRaw
  const annualHumifogSelectedPreheatCostResolved = usesBinAnnualTotals
    ? (selectedReheatUsesNaturalGas
      ? (annualHumifogSelectedPreheatEnergyKwhResolved / 10.35) * naturalGasRate
      : annualHumifogSelectedPreheatEnergyKwhResolved * electricityRate)
    : annualAdiabaticReheatCostRaw
  const annualAdiabaticCostResolved = usesBinAnnualTotals
    ? annualHumifogPumpCostResolved + annualHumifogSelectedPreheatCostResolved
    : usesHourlyAnnualTotals
      ? Number(hourlyWeatherSummary?.annualCost || 0)
      : annualAdiabaticCostRaw
  const annualNaturalGasCostResolved = usesBinAnnualTotals
    ? annualCommonHvacHeatingKwhResolved * electricityRate + (annualNaturalGasSteamEnergyKwhResolved / 10.35) * naturalGasRate
    : commonHvacHeatingThermalKWRaw * electricityRate * annualHumidificationHoursRaw + annualNaturalGasCostRaw
  const annualAtmosphericGasHumidifierCostResolved = usesBinAnnualTotals
    ? annualCommonHvacHeatingKwhResolved * electricityRate + (annualAtmosphericGasHumidifierEnergyKwhResolved / 10.35) * naturalGasRate
    : commonHvacHeatingThermalKWRaw * electricityRate * annualHumidificationHoursRaw + annualAtmosphericGasHumidifierCostRaw
  const annualHumifogElectricCostResolved = usesBinAnnualTotals
    ? (annualCommonHvacHeatingKwhResolved + annualHumifogElectricTotalEnergyKwhResolved) * electricityRate
    : usesHourlyAnnualTotals
      ? Number(hourlyWeatherSummary?.annualCost || 0)
      : (commonHvacHeatingThermalKWRaw + adiabaticHumidificationKWRaw + grossReheatKWRaw) * annualHumidificationHoursRaw * electricityRate
  const annualHumifogHeatPumpCostResolved = usesBinAnnualTotals
    ? (annualCommonHvacHeatingKwhResolved + annualHumifogHeatPumpTotalEnergyKwhResolved) * electricityRate
    : (commonHvacHeatingThermalKWRaw + adiabaticHumidificationKWRaw + grossReheatKWRaw / Math.max(heatPumpCOP, 0.1)) * annualHumidificationHoursRaw * electricityRate
  const annualSavingsPercentResolved = annualSteamEnergyKwhResolved > 0
    ? Math.round((1 - annualAdiabaticEnergyKwhResolved / annualSteamEnergyKwhResolved) * 100)
    : 0
  const annualHumidificationHoursResolved = usesHourlyAnnualTotals
    ? Number(hourlyWeatherSummary?.operatingHoursUsed || 0)
    : usesBinAnnualTotals
      ? totalBinHours
      : annualHumidificationHoursRaw
  const annualNaturalGasGESResolved = usesBinAnnualTotals
    ? (annualNaturalGasSteamEnergyKwhResolved * 0.182) / 1000
    : naturalGasGESRaw
  const annualAtmosphericGasGESResolved = usesBinAnnualTotals
    ? (annualAtmosphericGasHumidifierEnergyKwhResolved * 0.182) / 1000
    : atmosphericGasHumidifierGESRaw
  const annualAdiabaticGESResolved = usesBinAnnualTotals
    ? (selectedReheatUsesNaturalGas
      ? (annualHumifogSelectedPreheatEnergyKwhResolved * 0.182) / 1000
      : 0)
    : adiabaticGESRaw
  const annualEliminatedGESResolved = annualNaturalGasGESResolved - annualAdiabaticGESResolved

  const freeCoolingHumifogAnalysis = calculateFreeCoolingHumifogComparison({
    bins: freeCoolingWeatherData,
    optimizationBins: freeCoolingOptimizationWeatherData,
    roomDb: roomTemperature,
    roomRh: roomRelativeHumidity,
    minimumOutdoorAirPercent: minimumOutsideAirPercent,
    recoveryType: isNoRecovery ? 'none' : freeCoolingRecoveryType,
    recoveryEfficiency: isNoRecovery ? 0 : cappedRecoveryEfficiency,
    humifogEffectiveness: ventilationMode.evaporativeEffectiveness ?? 0.72,
    airflowCfm: outsideAirCFM,
    electricityRate,
    naturalGasRate,
    mixedAirTargetDb: economizerTargetTemp,
    selectedReheatSystem,
    heatPumpCOP,
    useMeasuredMixedAirTemperature,
    measuredMixedAirTemperatureC: measuredMixedAirTemperature,
  })
  const displayedFreeCoolingRows = isHourlySimulationActive
    ? aggregateFreeCoolingComparisonRows(
      freeCoolingHumifogAnalysis.binRows,
      freeCoolingHumifogAnalysis.conventionalRows,
      5
    )
    : freeCoolingHumifogAnalysis.binRows.map((humifogRow, index) => ({
      humifogRow,
      steamRow: freeCoolingHumifogAnalysis.conventionalRows[index] || {},
    }))
  const freeCoolingCalculationComplete = Boolean(freeCoolingHumifogAnalysis.isComplete)
  const freeCoolingSummaryRows = freeCoolingHumifogAnalysis.binRows || []
  const isFreeCoolingSummaryRowActive = (row) => (
    row.outdoorAirPercent > minimumOutsideAirPercent + 0.05
  )
  const totalEconomizerHours = freeCoolingSummaryRows.reduce(
    (sum, row) => isFreeCoolingSummaryRowActive(row) ? sum + row.hours : sum,
    0
  )
  const averageOACFM = Math.round(
    totalEconomizerHours > 0
      ? freeCoolingSummaryRows.reduce((sum, row) => (
          isFreeCoolingSummaryRowActive(row)
            ? sum + row.outdoorAirCfm * row.hours
            : sum
        ), 0) / totalEconomizerHours
      : outsideAirCFM * (minimumOutsideAirPercent / 100)
  )
  const outsideAirReduction = totalEconomizerHours > 0
    ? Math.round((1 - averageOACFM / outsideAirCFM) * 100)
    : 0
  const calculationIncompleteText = language === 'fr' ? 'Calcul incomplet' : 'Incomplete calculation'
  const freeCoolingChartRowIndex = (freeCoolingHumifogAnalysis.binRows || []).reduce(
    (bestIndex, row, index, rows) => row.hours > (rows[bestIndex]?.hours ?? -1) ? index : bestIndex,
    0
  )
  const freeCoolingChartHumifogRow = freeCoolingHumifogAnalysis.binRows?.[freeCoolingChartRowIndex]
  const freeCoolingChartReferenceRow = freeCoolingHumifogAnalysis.conventionalRows?.[freeCoolingChartRowIndex]
  const hasFreeCoolingChartComparison = Boolean(
    showFreeCoolingTables &&
    !isCustomOperatingHoursMode &&
    freeCoolingCalculationComplete &&
    freeCoolingChartHumifogRow &&
    freeCoolingChartReferenceRow
  )
  const annualValidationRows = (freeCoolingHumifogAnalysis.binValidationRows || []).map((row) => {
    const humifogAnnualTotal = freeCoolingHumifogAnalysis.annualComparison.humifog.totalEnergyKwh || 0
    const appliedMixedDb = Number(row.humifogAppliedMixTempDb ?? row.mixedDb ?? 0)
    const adiabaticDeltaDb = Math.abs(Number(row.adiabaticCoolingC ?? 0))
    const humifogOutletAfterAtomizationDb = appliedMixedDb - adiabaticDeltaDb

    return {
      ...row,
      humifogAppliedMixTempDb: appliedMixedDb,
      adiabaticCoolingC: adiabaticDeltaDb,
      humifogOutletAfterAtomizationDb,
      humifogAfterAtomizationDb: humifogOutletAfterAtomizationDb,
      humifogOutletDb: humifogOutletAfterAtomizationDb,
      humifogAtomizationWarning: humifogOutletAfterAtomizationDb > appliedMixedDb + 0.0001,
      annualContributionPercent: humifogAnnualTotal > 0
        ? row.humifogOptimized.binEnergyKwh / humifogAnnualTotal * 100
        : 0,
    }
  })
  const annualTotalsValidation = freeCoolingHumifogAnalysis.annualTotalsValidation || {}
  const annualValidationStable = Boolean(
    annualTotalsValidation.energyTotalsMatch &&
    annualTotalsValidation.costTotalsMatch
  )
  const criticalHumifogReheatRow = annualValidationRows.reduce(
    (maxRow, row) => row.reheatLoadKw > (maxRow?.reheatLoadKw ?? -1) ? row : maxRow,
    null
  )
  const humifogAtomizationWarningRows = annualValidationRows.filter((row) => row.humifogAtomizationWarning)

  const energyData = monthLabels[language].map((mois, index) => {
    const seasonalFactor = monthlyFactors[index]
    return {
      mois,
      vapeur: Math.round(steamEnergyKW * seasonalFactor * climateSeverityFactor * scheduleFactor),
      gaz: Math.round(naturalGasSteamInputKW * seasonalFactor * climateSeverityFactor * scheduleFactor),
      humidificateurGaz: Math.round(atmosphericGasHumidifierInputKW * seasonalFactor * climateSeverityFactor * scheduleFactor),
      adiabatique: Math.round(adiabaticEnergyKW * seasonalFactor * climateSeverityFactor * scheduleFactor),
    }
  })

  const fallbackOutdoorState = stateFromDbW({
    dryBulbC: oaTempCalc,
    humidityRatio: outdoorHumidityRatio,
  })
  const fallbackReturnState = psychrometricState({
    dryBulbC: roomTemperature,
    relativeHumidity: roomRelativeHumidity,
  })
  const fallbackMixedState = is100OA
    ? fallbackOutdoorState
    : mixAirStates(fallbackOutdoorState, fallbackReturnState, activeFraction * 100)
  const fallbackRecoveryInletState = is100OA ? fallbackOutdoorState : fallbackMixedState
  const hasChartRecovery = !isFreeCoolingMode && !isNoRecovery && cappedRecoveryEfficiency > 0
  const fallbackRecoveredState = calculateRecoveryChartState(fallbackRecoveryInletState, fallbackReturnState, {
    sensibleRecoveryEfficiency: effectiveSensibleRecoveryEfficiency,
    latentRecoveryEfficiency: effectiveLatentRecoveryEfficiency,
    latentRecoverySupported: selectedRecoverySupportsLatent,
    isNoRecovery,
  })
  const fallbackConditionedInletState = hasChartRecovery ? fallbackRecoveredState : fallbackRecoveryInletState
  const chartHeatingBeforeHumifog = true
  const chartHumifogProcess = calculateHumifogAtomizationProcess(fallbackConditionedInletState, fallbackReturnState, language)
  const fallbackPreHumifogHeatingState = chartHumifogProcess.preheatState
  const fallbackAfterHumifogState = chartHumifogProcess.afterHumifogState
  const fallbackAfterHeatingState = fallbackPreHumifogHeatingState
  const displayedPreHumifogTemp = isFreeCoolingMode ? fallbackAfterHeatingState.db : preHumifogTemp
  const displayedPreHumifogRh = isFreeCoolingMode ? fallbackAfterHeatingState.rh : preHumifogRh
  const displayedAfterHumifogTemp = isFreeCoolingMode ? fallbackAfterHumifogState.db : afterHumifogTemp
  const displayedAfterHumifogRh = isFreeCoolingMode ? fallbackAfterHumifogState.rh : afterHumifogRh
  const adiabaticDisplayDropC = Math.max(0, fallbackPreHumifogHeatingState.db - fallbackAfterHumifogState.db)
  const recoveryPointLabel = recoveryGroup === 'WHEEL' ? 'After thermal wheel' : 'After recovery'
  const chartHeatingInletState = fallbackConditionedInletState
  const chartHeatingOutletState = fallbackAfterHeatingState
  const chartRecoveryThermalKw = hasChartRecovery
    ? sensibleHeatingKw(effectiveOutsideAirCFM, Math.max(0, fallbackRecoveredState.db - fallbackRecoveryInletState.db))
    : 0
  const chartPreheatDeltaHBtuLb = Math.max(0, (chartHeatingOutletState.h - chartHeatingInletState.h) * 0.429923)
  const chartPreheatBtuHr = 4.5 * effectiveOutsideAirCFM * chartPreheatDeltaHBtuLb
  const chartHeatingThermalKw = chartPreheatBtuHr / 3412
  const chartHeatingHpKw = chartHeatingThermalKw / Math.max(heatPumpCOP, 0.1)
  const chartOutdoorAirPercent = is100OA ? 100 : Math.min(100, Math.max(0, activeFraction * 100))
  const chartReturnAirPercent = Math.max(0, 100 - chartOutdoorAirPercent)
  const chartOutdoorAirFraction = chartOutdoorAirPercent / 100
  const chartReturnAirFraction = chartReturnAirPercent / 100
  const chartOutdoorHumidityRatio = fallbackOutdoorState.w
  const chartReturnHumidityRatio = fallbackReturnState.w
  const chartMixedHumidityRatio =
    chartOutdoorAirFraction * chartOutdoorHumidityRatio +
    chartReturnAirFraction * chartReturnHumidityRatio
  const chartTargetHumidityRatio = chartReturnHumidityRatio
  const chartDeltaHumidityRatio = Math.max(0, chartTargetHumidityRatio - chartMixedHumidityRatio)
  const chartOutdoorGrainsLb = chartOutdoorHumidityRatio * 7000
  const chartReturnGrainsLb = chartReturnHumidityRatio * 7000
  const chartMixedGrainsLb = chartMixedHumidityRatio * 7000
  const chartTargetGrainsLb = chartTargetHumidityRatio * 7000
  const chartDeltaGrainsLb = chartDeltaHumidityRatio * 7000
  const chartHumifogInletGrainsLb = fallbackPreHumifogHeatingState.w * 7000
  const chartHumifogAfterGrainsLb = fallbackAfterHumifogState.w * 7000
  const chartHumifogDeltaDiagnosticGrainsLb = Math.max(0, chartHumifogAfterGrainsLb - chartHumifogInletGrainsLb)
  const chartHumifogLoadCfm = outsideAirCFM
  const chartHumifogWaterLbHr = Math.max(
    0,
    4.5 * chartHumifogLoadCfm * (chartHumifogDeltaDiagnosticGrainsLb / 7000)
  )
  const chartHumifogWaterKgH = chartHumifogWaterLbHr * 0.453592
  const chartHumifogPumpKw = Math.max(0, chartHumifogWaterLbHr * 0.0009)
  const chartHumifogDiagnosticLocale = language === 'fr' ? 'fr-CA' : 'en-CA'
  const formatHumifogDiagnosticNumber = (value, digits = 1) => Number(value || 0).toLocaleString(chartHumifogDiagnosticLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const chartHumifogFormulaText = `4.5 x ${formatHumifogDiagnosticNumber(chartHumifogLoadCfm, 0)} x ${formatHumifogDiagnosticNumber(chartHumifogDeltaDiagnosticGrainsLb, 2)} / 7000 = ${formatHumifogDiagnosticNumber(chartHumifogWaterLbHr, 1)} lb/h`
  const chartHumifogWarning = chartHumifogProcess.warning
  const fallbackPsychrometricPoints = [
    { key: 'oa', label: 'Outdoor air', state: fallbackOutdoorState },
    ...(!is100OA ? [
      { key: 'ra', label: 'Return air', state: fallbackReturnState },
      { key: 'mixed', label: 'Mixed air', state: fallbackMixedState },
    ] : []),
    ...(hasChartRecovery ? [{ key: 'recovered', label: recoveryPointLabel, state: fallbackRecoveredState }] : []),
    { key: 'heating', label: 'After preheat Humifog', state: fallbackAfterHeatingState },
    { key: 'humifog', label: 'After Humifog', state: fallbackAfterHumifogState },
    { key: 'room', label: 'Room', state: fallbackReturnState, isReferenceOnly: true },
  ]
  const basePsychrometricChartPoints = fallbackPsychrometricPoints
  const psychrometricChartPoints = basePsychrometricChartPoints.filter((point) => {
    if (is100OA && (point.key === 'mixed' || point.key === 'ra')) return false
    if (!hasChartRecovery && point.key === 'recovered') return false
    return true
  })
  const psychrometricProcessOrder = [
    'oa',
    ...(!is100OA ? ['mixed'] : []),
    ...(hasChartRecovery ? ['recovered'] : []),
    'heating',
    'humifog',
  ]
  const outdoorDesignState = fallbackOutdoorState
  const activeOaPercent = is100OA
    ? 100
    : isFreeCoolingMode
      ? Math.round(freeCoolingHumifogAnalysis.annualComparison.humifog.averageOa)
      : minimumOutsideAirPercent
  const baseSystemInstalledCost = isFreeCoolingMode
    ? electricSteamInstalledCost + freeCoolingControlsInstalledCost
    : electricSteamInstalledCost
  const selectedHumifogInstalledCost = isFreeCoolingMode
    ? humifogInstalledCost + freeCoolingControlsInstalledCost
    : humifogInstalledCost + (hasChartRecovery ? heatRecoveryInstalledCost : 0)
  const installedCostInputs = {
    electricSteam: baseSystemInstalledCost,
    naturalGasSteam: isFreeCoolingMode ? naturalGasSteamInstalledCost + freeCoolingControlsInstalledCost : naturalGasSteamInstalledCost,
    atmosphericGasHumidifier: isFreeCoolingMode ? atmosphericGasHumidifierInstalledCost + freeCoolingControlsInstalledCost : atmosphericGasHumidifierInstalledCost,
    humifog: selectedHumifogInstalledCost,
    freeCoolingControls: freeCoolingControlsInstalledCost,
    heatRecovery: heatRecoveryInstalledCost,
    baseline: baseSystemInstalledCost,
    selectedHumifog: selectedHumifogInstalledCost,
  }
  const installedCostBreakdown = {
    electricSteam: {
      base: electricSteamInstalledCost,
      heatRecoveryAdder: 0,
      freeCoolingControlsAdder: isFreeCoolingMode ? freeCoolingControlsInstalledCost : 0,
      total: installedCostInputs.electricSteam,
    },
    naturalGasSteam: {
      base: naturalGasSteamInstalledCost,
      heatRecoveryAdder: 0,
      freeCoolingControlsAdder: isFreeCoolingMode ? freeCoolingControlsInstalledCost : 0,
      total: installedCostInputs.naturalGasSteam,
    },
    atmosphericGasHumidifier: {
      base: atmosphericGasHumidifierInstalledCost,
      heatRecoveryAdder: 0,
      freeCoolingControlsAdder: isFreeCoolingMode ? freeCoolingControlsInstalledCost : 0,
      total: installedCostInputs.atmosphericGasHumidifier,
    },
    humifog: {
      base: humifogInstalledCost,
      heatRecoveryAdder: !isFreeCoolingMode && hasChartRecovery ? heatRecoveryInstalledCost : 0,
      freeCoolingControlsAdder: isFreeCoolingMode ? freeCoolingControlsInstalledCost : 0,
      total: installedCostInputs.humifog,
    },
  }
  const freeCoolingSteamAnnual = freeCoolingHumifogAnalysis.annualComparison.freeCooling || {}
  const freeCoolingHumifogAnnual = freeCoolingHumifogAnalysis.annualComparison.humifog || {}
  const freeCoolingSteamHumidificationKwh = freeCoolingSteamAnnual.humidificationEnergyKwh || 0
  const freeCoolingCommonElectricKwh = Math.max(
    0,
    (freeCoolingSteamAnnual.totalEnergyKwh || 0) - freeCoolingSteamHumidificationKwh
  )
  const freeCoolingNaturalGasHumidificationKwh =
    freeCoolingSteamHumidificationKwh / Math.max(steamBoilerEfficiency / 100, 0.01)
  const freeCoolingAtmosphericGasHumidificationKwh =
    freeCoolingSteamHumidificationKwh / Math.max(atmosphericGasHumidifierEfficiency / 100, 0.01)
  const freeCoolingNaturalGasAnnualCost =
    freeCoolingCommonElectricKwh * electricityRate +
    (freeCoolingNaturalGasHumidificationKwh / 10.35) * naturalGasRate
  const freeCoolingAtmosphericGasAnnualCost =
    freeCoolingCommonElectricKwh * electricityRate +
    (freeCoolingAtmosphericGasHumidificationKwh / 10.35) * naturalGasRate
  const referenceRoiKey = annualComparisonReference === 'atmosphericGas'
    ? 'atmosphericGasHumidifier'
    : annualComparisonReference
  const referenceAnnualCost = isFreeCoolingMode
    ? referenceRoiKey === 'naturalGasSteam'
      ? freeCoolingNaturalGasAnnualCost
      : referenceRoiKey === 'atmosphericGasHumidifier'
        ? freeCoolingAtmosphericGasAnnualCost
        : freeCoolingHumifogAnalysis.annualComparison.freeCooling.annualCost
    : referenceRoiKey === 'naturalGasSteam'
      ? annualNaturalGasCostResolved
      : referenceRoiKey === 'atmosphericGasHumidifier'
        ? annualAtmosphericGasHumidifierCostResolved
        : annualSteamCostResolved
  const referenceInstalledCost = referenceRoiKey === 'naturalGasSteam'
    ? installedCostInputs.naturalGasSteam
    : referenceRoiKey === 'atmosphericGasHumidifier'
      ? installedCostInputs.atmosphericGasHumidifier
      : installedCostInputs.electricSteam
  const roiOptions = [
    {
      key: 'electricSteam',
      label: language === 'fr' ? 'Humidificateur électrique vapeur' : 'Electric steam humidifier',
      installedCost: installedCostInputs.electricSteam,
      annualCost: isFreeCoolingMode ? freeCoolingHumifogAnalysis.annualComparison.freeCooling.annualCost : annualSteamCostResolved,
      reference: referenceRoiKey === 'electricSteam',
    },
    {
      key: 'naturalGasSteam',
      label: language === 'fr' ? 'Bouilloire vapeur gaz naturel' : 'Natural gas steam boiler',
      installedCost: installedCostInputs.naturalGasSteam,
      annualCost: isFreeCoolingMode ? freeCoolingNaturalGasAnnualCost : annualNaturalGasCostResolved,
      reference: referenceRoiKey === 'naturalGasSteam',
    },
    {
      key: 'atmosphericGasHumidifier',
      label: language === 'fr' ? 'Humidificateur gaz atmosphérique' : 'Atmospheric gas humidifier',
      installedCost: installedCostInputs.atmosphericGasHumidifier,
      annualCost: isFreeCoolingMode ? freeCoolingAtmosphericGasAnnualCost : annualAtmosphericGasHumidifierCostResolved,
      reference: referenceRoiKey === 'atmosphericGasHumidifier',
    },
    {
      key: 'humifog',
      label: isFreeCoolingMode
        ? (language === 'fr' ? 'Humifog optimisé + Free Cooling' : 'Humifog optimized + Free Cooling')
        : (language === 'fr' ? 'Humifog adiabatique' : 'Humifog adiabatic'),
      installedCost: installedCostInputs.humifog,
      annualCost: isFreeCoolingMode ? freeCoolingHumifogAnalysis.annualComparison.humifog.annualCost : annualAdiabaticCostResolved,
    },
  ]
  const roiRows = roiOptions.map((option) => {
    const annualSavings = Math.round(referenceAnnualCost - option.annualCost)
    const incrementalCost = Math.round(option.installedCost - referenceInstalledCost)
    const paybackYears = annualSavings > 0
      ? Math.max(0, incrementalCost) / annualSavings
      : null

    return {
      ...option,
      annualSavings,
      incrementalCost,
      paybackYears,
    }
  })
  const selectedRoiRow = roiRows.find((row) => row.key === 'humifog') || roiRows[0]
  const estimatedPayback = selectedRoiRow?.paybackYears == null
    ? (language === 'fr' ? 'Non rentable selon les données actuelles' : 'Not economical with current inputs')
    : selectedRoiRow.paybackYears === 0
      ? (language === 'fr' ? 'Immédiat' : 'Immediate')
      : `${selectedRoiRow.paybackYears.toFixed(1)} ${language === 'fr' ? 'ans' : 'years'}`
  const tenYearSavings = Math.round((selectedRoiRow?.annualSavings || 0) * 10 - Math.max(0, selectedRoiRow?.incrementalCost || 0))
  const twentyYearSavings = Math.round((selectedRoiRow?.annualSavings || 0) * 20 - Math.max(0, selectedRoiRow?.incrementalCost || 0))
  const reportProjectName = projectProfile.name.trim() || (language === 'fr' ? 'Optimisation énergétique HVAC' : 'HVAC Energy Optimization')
  const reportPreparedFor = projectProfile.owner.trim() || (language === 'fr' ? 'Propriétaire / équipe d’ingénierie' : 'Project Owner / Engineering Team')
  const reportPreparedBy = projectProfile.engineer.trim() || 'Enersol / Carel'
  const reportSystemType = is100OA
    ? (language === 'fr' ? 'CTA 100 % air extérieur' : '100% Outdoor Air AHU')
    : (language === 'fr' ? 'CTA air mélangé avec retour d’air' : 'Mixed Air AHU with return air')
  const reportHumidificationTechnology = language === 'fr'
    ? 'Humidification vapeur / Humifog adiabatique'
    : 'Steam Humidification / Humifog Adiabatic Humidification'
  const reportAirflowPaths = is100OA
    ? (language === 'fr'
      ? [
        'L’air extérieur (OA) entre par la prise d’air de la CTA.',
        'L’air traverse la filtration et la récupération d’énergie lorsque sélectionnée.',
        'L’air est réchauffé avant la section Humifog.',
        'Le Humifog humidifie l’air par évaporation et abaisse sa température.',
        'Le ventilateur de soufflage alimente la pièce selon la condition de conception.',
      ]
      : [
        'Outdoor Air (OA) enters the AHU through the intake section.',
        'Air passes through filtration and energy recovery when selected.',
        'Air is preheated before the Humifog section.',
        'Humifog evaporatively cools and humidifies the air stream.',
        'Supply fan delivers air to the occupied room condition.',
      ])
    : (language === 'fr'
      ? [
        'L’air extérieur (OA) et l’air de retour (RA) entrent dans la section de mélange.',
        'L’air mélangé traverse l’équipement de récupération sélectionné.',
        'Le Humifog humidifie l’air récupéré de façon adiabatique.',
        'Le réchauffage ramène la condition vers la cible de la pièce.',
        'L’air d’alimentation est livré à la pièce selon la condition de conception.',
      ]
      : [
        'Outdoor Air (OA) and Return Air (RA) enter the mixed air section.',
        'Mixed air passes through the selected heat recovery device.',
        'Humifog evaporatively cools and humidifies the recovered air.',
        'Reheat raises the supply condition toward the room design target.',
        'Supply air is delivered to the occupied room condition.',
      ])
  const reportComponentSequence = is100OA
    ? (language === 'fr'
      ? ['Prise d’air extérieur', 'Filtres', 'Récupération d’énergie', 'Serpentin de chauffage', 'Section Humifog', 'Ventilateur de soufflage', 'Pièce']
      : ['Outdoor air intake', 'Filters', 'Energy recovery device', 'Heating coil', 'Humifog section', 'Supply fan', 'Room'])
    : (language === 'fr'
      ? ['Volet d’air extérieur', 'Volet d’air de retour', 'Caisson de mélange', 'Récupération d’énergie', 'Section Humifog', 'Serpentin de chauffage / réchauffage', 'Ventilateur de soufflage', 'Pièce']
      : ['Outdoor air damper', 'Return air damper', 'Mixing box', 'Energy recovery device', 'Humifog section', 'Heating coil / reheat', 'Supply fan', 'Room'])
  const reportDesignTemperatures = [
    { label: language === 'fr' ? 'Température sèche extérieure de conception' : 'Outdoor design dry bulb', value: outdoorDesignState.db },
    { label: language === 'fr' ? 'Température sèche de la pièce' : 'Room dry bulb', value: roomTemperature },
    ...(is100OA ? [{ label: language === 'fr' ? 'Température d\'air d\'alimentation' : 'Supply Air Temperature', value: supplyAirTemperature }] : []),
    { label: language === 'fr' ? 'Température avant Humifog' : 'Temperature Before Humifog', value: displayedPreHumifogTemp },
    { label: language === 'fr' ? 'Température après Humifog' : 'Temperature After Humifog', value: displayedAfterHumifogTemp },
    ...(!is100OA
      ? [
        { label: language === 'fr' ? 'Air mélangé calculé' : 'Calculated mixed air', value: freeCoolingHumifogAnalysis.validation.calculatedMixedDb },
        { label: language === 'fr' ? 'Air mélangé actif' : 'Active mixed air', value: freeCoolingHumifogAnalysis.validation.activeMixedDb },
      ]
      : []),
  ]
  const reportPsychrometricStates = [
    ...(!is100OA ? [{
      label: language === 'fr' ? 'Température de mélange' : 'Mixed Air Temperature',
      temperature: freeCoolingHumifogAnalysis.validation.activeMixedDb,
      relativeHumidity: fallbackMixedState.rh,
    }] : []),
    {
      label: language === 'fr' ? 'Température avant Humifog' : 'Temperature Before Humifog',
      temperature: displayedPreHumifogTemp,
      relativeHumidity: displayedPreHumifogRh,
    },
    {
      label: language === 'fr' ? 'Température après Humifog' : 'Temperature After Humifog',
      temperature: displayedAfterHumifogTemp,
      relativeHumidity: displayedAfterHumifogRh,
    },
  ]
  const scheduleDaysLabel = scheduleDaysOption === 'mon-fri' ? t.mondayToFriday : scheduleDaysOption === 'mon-sat' ? t.mondayToSaturday : scheduleDaysOption === 'seven-days' ? t.sevenDaysWeek : Object.entries(scheduleCustomDays).filter(([, value]) => value).map(([day]) => t[day]).join(', ')
  const scheduleDescriptionText = scheduleMode === '24-7'
    ? t.operationMode24_7
    : language === 'fr'
      ? `${scheduleStartTime} à ${scheduleEndTime}, ${scheduleDaysLabel.charAt(0).toLowerCase()}${scheduleDaysLabel.slice(1)}`
      : `${scheduleStartTime} to ${scheduleEndTime}, ${scheduleDaysLabel}`

  const reportData = {
    language,
    units,
    mode: {
      is100OA,
      isFreeCoolingMode,
      showFreeCoolingTables,
      includesFreeCoolingAnalysis: showFreeCoolingTables && !is100OA,
      ventilationModeName: ventilationMode.nom,
      selectedCalculationMethod: calculationMethod === 'hourly'
        ? t.hourlyWeatherMethod
        : isCustomOperatingHoursMode
          ? (language === 'fr' ? 'Heures d’exploitation personnalisées' : 'Custom operating hours')
          : t.binHoursMethod,
      calculationMethod,
      scheduleMode,
      operatingHourBasis: calculationMethod === 'hourly'
        ? (scheduleMode === 'custom'
          ? (language === 'fr' ? 'Horaire personnalisé - simulation EPW horaire' : 'Custom operating hours - EPW hourly simulation')
          : (language === 'fr' ? 'Simulation EPW horaire 8760' : 'EPW hourly simulation 8760'))
        : (scheduleMode === 'custom'
          ? (language === 'fr' ? 'Heures BIN ajustées selon l’horaire personnalisé' : 'BIN hours adjusted to custom schedule')
          : (language === 'fr' ? 'Heures BIN' : 'BIN hours')),
      isCustomOperatingHours: isCustomOperatingHoursMode,
      hourlyWeatherSourceType,
      hourlyWeatherFileName,
      hourlyWeatherFileLocation,
      hourlyWeatherRecordsLoaded,
      hourlyWeatherOperatingHoursUsed,
      hourlyWeatherParseError,
      weatherDataSource: isCustomOperatingHoursMode
        ? (language === 'fr' ? 'Horaire personnalisé' : 'Custom operating schedule')
        : calculationMethod === 'hourly'
        ? (hourlyWeatherSourceType === 'custom'
          ? (language === 'fr' ? 'Fichier météo téléchargé personnalisé' : 'Custom uploaded weather file')
          : `${t.builtInWeatherFile} — ${selectedCity.nom}`)
        : (language === 'fr' ? 'Méthode heures BIN active' : 'BIN hours method active'),
      weatherSourceOrganization: calculationMethod === 'hourly'
        ? localizeWeatherMetadataValue('sourceOrganization', hourlyWeatherMetadata?.sourceOrganization || '', language)
        : '',
      weatherClimateFileType: calculationMethod === 'hourly'
        ? localizeWeatherMetadataValue('climateFileType', hourlyWeatherMetadata?.climateFileType || '', language)
        : '',
      weatherValidationStatus: calculationMethod === 'hourly'
        ? formatWeatherValidationStatus(effectiveWeatherValidationStatus, language)
        : (language === 'fr' ? 'bin' : 'bin'),
      weatherValidationWarning: '',
      hourlyWeatherDataSummary: isHourlySimulationActive
        ? {
          selectedCity: selectedCity.nom,
          weatherSource: localizeWeatherMetadataValue('dataSource', hourlyWeatherMetadata?.dataSource || '', language) || (hourlyWeatherSourceType === 'custom'
            ? (language === 'fr' ? 'Fichier météo téléchargé personnalisé' : 'Custom uploaded weather file')
            : ''),
          sourceOrganization: localizeWeatherMetadataValue('sourceOrganization', hourlyWeatherMetadata?.sourceOrganization || '', language),
          climateFileType: localizeWeatherMetadataValue('climateFileType', hourlyWeatherMetadata?.climateFileType || '', language),
          loadedFile: hourlyWeatherFileName || builtInHourlyWeatherFileName,
          validation: formatWeatherValidationStatus(effectiveWeatherValidationStatus, language),
          recordsLoaded: hourlyWeatherSummary?.recordsLoaded ?? 0,
          operatingHoursUsed: hourlyWeatherSummary?.operatingHoursUsed ?? 0,
          averageOutdoorTemp: hourlyWeatherSummary?.averageOutdoorTemp ?? 0,
          minOutdoorTemp: hourlyWeatherSummary?.minOutdoorTemp ?? 0,
          maxOutdoorTemp: hourlyWeatherSummary?.maxOutdoorTemp ?? 0,
          averageOutdoorRh: hourlyWeatherSummary?.averageOutdoorRh ?? 0,
          hoursBelowZero: hourlyWeatherSummary?.hoursBelowZero ?? 0,
          hoursBelowMinusTen: hourlyWeatherSummary?.hoursBelowMinusTen ?? 0,
          hoursBelowMinusTwenty: hourlyWeatherSummary?.hoursBelowMinusTwenty ?? 0,
          hoursWithHumidificationRequired: hourlyWeatherSummary?.hoursWithHumidificationRequired ?? 0,
        }
        : null,
      hourlyAnnualResults: isHourlySimulationActive
        ? {
          annualSteamKwh: hourlyWeatherSummary?.annualSteamKwh ?? 0,
          annualGasKwh: hourlyWeatherSummary?.annualGasKwh ?? 0,
          annualHumifogKwh: hourlyWeatherSummary?.annualHumifogKwh ?? 0,
          annualCost: hourlyWeatherSummary?.annualCost ?? 0,
          annualSavings: hourlyWeatherSummary?.annualSavings ?? 0,
          annualGhgReduction: hourlyWeatherSummary?.annualGhgReduction ?? 0,
          annualWaterConsumptionKg: hourlyWeatherSummary?.annualWaterConsumptionKg ?? 0,
        }
        : null,
    },
    project: {
      name: reportProjectName,
      location: selectedCity.nom,
      preparedFor: reportPreparedFor,
      preparedBy: reportPreparedBy,
      engineerOrRepresentative: reportPreparedBy,
      date: new Date().toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA'),
      softwareVersion: 'HVAC Analyzer Phase 3 - Free Cooling + Humifog',
    },
    system: {
      type: reportSystemType,
      supplyAirflowCfm: outsideAirCFM,
      oaMinimumPercent: is100OA ? 100 : minimumOutsideAirPercent,
      oaPercent: activeOaPercent,
      selectedOaPercent: is100OA ? 100 : minimumOutsideAirPercent,
      calculatedAverageOaPercent: activeOaPercent,
      raPercent: is100OA ? 0 : 100 - activeOaPercent,
      selectedRaPercent: is100OA ? 0 : 100 - minimumOutsideAirPercent,
      recoveryType: selectedRecoveryDisplayName || (language === 'fr' ? 'Aucun' : 'None'),
      recoveryTypeDisplay: selectedRecoveryDisplayName,
      recoveryEfficiency: isNoRecovery ? 0 : effectiveSensibleRecoveryEfficiency,
      recoverySensibleEfficiency: isNoRecovery ? 0 : effectiveSensibleRecoveryEfficiency,
      recoveryLatentEfficiency: isNoRecovery ? 0 : effectiveLatentRecoveryEfficiency,
      hasLatentRecovery: Boolean(!isNoRecovery && selectedRecoverySupportsLatent),
      heatingType: selectedReheatSystem?.nom || '',
      reheatMethodLabel: selectedReheatSystemDisplayName,
      reheatEnergySource: selectedReheatSystem?.energie || '',
      humidificationTechnology: reportHumidificationTechnology,
      humifogEfficiency: (ventilationMode.evaporativeEffectiveness ?? 0.72) * 100,
      imageSrc: selectedSystemImageSrc || systemImages.fallback,
      imageAlt: selectedSystemDiagramLabel,
      airflowPaths: reportAirflowPaths,
      componentSequence: reportComponentSequence,
      designTemperatures: reportDesignTemperatures,
      psychrometricStates: reportPsychrometricStates,
    },
    design: {
      outdoorState: outdoorDesignState,
      roomState: fallbackReturnState,
    },
    validation: freeCoolingHumifogAnalysis.validation,
    bins: freeCoolingHumifogAnalysis.bins,
    binRows: freeCoolingHumifogAnalysis.binRows,
    conventionalRows: freeCoolingHumifogAnalysis.conventionalRows,
    optimizedHumifogRows: freeCoolingHumifogAnalysis.optimizedHumifogRows,
    binValidationRows: freeCoolingHumifogAnalysis.binValidationRows,
    optimizationRows: freeCoolingHumifogAnalysis.optimizationRows,
    optimal: freeCoolingHumifogAnalysis.optimal,
    annualComparison: freeCoolingHumifogAnalysis.annualComparison,
    annualBreakdownRows: freeCoolingHumifogAnalysis.annualBreakdownRows,
    netSavings: freeCoolingHumifogAnalysis.netSavings,
    message: freeCoolingHumifogAnalysis.message,
    metrics: {
      ...freeCoolingHumifogAnalysis.metrics,
      correctedHumidificationLoad,
      correctedHumidificationLoadRaw: Number(metrics.correctedHumidificationLoadRaw ?? correctedHumidificationLoad),
      steamEnergyKW,
      steamEnergyKWRaw,
      humifogPumpKW: adiabaticHumidificationKW,
      humifogPumpKWRaw: adiabaticHumidificationKWRaw,
      commonHvacHeatingThermalKW,
      commonHvacHeatingThermalKWRaw,
      scheduleFactor,
      scheduleDescription: scheduleDescriptionText,
      recoveryEnergyReductionKW,
      annualHumidificationHours: annualHumidificationHoursResolved,
      naturalGasGES: Number(annualNaturalGasGESResolved.toFixed(1)),
      atmosphericGasHumidifierGES: Number(annualAtmosphericGasGESResolved.toFixed(1)),
      adiabaticGES: Number(annualAdiabaticGESResolved.toFixed(1)),
      eliminatedGES: Number(annualEliminatedGESResolved.toFixed(1)),
      savings: annualSavingsPercentResolved,
    },
    psychrometricPoints: psychrometricChartPoints,
    energySummary: {
      annualHumidificationHours: annualHumidificationHoursResolved,
      steam: {
        powerKw: steamEnergyKW,
        annualEnergyKwh: annualSteamEnergyKwhResolved,
        annualCost: annualSteamCostResolved,
      },
      naturalGasSteam: {
        powerKw: naturalGasSteamInputKW,
        annualEnergyKwh: annualNaturalGasSteamEnergyKwhResolved,
        annualCost: annualNaturalGasCostResolved,
      },
      atmosphericGasHumidifier: {
        powerKw: atmosphericGasHumidifierInputKW,
        annualEnergyKwh: annualAtmosphericGasHumidifierEnergyKwhResolved,
        annualCost: annualAtmosphericGasHumidifierCostResolved,
      },
      humifog: {
        powerKw: adiabaticEnergyKW,
        annualEnergyKwh: annualAdiabaticEnergyKwhResolved,
        annualCost: annualAdiabaticCostResolved,
        pumpPowerKw: adiabaticHumidificationKW,
        reheatPowerKw: reheatEnergyKW,
        annualPumpEnergyKwh: annualHumifogPumpEnergyKwhResolved,
        annualReheatEnergyKwh: annualHumifogSelectedPreheatEnergyKwhResolved,
        annualPumpCost: annualHumifogPumpCostResolved,
        annualReheatCost: annualHumifogSelectedPreheatCostResolved,
        annualElectricPreheatEnergyKwh: annualHumifogElectricPreheatEnergyKwhResolved,
        annualHeatPumpPreheatEnergyKwh: annualHumifogHeatPumpPreheatEnergyKwhResolved,
        annualElectricTotalEnergyKwh: annualHumifogElectricTotalEnergyKwhResolved,
        annualHeatPumpTotalEnergyKwh: annualHumifogHeatPumpTotalEnergyKwhResolved,
        annualElectricCost: annualHumifogElectricCostResolved,
        annualHeatPumpCost: annualHumifogHeatPumpCostResolved,
      },
      annualSavingsVsSteam: annualSteamCostResolved - annualAdiabaticCostResolved,
    },
    economics: {
      electricityRate,
      naturalGasRate,
      annualComparisonReference,
      steamBoilerEfficiency,
      atmosphericGasHumidifierEfficiency,
      installedCosts: installedCostInputs,
      installedCostBreakdown,
      roiRows,
      selectedRoi: selectedRoiRow,
      estimatedPayback,
      tenYearSavings,
      twentyYearSavings,
    },
  }
  const energySummary = reportData.energySummary

  const formatNumber = (value, digits = 1) => Number(value || 0).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const formatEnergy = (value) => Math.round(value || 0).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')
  const formatCost = (value) => Math.round(value || 0).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')
  const formatSignedNumber = (value) => {
    const rounded = Math.round(value || 0)
    const formatted = Math.abs(rounded).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')
    if (rounded > 0) return `+${formatted}`
    if (rounded < 0) return `-${formatted}`
    return formatted
  }
  const formatSavingsNumber = (value) => {
    const rounded = Math.round(value || 0)
    const formatted = Math.abs(rounded).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')
    return rounded < 0 ? `-${formatted}` : formatted
  }
  const annualSteamCostDisplay = isHourlySimulationActive && hourlyWeatherSummary
    ? Math.round((hourlyWeatherSummary.annualSteamKwh || 0) * electricityRate)
    : Math.round(annualSteamCostResolved)
  const annualNaturalGasCostDisplay = Math.round(annualNaturalGasCostResolved)
  const annualAtmosphericGasHumidifierCostDisplay = Math.round(annualAtmosphericGasHumidifierCostResolved)
  const annualAdiabaticCostDisplay = isHourlySimulationActive && hourlyWeatherSummary
    ? Math.round(hourlyWeatherSummary.annualCost || 0)
    : Math.round(annualAdiabaticCostResolved)
  const formatAnnualEnergy = (value) => `${formatEnergy(value)} kWh/year`
  const formatAnnualCost = (value) => `${formatCost(value)} $/year`
  const formatInstalledCost = (value) => `${formatCost(value)} $`
  const formatSignedAnnualEnergy = (value) => `${formatSignedNumber(value)} kWh/year`
  const formatSavingsAnnualEnergy = (value) => `${formatSavingsNumber(value)} kWh/year`
  const formatSignedAnnualCost = (value) => `${formatSignedNumber(value)} $/year`
  const formatSavingsAnnualCost = (value) => `${formatSavingsNumber(value)} $/year`
  const formatSignedCost = (value) => `${formatSignedNumber(value)} $`
  const formatPayback = (row) => {
    if (row.reference) return language === 'fr' ? 'Référence' : 'Reference'
    if (row.annualSavings <= 0) return language === 'fr' ? 'Non rentable' : 'Not economical'
    if (row.paybackYears === 0) return language === 'fr' ? 'Immédiat' : 'Immediate'
    return `${formatNumber(row.paybackYears, 1)} ${language === 'fr' ? 'ans' : 'years'}`
  }
  const formatInstantPower = (value) => `${formatNumber(value, 1)} kW`
  const formatSignedPercent = (value) => {
    const numeric = Number(value || 0)
    const formatted = Math.abs(numeric).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    if (numeric > 0) return `+${formatted}%`
    if (numeric < 0) return `-${formatted}%`
    return `${formatted}%`
  }
  const formatSavingsPercent = (value) => {
    const numeric = Number(value || 0)
    const formatted = Math.abs(numeric).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    return numeric < 0 ? `-${formatted}%` : `${formatted}%`
  }
  const formatBreakdownValue = (row, value, signed = false) => {
    if (!freeCoolingCalculationComplete) return calculationIncompleteText
    if (row.unit === '$/year') return signed ? formatSignedAnnualCost(value) : formatAnnualCost(value)
    return signed ? formatSignedAnnualEnergy(value) : formatAnnualEnergy(value)
  }
  const formatAnnualEnergyIfComplete = (value) =>
    freeCoolingCalculationComplete ? formatAnnualEnergy(value) : calculationIncompleteText
  const formatAnnualCostIfComplete = (value) =>
    freeCoolingCalculationComplete ? formatAnnualCost(value) : calculationIncompleteText
  const displayWaterLoad = (lbHr) => units === 'metric'
    ? `${formatNumber(lbHr * 0.453592, 1)} kg/h`
    : `${formatNumber(lbHr, 1)} lb/h`
  const humidificationLoadDisplay = displayWaterLoad(chartHumifogWaterLbHr)
  const formatChartTemperature = (state) => state ? `${displayTemp(state.db)}${tempUnit}` : calculationIncompleteText
  const formatChartHumidityRatio = (state) => {
    if (!state) return calculationIncompleteText
    return units === 'imperial'
      ? `${formatNumber(state.w * 7000, 1)} gr/lb`
      : `${formatNumber(state.w * 1000, 2)} g/kg`
  }
  const formatSignedTemperatureDifference = (value) => {
    const displayValue = displayDeltaTemp(value)
    if (displayValue > 0) return `+${displayValue}${tempUnit}`
    if (displayValue < 0) return `${displayValue}${tempUnit}`
    return `0${tempUnit}`
  }
  const formatSignedPowerDifference = (value) => {
    const formatted = formatInstantPower(Math.abs(value))
    if (value > 0) return `+${formatted}`
    if (value < 0) return `-${formatted}`
    return formatInstantPower(0)
  }
  const freeCoolingReferenceMixedState = freeCoolingChartReferenceRow?.controlledMixed ?? freeCoolingChartReferenceRow?.mixed
  const freeCoolingReferenceHeatKw = (freeCoolingChartReferenceRow?.heatingLoadKw || 0) + (freeCoolingChartReferenceRow?.reheatLoadKw || 0)
  const freeCoolingHumifogHeatKw = (freeCoolingChartHumifogRow?.heatingLoadKw || 0) + (freeCoolingChartHumifogRow?.reheatLoadKw || 0)
  const annualReferenceHeatKwh =
    (freeCoolingHumifogAnalysis.annualComparison.freeCooling?.heatingEnergyKwh || 0) +
    (freeCoolingHumifogAnalysis.annualComparison.freeCooling?.reheatEnergyKwh || 0)
  const annualHumifogHeatKwh =
    (freeCoolingHumifogAnalysis.annualComparison.humifog?.heatingEnergyKwh || 0) +
    (freeCoolingHumifogAnalysis.annualComparison.humifog?.reheatEnergyKwh || 0)
  const annualHoursBasis = isCustomOperatingHoursMode
    ? (language === 'fr' ? 'Heures personnalisées' : 'Custom Operating Hours')
    : calculationMethod === 'bin'
      ? (language === 'fr' ? 'Heures BIN' : 'BIN Hours')
      : (language === 'fr' ? 'Météo horaire' : 'Hourly Weather')
  const annualTechnologyResults = {
    electricSteam: {
      annualEnergyKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.totalEnergyKwh || 0 : energySummary.steam.annualEnergyKwh || 0,
      annualOperatingCost: isFreeCoolingMode ? freeCoolingSteamAnnual.annualCost || 0 : annualSteamCostResolved,
      heatingKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.heatingEnergyKwh || 0 : annualCommonHvacHeatingKwhResolved,
      humidificationKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.humidificationEnergyKwh || 0 : energySummary.steam.annualEnergyKwh || 0,
      reheatKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.reheatEnergyKwh || 0 : 0,
      pumpKWh: 0,
      installedInvestmentCost: installedCostInputs.electricSteam,
      hoursBasis: annualHoursBasis,
    },
    naturalGasSteam: {
      annualEnergyKWh: isFreeCoolingMode ? freeCoolingCommonElectricKwh + freeCoolingNaturalGasHumidificationKwh : annualCommonHvacHeatingKwhResolved + (energySummary.naturalGasSteam.annualEnergyKwh || 0),
      annualOperatingCost: isFreeCoolingMode ? freeCoolingNaturalGasAnnualCost : annualNaturalGasCostResolved,
      heatingKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.heatingEnergyKwh || 0 : annualCommonHvacHeatingKwhResolved,
      humidificationKWh: isFreeCoolingMode ? freeCoolingNaturalGasHumidificationKwh : energySummary.naturalGasSteam.annualEnergyKwh || 0,
      reheatKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.reheatEnergyKwh || 0 : 0,
      pumpKWh: 0,
      installedInvestmentCost: installedCostInputs.naturalGasSteam,
      hoursBasis: annualHoursBasis,
    },
    atmosphericGas: {
      annualEnergyKWh: isFreeCoolingMode ? freeCoolingCommonElectricKwh + freeCoolingAtmosphericGasHumidificationKwh : annualCommonHvacHeatingKwhResolved + (energySummary.atmosphericGasHumidifier.annualEnergyKwh || 0),
      annualOperatingCost: isFreeCoolingMode ? freeCoolingAtmosphericGasAnnualCost : annualAtmosphericGasHumidifierCostResolved,
      heatingKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.heatingEnergyKwh || 0 : annualCommonHvacHeatingKwhResolved,
      humidificationKWh: isFreeCoolingMode ? freeCoolingAtmosphericGasHumidificationKwh : energySummary.atmosphericGasHumidifier.annualEnergyKwh || 0,
      reheatKWh: isFreeCoolingMode ? freeCoolingSteamAnnual.reheatEnergyKwh || 0 : 0,
      pumpKWh: 0,
      installedInvestmentCost: installedCostInputs.atmosphericGasHumidifier,
      hoursBasis: annualHoursBasis,
    },
    humifogElectric: {
      annualEnergyKWh: isFreeCoolingMode
        ? freeCoolingHumifogAnnual.totalEnergyKwh || 0
        : energySummary.humifog.annualEnergyKwh || 0,
      annualOperatingCost: isFreeCoolingMode
        ? freeCoolingHumifogAnnual.annualCost || 0
        : annualHumifogElectricCostResolved,
      heatingKWh: isFreeCoolingMode ? freeCoolingHumifogAnnual.heatingEnergyKwh || 0 : annualCommonHvacHeatingKwhResolved,
      humidificationKWh: isFreeCoolingMode
        ? freeCoolingHumifogAnnual.humidificationEnergyKwh || 0
        : annualHumifogPumpEnergyKwhResolved,
      reheatKWh: isFreeCoolingMode
        ? freeCoolingHumifogAnnual.reheatEnergyKwh || 0
        : annualHumifogElectricPreheatEnergyKwhResolved,
      pumpKWh: isFreeCoolingMode
        ? freeCoolingHumifogAnnual.humidificationEnergyKwh || 0
        : annualHumifogPumpEnergyKwhResolved,
      thermalReheatKWh: isFreeCoolingMode
        ? freeCoolingHumifogAnnual.thermalReheatEnergyKwh || 0
        : grossReheatKWRaw * (usesBinAnnualTotals ? totalBinHours : annualHumidificationHoursRaw),
      reheatInputKWh: isFreeCoolingMode
        ? freeCoolingHumifogAnnual.reheatEnergyKwh || 0
        : annualHumifogSelectedPreheatEnergyKwhResolved,
      installedInvestmentCost: selectedHumifogInstalledCost,
      hoursBasis: annualHoursBasis,
    },
    humifogHeatPump: {
      annualEnergyKWh: annualCommonHvacHeatingKwhResolved + annualHumifogHeatPumpTotalEnergyKwhResolved,
      annualOperatingCost: annualHumifogHeatPumpCostResolved,
      heatingKWh: annualCommonHvacHeatingKwhResolved,
      humidificationKWh: annualHumifogPumpEnergyKwhResolved,
      reheatKWh: annualHumifogHeatPumpPreheatEnergyKwhResolved,
      pumpKWh: annualHumifogPumpEnergyKwhResolved,
      thermalReheatKWh: grossReheatKWRaw * (usesBinAnnualTotals ? totalBinHours : annualHumidificationHoursRaw),
      reheatInputKWh: annualHumifogHeatPumpPreheatEnergyKwhResolved,
      installedInvestmentCost: selectedHumifogInstalledCost,
      hoursBasis: annualHoursBasis,
    },
    humifogFreeCooling: {
      annualEnergyKWh: freeCoolingHumifogAnnual.totalEnergyKwh || 0,
      annualOperatingCost: freeCoolingHumifogAnnual.annualCost || 0,
      heatingKWh: freeCoolingHumifogAnnual.heatingEnergyKwh || 0,
      humidificationKWh: freeCoolingHumifogAnnual.humidificationEnergyKwh || 0,
      reheatKWh: freeCoolingHumifogAnnual.reheatEnergyKwh || 0,
      thermalReheatKWh: freeCoolingHumifogAnnual.thermalReheatEnergyKwh || 0,
      pumpKWh: freeCoolingHumifogAnnual.humidificationEnergyKwh || 0,
      freeCoolingObtainedKWh: freeCoolingHumifogAnnual.freeCoolingObtainedKwh,
      installedInvestmentCost: selectedHumifogInstalledCost,
      hoursBasis: annualHoursBasis,
    },
  }
  Object.values(annualTechnologyResults).forEach((result) => {
    result.humidificationLoadLbHr = Number(metrics.correctedHumidificationLoadRaw ?? correctedHumidificationLoad ?? 0)
  })
  const annualTechnologyResultsSerialized = JSON.stringify(annualTechnologyResults)
  useEffect(() => {
    onAnnualResults?.(annualTechnologyResults)
  }, [annualTechnologyResultsSerialized])
  reportData.annualTechnologyResults = annualTechnologyResults
  Object.assign(reportData.energySummary.steam, {
    annualEnergyKwh: annualTechnologyResults.electricSteam.annualEnergyKWh,
    annualCost: annualTechnologyResults.electricSteam.annualOperatingCost,
  })
  Object.assign(reportData.energySummary.naturalGasSteam, {
    annualEnergyKwh: annualTechnologyResults.naturalGasSteam.annualEnergyKWh,
    annualCost: annualTechnologyResults.naturalGasSteam.annualOperatingCost,
  })
  Object.assign(reportData.energySummary.atmosphericGasHumidifier, {
    annualEnergyKwh: annualTechnologyResults.atmosphericGas.annualEnergyKWh,
    annualCost: annualTechnologyResults.atmosphericGas.annualOperatingCost,
  })
  Object.assign(reportData.energySummary.humifog, {
    annualEnergyKwh: annualTechnologyResults.humifogElectric.annualEnergyKWh,
    annualCost: annualTechnologyResults.humifogElectric.annualOperatingCost,
  })
  const reportSnapshot = {
    id: activeSystemId,
    name: activeSystemName || reportData.system.type,
    settings: {
      selectedCityName: selectedCity.nom,
      outsideAirCFM,
      minimumOutsideAirPercent,
      roomTemperature,
      roomRelativeHumidity,
      calculationMethod,
      scheduleMode,
      scheduleStartTime,
      scheduleEndTime,
      scheduleDaysOption,
      scheduleCustomDays,
      hourlyWeatherFileName,
      hourlyWeatherFileLocation,
      hourlyWeatherSourceType,
      hourlyWeatherRecordsLoaded,
      hourlyWeatherOperatingHoursUsed,
      hourlyWeatherSummary,
      hourlyWeatherMetadata,
      heatPumpCOP,
    },
    mode: reportData.mode,
    system: reportData.system,
    design: reportData.design,
    project: reportData.project,
    metrics: reportData.metrics,
    psychrometricPoints: reportData.psychrometricPoints,
    binRows: reportData.binRows,
    optimizationRows: reportData.optimizationRows,
    optimal: reportData.optimal,
    validation: reportData.validation,
    economics: reportData.economics,
    annualComparison: reportData.annualComparison,
    annualTechnologyResults: {
      ...annualTechnologyResults,
      ...(reportData.mode.includesFreeCoolingAnalysis ? {} : { humifogFreeCooling: undefined }),
    },
  }
  const reportSnapshotSerialized = JSON.stringify(reportSnapshot)
  useEffect(() => {
    onReportSnapshot?.(reportSnapshot)
  }, [reportSnapshotSerialized])
  reportData.projectSystems = (projectSystems || []).map((system) => {
    if (system.id === activeSystemId) return reportSnapshot

    const savedSettings = system.settings || {}
    const savedInstalledCosts = {
      electricSteam: finiteSetting(savedSettings, 'electricSteamInstalledCost', null),
      naturalGasSteam: finiteSetting(savedSettings, 'naturalGasSteamInstalledCost', null),
      atmosphericGasHumidifier: finiteSetting(savedSettings, 'atmosphericGasHumidifierInstalledCost', null),
      humifog: finiteSetting(savedSettings, 'humifogInstalledCost', null),
      freeCoolingControls: finiteSetting(savedSettings, 'freeCoolingControlsInstalledCost', null),
      heatRecovery: finiteSetting(savedSettings, 'heatRecoveryInstalledCost', null),
    }
    const existingSnapshot = system.reportSnapshot
    if (existingSnapshot) {
      return {
        ...existingSnapshot,
        id: existingSnapshot.id || system.id,
        name: existingSnapshot.name || system.name,
        settings: {
          ...(existingSnapshot.settings || {}),
          ...savedSettings,
        },
        economics: {
          ...(existingSnapshot.economics || {}),
          installedCosts: {
            ...(existingSnapshot.economics?.installedCosts || {}),
            ...Object.fromEntries(Object.entries(savedInstalledCosts).filter(([, value]) => value !== null)),
          },
        },
      }
    }

    return {
        name: system.name,
        mode: {
          selectedCalculationMethod: system.settings?.calculationMethod === 'hourly'
            ? (language === 'fr' ? 'Simulation météo horaire 8760' : 'Hourly weather simulation 8760')
            : system.settings?.scheduleMode === '24-7'
              ? (language === 'fr' ? 'Heures BIN' : 'BIN Hours')
              : (language === 'fr' ? 'Heures personnalisées' : 'Custom Operating Hours'),
        },
        system: { supplyAirflowCfm: system.settings?.outsideAirCFM },
        project: {},
        metrics: {},
        economics: {},
        annualComparison: { freeCooling: {}, humifog: {} },
        annualTechnologyResults: system.results || {},
      }
  })
  const freeCoolingAnnualTechnologyOptions = [
    {
      key: 'electricSteam',
      label: language === 'fr' ? 'Vapeur electrique' : 'Electric steam',
      color: 'red',
      ...annualTechnologyResults.electricSteam,
      totalKwh: annualTechnologyResults.electricSteam.annualEnergyKWh,
      annualCost: annualTechnologyResults.electricSteam.annualOperatingCost,
    },
    {
      key: 'naturalGasSteam',
      label: language === 'fr' ? 'Vapeur gaz naturel' : 'Natural gas steam',
      color: 'yellow',
      ...annualTechnologyResults.naturalGasSteam,
      totalKwh: annualTechnologyResults.naturalGasSteam.annualEnergyKWh,
      annualCost: annualTechnologyResults.naturalGasSteam.annualOperatingCost,
    },
    {
      key: 'atmosphericGas',
      label: language === 'fr' ? 'Humidificateur gaz atmosph.' : 'Atmospheric gas humidifier',
      color: 'amber',
      ...annualTechnologyResults.atmosphericGas,
      totalKwh: annualTechnologyResults.atmosphericGas.annualEnergyKWh,
      annualCost: annualTechnologyResults.atmosphericGas.annualOperatingCost,
    },
    {
      key: 'humifogFreeCooling',
      label: language === 'fr' ? 'Humifog + Free Cooling' : 'Humifog + Free Cooling',
      color: 'cyan',
      ...annualTechnologyResults.humifogFreeCooling,
      totalKwh: annualTechnologyResults.humifogFreeCooling.annualEnergyKWh,
      annualCost: annualTechnologyResults.humifogFreeCooling.annualOperatingCost,
    },
    {
      key: 'humifogElectric',
      label: language === 'fr' ? 'Humifog + réchauffage électrique' : 'Humifog + Electric Reheat',
      color: 'sky',
      ...annualTechnologyResults.humifogElectric,
      pumpKwh: annualTechnologyResults.humifogElectric.pumpKWh,
      totalKwh: annualTechnologyResults.humifogElectric.annualEnergyKWh,
      annualCost: annualTechnologyResults.humifogElectric.annualOperatingCost,
    },
    {
      key: 'humifogHeatPump',
      label: language === 'fr' ? 'Humifog + thermopompe Air/Eau' : 'Humifog + Air/Water Heat Pump',
      color: 'violet',
      ...annualTechnologyResults.humifogHeatPump,
      pumpKwh: annualTechnologyResults.humifogHeatPump.pumpKWh,
      totalKwh: annualTechnologyResults.humifogHeatPump.annualEnergyKWh,
      annualCost: annualTechnologyResults.humifogHeatPump.annualOperatingCost,
    },
  ]
  const freeCoolingAnnualTechnologyRows = [
    {
      key: 'heating',
      label: language === 'fr' ? 'Energie annuelle chauffage' : 'Annual heating energy',
      value: (option) => option.heatingKWh,
      format: formatAnnualEnergyIfComplete,
    },
    {
      key: 'reheat',
      label: language === 'fr' ? 'Energie annuelle rechauffage' : 'Annual reheat energy',
      value: (option) => option.reheatKWh,
      format: formatAnnualEnergyIfComplete,
    },
    {
      key: 'humidification',
      label: language === 'fr' ? 'Energie annuelle humidification' : 'Annual humidification energy',
      value: (option) => option.humidificationKWh,
      format: (value) => value === null ? (language === 'fr' ? 'Non applicable' : 'Not applicable') : formatAnnualEnergyIfComplete(value),
    },
    {
      key: 'pump',
      label: language === 'fr' ? 'Energie pompe Humifog' : 'Humifog pump energy',
      value: (option) => option.pumpKWh,
      format: (value) => value === null ? (language === 'fr' ? 'Non applicable' : 'Not applicable') : formatAnnualEnergyIfComplete(value),
    },
    {
      key: 'total',
      label: language === 'fr' ? 'Energie annuelle totale' : 'Total annual energy',
      value: (option) => option.totalKwh,
      format: formatAnnualEnergyIfComplete,
    },
    {
      key: 'cost',
      label: language === 'fr' ? 'Cout annuel exploitation' : 'Annual operating cost',
      value: (option) => option.annualCost,
      format: formatAnnualCostIfComplete,
    },
  ]
  const selectedHumifogKey = selectedHumifogTechnology({ mode: reportData.mode, system: reportData.system })
  const annualTechnologyOptions = freeCoolingAnnualTechnologyOptions.filter((option) => (
    BASELINE_TECHNOLOGIES.includes(option.key) || option.key === selectedHumifogKey
  ))
  const selectedHumifogOption = annualTechnologyOptions.find((option) => option.key === selectedHumifogKey)
  const annualComparisonReferenceOption = annualTechnologyOptions.find((option) => option.key === annualComparisonReference) || annualTechnologyOptions[0]
  const detailedAnnualComparisonRows = [
    { key: 'heatingKWh', label: language === 'fr' ? 'Énergie annuelle chauffage' : 'Annual heating energy', kind: 'energy' },
    { key: 'humidificationKWh', label: language === 'fr' ? 'Énergie annuelle humidification' : 'Annual humidification energy', kind: 'energy' },
    { key: 'reheatKWh', label: language === 'fr' ? 'Énergie annuelle réchauffage' : 'Annual reheat energy', kind: 'energy' },
    { key: 'pumpKWh', label: language === 'fr' ? 'Énergie pompe Humifog' : 'Humifog pump energy', kind: 'energy', humifogOnly: true },
    ...(selectedHumifogKey === 'humifogFreeCooling'
      ? [{ key: 'freeCoolingObtainedKWh', label: language === 'fr' ? 'Refroidissement gratuit grâce au Free Cooling' : 'Free cooling obtained from Free Cooling', kind: 'energy', humifogOnly: true }]
      : []),
    { key: 'annualEnergyKWh', label: language === 'fr' ? 'Énergie annuelle totale' : 'Total annual energy', kind: 'energy' },
    { key: 'annualOperatingCost', label: language === 'fr' ? 'Coût annuel total' : 'Total annual cost', kind: 'cost' },
    { key: 'annualSavings', label: language === 'fr' ? 'Économie annuelle nette' : 'Net annual savings', kind: 'cost', selectedHumifogOnly: true },
  ]
  const annualComparisonValue = (row, option) => {
    if (row.selectedHumifogOnly && option.key !== selectedHumifogKey) return null
    if (row.humifogOnly && !option.key.startsWith('humifog')) return null
    if (row.key === 'annualSavings') {
      return Number(annualComparisonReferenceOption?.annualOperatingCost) - Number(selectedHumifogOption?.annualOperatingCost)
    }
    const value = option[row.key]
    return Number.isFinite(Number(value)) ? Number(value) : undefined
  }
  const formatAnnualComparisonValue = (row, value) => {
    if (value === null) return language === 'fr' ? 'Non applicable' : 'Not applicable'
    if (!Number.isFinite(value)) return language === 'fr' ? 'Non disponible' : 'Not available'
    return row.kind === 'cost' ? formatAnnualCost(value) : formatAnnualEnergy(value)
  }
  const annualComparisonDifference = (row) => {
    const referenceValue = annualComparisonValue(row, annualComparisonReferenceOption)
    const humifogValue = annualComparisonValue(row, selectedHumifogOption)
    return Number.isFinite(referenceValue) && Number.isFinite(humifogValue)
      ? referenceValue - humifogValue
      : null
  }
  const format100OaAnnualValue = (row, option) => {
    if (row.key === 'pump' && !option.key.startsWith('humifog')) {
      return language === 'fr' ? 'Non applicable' : 'Not applicable'
    }
    const value = row.value(option)
    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return language === 'fr' ? 'Non disponible' : 'Not available'
    }
    return row.key === 'cost' ? formatAnnualCost(value) : formatAnnualEnergy(value)
  }
  const formatOaReductionText = (steamOa, humifogOa) => {
    const difference = Number(steamOa || 0) - Number(humifogOa || 0)
    const points = formatNumber(Math.abs(difference), 0)

    if (difference > 0) {
      return language === 'fr'
        ? `Humifog utilise ${points} points de pourcentage OA de moins`
        : `Humifog uses ${points} percentage points less OA`
    }

    if (difference < 0) {
      return language === 'fr'
        ? `Humifog utilise ${points} points de pourcentage OA de plus`
        : `Humifog uses ${points} percentage points more OA`
    }

    return language === 'fr' ? 'Aucun ecart OA' : 'No OA difference'
  }
  const freeCoolingAlignedComparisonRows = hasFreeCoolingChartComparison
    ? [
        {
          label: language === 'fr' ? 'BIN affiché sur la charte' : 'BIN shown on chart',
          reference: `${displayTemp(freeCoolingChartReferenceRow.tempC)}${tempUnit} / ${formatNumber(freeCoolingChartReferenceRow.hours, 0)} h`,
          humifog: `${displayTemp(freeCoolingChartHumifogRow.tempC)}${tempUnit} / ${formatNumber(freeCoolingChartHumifogRow.hours, 0)} h`,
          difference: '-',
        },
        {
          label: language === 'fr' ? 'OA théorique / appliqué' : 'Theoretical / applied OA',
          reference: `${formatNumber(freeCoolingChartReferenceRow.theoreticalOutdoorAirPercent, 0)}% -> ${formatNumber(freeCoolingChartReferenceRow.appliedOutdoorAirPercent, 0)}%`,
          humifog: `${formatNumber(freeCoolingChartHumifogRow.theoreticalOutdoorAirPercent, 0)}% -> ${formatNumber(freeCoolingChartHumifogRow.appliedOutdoorAirPercent, 0)}%`,
          difference: formatOaReductionText(
            freeCoolingChartReferenceRow.appliedOutdoorAirPercent,
            freeCoolingChartHumifogRow.appliedOutdoorAirPercent
          ),
        },
        {
          label: language === 'fr' ? 'Température mélange' : 'Mixed air temperature',
          reference: formatChartTemperature(freeCoolingReferenceMixedState),
          humifog: formatChartTemperature(freeCoolingChartHumifogRow.mixed),
          difference: formatSignedTemperatureDifference((freeCoolingReferenceMixedState?.db || 0) - freeCoolingChartHumifogRow.mixed.db),
        },
        {
          label: language === 'fr' ? 'Ratio humidité mélange' : 'Mixed air humidity ratio',
          reference: formatChartHumidityRatio(freeCoolingReferenceMixedState),
          humifog: formatChartHumidityRatio(freeCoolingChartHumifogRow.mixed),
          difference: units === 'imperial'
            ? `${formatSignedNumber((freeCoolingReferenceMixedState?.w || 0) * 7000 - freeCoolingChartHumifogRow.mixed.w * 7000)} gr/lb`
            : `${formatSignedNumber((freeCoolingReferenceMixedState?.w || 0) * 1000 - freeCoolingChartHumifogRow.mixed.w * 1000)} g/kg`,
        },
        {
          label: language === 'fr' ? 'Température après Humifog' : 'Temperature after Humifog',
          reference: formatChartTemperature(freeCoolingChartReferenceRow.afterHumifog),
          humifog: formatChartTemperature(freeCoolingChartHumifogRow.afterHumifog),
          difference: formatSignedTemperatureDifference((freeCoolingChartReferenceRow.afterHumifog?.db || 0) - freeCoolingChartHumifogRow.afterHumifog.db),
        },
        {
          label: language === 'fr' ? 'Charge humidification instantanée' : 'Instant humidification load',
          reference: formatInstantPower(freeCoolingChartReferenceRow.humidificationLoadKw),
          humifog: formatInstantPower(freeCoolingChartHumifogRow.humidificationLoadKw),
          difference: formatSignedPowerDifference(freeCoolingChartReferenceRow.humidificationLoadKw - freeCoolingChartHumifogRow.humidificationLoadKw),
        },
        {
          label: language === 'fr' ? 'Charge chauffage / réchauffage instantanée' : 'Instant heating / reheat load',
          reference: formatInstantPower(freeCoolingReferenceHeatKw),
          humifog: formatInstantPower(freeCoolingHumifogHeatKw),
          difference: formatSignedPowerDifference(freeCoolingReferenceHeatKw - freeCoolingHumifogHeatKw),
        },
        {
          label: language === 'fr' ? 'Énergie annuelle chauffage + réchauffage' : 'Annual heating + reheat energy',
          reference: formatAnnualEnergy(annualReferenceHeatKwh),
          humifog: formatAnnualEnergy(annualHumifogHeatKwh),
          difference: formatSignedAnnualEnergy(annualReferenceHeatKwh - annualHumifogHeatKwh),
        },
        {
          label: language === 'fr' ? 'Énergie annuelle humidification' : 'Annual humidification energy',
          reference: formatAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.freeCooling.humidificationEnergyKwh),
          humifog: formatAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.humifog.humidificationEnergyKwh),
          difference: formatSignedAnnualEnergy(
            freeCoolingHumifogAnalysis.annualComparison.freeCooling.humidificationEnergyKwh -
            freeCoolingHumifogAnalysis.annualComparison.humifog.humidificationEnergyKwh
          ),
        },
        {
          label: language === 'fr' ? 'Énergie annuelle totale' : 'Total annual energy',
          reference: formatAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.freeCooling.totalEnergyKwh),
          humifog: formatAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.humifog.totalEnergyKwh),
          difference: formatSignedAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.savingsKwh),
        },
        {
          label: language === 'fr' ? 'Coût annuel total' : 'Total annual cost',
          reference: formatAnnualCost(freeCoolingHumifogAnalysis.annualComparison.freeCooling.annualCost),
          humifog: formatAnnualCost(freeCoolingHumifogAnalysis.annualComparison.humifog.annualCost),
          difference: formatSavingsAnnualCost(freeCoolingHumifogAnalysis.annualComparison.annualSavings),
        },
      ]
    : []
  const activeRaPercent = is100OA ? 0 : 100 - activeOaPercent
  const imageOutdoorAirPercent = is100OA ? 100 : Number(minimumOutsideAirPercent)
  const imageReturnAirPercent = is100OA ? 0 : Math.max(0, 100 - imageOutdoorAirPercent)
  const imageOutdoorAirCFM = Math.round(outsideAirCFM * (imageOutdoorAirPercent / 100))
  const imageReturnAirCFM = Math.max(0, outsideAirCFM - imageOutdoorAirCFM)
  const imageExhaustAirCFM = imageOutdoorAirCFM
  const imageSupplyAirCFM = outsideAirCFM
  const displayedOaPercentForFlow = is100OA
    ? 100
    : isFreeCoolingMode
      ? minimumOutsideAirPercent
      : activeOaPercent
  const displayedOutdoorAirCFM = Math.round(outsideAirCFM * (displayedOaPercentForFlow / 100))
  const displayedReturnAirCFM = Math.max(0, outsideAirCFM - displayedOutdoorAirCFM)
  const displayedExhaustAirCFM = displayedOutdoorAirCFM
  const totalAirflowDisplay = `${displayFlow(outsideAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const outsideAirFlowDisplay = `${displayFlow(effectiveOutsideAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const returnAirFlowDisplay = `${displayFlow(calculatedReturnAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const displayedOutdoorAirFlowDisplay = `${displayFlow(displayedOutdoorAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const displayedReturnAirFlowDisplay = `${displayFlow(displayedReturnAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const displayedExhaustAirFlowDisplay = `${displayFlow(displayedExhaustAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const imageOutdoorAirFlowDisplay = `${displayFlow(imageOutdoorAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const imageReturnAirFlowDisplay = `${displayFlow(imageReturnAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const imageExhaustAirFlowDisplay = `${displayFlow(imageExhaustAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const imageSupplyAirFlowDisplay = `${displayFlow(imageSupplyAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} ${flowUnit}`
  const imageFlowDiagnostic = language === 'fr'
    ? `Débits image utilisés : OA ${formatNumber(imageOutdoorAirPercent, 1)}% / ${displayFlow(imageOutdoorAirCFM).toLocaleString('fr-CA')} ${flowUnit} | RA ${formatNumber(imageReturnAirPercent, 1)}% / ${displayFlow(imageReturnAirCFM).toLocaleString('fr-CA')} ${flowUnit} | Exhaust ${displayFlow(imageExhaustAirCFM).toLocaleString('fr-CA')} ${flowUnit} | Supply ${displayFlow(imageSupplyAirCFM).toLocaleString('fr-CA')} ${flowUnit}`
    : `Image airflow used: OA ${formatNumber(imageOutdoorAirPercent, 1)}% / ${displayFlow(imageOutdoorAirCFM).toLocaleString('en-CA')} ${flowUnit} | RA ${formatNumber(imageReturnAirPercent, 1)}% / ${displayFlow(imageReturnAirCFM).toLocaleString('en-CA')} ${flowUnit} | Exhaust ${displayFlow(imageExhaustAirCFM).toLocaleString('en-CA')} ${flowUnit} | Supply ${displayFlow(imageSupplyAirCFM).toLocaleString('en-CA')} ${flowUnit}`
  const freeCoolingEnergySavingsDisplay = freeCoolingCalculationComplete
    ? `${formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.netAnnualEnergySavingsKwh)} / ${formatSavingsPercent(freeCoolingHumifogAnalysis.netSavings.energyReductionPercent)}`
    : calculationIncompleteText
  const schematicMixedAirState = isFreeCoolingMode
    ? freeCoolingChartHumifogRow?.mixed ?? fallbackMixedState
    : fallbackMixedState
  const psychrometricGainItems = [
    {
      key: 'recovery',
      label: language === 'fr' ? 'Récupération roue' : 'Wheel recovery',
      value: `${formatNumber(chartRecoveryThermalKw, 1)} kW`,
    },
    {
      key: 'heating',
      label: language === 'fr' ? 'Prechauffage HP' : 'HP preheat',
      value: `${formatNumber(chartHeatingHpKw, 1)} kW`,
    },
    {
      key: 'humidification',
      label: language === 'fr' ? "Charge d'humidification" : 'Humidification load',
      value: `${formatNumber(chartHumifogWaterLbHr, 1)} lb/h / ${formatNumber(chartHumifogWaterKgH, 1)} kg/h`,
    },
    {
      key: 'pump',
      label: language === 'fr' ? 'Pompe Humifog' : 'Humifog pump',
      value: `${formatNumber(chartHumifogPumpKw, 1)} kW`,
    },
  ]
  const systemImageRecoveryType = {
    WHEEL: 'wheel',
    CROSSFLOW: 'crossflow',
    CASSETTE: 'cassette',
    GLYCOL: 'glycolLoop',
    BASIC: 'basic',
    NONE: 'basic',
  }[recoveryGroup] || 'wheel'
  const hvacSystemImageData = {
    oaTemp: `${displayTemp(fallbackOutdoorState.db)}${tempUnit}`,
    oaRh: `HR ${formatNumber(fallbackOutdoorState.rh, 0)}%`,
    raTemp: `${displayTemp(fallbackReturnState.db)}${tempUnit}`,
    raRh: `HR ${formatNumber(fallbackReturnState.rh, 0)}%`,
    mixedAirTemp: `${displayTemp(schematicMixedAirState.db)}${tempUnit}`,
    mixedAirSub: isFreeCoolingMode
      ? (language === 'fr' ? 'Avant Humifog' : 'Before Humifog')
      : '',
    afterRecoveryTemp: `${displayTemp(fallbackRecoveredState.db)}${tempUnit}`,
    afterRecoveryRh: `HR ${formatNumber(fallbackRecoveredState.rh, 0)}%`,
    afterHumifogTemp: `${displayTemp(fallbackAfterHumifogState.db)}${tempUnit}`,
    afterHumifogRh: `HR ${formatNumber(fallbackAfterHumifogState.rh, 0)}%`,
    afterHeatingTemp: `${displayTemp(fallbackAfterHeatingState.db)}${tempUnit}`,
    afterHeatingRh: `HR ${formatNumber(fallbackAfterHeatingState.rh, 0)}%`,
    saTemp: `${displayTemp(displayedAfterHumifogTemp)}${tempUnit}`,
    saRh: `HR ${formatNumber(displayedAfterHumifogRh, 1)}%`,
    recoveryKw: `${formatNumber(chartRecoveryThermalKw, 1)} kW`,
    heatingKw: `${formatNumber(chartHeatingHpKw, 1)} kW`,
    humifogKw: `${formatNumber(chartHumifogPumpKw, 1)} kW`,
    airflow: totalAirflowDisplay,
    oaPercent: `${formatNumber(imageOutdoorAirPercent, 1)}%`,
    raPercent: `${formatNumber(imageReturnAirPercent, 1)}%`,
    totalAirflow: totalAirflowDisplay,
    outsideAirFlow: imageOutdoorAirFlowDisplay,
    returnAirFlow: imageReturnAirFlowDisplay,
    exhaustAirFlow: imageExhaustAirFlowDisplay,
    supplyAirFlow: imageSupplyAirFlowDisplay,
    imageOutdoorAirCFM,
    imageReturnAirCFM,
    imageExhaustAirCFM,
    imageSupplyAirCFM,
    humifogLoad: humidificationLoadDisplay,
    energySavings: freeCoolingEnergySavingsDisplay,
  }
  const formatPointLabel = (label) => {
    const labels = {
      'Outdoor air': language === 'fr' ? 'Air extérieur' : 'Outdoor air',
      'Return air': language === 'fr' ? 'Air de retour' : 'Return air',
      'Mixed air': language === 'fr' ? 'Air mélangé' : 'Mixed air',
      'After thermal wheel': language === 'fr' ? 'Après roue thermique' : 'After thermal wheel',
      'After recovery': language === 'fr' ? 'Après récupération' : 'After recovery',
      'After Humifog': language === 'fr' ? 'Après Humifog' : 'After Humifog',
      'After preheat Humifog': language === 'fr' ? 'Après préchauffage' : 'After Preheat',
      Room: language === 'fr' ? 'Pièce' : 'Room',
    }

    return labels[label] ?? label
  }

  const assistantContext = {
    language,
    units,
    project: reportData.project,
    mode: reportData.mode,
    system: reportData.system,
    design: reportData.design,
    validation: reportData.validation,
    energySummary: reportData.energySummary,
    economics: reportData.economics,
    freeCooling: {
      calculationComplete: freeCoolingCalculationComplete,
      incompleteReason: freeCoolingHumifogAnalysis.incompleteReason,
      comparisonBasis: {
        rule: 'Humifog must not be compared to steam using the same mixed air temperature.',
        steamScenario: {
          source: 'annualComparison.freeCooling',
          averageMixedDb: freeCoolingHumifogAnalysis.annualComparison.freeCooling?.averageMixedDb,
          averageOa: freeCoolingHumifogAnalysis.annualComparison.freeCooling?.averageOa,
        },
        humifogScenario: {
          source: 'annualComparison.humifog',
          averageMixedDb: freeCoolingHumifogAnalysis.annualComparison.humifog?.averageMixedDb,
          averageOa: freeCoolingHumifogAnalysis.annualComparison.humifog?.averageOa,
          averageHumifogOutletDb: freeCoolingHumifogAnalysis.annualComparison.humifog?.averageHumifogDb,
        },
      },
      annualComparison: reportData.annualComparison,
      netSavings: reportData.netSavings,
      optimal: reportData.optimal,
      message: reportData.message,
      annualBreakdownRows: reportData.annualBreakdownRows,
      alignedComparisonRows: freeCoolingAlignedComparisonRows,
      binValidationRows: isCustomOperatingHoursMode ? [] : reportData.binValidationRows,
      optimizationRows: isCustomOperatingHoursMode ? [] : reportData.optimizationRows,
    },
    displayedValues: {
      humidificationLoad: humidificationLoadDisplay,
      totalAirflow: totalAirflowDisplay,
      outsideAirFlow: displayedOutdoorAirFlowDisplay,
      returnAirFlow: displayedReturnAirFlowDisplay,
      exhaustAirFlow: displayedExhaustAirFlowDisplay,
      activeOaPercent,
      activeRaPercent,
      psychrometricGainItems,
      hvacSystemImageData,
    },
    pdfReport: {
      available: Boolean(reportRef),
      title: reportData.project.name,
      sections: [
        'Design conditions',
        'HVAC system schematic',
        'Psychrometric analysis',
        'Psychrometric calculations',
        'BIN weather analysis',
        'OA / RA optimization',
        'Free cooling analysis',
        'Energy recovery analysis',
        'Energy analysis',
        'Economic analysis',
        'Greenhouse gas analysis',
        'Graphs',
        'Engineering recommendation',
      ],
    },
  }

  const askHesesAssistant = async () => {
    const question = assistantQuestion.trim()
    if (!question) {
      setAssistantError(language === 'fr' ? 'Entrez une question.' : 'Enter a question.')
      return
    }

    setAssistantLoading(true)
    setAssistantError('')

    try {
      const response = await fetch(HESES_ASSISTANT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          context: assistantContext,
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Assistant request failed')
      }

      if (typeof payload.configured === 'boolean') {
        setAssistantHealth((current) => ({
          ...current,
          checked: true,
          online: true,
          configured: payload.fallbackReason ? false : payload.configured,
          model: payload.model || current.model,
        }))
      }

      const fallbackPrefix = payload.fallbackReason
        ? `${language === 'fr' ? 'Mode local HESA actif' : 'HESA local mode active'}\n\n`
        : ''
      setAssistantAnswer(fallbackPrefix + (payload.answer || (language === 'fr'
        ? "L'assistant n'a retourne aucune reponse."
        : 'The assistant returned no answer.')))
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      const networkFailure = rawMessage === 'Failed to fetch' || rawMessage.includes('NetworkError')
      setAssistantError(networkFailure
        ? (language === 'fr'
          ? 'Le service Assistant HESA ne repond pas via Vite. Redemarrez HESA avec npm run dev ou npm run dev:all.'
          : 'The HESA Assistant service is not responding through Vite. Restart HESA with npm run dev or npm run dev:all.')
        : rawMessage)
    } finally {
      setAssistantLoading(false)
    }
  }

  const assistantSetupPanel = assistantHealth.checked && (
    !assistantHealth.online ? (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <div className="font-bold">
          {language === 'fr' ? 'Assistant IA hors ligne' : 'AI Assistant offline'}
        </div>
        <p className="mt-1">
          {language === 'fr'
            ? 'La route serveur /api/heses-assistant ne repond pas. Redemarrez HESA avec npm run dev ou npm run dev:all.'
            : 'The server route /api/heses-assistant is not responding. Restart HESA with npm run dev or npm run dev:all.'}
        </p>
      </div>
    ) : assistantHealth.configured === false ? (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-bold text-slate-900">
            {language === 'fr' ? 'Mode local HESA actif' : 'HESA local mode active'}
          </div>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700">
            {language === 'fr' ? 'Assistant secondaire' : 'Secondary assistant'}
          </span>
        </div>
        <p className="mt-2">
          {language === 'fr'
            ? "L'assistant explique uniquement les resultats affiches par HESA. Il ne modifie pas les calculs et ne bloque pas le logiciel."
            : 'The assistant explains only the results displayed by HESA. It does not modify calculations or block the software.'}
        </p>
      </div>
    ) : (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
        {language === 'fr'
          ? 'Assistant HESA actif.'
          : 'HESA Assistant active.'}
      </div>
    )
  )

  if (showLandingPage) {
    return (
      <HesesLandingPage
        language={language}
        setLanguage={setLanguage}
        onStartAnalysis={() => {
          if (typeof controlledStartAnalysis === 'function') {
            controlledStartAnalysis()
            return
          }
          setInternalShowLandingPage(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <style>{`
        @media screen {
          .heses-print-report {
            position: absolute;
            left: -10000px;
            top: 0;
            width: 1060px;
            background: #ffffff;
          }
        }

        @media print {
          @page {
            size: letter;
            margin: 14mm;
          }

          body {
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .heses-print-report,
          .heses-print-report * {
            visibility: visible !important;
          }

          .heses-print-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            color: #0f172a !important;
            background: #ffffff !important;
          }

          .heses-print-report .engineering-report {
            max-width: 1060px;
            margin: 0 auto;
            font-size: 12px;
          }

          .heses-print-report .page-break {
            break-before: auto;
            page-break-before: auto;
          }

          .heses-print-report .report-cover.page-break {
            break-before: auto;
            page-break-before: auto;
          }

          .heses-print-report .report-cover {
            break-after: page;
            page-break-after: always;
          }

          .heses-print-report .report-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .heses-print-report .report-section.allow-page-break {
            break-inside: auto;
            page-break-inside: auto;
          }

          .heses-print-report .report-section h2,
          .heses-print-report .report-section h3 {
            break-after: avoid;
            page-break-after: avoid;
          }

          .heses-print-report button {
            display: none !important;
          }
        }
      `}</style>
      <div className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="logo-card" role="img" aria-label="HESA Humidification Energy System Analysis">
            <div className="logo-title">HESA</div>
            <div className="logo-accent" aria-hidden="true" />
            <div className="logo-subtitle">Humidification Energy System Analysis</div>
          </div>
          <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLanguage('fr')}
            className={`px-4 py-2 rounded-xl font-semibold transition ${
              language === 'fr' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-200 text-slate-700'
            }`}
          >
            Français
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-4 py-2 rounded-xl font-semibold transition ${
              language === 'en' ? 'bg-cyan-600 text-white shadow' : 'bg-slate-200 text-slate-700'
            }`}
          >
            English
          </button>
          <div className="w-px bg-slate-300 mx-1 self-stretch" />
          <button
            onClick={() => setUnits('metric')}
            className={`px-4 py-2 rounded-xl font-semibold transition ${
              units === 'metric' ? 'bg-sky-700 text-white shadow' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {t.metric}
          </button>
          <button
            onClick={() => setUnits('imperial')}
            className={`px-4 py-2 rounded-xl font-semibold transition ${
              units === 'imperial' ? 'bg-sky-700 text-white shadow' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {t.imperial}
          </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={generatePDF}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl shadow-xl font-bold transition"
          >
            {t.generatePDF}
          </button>
          <button
            onClick={downloadPrintableReport}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl font-bold transition"
          >
            {language === 'fr' ? 'Rapport imprimable' : 'Printable report'}
          </button>
        </div>
      </div>

      <section className="mx-auto mb-6 max-w-7xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {language === 'fr' ? 'Identification du projet' : 'Project Identification'}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {language === 'fr'
                ? 'Ces informations sont sauvegardées localement et apparaissent dans le rapport PDF.'
                : 'These details are saved locally and appear in the PDF report.'}
            </p>
          </div>
          <button
            type="button"
            onClick={saveProjectProfile}
            className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white shadow hover:bg-emerald-700"
          >
            {language === 'fr' ? 'Sauvegarder le projet' : 'Save project'}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {language === 'fr' ? 'Nom du projet' : 'Project name'}
            </span>
            <input
              type="text"
              value={projectProfile.name}
              onChange={(event) => updateProjectProfile('name', event.target.value)}
              placeholder={language === 'fr' ? 'Ex. Hôpital - CTA niveau 2' : 'Ex. Hospital - AHU level 2'}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {language === 'fr' ? 'Client / propriétaire' : 'Client / owner'}
            </span>
            <input
              type="text"
              value={projectProfile.owner}
              onChange={(event) => updateProjectProfile('owner', event.target.value)}
              placeholder={language === 'fr' ? 'Nom du client' : 'Client name'}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              {language === 'fr' ? 'Ingénieur / représentant' : 'Engineer / representative'}
            </span>
            <input
              type="text"
              value={projectProfile.engineer}
              onChange={(event) => updateProjectProfile('engineer', event.target.value)}
              placeholder={language === 'fr' ? 'Nom de l’ingénieur ou représentant' : 'Engineer or representative name'}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none"
            />
          </label>
        </div>
        {projectSaveStatus && (
          <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            {projectSaveStatus}
          </div>
        )}
      </section>

      <div className="heses-print-report" aria-hidden="true">
        <div
          ref={reportRef}
          dangerouslySetInnerHTML={{ __html: buildPrintableReportMarkup() }}
        />
      </div>

      {reportPreviewVisible && (
        <section className="mx-auto mb-6 max-w-7xl rounded-3xl border border-slate-300 bg-white p-5 shadow-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {language === 'fr' ? 'Apercu du rapport HESA genere' : 'Generated HESA report preview'}
              </h2>
              {reportStatus && (
                <p className="mt-1 text-sm font-semibold text-slate-600">{reportStatus}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generatePDF}
                className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700"
              >
                {language === 'fr' ? 'Ouvrir rapport PDF' : 'Open PDF report'}
              </button>
              <button
                type="button"
                onClick={printReportPreview}
                className="rounded-xl bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
              >
                {language === 'fr' ? 'Imprimer cet aperçu' : 'Print this preview'}
              </button>
              <button
                type="button"
                onClick={downloadPrintableReport}
                className="rounded-xl bg-slate-800 px-4 py-2 font-bold text-white hover:bg-slate-900"
              >
                {language === 'fr' ? 'Telecharger HTML' : 'Download HTML'}
              </button>
              <button
                type="button"
                onClick={() => setReportPreviewVisible(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
              >
                {language === 'fr' ? 'Fermer' : 'Close'}
              </button>
            </div>
          </div>
          <div className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <iframe
              title={language === 'fr' ? 'Aperçu du rapport PDF HESA' : 'HESA PDF report preview'}
              srcDoc={buildPrintableReportHtml({ autoPrint: false })}
              className="h-[75vh] w-full rounded-xl border-0 bg-white shadow"
            />
          </div>
        </section>
      )}

      <div>
        <div className="mx-auto w-full max-w-7xl space-y-6">

          {/* Header */}
          <div className="w-full bg-gradient-to-r from-sky-700 to-cyan-500 rounded-3xl shadow-2xl p-8 text-white">
            <h1 className="text-4xl font-bold">{t.title}</h1>
            <p className="mt-3 text-lg opacity-90">{t.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {ventilationModes[language].map((item) => {
                const selected = ventilationMode.type === item.type

                return (
                  <button
                    key={`header-mode-${item.type}`}
                    type="button"
                    onClick={() => openVentilationMode(item)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                      selected
                        ? 'border-white bg-white text-sky-800'
                        : 'border-white/60 bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {item.nom}
                  </button>
                )
              })}
            </div>
          </div>


          {/* Climate Cities */}
          <div className="w-full bg-white rounded-3xl shadow-xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{t.climateConditions}</h2>
                <p className="text-slate-500 mt-1">{t.climateDescription}</p>
              </div>
              <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">
                {t.hvacRegions}
              </div>
            </div>

            {isFreeCoolingMode && (
            <div className="order-3 w-full bg-white rounded-3xl shadow-xl p-6 border border-cyan-200 mb-8">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {language === 'fr' ? 'Parametres de depart Free Cooling' : 'Free Cooling Starting Parameters'}
                  </h2>
                  <p className="text-slate-500 mt-1">
                    {language === 'fr'
                      ? 'A valider en premier : conditions de piece, debit CTA et minimum d air exterieur.'
                      : 'Validate first: room conditions, AHU airflow and minimum outdoor air.'}
                  </p>
                </div>
                <div className="bg-cyan-100 text-cyan-700 px-4 py-2 rounded-full text-sm font-semibold">
                  {language === 'fr' ? 'Etape 1' : 'Step 1'}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse overflow-hidden rounded-2xl">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="p-4 text-left">{language === 'fr' ? 'Parametre' : 'Parameter'}</th>
                      <th className="p-4 text-center">{language === 'fr' ? 'Valeur confirmee' : 'Confirmed value'}</th>
                      <th className="p-4 text-center">{language === 'fr' ? 'Ajustement' : 'Adjustment'}</th>
                      <th className="p-4 text-center">{language === 'fr' ? 'Impact calcule' : 'Calculated impact'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-4 font-semibold text-slate-800">{t.roomTemperature}</td>
                      <td className="p-4 text-center font-bold text-slate-800">{displayTemp(roomTemperature)}{tempUnit}</td>
                      <td className="p-4">
                        <input
                          type="number"
                          min={displayTemp(18)}
                          max={displayTemp(30)}
                          step="0.1"
                          value={displayTemp(roomTemperature)}
                          onChange={(event) => setRoomTemperature(inputTempToC(Number(event.target.value)))}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                        />
                      </td>
                      <td className="p-4 text-center text-slate-600">
                        {language === 'fr' ? 'Point de retour / piece' : 'Return / room point'}
                      </td>
                    </tr>

                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-4 font-semibold text-slate-800">{t.relativeHumidity}</td>
                      <td className="p-4 text-center font-bold text-slate-800">{roomRelativeHumidity}%</td>
                      <td className="p-4">
                        <input
                          type="number" min="0" max="100" step="1" value={roomRelativeHumidity}
                          onChange={(event) => setRoomRelativeHumidity(Number(event.target.value))}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                        />
                      </td>
                      <td className="p-4 text-center text-slate-600">
                        {language === 'fr' ? 'Humidite cible de la piece' : 'Room humidity target'}
                      </td>
                    </tr>

                    <tr className="border-b border-slate-200">
                      <td className="p-4 font-semibold text-slate-800">
                        {language === 'fr' ? 'Debit CTA total confirme' : 'Confirmed total AHU airflow'}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-800">{displayFlow(outsideAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} {flowUnit}</td>
                      <td className="p-4">
                        <input
                          type="number"
                          min="100"
                          max="150000"
                          step={units === 'metric' ? 50 : 100}
                          value={displayFlow(outsideAirCFM)}
                          onChange={(event) => setOutsideAirCFM(inputFlowToCfm(Number(event.target.value)))}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                        />
                      </td>
                      <td className="p-4 text-center text-slate-600">
                        {language === 'fr' ? 'Base des debits OA / RA' : 'Basis for OA / RA airflow'}
                      </td>
                    </tr>

                    <tr className="bg-cyan-50">
                      <td className="p-4 font-semibold text-slate-800">
                        {language === 'fr' ? 'Air exterieur minimum selectionne' : 'Selected minimum outdoor air'}
                      </td>
                      <td className="p-4 text-center font-bold text-cyan-700">{minimumOutsideAirPercent}% OA / {100 - minimumOutsideAirPercent}% RA</td>
                      <td className="p-4">
                        <input
                          type="number" min="0" max="100" step="0.1" value={minimumOutsideAirPercent}
                          onChange={(event) => setMinimumOutsideAirPercent(Number(event.target.value))}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                        />
                      </td>
                      <td className="p-4 text-center text-slate-700">
                        <span className="font-semibold text-cyan-700">{displayedOutdoorAirFlowDisplay}</span>
                        <span className="mx-2 text-slate-400">/</span>
                        <span className="font-semibold text-orange-700">{displayedReturnAirFlowDisplay}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-3 text-sm font-semibold text-slate-600">
                  {language === 'fr'
                    ? 'Note : si les températures de mélange appliquées sont égales, le minimum OA sélectionné bloque les volets. La cible Humifog demeure plus chaude avant atomisation, mais elle ne peut pas être atteinte sans descendre sous le minimum OA.'
                    : 'Note: if the applied mixed-air temperatures are equal, the selected OA minimum is limiting the dampers. The Humifog target remains warmer before atomization, but it cannot be reached without going below the OA minimum.'}
                </p>

                <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {language === 'fr' ? 'Commande des volets OA / RA Free Cooling' : 'Free Cooling OA / RA Damper Control'}
                      </h3>
                      <p className="mt-1 text-sm text-slate-700">
                        {language === 'fr'
                          ? 'La vapeur et Humifog utilisent leurs propres positions de volets calculées. Le minimum OA sélectionné reste une limite inférieure.'
                          : 'Steam and Humifog use their own calculated damper positions. The selected minimum OA remains a lower limit.'}
                      </p>
                    </div>
                    <div className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-sm font-bold text-cyan-800">
                      {language === 'fr' ? 'Volets modulants' : 'Modulating dampers'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="rounded-xl border border-cyan-100 bg-white p-4">
                      <span className="block text-xs font-bold uppercase text-slate-500">
                        {language === 'fr' ? 'Consigne air mélangé' : 'Mixed-air setpoint'}
                      </span>
                      <input
                        type="number"
                        min={displayTemp(10)}
                        max={displayTemp(30)}
                        step="0.5"
                        value={displayTemp(economizerTargetTemp)}
                        onChange={(event) => setEconomizerTargetTemp(inputTempToC(Number(event.target.value)))}
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-bold text-slate-800"
                      />
                      <span className="mt-1 block text-xs text-slate-500">{tempUnit}</span>
                    </label>
                    <div className="rounded-xl border border-cyan-100 bg-white p-4">
                      <div className="text-xs font-bold uppercase text-slate-500">{language === 'fr' ? 'OA minimum imposé' : 'Enforced OA minimum'}</div>
                      <div className="mt-2 text-2xl font-bold text-cyan-800">{formatNumber(minimumOutsideAirPercent, 1)}% OA</div>
                      <div className="mt-1 text-sm font-semibold text-orange-700">{formatNumber(100 - minimumOutsideAirPercent, 1)}% RA</div>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-white p-4">
                      <div className="text-xs font-bold uppercase text-slate-500">{language === 'fr' ? 'Vapeur, moyenne appliquée' : 'Steam, average applied'}</div>
                      <div className="mt-2 text-2xl font-bold text-red-700">{formatNumber(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageAppliedOa, 1)}% OA</div>
                      <div className="mt-1 text-sm font-semibold text-orange-700">{formatNumber(100 - freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageAppliedOa, 1)}% RA</div>
                    </div>
                    <div className="rounded-xl border border-cyan-100 bg-white p-4">
                      <div className="text-xs font-bold uppercase text-slate-500">{language === 'fr' ? 'Humifog, moyenne appliquée' : 'Humifog, average applied'}</div>
                      <div className="mt-2 text-2xl font-bold text-cyan-800">{formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.averageAppliedOa, 1)}% OA</div>
                      <div className="mt-1 text-sm font-semibold text-orange-700">{formatNumber(100 - freeCoolingHumifogAnalysis.annualComparison.humifog.averageAppliedOa, 1)}% RA</div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    {language === 'fr'
                      ? 'Les positions théoriques et appliquées par BIN restent visibles dans la validation annuelle ci-dessous; la position appliquée ne descend jamais sous le minimum OA.'
                      : 'The theoretical and applied positions by BIN remain visible in the annual validation below; the applied position never goes below the OA minimum.'}
                  </p>
                </section>
              </div>
            </div>
            )}

            <div className="order-2 grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {climateCities.map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (calculationMethod === 'hourly' && hourlyWeatherSourceType !== 'custom') {
                      clearHourlyWeatherState()
                    }
                    setSelectedCity(item)
                  }}
                  className={`rounded-2xl p-5 border-2 cursor-pointer transition hover:shadow-lg ${
                    selectedCity.nom === item.nom
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-slate-800 text-lg">{item.nom}</div>
                  <div className="text-slate-500 text-sm mt-2">
                    {displayTemp(item.hiver)}{tempUnit} {t.winter} / {displayTemp(item.ete)}{tempUnit} {t.summer}
                  </div>
                  <div className="text-slate-500 text-sm mt-1">{t.summerHumidity} {item.humidite}%</div>
                  <div className="mt-3 inline-block bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-semibold text-slate-700">
                    {item.zone}
                  </div>
                </div>
              ))}
            </div>

          </div>
            {/* Heat Recovery Systems */}
            {!isFreeCoolingMode && (
              <div className="w-full bg-orange-50 border border-orange-200 rounded-3xl p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">{t.heatRecovery}</h2>
                    <p className="text-slate-500 mt-1">{t.heatRecoveryDescription}</p>
                  </div>
                  <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold">
                    {t.combinedRecovery}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {displayedHeatRecoverySystems.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setSelectedRecoveries([item])
                        setWheelEfficiency(defaultSensibleRecoveryEfficiency(item))
                        setLatentRecoveryEfficiency(defaultLatentRecoveryEfficiency(item))
                      }}
                      className={`rounded-2xl p-5 border-2 cursor-pointer transition hover:shadow-lg ${
                        activeSelectedRecoveries.some(r => r.nom === item.nom)
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <img
                        src={heatRecoveryImageFor(item)}
                        alt={item.nom}
                        className="mb-4 h-44 w-full rounded-xl border border-slate-200 bg-white object-contain p-2"
                        loading="eager"
                        onError={(event) => {
                          event.currentTarget.src = systemImages.fallback
                        }}
                      />
                      <div className="font-bold text-slate-800 text-lg">{item.nom}</div>
                      <div className="text-slate-500 text-sm mt-2">{item.type}</div>
                      <div className="mt-5 flex justify-between items-center">
                        <div className="text-sm text-slate-500">{t.designRecoveryEfficiency}</div>
                        <div className="text-3xl font-bold text-cyan-700">
                          {activeSelectedRecoveries.some(r => r.nom === item.nom)
                            ? `${Math.round(effectiveSensibleRecoveryEfficiency)}%`
                            : `${Math.round(defaultSensibleRecoveryEfficiency(item))}%`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {!isNoRecovery && (
                  <div className="mt-6 rounded-2xl border border-orange-200 bg-white p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700">{t.sensibleEfficiency}</span>
                          <span className="text-sm font-bold text-slate-800">{Math.round(effectiveSensibleRecoveryEfficiency)}%</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round(wheelEfficiency)}
                          onChange={(event) => setWheelEfficiency(clampValue(Number(event.target.value), 0, 100))}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                        />
                        <div className="mt-1 text-xs text-slate-500">{t.designRecoveryEfficiency}</div>
                      </div>
                      {selectedRecoverySupportsLatent ? (
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">{t.latentEfficiency}</span>
                            <span className="text-sm font-bold text-slate-800">{Math.round(effectiveLatentRecoveryEfficiency)}%</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(latentRecoveryEfficiency)}
                            onChange={(event) => setLatentRecoveryEfficiency(clampValue(Number(event.target.value), 0, 100))}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                          />
                          <div className="mt-1 text-xs text-slate-500">{t.designRecoveryEfficiency}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
            {false && (
              <>
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{t.hvacParameters}</h2>

            {/* Ventilation Mode */}
            <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
                {t.ventilationMode}
              </h2>
              <div className="flex flex-col gap-3">
                {ventilationModes[language].map((item, index) => {
                  const selected = ventilationMode.nom === item.nom;
                  return (
                    <button
                      key={index}
                      onClick={() => openVentilationMode(item)}
                      className={`flex items-center gap-4 w-full text-left px-5 py-4 rounded-2xl border-2 transition-all ${
                        selected
                          ? 'border-slate-800 bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selected ? 'border-slate-800' : 'border-slate-300'
                      }`}>
                        {selected && <span className="w-2.5 h-2.5 rounded-full bg-slate-800 block" />}
                      </span>
                      <div className="flex-1">
                        <div className={`font-semibold text-base ${selected ? 'text-slate-900' : 'text-slate-600'}`}>
                          {item.nom}
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5">{item.description}</div>
                        {selected && item.type === 'free-cooling-evaporative' && (
                          <img
                            src={systemImages.freeCooling}
                            alt={language === 'fr' ? 'Système Free Cooling' : 'Free Cooling system'}
                            className="mt-3 max-h-72 w-full rounded-xl border border-slate-200 object-contain bg-white"
                            loading="eager"
                            onError={(event) => {
                              event.currentTarget.src = systemImages.fallback
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Economizer card - only shown for Free Cooling modes */}
              </>
            )}
            {showFreeCoolingTables && (
              <div className="w-full bg-cyan-50 border border-cyan-200 rounded-3xl p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">{t.economizerCard}</h2>
                    <p className="text-slate-500 mt-1">{t.economizerCardDesc}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                    economizerActive
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      : 'bg-red-100 text-red-700 border border-red-300'
                  }`}>
                    {economizerActive ? t.economizerActive : t.economizerInactive}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    {t.economizerMixTarget}
                  </div>
                  <div className="text-4xl font-bold text-slate-800 mb-4">
                    {displayTemp(economizerTargetTemp)}{tempUnit}
                  </div>
                  <div className="flex gap-2">
                    {economizerTargetOptions.map((displayValue) => {
                      const tempC = inputTempToC(displayValue)
                      const selected = Math.abs(economizerTargetTemp - tempC) < 0.25
                      return (
                        <button
                          key={`${units}-${displayValue}`}
                          onClick={() => setEconomizerTargetTemp(tempC)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                            selected
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                          }`}
                        >
                          {displayValue}{tempUnit}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-3 text-sm text-slate-500">
                    {t.economizerNote} : <strong className="text-slate-700">{displayTemp(outsideWinterTemp)}{tempUnit}</strong>
                    <span className="ml-4">{t.outsideAirFraction} : <strong className={economizerActive ? 'text-emerald-700' : 'text-red-700'}>
                      {Math.round(activeFraction * 100)}%
                    </strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{language === 'fr' ? 'Débit total confirmé' : 'Confirmed total airflow'}</div>
                    <div className="text-4xl font-bold text-slate-800 mt-2">{displayFlow(outsideAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')}</div>
                    <div className="text-sm text-slate-500 mt-1">{flowUnit}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{language === 'fr' ? 'Débit OA minimum calculé' : 'Calculated minimum OA flow'}</div>
                    <div className="text-4xl font-bold text-cyan-700 mt-2">{displayFlow(displayedOutdoorAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')}</div>
                    <div className="text-sm text-slate-500 mt-1">{flowUnit}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{language === 'fr' ? 'Débit air de retour calculé' : 'Calculated return air flow'}</div>
                    <div className="text-4xl font-bold text-orange-700 mt-2">{displayFlow(displayedReturnAirCFM).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')}</div>
                    <div className="text-sm text-slate-500 mt-1">{flowUnit}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{language === 'fr' ? 'OA minimum' : 'Minimum OA'}</div>
                    <div className="text-4xl font-bold text-cyan-700 mt-2">{minimumOutsideAirPercent}</div>
                    <div className="text-sm text-slate-500 mt-1">%</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{language === 'fr' ? 'RA disponible' : 'Available RA'}</div>
                    <div className="text-4xl font-bold text-orange-700 mt-2">{100 - minimumOutsideAirPercent}</div>
                    <div className="text-sm text-slate-500 mt-1">%</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{t.economizerHoursLabel}</div>
                    <div className="text-4xl font-bold text-cyan-700 mt-2">{totalEconomizerHours.toLocaleString()}</div>
                    <div className="text-sm text-slate-500 mt-1">{t.perYear}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{t.economizerAvgOutsideAir}</div>
                    <div className="text-4xl font-bold text-cyan-700 mt-2">{displayFlow(averageOACFM).toLocaleString()}</div>
                    <div className="text-sm text-slate-500 mt-1">{flowUnit}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-cyan-100">
                    <div className="text-sm text-slate-500">{t.economizerOAReductionLabel}</div>
                    <div className="text-4xl font-bold text-green-700 mt-2">{outsideAirReduction}</div>
                    <div className="text-sm text-slate-500 mt-1">%</div>
                  </div>
                </div>
              </div>
            )}

            {/* Reheat Systems */}
            <div className="w-full bg-green-50 border border-green-200 rounded-3xl p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">{t.reheatSystem}</h2>
                  <p className="text-slate-500 mt-1">{t.reheatDescription}</p>
                </div>
                <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
                  {t.reheatHVAC}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reheatSystems[language].map((item, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedReheatSystem(item)}
                    className={`rounded-2xl p-4 border-2 cursor-pointer transition hover:shadow-lg ${
                      selectedReheatSystem.nom === item.nom
                        ? 'border-green-500 bg-green-100'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="font-bold text-slate-800">{item.nom}</div>
                    <div className="text-sm text-slate-500 mt-2">{item.energie}</div>
                    <div className="text-3xl font-bold text-green-700 mt-4">
                      {item.cop ? `COP ${heatPumpCOP.toFixed(1)}` : `${item.rendement}%`}
                    </div>
                  </div>
                ))}
              </div>
            </div>


            <div className={`grid grid-cols-1 gap-6 mb-8 ${isFreeCoolingMode ? 'md:grid-cols-1 lg:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
              {!isFreeCoolingMode && (
                <div>
                <div className="flex justify-between mb-2">
                  <span>{t.roomTemperature}</span>
                  <span>{displayTemp(roomTemperature)}{tempUnit}</span>
                </div>
                <input
                  type="number"
                  min={displayTemp(18)}
                  max={displayTemp(30)}
                  step="0.1"
                  value={displayTemp(roomTemperature)}
                  onChange={(e) => setRoomTemperature(inputTempToC(Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                />
                </div>
              )}

              {!isFreeCoolingMode && (
                <div>
                <div className="flex justify-between mb-2">
                  <span>{t.relativeHumidity}</span>
                  <span>{roomRelativeHumidity}%</span>
                </div>
                <input
                  type="number" min="0" max="100" step="1" value={roomRelativeHumidity}
                  onChange={(e) => setRoomRelativeHumidity(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                />
                </div>
              )}

              {!isFreeCoolingMode && (
                <div>
                <div className="flex justify-between mb-2">
                  <span>{t.supplyAirTemperature}</span>
                  <span>{displayTemp(supplyAirTemperature)}{tempUnit}</span>
                </div>
                <input
                  type="number"
                  min={displayTemp(15)}
                  max={displayTemp(40)}
                  step="0.1"
                  value={displayTemp(supplyAirTemperature)}
                  onChange={(e) => setSupplyAirTemperature(inputTempToC(Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                />
                </div>
              )}

              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="flex justify-between gap-4 mb-2">
                  <span>{t.beforeHumifogTemperature}</span>
                  <span className="font-semibold">{displayTemp(displayedPreHumifogTemp)}{tempUnit} / HR {formatNumber(displayedPreHumifogRh, 1)}%</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t.afterHumifogTemperature}</span>
                  <span className="font-semibold">{displayTemp(displayedAfterHumifogTemp)}{tempUnit} / HR {formatNumber(displayedAfterHumifogRh, 1)}%</span>
                </div>
              </div>
            </div>

            {/* Sliders Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!isFreeCoolingMode && (
                <div>
                <div className="flex justify-between mb-2">
                  <span>{t.outsideAirFlow}</span>
                  <span>{displayFlow(outsideAirCFM).toLocaleString()} {flowUnit}</span>
                </div>
                <input
                  type="number"
                  min="100"
                  max="150000"
                  step={units === 'metric' ? 50 : 100}
                  value={displayFlow(outsideAirCFM)}
                  onChange={(e) => setOutsideAirCFM(inputFlowToCfm(Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                />
                </div>
              )}

              {!isFreeCoolingMode && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="text-sm text-red-700">{language === 'fr' ? 'Fraction air extérieur' : 'Outside air fraction'}</div>
                  <div className="text-3xl font-bold text-red-800 mt-2">100%</div>
                  <div className="text-sm text-red-700 mt-1">
                    {language === 'fr' ? 'Fixe en mode 100% air extérieur' : 'Fixed in 100% outside air mode'}
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between mb-2">
                  <span>{t.heatPumpCOP}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="8"
                    step="0.1"
                    value={heatPumpCOP}
                    onChange={(e) => setHeatPumpCOP(clampValue(Number(e.target.value), 1, 8))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                  />
                  <span className="text-sm font-semibold text-slate-500">COP</span>
                </div>
                {is100OA && isNoRecovery && (
                  <p className="mt-2 text-sm text-slate-500">
                    {language === 'fr'
                      ? 'En 100 % air extérieur sans récupération, le réchauffage Humifog par thermopompe est converti en kWh électrique selon ce COP.'
                      : 'In 100% outdoor air with no recovery, Humifog heat-pump reheat is converted to electric kWh with this COP.'}
                  </p>
                )}
              </div>

              {!isFreeCoolingMode && <div />}

            </div>
          </div>

          <div className="mb-8">
            <HVACSystemImage
              schematicId={systemSchematicId}
              recoveryType={systemImageRecoveryType}
              recoveryLabel={isFreeCoolingMode
                ? (language === 'fr' ? 'Aucune récupération thermique' : 'No heat recovery')
                : selectedSystemDiagramLabel}
              location={`${selectedCity?.nom} - ${selectedCity?.zone}`}
              systemDescription={isFreeCoolingMode
                ? (language === 'fr'
                  ? `CTA - Free Cooling + retour air - Humifog - ${selectedReheatSystemDisplayName}`
                  : `AHU - Free Cooling + return air - Humifog - ${selectedReheatSystemDisplayName}`)
                : (language === 'fr'
                  ? `CTA - 100% air extérieur - ${selectedSystemDiagramLabel} - Humifog - ${selectedReheatSystemDisplayName}`
                  : `AHU - 100% outdoor air - ${selectedSystemDiagramLabel} - Humifog - ${selectedReheatSystemDisplayName}`)}
              isFreeCoolingMode={isFreeCoolingMode}
              language={language}
              outdoorAirPercent={imageOutdoorAirPercent}
              returnAirPercent={imageReturnAirPercent}
              outdoorAirCFM={imageOutdoorAirCFM}
              returnAirCFM={imageReturnAirCFM}
              exhaustAirCFM={imageExhaustAirCFM}
              supplyAirCFM={imageSupplyAirCFM}
              data={hvacSystemImageData}
            />
            {isFreeCoolingMode && (
              <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
                {imageFlowDiagnostic}
              </div>
            )}
          </div>

          <PsychrometricChart
            key={`${ventilationMode.type}-${recoveryGroup}-${selectedRecoveryName}-${selectedReheatSystem?.nom || ''}-${units}`}
            title={t.psychrometricChart}
            description={
              language === 'fr'
                ? 'Courbes HR, enthalpie, temperature seche, ratio humidite et points du systeme selectionne'
                : 'RH curves, enthalpy, dry bulb temperature, humidity ratio and selected system points'
            }
            points={psychrometricChartPoints}
            processOrder={psychrometricProcessOrder}
            gains={psychrometricGainItems}
            language={language}
            units={units}
            referencePointKey="room"
          />
          {chartHumifogWarning && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {chartHumifogWarning}
            </div>
          )}

          <div className="w-full bg-white rounded-3xl shadow-xl p-6 overflow-x-auto border border-slate-200">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {language === 'fr' ? 'Tarifs et rendements énergétiques' : 'Energy Rates and Efficiencies'}
                </h2>
                <p className="text-slate-500 mt-1">
                  {language === 'fr'
                    ? 'Tous les tarifs et rendements utilisés dans les calculs annuels sont regroupés ici.'
                    : 'All rates and efficiencies used in annual calculations are grouped here.'}
                </p>
              </div>
              <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-full text-sm font-semibold">
                {language === 'fr' ? 'Tableau unique' : 'Single table'}
              </div>
            </div>

            <table className="w-full min-w-[920px] border-collapse overflow-hidden rounded-2xl">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-4 text-left">{language === 'fr' ? 'Paramètre' : 'Parameter'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Valeur actuelle' : 'Current value'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Ajustement' : 'Adjustment'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Résultat calculé' : 'Calculated result'}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-4 font-semibold text-slate-800">{t.electricity}</td>
                  <td className="p-4 text-center font-bold text-slate-800">{electricityRate.toFixed(2)} $/kWh</td>
                  <td className="p-4">
                    <input
                      type="number" min="0.03" max="0.50" step="0.001" value={electricityRate}
                      onChange={(e) => setElectricityRate(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                    />
                  </td>
                  <td className="p-4 text-center text-slate-700">
                    {language === 'fr' ? 'Vapeur électrique, Humifog et thermopompe' : 'Electric steam, Humifog and heat pump'}
                  </td>
                </tr>

                <tr className="border-b border-slate-200 bg-slate-50">
                  <td className="p-4 font-semibold text-slate-800">{t.naturalGasCost}</td>
                  <td className="p-4 text-center font-bold text-slate-800">{displayGasRate(naturalGasRate).toFixed(2)} {gasRateUnit}</td>
                  <td className="p-4">
                    <input
                      type="number"
                      min="0.10"
                      max={units === 'imperial' ? 54.64 : 2.00}
                      step="0.01"
                      value={displayGasRate(naturalGasRate)}
                      onChange={(e) => setNaturalGasRate(inputGasRateToMetric(Number(e.target.value)))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                    />
                  </td>
                  <td className="p-4 text-center text-yellow-700 font-semibold">
                    {annualNaturalGasCostDisplay.toLocaleString()} $/an
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="p-4 font-semibold text-slate-800">{t.boilerEfficiency}</td>
                  <td className="p-4 text-center font-bold text-slate-800">{steamBoilerEfficiency}%</td>
                  <td className="p-4">
                    <input
                      type="number" min="0" max="100" step="1" value={steamBoilerEfficiency}
                      onChange={(e) => setSteamBoilerEfficiency(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                    />
                  </td>
                  <td className="p-4 text-center text-yellow-700 font-semibold">
                    {naturalGasSteamInputKW.toLocaleString()} kW / {displayGasFlow(naturalGasM3PerHour)} {gasFlowUnit}
                  </td>
                </tr>

                <tr className="bg-slate-50">
                  <td className="p-4 font-semibold text-slate-800">{t.atmosphericGasHumidifierEfficiencyLabel}</td>
                  <td className="p-4 text-center font-bold text-slate-800">{atmosphericGasHumidifierEfficiency}%</td>
                  <td className="p-4">
                    <input
                      type="number" min="0" max="100" step="1" value={atmosphericGasHumidifierEfficiency}
                      onChange={(e) => setAtmosphericGasHumidifierEfficiency(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                    />
                  </td>
                  <td className="p-4 text-center text-amber-700 font-semibold">
                    {atmosphericGasHumidifierInputKW.toLocaleString()} kW / {displayGasFlow(atmosphericGasHumidifierM3PerHour)} {gasFlowUnit} / {annualAtmosphericGasHumidifierCostDisplay.toLocaleString()} $/an
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="w-full bg-white rounded-3xl shadow-xl p-6 overflow-x-auto border border-emerald-200">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {language === 'fr' ? 'Prix des systèmes et ROI' : 'System Prices and ROI'}
                </h2>
                <p className="text-slate-500 mt-1">
                  {language === 'fr'
                    ? 'Entrer les coûts installés afin de calculer le retour simple selon les économies annuelles.'
                    : 'Enter installed costs to calculate simple payback from annual savings.'}
                </p>
              </div>
              <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold">
                {language === 'fr' ? 'ROI utilisateur' : 'User ROI'}
              </div>
            </div>

            <table className="w-full min-w-[980px] border-collapse overflow-hidden rounded-2xl">
              <thead>
                <tr className="bg-emerald-900 text-white">
                  <th className="p-4 text-left">{language === 'fr' ? 'Système' : 'System'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Coût installé' : 'Installed cost'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Ajustement utilisateur' : 'User adjustment'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Coût annuel énergie' : 'Annual energy cost'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Économie annuelle' : 'Annual savings'}</th>
                  <th className="p-4 text-center">{language === 'fr' ? 'Coût additionnel' : 'Incremental cost'}</th>
                  <th className="p-4 text-center">ROI</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    key: 'electricSteam',
                    setter: setElectricSteamInstalledCost,
                    value: electricSteamInstalledCost,
                  },
                  {
                    key: 'naturalGasSteam',
                    setter: setNaturalGasSteamInstalledCost,
                    value: naturalGasSteamInstalledCost,
                  },
                  {
                    key: 'atmosphericGasHumidifier',
                    setter: setAtmosphericGasHumidifierInstalledCost,
                    value: atmosphericGasHumidifierInstalledCost,
                  },
                  {
                    key: 'humifog',
                    setter: setHumifogInstalledCost,
                    value: humifogInstalledCost,
                  },
                ].map((inputRow, index) => {
                  const row = roiRows.find((item) => item.key === inputRow.key)
                  return (
                    <tr key={inputRow.key} className={`border-b border-slate-200 ${index % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                      <td className="p-4 font-semibold text-slate-800">{row?.label}</td>
                      <td className="p-4 text-center font-bold text-slate-800">{formatInstalledCost(inputRow.value)}</td>
                      <td className="p-4">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={inputRow.value}
                          onChange={(event) => inputRow.setter(Number(event.target.value))}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                        />
                      </td>
                      <td className="p-4 text-center text-slate-700">{formatAnnualCost(row?.annualCost)}</td>
                      <td className={`p-4 text-center font-bold ${(row?.annualSavings || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {row?.reference ? '-' : formatSignedAnnualCost(row?.annualSavings)}
                      </td>
                      <td className={`p-4 text-center font-bold ${(row?.incrementalCost || 0) <= 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {row?.reference ? '-' : formatSignedCost(row?.incrementalCost)}
                      </td>
                      <td className="p-4 text-center font-bold text-emerald-800">{row ? formatPayback(row) : '-'}</td>
                    </tr>
                  )
                })}

                {isFreeCoolingMode && (
                  <tr className="border-b border-slate-200 bg-cyan-50">
                    <td className="p-4 font-semibold text-slate-800">
                      {language === 'fr' ? 'Volets et contrôles Free Cooling' : 'Free Cooling dampers and controls'}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-800">{formatInstalledCost(freeCoolingControlsInstalledCost)}</td>
                    <td className="p-4">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={freeCoolingControlsInstalledCost}
                        onChange={(event) => setFreeCoolingControlsInstalledCost(Number(event.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                      />
                    </td>
                    <td className="p-4 text-center text-slate-500" colSpan={4}>
                      {language === 'fr'
                        ? 'Coût commun inclus dans la référence vapeur Free Cooling et dans l’option Humifog optimisée.'
                        : 'Common cost included in the Free Cooling steam reference and Humifog optimized option.'}
                    </td>
                  </tr>
                )}

                {!isFreeCoolingMode && (
                  <tr className="border-b border-slate-200 bg-cyan-50">
                    <td className="p-4 font-semibold text-slate-800">
                      {language === 'fr' ? 'Récupération sélectionnée' : 'Selected heat recovery'}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-800">{formatInstalledCost(heatRecoveryInstalledCost)}</td>
                    <td className="p-4">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={heatRecoveryInstalledCost}
                        onChange={(event) => setHeatRecoveryInstalledCost(Number(event.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-semibold text-slate-800"
                      />
                    </td>
                    <td className="p-4 text-center text-slate-500" colSpan={4}>
                      {hasChartRecovery
                        ? (language === 'fr' ? 'Ajouté au coût installé de l’option Humifog avec récupération.' : 'Added to the installed cost of the Humifog option with recovery.')
                        : (language === 'fr' ? 'Non appliqué lorsque aucune récupération n’est sélectionnée.' : 'Not applied when no recovery is selected.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-800">{language === 'fr' ? 'ROI Humifog sélectionné' : 'Selected Humifog ROI'}</div>
                <div className="mt-2 text-3xl font-bold text-emerald-900">{estimatedPayback}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">{language === 'fr' ? 'Gain net 10 ans' : '10-year net gain'}</div>
                <div className={`mt-2 text-3xl font-bold ${tenYearSavings >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{formatSignedCost(tenYearSavings)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">{language === 'fr' ? 'Gain net 20 ans' : '20-year net gain'}</div>
                <div className={`mt-2 text-3xl font-bold ${twentyYearSavings >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{formatSignedCost(twentyYearSavings)}</div>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
              <div className="text-sm text-red-700">{t.correctedHumidificationLoad}</div>
              <div className="text-5xl font-bold text-red-800 mt-3">{humidificationLoadDisplay}</div>
              <div className="text-red-700 mt-2">
                @ {displayTemp(roomTemperature)}{tempUnit} / {roomRelativeHumidity}% RH
              </div>
              <div className="mt-3 rounded-2xl border border-red-200 bg-white/70 p-3 text-sm text-red-900">
                <div>{language === 'fr' ? `CFM utilisé pour charge : ${formatNumber(chartHumifogLoadCfm, 0)} CFM` : `CFM used for load: ${formatNumber(chartHumifogLoadCfm, 0)} CFM`}</div>
                <div>{language === 'fr' ? `Grains avant Humifog : ${formatNumber(chartHumifogInletGrainsLb, 2)} gr/lb` : `Grains before Humifog: ${formatNumber(chartHumifogInletGrainsLb, 2)} gr/lb`}</div>
                <div>{language === 'fr' ? `Grains après Humifog : ${formatNumber(chartHumifogAfterGrainsLb, 2)} gr/lb` : `Grains after Humifog: ${formatNumber(chartHumifogAfterGrainsLb, 2)} gr/lb`}</div>
                <div>{language === 'fr' ? `Delta grains : ${formatNumber(chartHumifogDeltaDiagnosticGrainsLb, 2)} gr/lb` : `Delta grains: ${formatNumber(chartHumifogDeltaDiagnosticGrainsLb, 2)} gr/lb`}</div>
                <div>{language === 'fr' ? `Formule utilisée : ${chartHumifogFormulaText}` : `Formula used: ${chartHumifogFormulaText}`}</div>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
              <div className="text-sm text-red-700">{t.steamConsumption}</div>
              <div className="text-5xl font-bold text-red-800 mt-3">
                {steamEnergyKW.toLocaleString()}
              </div>
              <div className="text-red-700 mt-2">kW</div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6">
              <div className="text-sm text-blue-700">{t.adiabaticCooling}</div>
              <div className="text-5xl font-bold text-blue-800 mt-3">-{displayDeltaTemp(adiabaticTemperatureDrop)}{tempUnit}</div>
              <div className="text-blue-700 mt-2">
                {t.airOutlet} : {displayTemp(fallbackAfterHumifogState.db)}{tempUnit}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6">
              <div className="text-sm text-emerald-700">{t.eliminatedGHG}</div>
              <div className="text-5xl font-bold text-emerald-800 mt-3">{Number(annualEliminatedGESResolved.toFixed(1))}</div>
              <div className="text-emerald-700 mt-2">tonnes CO2/an</div>
            </div>

            <div className="bg-cyan-50 border border-cyan-200 rounded-3xl p-6">
              <div className="text-sm text-cyan-700">{t.totalAdiabaticHP}</div>
              <div className="text-5xl font-bold text-cyan-800 mt-3">{formatNumber(adiabaticEnergyKW, 1)}</div>
              <div className="text-cyan-700 mt-2">kW</div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="hidden w-full bg-white rounded-3xl shadow-xl p-6 overflow-x-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{t.energyComparison}</h2>
            {showFreeCoolingTables ? (
              <>
                <div className="mb-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                  {language === 'fr'
                    ? 'Mode Free Cooling : comparaison des memes technologies que le mode 100% air, avec impact Free Cooling + Humifog separe.'
                    : 'Free Cooling mode: comparison uses the same technologies as 100% outdoor air mode, with Free Cooling + Humifog impact shown separately.'}
                </div>
                <table className="w-full border-collapse overflow-hidden rounded-2xl">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="p-4 text-left">{t.parameter}</th>
                      <th className="p-4 text-center bg-red-600">{t.electricSteam}</th>
                      <th className="p-4 text-center bg-yellow-600">{t.naturalGasBoilerShort}</th>
                      <th className="p-4 text-center bg-amber-700">{t.atmosphericGasHumidifier}</th>
                      <th className="p-4 text-center bg-cyan-600">{language === 'fr' ? 'Humifog + Free Cooling' : 'Humifog + Free Cooling'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-4 font-semibold">{language === 'fr' ? 'Base de calcul' : 'Calculation basis'}</td>
                      <td className="p-4 text-center text-red-700 font-bold">{language === 'fr' ? 'Vapeur + economiseur' : 'Steam + economizer'}</td>
                      <td className="p-4 text-center text-yellow-700 font-bold">{language === 'fr' ? 'Vapeur gaz' : 'Gas steam'}</td>
                      <td className="p-4 text-center text-amber-700 font-bold">{language === 'fr' ? 'Gaz atmospherique' : 'Atmospheric gas'}</td>
                      <td className="p-4 text-center text-cyan-700 font-bold">{language === 'fr' ? 'Humifog optimise' : 'Optimized Humifog'}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="p-4 font-semibold">{language === 'fr' ? 'Energie annuelle totale' : 'Total annual energy'}</td>
                      <td className="p-4 text-center text-red-700 font-bold">{formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.freeCooling.totalEnergyKwh)}</td>
                      <td className="p-4 text-center text-yellow-700 font-bold">{formatAnnualEnergy(energySummary.naturalGasSteam.annualEnergyKwh)}</td>
                      <td className="p-4 text-center text-amber-700 font-bold">{formatAnnualEnergy(energySummary.atmosphericGasHumidifier.annualEnergyKwh)}</td>
                      <td className="p-4 text-center text-cyan-700 font-bold">{formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifog.totalEnergyKwh)}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-4 font-semibold">{t.annualCost}</td>
                      <td className="p-4 text-center text-red-700 font-bold">{formatAnnualCostIfComplete(freeCoolingHumifogAnalysis.annualComparison.freeCooling.annualCost)}</td>
                      <td className="p-4 text-center text-yellow-700 font-bold">{formatAnnualCost(energySummary.naturalGasSteam.annualCost)}</td>
                      <td className="p-4 text-center text-amber-700 font-bold">{formatAnnualCost(energySummary.atmosphericGasHumidifier.annualCost)}</td>
                      <td className="p-4 text-center text-cyan-700 font-bold">{formatAnnualCostIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifog.annualCost)}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-emerald-50">
                      <td className="p-4 font-semibold">{language === 'fr' ? 'Impact Free Cooling + Humifog' : 'Free Cooling + Humifog impact'}</td>
                      <td className="p-4 text-center">-</td>
                      <td className="p-4 text-center">-</td>
                      <td className="p-4 text-center">-</td>
                      <td className="p-4 text-center text-emerald-700 font-bold">
                        {freeCoolingCalculationComplete
                          ? `${formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.savingsKwh)} / ${formatSavingsAnnualCost(freeCoolingHumifogAnalysis.annualComparison.annualSavings)}`
                          : calculationIncompleteText}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <table className="w-full border-collapse overflow-hidden rounded-2xl">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-left">{t.parameter}</th>
                    <th className="p-4 text-center bg-red-600">{t.electricSteam}</th>
                    <th className="p-4 text-center bg-yellow-600">{t.naturalGasBoilerShort}</th>
                    <th className="p-4 text-center bg-amber-700">{t.atmosphericGasHumidifier}</th>
                    <th className="p-4 text-center bg-cyan-600">{t.adiabaticHP}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-4 font-semibold">{t.humidificationLoad}</td>
                    <td className="p-4 text-center">{humidificationLoadDisplay}</td>
                    <td className="p-4 text-center">{humidificationLoadDisplay}</td>
                    <td className="p-4 text-center">{humidificationLoadDisplay}</td>
                    <td className="p-4 text-center">{humidificationLoadDisplay}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-4 font-semibold">{t.humidificationPower}</td>
                    <td className="p-4 text-center text-red-700 font-bold">{steamEnergyKW.toLocaleString()} kW</td>
                    <td className="p-4 text-center text-yellow-700 font-bold">
                      {naturalGasSteamInputKW.toLocaleString()} kW
                      <div className="mt-2 text-sm">{displayGasFlow(naturalGasM3PerHour)} {gasFlowUnit}</div>
                    </td>
                    <td className="p-4 text-center text-amber-700 font-bold">
                      {atmosphericGasHumidifierInputKW.toLocaleString()} kW
                      <div className="mt-2 text-sm">{displayGasFlow(atmosphericGasHumidifierM3PerHour)} {gasFlowUnit}</div>
                      <div className="mt-1 text-xs">{atmosphericGasHumidifierEfficiency}%</div>
                    </td>
                    <td className="p-4 text-center text-cyan-700 font-bold">
                      {adiabaticHumidificationKW} kW
                      <div className="mt-2 text-sm">{t.systemTotal} : {adiabaticEnergyKW} kW</div>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-4 font-semibold">{t.grossReheat}</td>
                    <td className="p-4 text-center">0 kW</td>
                    <td className="p-4 text-center">0 kW</td>
                    <td className="p-4 text-center">0 kW</td>
                    <td className="p-4 text-center">{grossReheatKW} kW</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-4 font-semibold">
                      {language === 'fr' ? 'Chauffage CVC de base (commun)' : 'Base HVAC heating (common)'}
                    </td>
                    <td className="p-4 text-center">{commonHvacHeatingThermalKW} kW</td>
                    <td className="p-4 text-center">{commonHvacHeatingThermalKW} kW</td>
                    <td className="p-4 text-center">{commonHvacHeatingThermalKW} kW</td>
                    <td className="p-4 text-center">{commonHvacHeatingThermalKW} kW</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="p-4 font-semibold">
                      {language === 'fr' ? 'Préchauffage adiabatique additionnel' : 'Additional adiabatic preheat'}
                    </td>
                    <td className="p-4 text-center">0 kW</td>
                    <td className="p-4 text-center">0 kW</td>
                    <td className="p-4 text-center">0 kW</td>
                    <td className="p-4 text-center">{grossReheatKW} kW / {grossHumifogPreheatKW} kW</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-blue-50">
                    <td className="p-4 font-semibold">{t.adiabaticCoolingShort}</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center text-blue-700 font-bold">
                      -{displayDeltaTemp(adiabaticDisplayDropC)}{tempUnit}
                      <div className="mt-2">{t.airBeforeReheat} : {displayTemp(fallbackAfterHumifogState.db)}{tempUnit}</div>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-green-50">
                    <td className="p-4 font-semibold">{t.reheatMode}</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-center text-green-700 font-bold">
                      {selectedReheatSystem.nom}
                      <div className="mt-2">{reheatEnergyKW} kW</div>
                      {usesHeatPumpReheat && (
                        <div className="mt-1 text-xs font-semibold text-green-700">
                          {language === 'fr'
                            ? `Consommation thermopompe = ${Number(reheatEnergyKW || 0).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW électrique (${Number(netReheatKW || 0).toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kW thermique / COP ${heatPumpCOP.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })})`
                            : `Heat pump input = ${Number(reheatEnergyKW || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW electric (${Number(netReheatKW || 0).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kW thermal / COP ${heatPumpCOP.toLocaleString('en-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })})`}
                        </div>
                      )}
                    </td>
                  </tr>
                  {activeSelectedRecoveries.length > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="p-4 font-semibold">
                        {language === 'fr'
                          ? 'Récupération sélectionnée (énergie sensible récupérée)'
                          : 'Selected Recovery (sensible recovered energy)'}
                      </td>
                      <td className="p-4 text-center">-</td>
                      <td className="p-4 text-center">-</td>
                      <td className="p-4 text-center">-</td>
                      <td className="p-4 text-center text-green-700 font-bold">
                        {selectedRecoveryDisplayName}
                        <div className="mt-2">{isNoRecovery ? '0' : `${recoveryEnergyReductionKW}`} kW</div>
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-50">
                    <td className="p-4 font-semibold">{t.annualCost}</td>
                    <td className="p-4 text-center text-red-700 font-bold">{annualSteamCostDisplay.toLocaleString()} $</td>
                    <td className="p-4 text-center text-yellow-700 font-bold">{annualNaturalGasCostDisplay.toLocaleString()} $</td>
                    <td className="p-4 text-center text-amber-700 font-bold">{annualAtmosphericGasHumidifierCostDisplay.toLocaleString()} $</td>
                    <td className="p-4 text-center text-cyan-700 font-bold">
                      {annualAdiabaticCostDisplay.toLocaleString()} $
                      {isNoRecovery && (
                        <div className="mt-1 text-xs font-semibold text-cyan-700 leading-relaxed">
                          <div>
                            {language === 'fr'
                              ? `Pompe Humifog : ${Math.round(annualHumifogPumpCostResolved).toLocaleString()} $/an`
                              : `Humifog pump: ${Math.round(annualHumifogPumpCostResolved).toLocaleString()} $/year`}
                          </div>
                          <div>
                          {language === 'fr'
                            ? (usesHeatPumpReheat
                              ? `Réchauffage thermopompe COP ${heatPumpCOP.toFixed(1)} : ${Math.round(annualHumifogSelectedPreheatCostResolved).toLocaleString()} $/an`
                              : `Réchauffage ${selectedReheatSystem.nom} : ${Math.round(annualHumifogSelectedPreheatCostResolved).toLocaleString()} $/an`)
                            : (usesHeatPumpReheat
                              ? `Heat-pump reheat COP ${heatPumpCOP.toFixed(1)}: ${Math.round(annualHumifogSelectedPreheatCostResolved).toLocaleString()} $/year`
                              : `${selectedReheatSystem.nom} reheat: ${Math.round(annualHumifogSelectedPreheatCostResolved).toLocaleString()} $/year`)}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-4 font-semibold">{language === 'fr' ? 'GES annuel' : 'Annual GHG'}</td>
                    <td className="p-4 text-center text-red-700 font-bold">-</td>
                    <td className="p-4 text-center text-yellow-700 font-bold">{Number(annualNaturalGasGESResolved.toFixed(1)).toLocaleString()} t</td>
                    <td className="p-4 text-center text-amber-700 font-bold">{Number(annualAtmosphericGasGESResolved.toFixed(1)).toLocaleString()} t</td>
                    <td className="p-4 text-center text-cyan-700 font-bold">{Number(annualAdiabaticGESResolved.toFixed(1)).toLocaleString()} t</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="w-full bg-white rounded-3xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">{t.energyHistory}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={energyData}>
                  <XAxis dataKey="mois" />
                  <YAxis label={{ value: 'kW', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="vapeur" stroke="#ef4444" strokeWidth={3} dot={false} name={t.electricSteam} />
                  <Line
                    type="monotone"
                    dataKey="humidificateurGaz"
                    stroke="#92400e"
                    strokeWidth={7}
                    strokeOpacity={0.45}
                    strokeDasharray="9 6"
                    dot={{ r: 3, fill: '#92400e', strokeWidth: 0 }}
                    name={t.atmosphericGasHumidifier}
                  />
                  <Line
                    type="monotone"
                    dataKey="gaz"
                    stroke="#eab308"
                    strokeWidth={4}
                    dot={{ r: 3, fill: '#eab308', stroke: '#854d0e', strokeWidth: 1 }}
                    name={t.naturalGasBoilerShort}
                  />
                  <Line type="monotone" dataKey="adiabatique" stroke="#06b6d4" strokeWidth={3} dot={false} name={t.adiabaticHP} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full bg-white rounded-3xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">{t.energySavings}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { nom: language === 'fr' ? 'Vapeur' : 'Steam', valeur: steamEnergyKW },
                    { nom: language === 'fr' ? 'Gaz atm.' : 'Atm. gas', valeur: atmosphericGasHumidifierInputKW },
                    { nom: language === 'fr' ? 'Adiabatique' : 'Adiabatic', valeur: adiabaticEnergyKW },
                  ]}
                  margin={{ top: 28, right: 16, left: 8, bottom: 8 }}
                >
                  <XAxis dataKey="nom" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} kW`, t.energySavings]} />
                  <Bar dataKey="valeur" fill="#0284c7" radius={[8, 8, 0, 0]}>
                    <LabelList
                      dataKey="valeur"
                      position="top"
                      className="fill-slate-800 text-sm font-bold"
                      formatter={(value) => `${Number(value).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} kW`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BIN Hours */}
          <div className="w-full bg-white rounded-3xl shadow-xl p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {t.binHoursAnalysis} - {selectedCity.nom}
                </h2>
                <p className="text-slate-500 mt-1">{t.binHoursDescription}</p>
                <div className="mt-3 text-sm font-semibold text-indigo-700">
                  {t.climateCity} : {selectedCity.nom}
                </div>
                <div className="text-sm text-slate-600">
                  {t.designTemperature} : {displayTemp(selectedCity.hiver)}{tempUnit}
                </div>
                <div className="text-sm text-slate-600">
                  {selectedCity.zone}
                </div>
              </div>
              <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold">
                {t.binHours}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <div className="font-semibold text-slate-800 mb-1">{t.operatingSchedule}</div>
                  <div className="mb-3 text-sm text-slate-500">
                    {t.calculationMode}: {scheduleMode === '24-7' ? t.operationMode24_7 : t.operationModeCustom}
                  </div>
                  <div className="mb-3 text-sm text-slate-500">
                    {t.methodSelection}: {calculationMethod === 'bin' ? t.binHoursMethod : t.hourlyWeatherMethod}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('24-7')}
                      className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${scheduleMode === '24-7' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
                    >
                      {t.operationMode24_7}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('custom')}
                      className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${scheduleMode === 'custom' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
                    >
                      {t.operationModeCustom}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800 mb-1">{t.methodSelection}</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCalculationMethod('bin')}
                      className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${calculationMethod === 'bin' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
                    >
                      {t.binHoursMethod}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalculationMethod('hourly')}
                      className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${calculationMethod === 'hourly' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'}`}
                    >
                      {t.hourlyWeatherMethod}
                    </button>
                  </div>
                  <div className="mt-4 text-sm font-semibold text-slate-700">
                    {calculationMethod === 'bin'
                      ? (language === 'fr' ? 'Heures BIN sélectionnées' : 'Selected BIN hours')
                      : (language === 'fr'
                        ? `Heures spécifiques sélectionnées : ${formatNumber(annualOperatingHours, 0)} h/an`
                        : `Selected specific hours: ${formatNumber(annualOperatingHours, 0)} h/year`)}
                  </div>
                  {calculationMethod === 'bin' && (
                    <div className="mt-4 text-sm font-semibold text-slate-700">
                      {t.weatherSource}: {language === 'fr' ? 'Méthode heures BIN active' : 'BIN hours method active'}
                    </div>
                  )}
                  {calculationMethod === 'hourly' && (
                    <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                      <div>
                        {language === 'fr'
                          ? `La simulation horaire charge automatiquement le fichier EPW intégré pour ${selectedCity.nom} lorsque disponible. Un fichier EPW personnalisé peut remplacer ce fichier en mode avancé.`
                          : `Hourly simulation automatically loads the built-in EPW file for ${selectedCity.nom} when available. A custom EPW file can replace this file in advanced mode.`}
                      </div>
                      <label className="mt-3 block text-sm font-semibold text-slate-800">{t.optionalHourlyWeatherFileLabel}</label>
                      <input
                        ref={hourlyWeatherFileInputRef}
                        type="file"
                        accept=".epw,.csv"
                        onChange={(event) => handleHourlyWeatherFileChange(event.target.files?.[0])}
                        className="hidden"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => hourlyWeatherFileInputRef.current?.click()}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                          {t.chooseFile}
                        </button>
                        <span className="text-sm text-slate-600">
                          {hourlyWeatherFileName || t.noFileChosen}
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-slate-700 font-semibold">
                        {t.weatherSource}: {hourlyWeatherSourceType === 'custom'
                          ? t.customUploadedWeatherFile
                          : (builtInHourlyWeatherFilePath
                            ? `${t.builtInWeatherFile} — ${selectedCity.nom}`
                                : t.noBuiltInWeatherAvailable)}
                      </div>
                      {calculationMethod === 'hourly' && (
                        <div className="mt-2 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-xs font-semibold text-cyan-800">
                          <div>{language === 'fr' ? `EPW URL utilisée : ${hourlyWeatherResolvedUrl || buildEpwUrl(builtInHourlyWeatherFileName)}` : `EPW URL used: ${hourlyWeatherResolvedUrl || buildEpwUrl(builtInHourlyWeatherFileName)}`}</div>
                          <div>{language === 'fr' ? `Fetch status : ${hourlyWeatherFetchStatus || '-'}` : `Fetch status: ${hourlyWeatherFetchStatus || '-'}`}</div>
                          <div>{language === 'fr' ? `Enregistrements EPW : ${formatNumber(hourlyWeatherDebugRecordCount || hourlyWeatherSummary?.recordsLoaded || hourlyWeatherRecords.length || 0, 0)}` : `EPW records: ${formatNumber(hourlyWeatherDebugRecordCount || hourlyWeatherSummary?.recordsLoaded || hourlyWeatherRecords.length || 0, 0)}`}</div>
                          <div>{language === 'fr' ? `Enregistrements EPW chargés : ${formatNumber(hourlyWeatherRecords.length, 0)}` : `EPW records loaded: ${formatNumber(hourlyWeatherRecords.length, 0)}`}</div>
                          <div>{language === 'fr' ? `Enregistrements d’exploitation filtrés : ${formatNumber(filteredHourlyRecords.length, 0)}` : `Filtered operating records: ${formatNumber(filteredHourlyRecords.length, 0)}`}</div>
                          <div>{language === 'fr' ? `Heure de début d’horaire : ${formatNumber(scheduleStartHour, 0)}` : `Schedule start hour: ${formatNumber(scheduleStartHour, 0)}`}</div>
                          <div>{language === 'fr' ? `Heure de fin d’horaire : ${formatNumber(scheduleEndHour, 0)}` : `Schedule end hour: ${formatNumber(scheduleEndHour, 0)}`}</div>
                          <div>{language === 'fr' ? 'Source de calcul : EPW horaire intégré' : 'Calculation source: Built-in hourly EPW'}</div>
                        </div>
                      )}
                      {calculationMethod === 'hourly' && hourlyWeatherFileFound && (
                        <div className="mt-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                          <div>{language === 'fr' ? `Fichier chargé : ${hourlyWeatherFileName || builtInHourlyWeatherFileName}` : `Loaded file: ${hourlyWeatherFileName || builtInHourlyWeatherFileName}`}</div>
                          <div>{language === 'fr' ? `Enregistrements chargés : ${formatNumber(hourlyWeatherRecords.length, 0)}` : `Records loaded: ${formatNumber(hourlyWeatherRecords.length, 0)}`}</div>
                          <div>{language === 'fr' ? 'Source de calcul : EPW horaire intégré' : 'Calculation source: Built-in hourly EPW'}</div>
                        </div>
                      )}
                      {(hourlyWeatherFileName || (hourlyWeatherLoading && builtInHourlyWeatherFileName)) && (
                        <div className="mt-2 text-sm text-slate-700">{t.loadedFile}: {hourlyWeatherFileName || builtInHourlyWeatherFileName}</div>
                      )}
                      {hourlyWeatherMetadata && (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700">
                          <div className="text-sm"><strong>{language === 'fr' ? 'Source de données' : 'Data source'}:</strong> {localizeWeatherMetadataValue('dataSource', hourlyWeatherMetadata.dataSource, language)}</div>
                          <div className="text-sm"><strong>{language === 'fr' ? 'Organisation' : 'Organization'}:</strong> {localizeWeatherMetadataValue('sourceOrganization', hourlyWeatherMetadata.sourceOrganization, language)}</div>
                          <div className="text-sm"><strong>{language === 'fr' ? 'Station' : 'Station'}:</strong> {hourlyWeatherMetadata.stationName || '-'}</div>
                          <div className="text-sm"><strong>{language === 'fr' ? 'Type de fichier' : 'Climate file type'}:</strong> {localizeWeatherMetadataValue('climateFileType', hourlyWeatherMetadata.climateFileType, language)}</div>
                          <div className="text-sm"><strong>{language === 'fr' ? 'Validation' : 'Validation'}:</strong> {(isOfficialBuiltInHourlyFileLoaded || effectiveWeatherValidationStatus === 'official') ? validationDisplayLabel : formatWeatherValidationStatus(effectiveWeatherValidationStatus, language)}</div>
                        </div>
                      )}
                      {hourlyWeatherLoading && (
                        <div className="mt-2 rounded-2xl bg-white p-3 text-slate-700">
                          {language === 'fr' ? 'Chargement du fichier météo horaire...' : 'Loading hourly weather file...'}
                        </div>
                      )}
                      {hourlyWeatherSummary && (
                        <>
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800">
                            <div className="font-semibold mb-2">{language === 'fr' ? 'Données météorologiques utilisées' : 'Weather data used'}</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <tbody>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Ville sélectionnée' : 'Selected city'}</td><td className="py-1">{selectedCity.nom}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Source météo' : 'Weather source'}</td><td className="py-1">{localizeWeatherMetadataValue('dataSource', hourlyWeatherMetadata?.dataSource || '', language) || '-'}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Organisation' : 'Organization'}</td><td className="py-1">{localizeWeatherMetadataValue('sourceOrganization', hourlyWeatherMetadata?.sourceOrganization || '', language) || '-'}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Type de fichier' : 'File type'}</td><td className="py-1">{localizeWeatherMetadataValue('climateFileType', hourlyWeatherMetadata?.climateFileType || '', language) || '-'}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Fichier chargé' : 'Loaded file'}</td><td className="py-1">{hourlyWeatherFileName || builtInHourlyWeatherFileName || '-'}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Validation' : 'Validation'}</td><td className="py-1">{(isOfficialBuiltInHourlyFileLoaded || effectiveWeatherValidationStatus === 'official') ? validationDisplayLabel : formatWeatherValidationStatus(effectiveWeatherValidationStatus, language)}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Nombre d’enregistrements horaires' : 'Number of hourly records'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.recordsLoaded, 0)}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Heures d’exploitation utilisées' : 'Operating hours used'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.operatingHoursUsed, 0)}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Température extérieure moyenne pendant les heures d’exploitation' : 'Average outdoor temperature during operating hours'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.averageOutdoorTemp, 1)} °C</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Température extérieure minimale pendant les heures d’exploitation' : 'Minimum outdoor temperature during operating hours'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.minOutdoorTemp, 1)} °C</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Température extérieure maximale pendant les heures d’exploitation' : 'Maximum outdoor temperature during operating hours'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.maxOutdoorTemp, 1)} °C</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Humidité relative extérieure moyenne pendant les heures d’exploitation' : 'Average outdoor relative humidity during operating hours'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.averageOutdoorRh, 1)}%</td></tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800">
                            <div className="font-semibold mb-2">{language === 'fr' ? 'Résumé météo pendant les heures d’exploitation' : 'Weather summary during operating hours'}</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <tbody>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Heures d’exploitation utilisées' : 'Operating hours used'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.operatingHoursUsed, 0)}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Heures sous 0°C' : 'Hours below 0°C'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.hoursBelowZero, 0)}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Heures sous -10°C' : 'Hours below -10°C'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.hoursBelowMinusTen, 0)}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Heures sous -20°C' : 'Hours below -20°C'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.hoursBelowMinusTwenty, 0)}</td></tr>
                                  <tr><td className="py-1 pr-4 font-medium">{language === 'fr' ? 'Heures avec humidification requise' : 'Hours requiring humidification'}</td><td className="py-1">{formatNumber(hourlyWeatherSummary.hoursWithHumidificationRequired, 0)}</td></tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800">
                            <div className="font-semibold mb-2">{language === 'fr' ? 'Résultats de simulation horaire' : 'Hourly simulation results'}</div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div>{language === 'fr' ? 'Enregistrements chargés' : 'Hourly records loaded'}: <strong>{formatNumber(hourlyWeatherSummary.recordsLoaded, 0)}</strong></div>
                              <div>{language === 'fr' ? 'Heures d exploitation utilisées' : 'Operating hours used'}: <strong>{formatNumber(hourlyWeatherSummary.operatingHoursUsed, 0)}</strong></div>
                              <div>{language === 'fr' ? 'Température extérieure moyenne' : 'Average outdoor temperature'}: <strong>{formatNumber(hourlyWeatherSummary.averageOutdoorTemp, 1)} °C</strong></div>
                              <div>{language === 'fr' ? 'Température extérieure minimale' : 'Minimum outdoor temperature'}: <strong>{formatNumber(hourlyWeatherSummary.minOutdoorTemp, 1)} °C</strong></div>
                              <div>{language === 'fr' ? 'Température extérieure maximale' : 'Maximum outdoor temperature'}: <strong>{formatNumber(hourlyWeatherSummary.maxOutdoorTemp, 1)} °C</strong></div>
                              <div>{language === 'fr' ? 'Humidité relative extérieure moyenne' : 'Average outdoor RH'}: <strong>{formatNumber(hourlyWeatherSummary.averageOutdoorRh, 1)}%</strong></div>
                              <div>{language === 'fr' ? 'Énergie annuelle vapeur' : 'Annual steam kWh'}: <strong>{formatNumber(hourlyWeatherSummary.annualSteamKwh, 0)} kWh</strong></div>
                              <div>{language === 'fr' ? 'Énergie annuelle gaz' : 'Annual gas kWh'}: <strong>{formatNumber(hourlyWeatherSummary.annualGasKwh, 0)} kWh</strong></div>
                              <div>{language === 'fr' ? 'Énergie annuelle Humifog' : 'Annual Humifog kWh'}: <strong>{formatNumber(hourlyWeatherSummary.annualHumifogKwh, 0)} kWh</strong></div>
                              <div>{language === 'fr' ? 'Coût annuel' : 'Annual cost'}: <strong>{formatNumber(hourlyWeatherSummary.annualCost, 0)} $</strong></div>
                              <div>{language === 'fr' ? 'Économies annuelles' : 'Annual savings'}: <strong>{formatNumber(hourlyWeatherSummary.annualSavings, 0)} $</strong></div>
                              <div>{language === 'fr' ? 'Réduction annuelle de GES' : 'Annual GHG reduction'}: <strong>{formatNumber(hourlyWeatherSummary.annualGhgReduction, 3)} tCO2e</strong></div>
                              <div>{language === 'fr' ? 'Consommation annuelle d eau' : 'Annual water consumption'}: <strong>{formatNumber(hourlyWeatherSummary.annualWaterConsumptionKg, 0)} kg</strong></div>
                            </div>
                          </div>
                        </>
                      )}
                      {shouldShowBuiltInFileNotFound && (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-100 p-3 text-amber-900">
                          {hourlyWeatherLoadError}
                        </div>
                      )}
                      {!shouldShowBuiltInFileNotFound && hourlyWeatherLoadError && hourlyWeatherSourceType === 'custom' && (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-100 p-3 text-amber-900">
                          {hourlyWeatherLoadError}
                        </div>
                      )}
                      {hourlyWeatherWarning && (
                        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-100 p-3 text-amber-900">
                          {hourlyWeatherWarning}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mb-3 rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-900">
                  VERSION DASHBOARD : schedule-visible-days-v2
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-800">{t.startTime}</div>
                    <input
                      type="time"
                      value={scheduleStartTime}
                      onChange={(event) => setScheduleStartTime(event.target.value)}
                      disabled={scheduleMode === '24-7'}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-800">{t.endTime}</div>
                    <input
                      type="time"
                      value={scheduleEndTime}
                      onChange={(event) => setScheduleEndTime(event.target.value)}
                      disabled={scheduleMode === '24-7'}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
              <div>
                <div className="mb-2 font-semibold text-slate-800">
                  {language === 'fr' ? 'Jours d’exploitation' : 'Operating days'}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuickScheduleDays('mon-fri')}
                    className="rounded-2xl transition"
                    style={scheduleDaysOption === 'mon-fri'
                      ? { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                    disabled={scheduleMode === '24-7'}
                  >
                    {language === 'fr' ? 'Lundi à vendredi' : 'Monday to Friday'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickScheduleDays('mon-sat')}
                    className="rounded-2xl transition"
                    style={scheduleDaysOption === 'mon-sat'
                      ? { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                    disabled={scheduleMode === '24-7'}
                  >
                    {language === 'fr' ? 'Lundi à samedi' : 'Monday to Saturday'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickScheduleDays('seven-days')}
                    className="rounded-2xl transition"
                    style={scheduleDaysOption === 'seven-days'
                      ? { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                    disabled={scheduleMode === '24-7'}
                  >
                    {language === 'fr' ? '7 jours/semaine' : '7 days/week'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleDaysOption('custom')}
                    className="rounded-2xl transition"
                    style={scheduleDaysOption === 'custom'
                      ? { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '80px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                    disabled={scheduleMode === '24-7'}
                  >
                    {language === 'fr' ? 'Personnalisé' : 'Custom'}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <button
                    type="button"
                    disabled={scheduleMode === '24-7'}
                    onClick={() => toggleScheduleDay('mon')}
                    className="inline-flex min-h-10 min-w-[64px] items-center justify-center rounded-2xl shadow-sm transition whitespace-nowrap"
                    style={Boolean(activeScheduleDays.mon)
                      ? { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  >
                    {language === 'fr' ? 'Lun' : 'Mon'}
                  </button>
                  <button
                    type="button"
                    disabled={scheduleMode === '24-7'}
                    onClick={() => toggleScheduleDay('tue')}
                    className="inline-flex min-h-10 min-w-[64px] items-center justify-center rounded-2xl shadow-sm transition whitespace-nowrap"
                    style={Boolean(activeScheduleDays.tue)
                      ? { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  >
                    {language === 'fr' ? 'Mar' : 'Tue'}
                  </button>
                  <button
                    type="button"
                    disabled={scheduleMode === '24-7'}
                    onClick={() => toggleScheduleDay('wed')}
                    className="inline-flex min-h-10 min-w-[64px] items-center justify-center rounded-2xl shadow-sm transition whitespace-nowrap"
                    style={Boolean(activeScheduleDays.wed)
                      ? { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  >
                    {language === 'fr' ? 'Mer' : 'Wed'}
                  </button>
                  <button
                    type="button"
                    disabled={scheduleMode === '24-7'}
                    onClick={() => toggleScheduleDay('thu')}
                    className="inline-flex min-h-10 min-w-[64px] items-center justify-center rounded-2xl shadow-sm transition whitespace-nowrap"
                    style={Boolean(activeScheduleDays.thu)
                      ? { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  >
                    {language === 'fr' ? 'Jeu' : 'Thu'}
                  </button>
                  <button
                    type="button"
                    disabled={scheduleMode === '24-7'}
                    onClick={() => toggleScheduleDay('fri')}
                    className="inline-flex min-h-10 min-w-[64px] items-center justify-center rounded-2xl shadow-sm transition whitespace-nowrap"
                    style={Boolean(activeScheduleDays.fri)
                      ? { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  >
                    {language === 'fr' ? 'Ven' : 'Fri'}
                  </button>
                  <button
                    type="button"
                    disabled={scheduleMode === '24-7'}
                    onClick={() => toggleScheduleDay('sat')}
                    className="inline-flex min-h-10 min-w-[64px] items-center justify-center rounded-2xl shadow-sm transition whitespace-nowrap"
                    style={Boolean(activeScheduleDays.sat)
                      ? { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  >
                    {language === 'fr' ? 'Sam' : 'Sat'}
                  </button>
                  <button
                    type="button"
                    disabled={scheduleMode === '24-7'}
                    onClick={() => toggleScheduleDay('sun')}
                    className="inline-flex min-h-10 min-w-[64px] items-center justify-center rounded-2xl shadow-sm transition whitespace-nowrap"
                    style={Boolean(activeScheduleDays.sun)
                      ? { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: '#0f172a', color: 'white', border: '1px solid #0f172a' }
                      : { minWidth: '52px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, background: 'white', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  >
                    {language === 'fr' ? 'Dim' : 'Sun'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">
                    {language === 'fr' ? 'Heures d’exploitation par jour' : 'Operating hours per day'}
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{dailyOperatingHours.toFixed(1)} h/day</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">
                    {language === 'fr' ? 'Heures d’exploitation par semaine' : 'Operating hours per week'}
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{weeklyOperatingHours.toFixed(1)} h/week</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">
                    {language === 'fr' ? 'Heures d’exploitation annuelles' : 'Annual operating hours'}
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{annualOperatingHours.toLocaleString()} h/year</div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">
                    {language === 'fr' ? 'Facteur d’exploitation' : 'Operating factor'}
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{annualOperatingPercent.toFixed(1)}%</div>
                  <div className="mt-1 block text-xs font-medium text-slate-600">
                    {language === 'fr'
                      ? 'Pourcentage annuel réel'
                      : 'Actual annual percentage'}: {annualOperatingPercent.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {isCustomOperatingHoursMode
                ? (language === 'fr'
                  ? 'Les heures d’exploitation personnalisées sont la seule référence horaire utilisée pour les résultats annuels. La météo de la ville reste utilisée pour les conditions extérieures.'
                  : 'Custom operating hours are the only schedule reference used for annual results. City weather remains available for outdoor conditions.')
                : t.scheduleNote}
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-800">
                {calculationMethod === 'hourly'
                  ? (language === 'fr' ? 'Répartition des heures météo utilisées' : 'Distribution of weather hours used')
                  : (language === 'fr' ? 'Répartition des heures météo' : 'Weather Hours Distribution')}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
                  {language === 'fr' ? `Ville : ${selectedCity.nom}` : `City: ${selectedCity.nom}`}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                  {language === 'fr'
                    ? `Méthode : ${calculationMethod === 'bin' ? t.binHoursMethod : t.hourlyWeatherMethod}`
                    : `Method: ${calculationMethod === 'bin' ? t.binHoursMethod : t.hourlyWeatherMethod}`}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                  {calculationMethod === 'bin'
                    ? (language === 'fr'
                      ? `Heures BIN sélectionnées : ${formatNumber(annualOperatingHours, 0)} h/an`
                      : `Selected BIN hours: ${formatNumber(annualOperatingHours, 0)} h/year`)
                    : (language === 'fr'
                      ? `Heures spécifiques sélectionnées : ${formatNumber(annualOperatingHours, 0)} h/an`
                      : `Selected specific hours: ${formatNumber(annualOperatingHours, 0)} h/year`)}
                </span>
                {calculationMethod === 'hourly' && (
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700">
                    {language === 'fr'
                      ? `Source de calcul : ${weatherSourceCalculationLabel}`
                      : `Calculation source: ${weatherSourceCalculationLabel}`}
                  </span>
                )}
              </div>
            </div>

            {isWeatherChartEmpty ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                {language === 'fr'
                  ? 'Aucune donnée météo disponible pour ce graphique.'
                  : 'No weather data available for this chart.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weatherChartData}>
                  <XAxis
                    dataKey="temperatureBin"
                    label={{
                      value: language === 'fr' ? 'Température extérieure' : 'Outdoor temperature',
                      position: 'insideBottom',
                      offset: -6,
                    }}
                  />
                  <YAxis
                    label={{
                      value: language === 'fr' ? 'Nombre d’heures' : 'Number of hours',
                      angle: -90,
                      position: 'insideLeft',
                    }}
                  />
                  <Tooltip
                    labelFormatter={(value) => (
                      language === 'fr'
                        ? `Température extérieure: ${value}`
                        : `Outdoor temperature: ${value}`
                    )}
                    formatter={(value, name) => {
                      const hoursLabel = `${formatNumber(Number(value), 0)} h`

                      if (calculationMethod === 'bin') {
                        if (name === 'originalHours') {
                          return [hoursLabel, language === 'fr' ? 'Heures BIN originales' : 'Original BIN hours']
                        }

                        return [hoursLabel, language === 'fr' ? 'Heures BIN ajustées' : 'Adjusted BIN hours']
                      }

                      return [
                        hoursLabel,
                        language === 'fr' ? 'Température extérieure / Nombre d’heures' : 'Outdoor temperature / Number of hours',
                      ]
                    }}
                  />
                  {showOriginalBinHoursInChart && (
                    <Bar dataKey="originalHours" fill="#94a3b8" radius={[8, 8, 0, 0]} name={language === 'fr' ? 'Heures BIN originales' : 'Original BIN hours'} />
                  )}
                  <Bar dataKey="hoursUsed" fill="#4f46e5" radius={[8, 8, 0, 0]} name={language === 'fr' ? 'Heures BIN ajustées' : 'Adjusted BIN hours'} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="mb-2 text-sm font-bold text-slate-900">
                {language === 'fr' ? 'Référence des données utilisées' : 'Data Reference Used'}
              </div>

              {calculationMethod === 'bin' ? (
                <div className="space-y-1">
                  <div>
                    <strong>{language === 'fr' ? 'Source des données' : 'Data source'}:</strong>{' '}
                    {language === 'fr' ? 'Méthode heures BIN intégrée à HESA' : 'HESA integrated BIN-hours method'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Ville climatique' : 'Climate city'}:</strong> {selectedCity.nom}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Méthode' : 'Method'}:</strong>{' '}
                    {language === 'fr'
                      ? 'Répartition annuelle des températures extérieures par plages BIN'
                      : 'Annual outdoor temperature distribution by BIN ranges'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Nombre total d’heures' : 'Total hours'}:</strong>{' '}
                    {language === 'fr' ? '8 760 h/an' : '8,760 h/year'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Horaire appliqué' : 'Applied schedule'}:</strong>{' '}
                    {scheduleDescriptionText}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Heures utilisées après horaire' : 'Hours used after schedule'}:</strong>{' '}
                    {formatNumber(Math.round(8760 * (scheduleMode === '24-7' ? 1 : baseScheduleFactor)), 0)} {language === 'fr' ? 'h/an' : 'h/year'}
                  </div>
                  <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-indigo-900">
                    {language === 'fr'
                      ? 'Les heures BIN sont utilisées pour une analyse énergétique préliminaire. Pour une simulation horaire détaillée, utiliser le mode Simulation météo horaire 8760.'
                      : 'BIN hours are used for a preliminary energy analysis. For detailed hourly simulation, use Hourly Weather Simulation 8760 mode.'}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div>
                    <strong>{language === 'fr' ? 'Source des données' : 'Data source'}:</strong>{' '}
                    {language === 'fr' ? 'Gouvernement du Canada CWEC_FMCCE' : 'Government of Canada CWEC_FMCCE'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Organisation' : 'Organization'}:</strong>{' '}
                    {language === 'fr' ? 'Environnement et Changement climatique Canada' : 'Environment and Climate Change Canada'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Fichier météo' : 'Weather file'}:</strong>{' '}
                    {hourlyWeatherFileName || builtInHourlyWeatherFileName || '-'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Type' : 'Type'}:</strong>{' '}
                    {language === 'fr' ? 'fichier météo horaire EPW 8760' : 'hourly EPW weather file 8760'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Validation' : 'Validation'}:</strong>{' '}
                    {language === 'fr' ? 'officiel' : 'official'}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Nombre d’enregistrements horaires' : 'Number of hourly records'}:</strong>{' '}
                    {formatNumber(hourlyWeatherSummary?.recordsLoaded || 8760, 0)}
                  </div>
                  <div>
                    <strong>{language === 'fr' ? 'Heures d’exploitation utilisées' : 'Operating hours used'}:</strong>{' '}
                    {formatNumber(hourlyWeatherSummary?.operatingHoursUsed || 0, 0)} {language === 'fr' ? 'h/an' : 'h/year'}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto mt-6">
              <table className="w-full border-collapse overflow-hidden rounded-2xl">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-4 text-left">{t.binTemperature}</th>
                    <th className="p-4 text-center">{t.originalBinHours}</th>
                    <th className="p-4 text-center">{t.effectiveBinHours}</th>
                    <th className="p-4 text-center">{isNoRecovery
                      ? (language === 'fr' ? 'Énergie vapeur sans récupération' : 'Steam Energy Without Recovery')
                      : t.correctedRecoveryLoad}</th>
                    <th className="p-4 text-center">{t.adiabaticLoad}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBinData.map((item, index) => {
                    const binEnergyRow = binEnergyRows[index]
                    return (
                      <tr
                        key={index}
                        className={`${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'} border-b border-slate-200`}
                      >
                        <td className="p-4 font-semibold text-slate-700">{item.temperature}</td>
                        <td className="p-4 text-center font-semibold text-slate-800">{item.originalHours} h</td>
                        <td className="p-4 text-center font-bold text-slate-800">{item.heures} h</td>
                        <td className="p-4 text-center text-red-700 font-bold">
                          {Math.round(binEnergyRow?.steamTotalBinEnergyKwh || 0).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} kWh
                        </td>
                        <td className="p-4 text-center text-cyan-700 font-bold">
                          {Math.round(binEnergyRow?.adiabaticTotalBinEnergyKwh || 0).toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA')} kWh
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-slate-100 rounded-2xl p-5">
                <div className="text-sm text-slate-500">{t.annualHeatingHours}</div>
                <div className="text-4xl font-bold text-slate-800 mt-2">{totalBinHours.toLocaleString()} h</div>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-5">
                <div className="text-sm text-cyan-700">{t.dominantTemperature}</div>
                <div className="text-4xl font-bold text-cyan-800 mt-2">{displayTemp(dominantBin[0])}{tempUnit}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <div className="text-sm text-green-700">{t.energyReduction}</div>
                <div className="text-4xl font-bold text-green-800 mt-2">{binEnergyReductionPercent}%</div>
              </div>
            </div>

          </div>

          {is100OA && (
            <section className="mt-8 w-full overflow-hidden rounded-3xl bg-white p-6 shadow-xl">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  {language === 'fr' ? 'Bilan énergétique annuel' : 'Annual Energy Balance'}
                </h2>
                <p className="mt-2 text-sm font-semibold text-cyan-800">
                  {isCustomOperatingHoursMode
                    ? (language === 'fr' ? 'Base annuelle : Heures personnalisées' : 'Annual basis: Custom Operating Hours')
                    : (language === 'fr' ? 'Base annuelle : Heures BIN' : 'Annual basis: BIN Hours')}
                </p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="p-3 text-left">{language === 'fr' ? 'Poste annuel' : 'Annual item'}</th>
                      {annualTechnologyOptions.map((option) => (
                        <th
                          key={option.key}
                          className={`p-3 text-center ${
                            option.color === 'red' ? 'bg-red-700' :
                            option.color === 'yellow' ? 'bg-yellow-700' :
                            option.color === 'amber' ? 'bg-amber-700' :
                            option.color === 'violet' ? 'bg-violet-700' :
                            'bg-cyan-700'
                          }`}
                        >
                          {option.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {freeCoolingAnnualTechnologyRows.map((row) => (
                      <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                        <td className="p-3 font-semibold text-slate-700">{row.label}</td>
                        {annualTechnologyOptions.map((option) => (
                          <td
                            key={`${row.label}-${option.key}`}
                            className={`p-3 text-center font-bold ${
                              option.color === 'red' ? 'text-red-700' :
                              option.color === 'yellow' ? 'text-yellow-700' :
                              option.color === 'amber' ? 'text-amber-700' :
                              option.color === 'violet' ? 'text-violet-700' :
                              'text-cyan-700'
                            }`}
                          >
                            {format100OaAnnualValue(row, option)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {showFreeCoolingTables && (
            <section id="free-cooling" className="mt-8 w-full overflow-hidden rounded-3xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {language === 'fr' ? 'Module Free Cooling + Humifog adiabatique' : 'Free Cooling + Adiabatic Humifog Module'}
                  </h2>
                  <p className="text-slate-500 mt-1">
                    {language === 'fr'
                      ? 'CTA air melange avec retour d air. La cible de conception est la piece, pas une temperature de soufflage fixe.'
                      : 'Mixed air AHU with return air. The design target is the room condition, not a fixed supply target.'}
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-full text-xs font-bold border bg-cyan-50 text-cyan-700 border-cyan-200">
                  OA min {minimumOutsideAirPercent}% / {Math.round((ventilationMode.evaporativeEffectiveness ?? 0.72) * 100)}% Humifog
                </span>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-6 text-sm font-semibold text-emerald-900">
                {language === 'fr'
                  ? `Le module demontre que le scenario Humifog module separement les volets OA/RA pour hausser la temperature de melange avant Humifog, limiter le refroidissement excessif et reduire le recours au rechauffage.`
                  : `This module demonstrates that the Humifog scenario modulates OA/RA dampers separately to raise the mixed air temperature before Humifog, limit overcooling and reduce reheat use.`}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-6">
                <div className="text-xs uppercase font-bold text-slate-500 mb-2">
                  {language === 'fr' ? 'Clarification des unites' : 'Unit clarification'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-700">
                  <div><strong>kW</strong> = {language === 'fr' ? 'Puissance instantanee' : 'Instantaneous power'}</div>
                  <div><strong>kWh/year</strong> = {language === 'fr' ? 'Energie annuelle' : 'Annual energy'}</div>
                  <div><strong>$/year</strong> = {language === 'fr' ? 'Cout ou economie annuelle' : 'Annual cost or savings'}</div>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  {language === 'fr'
                    ? 'Le total annuel Humifog inclut la pompe Humifog plus le rechauffage adiabatique thermique converti en energie electrique par le COP thermopompe.'
                    : 'The annual Humifog total includes Humifog pump energy plus adiabatic reheat thermal energy converted to electric energy by the heat pump COP.'}
                </div>
                {!freeCoolingCalculationComplete && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-bold text-amber-800">
                    {language === 'fr' ? 'Calcul incomplet' : 'Incomplete calculation'}
                  </div>
                )}
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? 'Bilan energetique annuel' : 'Annual energy balance'}
                </h3>
                <p className="mb-3 text-sm font-semibold text-cyan-800">
                  {isCustomOperatingHoursMode
                    ? (language === 'fr' ? 'Base annuelle : Heures personnalisées' : 'Annual basis: Custom Operating Hours')
                    : (language === 'fr' ? 'Base annuelle : Heures BIN' : 'Annual basis: BIN Hours')}
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="p-3 text-left">
                          {language === 'fr' ? 'Poste annuel' : 'Annual item'}
                        </th>
                        {annualTechnologyOptions.map((option) => (
                          <th
                            key={option.key}
                            className={`p-3 text-center ${
                              option.color === 'red' ? 'bg-red-700' :
                              option.color === 'yellow' ? 'bg-yellow-700' :
                              option.color === 'amber' ? 'bg-amber-700' :
                              'bg-cyan-700'
                            }`}
                          >
                            {option.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {freeCoolingAnnualTechnologyRows.map((row) => (
                        <tr key={row.label} className="border-b border-slate-100 last:border-b-0">
                          <td className="p-3 font-semibold text-slate-700">{row.label}</td>
                          {annualTechnologyOptions.map((option) => (
                            <td
                              key={`${row.label}-${option.key}`}
                              className={`p-3 text-center font-bold ${
                                option.color === 'red' ? 'text-red-700' :
                                option.color === 'yellow' ? 'text-yellow-700' :
                                option.color === 'amber' ? 'text-amber-700' :
                                'text-cyan-700'
                              }`}
                            >
                              {row.format(row.value(option))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  {language === 'fr'
                    ? 'Les options gaz utilisent la meme charge annuelle Free Cooling, puis convertissent seulement la portion humidification vapeur selon le rendement et le tarif gaz selectionnes.'
                    : 'Gas options use the same annual Free Cooling load, then convert only the steam humidification portion with the selected gas efficiency and gas rate.'}
                </div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <h4 className="text-lg font-bold text-emerald-900 mb-4">
                      {language === 'fr' ? 'Meilleure option selon le cout annuel' : 'Lowest annual cost option'}
                    </h4>
                    <div className="text-2xl font-black text-emerald-800">
                      {freeCoolingCalculationComplete
                        ? annualTechnologyOptions.reduce((best, option) =>
                            option.annualCost < best.annualCost ? option : best
                          ).label
                        : calculationIncompleteText}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                    <h4 className="text-lg font-bold text-blue-900 mb-4">
                      {language === 'fr' ? 'Reference du calcul' : 'Calculation reference'}
                    </h4>
                    {[
                      [language === 'fr' ? 'Rendement vapeur gaz naturel' : 'Natural gas steam efficiency', `${formatNumber(steamBoilerEfficiency, 0)}%`],
                      [language === 'fr' ? 'Rendement humidificateur gaz' : 'Gas humidifier efficiency', `${formatNumber(atmosphericGasHumidifierEfficiency, 0)}%`],
                      [language === 'fr' ? 'Tarif gaz naturel' : 'Natural gas rate', `${formatNumber(naturalGasRate, 2)} $/m3`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4 border-b border-blue-100 py-2 last:border-b-0">
                        <span className="text-sm font-semibold text-blue-900">{label}</span>
                        <span className="text-sm font-bold text-blue-800">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? 'Debug calcul annuel Humifog' : 'Humifog annual calculation debug'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    [language === 'fr' ? 'Pompe Humifog annuelle' : 'Annual Humifog pump kWh', formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.humifogPumpKwh)],
                    [language === 'fr' ? 'Cout pompe Humifog' : 'Humifog pump cost', formatAnnualCostIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.humifogPumpCost)],
                    [language === 'fr' ? 'Source rechauffage selectionnee' : 'Selected reheat source', selectedReheatSystemDisplayName],
                    [language === 'fr' ? 'Rechauffage thermique requis' : 'Required thermal reheat', formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.adiabaticReheatThermalKwh)],
                    [language === 'fr' ? 'Rechauffage applique selon methode' : 'Applied reheat by selected method', formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.selectedReheatEnergyKwh)],
                    [language === 'fr' ? 'Cout rechauffage selectionne' : 'Selected reheat cost', formatAnnualCostIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.selectedReheatCost)],
                    ...(usesHeatPumpReheat
                      ? [[language === 'fr' ? 'Equivalent thermopompe COP' : 'Heat-pump COP equivalent', `${formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.adiabaticReheatElectricKwh)} / COP ${formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.heatPumpCOP ?? heatPumpCOP, 1)}`]]
                      : []),
                    [language === 'fr' ? 'Total annuel Humifog' : 'Total annual Humifog kWh', formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.totalAnnualHumifogKwh)],
                    [language === 'fr' ? 'Cout annuel Humifog' : 'Annual Humifog cost', formatAnnualCostIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifogDebug?.totalAnnualHumifogCost)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs uppercase font-bold text-slate-500">{label}</div>
                      <div className="mt-2 text-lg font-bold text-slate-900">
                        {freeCoolingCalculationComplete ? value : calculationIncompleteText}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? 'Economies nettes' : 'Net savings'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[
                    [language === 'fr' ? 'Economies chauffage annuel' : 'Annual Heating Savings', formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.annualHeatingSavingsKwh)],
                    [language === 'fr' ? 'Economies humidification annuel' : 'Annual Humidification Savings', formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.annualHumidificationSavingsKwh)],
                    [language === 'fr' ? 'Rechauffage additionnel' : 'Additional Reheat Energy', formatAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.additionalReheatEnergyKwh)],
                    [language === 'fr' ? 'Economies energie annuelle nettes' : 'Net Annual Energy Savings', formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.netAnnualEnergySavingsKwh)],
                    [language === 'fr' ? 'Economies cout annuel' : 'Annual Cost Savings', formatSavingsAnnualCost(freeCoolingHumifogAnalysis.netSavings.annualCostSavings)],
                    [language === 'fr' ? 'Reduction energie' : 'Energy Reduction', formatSavingsPercent(freeCoolingHumifogAnalysis.netSavings.energyReductionPercent)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase font-bold text-slate-500">{label}</div>
                      <div className="text-2xl font-bold text-slate-900 mt-2">
                        {freeCoolingCalculationComplete ? value : calculationIncompleteText}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-xl font-bold text-slate-800 mb-4">
                  {language === 'fr' ? 'Validation air melange' : 'Mixed air validation'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs uppercase font-bold text-slate-500">{language === 'fr' ? 'T melange calculee' : 'Calculated Mixed Air Temperature'}</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{displayTemp(freeCoolingHumifogAnalysis.validation.calculatedMixedDb)}{tempUnit}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase font-bold text-slate-500">{language === 'fr' ? 'T melange mesuree' : 'Measured Mixed Air Temperature'}</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {freeCoolingHumifogAnalysis.validation.isOverridden
                        ? `${displayTemp(freeCoolingHumifogAnalysis.validation.measuredMixedDb)}${tempUnit}`
                        : (language === 'fr' ? 'Non utilisee' : 'Not used')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase font-bold text-slate-500">{language === 'fr' ? 'Difference' : 'Difference'}</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {freeCoolingHumifogAnalysis.validation.isOverridden
                        ? `${displayDeltaTemp(freeCoolingHumifogAnalysis.validation.mixedAirDifferenceC)}${tempUnit}`
                        : `${displayDeltaTemp(0)}${tempUnit}`}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={useMeasuredMixedAirTemperature}
                    onChange={(event) => setUseMeasuredMixedAirTemperature(event.target.checked)}
                  />
                  {language === 'fr' ? 'Utiliser T melange mesuree et recalculer les points en aval' : 'Use measured mixed air T and recalculate downstream points'}
                </label>
                <div className="mt-3 grid grid-cols-[minmax(0,180px)_64px] gap-2 items-center">
                  <input
                    type="number"
                    step="0.1"
                    disabled={!useMeasuredMixedAirTemperature}
                    value={displayTemp(measuredMixedAirTemperature)}
                    onChange={(event) => setMeasuredMixedAirTemperature(inputTempToC(Number(event.target.value)))}
                    className="rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-sm text-slate-500">{tempUnit}</span>
                </div>
              </div>

              <div className="overflow-x-auto mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? 'Points psychrometriques - BIN dominant' : 'Psychrometric points - dominant BIN'}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      {['Point', 'DB', 'RH', 'W', 'h', 'WB', 'DP'].map((heading) => (
                        <th key={heading} className="p-3 text-center font-semibold text-slate-700 first:text-left">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {freeCoolingHumifogAnalysis.psychrometricPoints.map((point) => (
                      <tr key={point.key} className="border-b border-slate-100">
                        <td className="p-3 font-bold text-slate-700">{formatPointLabel(point.label)}</td>
                        <td className="p-3 text-center">{displayTemp(point.state.db)}{tempUnit}</td>
                        <td className="p-3 text-center">{formatNumber(point.state.rh, 0)}%</td>
                        <td className="p-3 text-center">{formatNumber(point.state.w * 1000, 2)} g/kg</td>
                        <td className="p-3 text-center">{formatNumber(point.state.h, 1)} kJ/kg</td>
                        <td className="p-3 text-center">{displayTemp(point.state.wb)}{tempUnit}</td>
                        <td className="p-3 text-center">{displayTemp(point.state.dp)}{tempUnit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? 'Analyse détaillée Free Cooling' : 'Detailed Free Cooling Analysis'}
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  {language === 'fr'
                    ? (isHourlySimulationActive
                      ? 'Les heures EPW sont regroupées par tranches de température pour garder l’affichage fluide. Les totaux annuels utilisent toutes les heures EPW sélectionnées.'
                      : 'Chaque ligne correspond à un BIN actif. Les heures affichées reflètent le mode de calcul choisi, y compris les heures effectives du calendrier personnalisé.')
                    : (isHourlySimulationActive
                      ? 'EPW hours are grouped by temperature range for a responsive display. Annual totals still use all selected EPW hours.'
                      : 'Each row corresponds to an active weather BIN. The displayed hours reflect the selected calculation mode, including effective custom operating hours.')}
                </p>
                <table className="w-full text-sm min-w-[1400px]">
                  <thead>
                    <tr className="bg-slate-100">
                      {[
                        language === 'fr' ? 'Température extérieure' : 'Outdoor temperature',
                        language === 'fr' ? 'Heures effectives' : 'Effective hours',
                        language === 'fr' ? 'OA vapeur %' : 'Steam OA %',
                        language === 'fr' ? 'RA vapeur %' : 'Steam RA %',
                        language === 'fr' ? 'Température mélange vapeur' : 'Steam mixed temp',
                        language === 'fr' ? 'OA Humifog %' : 'Humifog OA %',
                        language === 'fr' ? 'RA Humifog %' : 'Humifog RA %',
                        language === 'fr' ? 'Température mélange Humifog' : 'Humifog mixed temp',
                        language === 'fr' ? 'Température avant Humifog' : 'Temperature before Humifog',
                        language === 'fr' ? 'Température après Humifog' : 'Temperature after Humifog',
                      ].map((heading) => (
                        <th key={heading} className="p-3 text-center font-semibold text-slate-700 first:text-left">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedFreeCoolingRows.map(({ humifogRow, steamRow }, index) => {
                      const steamOaPercent = Number(steamRow.appliedOutdoorAirPercent ?? steamRow.outdoorAirPercent ?? 0)
                      const steamRaPercent = 100 - steamOaPercent
                      const humifogOaPercent = Number(humifogRow.appliedOutdoorAirPercent ?? humifogRow.outdoorAirPercent ?? 0)
                      const humifogRaPercent = 100 - humifogOaPercent

                      return (
                        <tr key={`detail-${humifogRow.tempC}-${humifogRow.hours}-${index}`} className="border-b border-slate-100">
                          <td className="p-3 font-bold text-slate-700">{displayTemp(humifogRow.tempC)}{tempUnit}</td>
                          <td className="p-3 text-center font-semibold text-slate-800">{formatNumber(humifogRow.hours, 0)} h</td>
                          <td className="p-3 text-center font-bold text-red-700">{formatNumber(steamOaPercent, 1)}%</td>
                          <td className="p-3 text-center font-bold text-red-600">{formatNumber(steamRaPercent, 1)}%</td>
                          <td className="p-3 text-center font-bold text-red-700">{displayTemp(steamRow.mixed?.db ?? steamRow.calculatedMixed?.db ?? 0)}{tempUnit}</td>
                          <td className="p-3 text-center font-bold text-cyan-700">{formatNumber(humifogOaPercent, 1)}%</td>
                          <td className="p-3 text-center font-bold text-cyan-600">{formatNumber(humifogRaPercent, 1)}%</td>
                          <td className="p-3 text-center font-bold text-cyan-700">{displayTemp(humifogRow.mixed?.db ?? 0)}{tempUnit}</td>
                          <td className="p-3 text-center font-bold text-cyan-700">{displayTemp(humifogRow.inletToHumifog?.db ?? 0)}{tempUnit}</td>
                          <td className="p-3 text-center font-bold text-cyan-700">{displayTemp(humifogRow.afterHumifog?.db ?? 0)}{tempUnit}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? '1. Validation annuelle BIN par BIN' : '1. Annual BIN-by-BIN validation'}
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  {language === 'fr'
                    ? 'Le total annuel est la somme de tous les BIN climatiques ci-dessous; il ne provient pas seulement du BIN affiche dans le graphique.'
                    : 'The annual total is the sum of every climate BIN below; it is not calculated from only the BIN shown in the chart.'}
                </p>
                <p className="text-sm text-cyan-800 mb-3 font-semibold">
                  {language === 'fr'
                    ? 'Validation adiabatique: Sortie Humifog apres atomisation = T melange Humifog appliquee - DeltaT adiabatique.'
                    : 'Adiabatic validation: Humifog outlet after atomization = applied Humifog mixed T - adiabatic DeltaT.'}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      {[
                        language === 'fr' ? 'Temperature BIN' : 'BIN Temperature',
                        language === 'fr' ? 'Heures' : 'Hours',
                        language === 'fr' ? 'Vapeur OA théorique / appliqué' : 'Steam theoretical / applied OA',
                        language === 'fr' ? 'Humifog OA théorique / appliqué' : 'Humifog theoretical / applied OA',
                        language === 'fr' ? 'Écart volets Humifog' : 'Humifog damper difference',
                        language === 'fr' ? 'T mélange vapeur cible / appliquée' : 'Steam target / applied mixed T',
                        language === 'fr' ? 'T mélange Humifog appliquée' : 'Applied Humifog mixed T',
                        language === 'fr' ? 'T avant Humifog (apres prechauffage)' : 'T before Humifog (after preheat)',
                        language === 'fr' ? 'Sortie Humifog apres atomisation' : 'Humifog outlet after atomization',
                        language === 'fr' ? 'DeltaT adiabatique' : 'Adiabatic deltaT',
                        language === 'fr' ? 'Rechauffage instantane' : 'Instant reheat',
                        language === 'fr' ? 'Energie vapeur BIN' : 'Steam BIN energy',
                        language === 'fr' ? 'Energie Humifog BIN' : 'Humifog BIN energy',
                        language === 'fr' ? 'Économies BIN' : 'BIN savings',
                        language === 'fr' ? 'Contribution annuel Humifog' : 'Humifog annual contribution',
                      ].map((heading) => (
                        <th key={heading} className="p-3 text-center font-semibold text-slate-700 first:text-left">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {annualValidationRows.map((row) => {
                      const displayedHumifogAppliedMixedTempDb = Number(row.humifogAppliedMixTempDb ?? 0)
                      const displayedAdiabaticDeltaDb = Math.abs(Number(row.adiabaticCoolingC ?? 0))
                      const displayedHumifogOutletAfterAtomizationDb = displayedHumifogAppliedMixedTempDb - displayedAdiabaticDeltaDb
                      const displayedHumifogOutletWarning = displayedHumifogOutletAfterAtomizationDb > displayedHumifogAppliedMixedTempDb + 0.0001

                      return (
                      <tr key={`bin-${row.tempC}-${row.hours}`} className="border-b border-slate-100">
                        <td className="p-3 font-bold text-slate-700">{displayTemp(row.tempC)}{tempUnit}</td>
                        <td className="p-3 text-center">{formatNumber(row.hours, 0)} h</td>
                        <td className="p-3 text-center font-bold text-red-700">
                          <div>{language === 'fr' ? 'Théorique' : 'Theoretical'} {formatNumber(row.steamReference.theoreticalOaPercent, 1)}% OA</div>
                          <div className="mt-1 text-xs font-semibold text-red-500">
                            {language === 'fr' ? 'Appliqué' : 'Applied'} {formatNumber(row.steamReference.appliedOaPercent, 1)}% OA / {formatNumber(100 - row.steamReference.appliedOaPercent, 1)}% RA
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-cyan-700">
                          <div>{language === 'fr' ? 'Théorique' : 'Theoretical'} {formatNumber(row.theoreticalOutdoorAirPercent, 1)}% OA</div>
                          <div className="mt-1 text-xs font-semibold text-cyan-600">
                            {language === 'fr' ? 'Appliqué' : 'Applied'} {formatNumber(row.appliedOutdoorAirPercent, 1)}% OA / {formatNumber(100 - row.appliedOutdoorAirPercent, 1)}% RA
                          </div>
                        </td>
                        <td className="p-3 text-center text-sm font-semibold text-slate-700">
                          {(() => {
                            const steamOa = Number(row.steamReference.appliedOaPercent ?? row.steamReference.oaPercent ?? 0)
                            const humifogOa = Number(row.appliedOutdoorAirPercent ?? row.outdoorAirPercent ?? 0)
                            const theoreticalHumifogOa = Number(row.theoreticalOutdoorAirPercent ?? row.requestedOutdoorAirPercent ?? humifogOa)
                            const delta = steamOa - humifogOa
                            const theoreticalDelta = steamOa - theoreticalHumifogOa

                            if (Math.abs(delta) > 0.05) {
                              return delta > 0
                                ? (language === 'fr'
                                  ? `${formatNumber(delta, 1)} pts OA de moins`
                                  : `${formatNumber(delta, 1)} OA pts less`)
                                : (language === 'fr'
                                  ? `${formatNumber(Math.abs(delta), 1)} pts OA de plus`
                                  : `${formatNumber(Math.abs(delta), 1)} OA pts more`)
                            }

                            if (theoreticalDelta > 0.05 && humifogOa <= minimumOutsideAirPercent + 0.05) {
                              return language === 'fr'
                                ? `Bloqué au minimum OA ${formatNumber(minimumOutsideAirPercent, 1)}%`
                                : `Limited at ${formatNumber(minimumOutsideAirPercent, 1)}% OA minimum`
                            }

                            return language === 'fr' ? 'Aucun écart OA' : 'No OA difference'
                          })()}
                        </td>
                        <td className="p-3 text-center text-red-700">
                          <div className="font-bold">
                            {language === 'fr' ? 'Cible' : 'Target'} {displayTemp(row.steamReference.targetMixedDb)}{tempUnit}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-red-500">
                            {language === 'fr' ? 'Appliquée' : 'Applied'} {displayTemp(row.steamReference.tmix)}{tempUnit}
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-cyan-700">
                          {displayTemp(displayedHumifogAppliedMixedTempDb)}{tempUnit}
                        </td>
                        <td className="p-3 text-center font-bold text-cyan-700">
                          {displayTemp(row.humifogBeforeAtomizationDb)}{tempUnit}
                        </td>
                        <td className="p-3 text-center font-bold text-cyan-700">
                          <div>{displayTemp(displayedHumifogOutletAfterAtomizationDb)}{tempUnit}</div>
                          <div className={`mt-1 text-[11px] font-semibold ${displayedHumifogOutletWarning ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {displayedHumifogOutletWarning
                              ? (language === 'fr' ? 'Validation Humifog : WARNING (sortie > T melange appliquee)' : 'Humifog validation: WARNING (outlet > applied mixed T)')
                              : (language === 'fr' ? 'Validation Humifog : OK' : 'Humifog validation: OK')}
                          </div>
                        </td>
                        <td className="p-3 text-center text-blue-700">{displayDeltaTemp(displayedAdiabaticDeltaDb)}{tempUnit}</td>
                        <td className="p-3 text-center">{formatInstantPower(row.reheatLoadKw)}</td>
                        <td className="p-3 text-center font-bold text-red-700">{formatAnnualEnergy(row.steamReference.binEnergyKwh)}</td>
                        <td className="p-3 text-center font-bold text-cyan-700">{formatAnnualEnergy(row.humifogOptimized.binEnergyKwh)}</td>
                        <td className={`p-3 text-center font-bold ${row.difference.binEnergyKwh >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatSavingsAnnualEnergy(row.difference.binEnergyKwh)}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-900">{formatNumber(row.annualContributionPercent, 1)}%</td>
                        </tr>
                        )
                      })}
                    <tr className="bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{language === 'fr' ? 'Total annuel' : 'Annual total'}</td>
                      <td className="p-3 text-center font-bold">{formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.totalHours, 0)} h</td>
                      <td className="p-3 text-center font-bold text-red-700">
                        <div>{language === 'fr' ? 'Théorique' : 'Theoretical'} {formatNumber(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageTheoreticalOa, 1)}%</div>
                        <div className="mt-1 text-xs font-semibold text-red-500">
                          {language === 'fr' ? 'Appliqué' : 'Applied'} {formatNumber(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageAppliedOa, 1)}%
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-cyan-700">
                        <div>{language === 'fr' ? 'Théorique' : 'Theoretical'} {formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.averageTheoreticalOa, 1)}%</div>
                        <div className="mt-1 text-xs font-semibold text-cyan-600">
                          {language === 'fr' ? 'Appliqué' : 'Applied'} {formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.averageAppliedOa, 1)}%
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        {(() => {
                          const delta = (freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageAppliedOa || 0) -
                            (freeCoolingHumifogAnalysis.annualComparison.humifog.averageAppliedOa || 0)
                          if (Math.abs(delta) <= 0.05) {
                            return language === 'fr' ? 'Aucun écart moyen' : 'No average difference'
                          }
                          return delta > 0
                            ? (language === 'fr' ? `${formatNumber(delta, 1)} pts moins` : `${formatNumber(delta, 1)} pts less`)
                            : (language === 'fr' ? `${formatNumber(Math.abs(delta), 1)} pts plus` : `${formatNumber(Math.abs(delta), 1)} pts more`)
                        })()}
                      </td>
                      <td className="p-3 text-center text-red-700">{displayTemp(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageMixedDb)}{tempUnit}</td>
                      <td className="p-3 text-center text-cyan-700">{displayTemp(freeCoolingHumifogAnalysis.annualComparison.humifog.averageMixedDb)}{tempUnit}</td>
                      <td className="p-3 text-center">-</td>
                      <td className="p-3 text-center">-</td>
                      <td className="p-3 text-center">-</td>
                      <td className="p-3 text-center font-bold">{formatAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.humifog.reheatEnergyKwh)}</td>
                      <td className="p-3 text-center font-bold text-red-700">{formatAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.freeCooling.totalEnergyKwh)}</td>
                      <td className="p-3 text-center font-bold text-cyan-700">{formatAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.humifog.totalEnergyKwh)}</td>
                      <td className={`p-3 text-center font-bold ${freeCoolingHumifogAnalysis.annualComparison.savingsKwh >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.annualComparison.savingsKwh)}
                      </td>
                      <td className="p-3 text-center font-bold">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className={`mb-8 rounded-xl border p-4 text-sm font-semibold ${
                annualValidationStable
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}>
                {annualValidationStable
                  ? (language === 'fr'
                    ? 'Validation stable : les totaux annuels Free Cooling correspondent exactement à la somme de tous les BIN climatiques.'
                    : 'Stable validation: Free Cooling annual totals match the sum of all climate BINs.')
                  : (language === 'fr'
                    ? 'Attention : les totaux annuels ne correspondent pas parfaitement à la somme des BIN. Vérifier la logique Free Cooling.'
                    : 'Warning: annual totals do not fully match the BIN sum. Verify Free Cooling logic.')}
              </div>

              {humifogAtomizationWarningRows.length > 0 && (
                <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  {language === 'fr'
                    ? `Alerte coherence Humifog: ${humifogAtomizationWarningRows.length} BIN ont une temperature apres atomisation superieure a la temperature juste avant Humifog.`
                    : `Humifog coherence warning: ${humifogAtomizationWarningRows.length} BIN rows have an after-atomization temperature higher than the immediate pre-Humifog temperature.`}
                </div>
              )}

              {criticalHumifogReheatRow && (
                <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-xl font-bold text-amber-950 mb-3">
                    {language === 'fr' ? 'BIN critique - origine du rechauffage Humifog' : 'Critical BIN - Humifog reheat source'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    {[
                      [language === 'fr' ? 'BIN / heures' : 'BIN / hours', `${displayTemp(criticalHumifogReheatRow.tempC)}${tempUnit} / ${formatNumber(criticalHumifogReheatRow.hours, 0)} h`],
                      [language === 'fr' ? 'T melange Humifog appliquee' : 'Applied Humifog mixed T', `${displayTemp(criticalHumifogReheatRow.humifogAppliedMixTempDb)}${tempUnit}`],
                      [language === 'fr' ? 'T avant Humifog (apres prechauffage)' : 'T before Humifog (after preheat)', `${displayTemp(criticalHumifogReheatRow.humifogBeforeAtomizationDb)}${tempUnit}`],
                      [language === 'fr' ? 'T apres Humifog (apres atomisation)' : 'T after Humifog (after atomization)', `${displayTemp(criticalHumifogReheatRow.humifogOutletAfterAtomizationDb)}${tempUnit}`],
                      [language === 'fr' ? 'DeltaT adiabatique' : 'Adiabatic DeltaT', `${displayDeltaTemp(criticalHumifogReheatRow.adiabaticCoolingC)}${tempUnit}`],
                      [language === 'fr' ? 'Formule validee' : 'Validated formula', `${displayTemp(criticalHumifogReheatRow.humifogAppliedMixTempDb)}${tempUnit} - ${displayDeltaTemp(criticalHumifogReheatRow.adiabaticCoolingC)}${tempUnit} = ${displayTemp(criticalHumifogReheatRow.humifogOutletAfterAtomizationDb)}${tempUnit}`],
                      [language === 'fr' ? 'Delta rechauffage' : 'Reheat delta', `${displayDeltaTemp(criticalHumifogReheatRow.reheatDeltaC)}${tempUnit}`],
                      [language === 'fr' ? 'Puissance thermique' : 'Thermal reheat', formatInstantPower(criticalHumifogReheatRow.reheatThermalKw)],
                      [language === 'fr' ? 'Puissance appliquee' : 'Applied reheat input', formatInstantPower(criticalHumifogReheatRow.reheatLoadKw)],
                      [language === 'fr' ? 'Energie BIN rechauffage' : 'BIN reheat energy', formatAnnualEnergy(criticalHumifogReheatRow.humifogOptimized.reheatEnergyKwh)],
                      [language === 'fr' ? 'Energie BIN Humifog totale' : 'Total Humifog BIN energy', formatAnnualEnergy(criticalHumifogReheatRow.humifogOptimized.binEnergyKwh)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white border border-amber-100 p-3">
                        <div className="text-slate-500">{label}</div>
                        <div className="mt-1 font-bold text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? '2. Impact OA / RA' : '2. OA / RA impact'}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      {[
                        language === 'fr' ? 'Minimum OA testé' : 'Tested OA minimum',
                        'RA %',
                        language === 'fr' ? 'Temperature air melange' : 'Mixed Air Temperature',
                        language === 'fr' ? 'Energie chauffage' : 'Heating Energy',
                        language === 'fr' ? 'Energie humidification' : 'Humidification Energy',
                        language === 'fr' ? 'Energie totale' : 'Total Energy',
                        language === 'fr' ? 'Cout annuel' : 'Annual Cost',
                      ].map((heading) => (
                        <th key={heading} className="p-3 text-center font-semibold text-slate-700">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {freeCoolingHumifogAnalysis.optimizationRows.map((row) => (
                      <tr key={`opt-${row.oaPercent}`} className={`border-b border-slate-100 ${row.oaPercent === freeCoolingHumifogAnalysis.optimal.oaPercent ? 'bg-emerald-50' : ''}`}>
                        <td className="p-3 text-center font-bold text-sky-700">{row.oaPercent}%</td>
                        <td className="p-3 text-center font-bold text-orange-700">{row.raPercent}%</td>
                        <td className="p-3 text-center">{displayTemp(row.tmix)}{tempUnit}</td>
                        <td className="p-3 text-center">{formatAnnualEnergy(row.heatingEnergyKwh)}</td>
                        <td className="p-3 text-center">{formatAnnualEnergy(row.humidificationEnergyKwh)}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{formatAnnualEnergy(row.totalEnergyKwh)}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{formatAnnualCost(row.annualCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? '3. Comparaison détaillée des calculs annuels' : '3. Detailed Annual Energy Comparison'}
                </h3>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <label className="font-semibold text-slate-700">
                    {language === 'fr' ? 'Technologie de référence' : 'Reference Technology'}
                    <select
                      value={annualComparisonReference}
                      onChange={(event) => setAnnualComparisonReference(event.target.value)}
                      className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800"
                    >
                      {annualTechnologyOptions.filter((option) => BASELINE_TECHNOLOGIES.includes(option.key)).map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <span className="font-semibold text-cyan-800">
                    {selectedHumifogOption?.label || (language === 'fr' ? 'Humifog - solution sélectionnée' : 'Humifog - Selected Solution')}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-3 text-left">{language === 'fr' ? 'Paramètre' : 'Parameter'}</th>
                      {annualTechnologyOptions.map((option) => (
                        <th key={option.key} className="p-3 text-center">{option.label}</th>
                      ))}
                      <th className="p-3 text-center">
                        {language === 'fr' ? 'Écart vs technologie de référence' : 'Difference vs Reference Technology'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedAnnualComparisonRows.map((row) => {
                      const difference = annualComparisonDifference(row)
                      return (
                        <tr key={row.key} className="border-b border-slate-100">
                          <td className="p-3 font-bold text-slate-700">{row.label}</td>
                          {annualTechnologyOptions.map((option) => (
                            <td key={`${row.key}-${option.key}`} className="p-3 text-center">
                              {formatAnnualComparisonValue(row, annualComparisonValue(row, option))}
                            </td>
                          ))}
                          <td className={`p-3 text-center font-bold ${difference === null ? 'text-slate-500' : difference >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {difference === null
                              ? (language === 'fr' ? 'Non applicable' : 'Not applicable')
                              : row.kind === 'cost' ? formatSavingsAnnualCost(difference) : formatSavingsAnnualEnergy(difference)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {language === 'fr' ? '4. Analyse détaillée Free Cooling' : '4. Detailed Free Cooling Analysis'}
                </h3>
                <p className="mb-3 text-sm text-slate-600">
                  {language === 'fr'
                    ? 'Cette section illustre le comportement physique Free Cooling : modulation OA/RA, mélange, refroidissement adiabatique et température après Humifog. Les totaux annuels restent dans la section 3.'
                    : 'This section illustrates the physical Free Cooling behavior: OA/RA modulation, mixed-air temperature, adiabatic cooling and post-Humifog temperature. Annual totals remain in section 3.'}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="p-3 text-left">{language === 'fr' ? 'Parametre' : 'Parameter'}</th>
                      <th className="p-3 text-center">{language === 'fr' ? 'Scenario vapeur' : 'Steam scenario'}</th>
                      <th className="p-3 text-center">{language === 'fr' ? 'Scenario Humifog' : 'Humifog scenario'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        language === 'fr' ? 'OA moyen théorique / appliqué' : 'Average theoretical / applied OA%',
                        `${formatNumber(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageTheoreticalOa, 0)}% -> ${formatNumber(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageAppliedOa, 0)}%`,
                        `${formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.averageTheoreticalOa, 0)}% -> ${formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.averageAppliedOa, 0)}%`,
                      ],
                      [
                        language === 'fr' ? 'OA moyen vapeur / Humifog' : 'Average steam / Humifog OA',
                        `${formatNumber(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageAppliedOa, 0)}%`,
                        `${formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.averageAppliedOa, 0)}%`,
                      ],
                      [language === 'fr' ? 'Température mélange moyenne vapeur' : 'Average steam mixed air temperature', `${displayTemp(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageMixedDb)}${tempUnit}`, '-'],
                      [language === 'fr' ? 'Température mélange moyenne Humifog' : 'Average Humifog mixed air temperature', '-', `${displayTemp(freeCoolingHumifogAnalysis.annualComparison.humifog.averageMixedDb)}${tempUnit}`],
                    ].map(([label, freeCoolingValue, humifogValue]) => (
                      <tr key={label} className="border-b border-slate-100">
                        <td className="p-3 font-bold text-slate-700">{label}</td>
                        <td className="p-3 text-center">{freeCoolingValue}</td>
                        <td className="p-3 text-center font-bold text-cyan-700">{humifogValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="text-xl font-bold text-emerald-950 mb-4">
                  {language === 'fr' ? 'Demonstration de la logique energetique' : 'Energy logic demonstration'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {[
                    [
                      language === 'fr' ? 'Reduction air exterieur' : 'Reducing outdoor air',
                      `${formatNumber(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageOa, 0)}% -> ${formatNumber(freeCoolingHumifogAnalysis.annualComparison.humifog.averageOa, 0)}%`,
                    ],
                    [
                      language === 'fr' ? 'Tmix augmente' : 'Increasing mixed air temperature',
                      `${displayTemp(freeCoolingHumifogAnalysis.annualComparison.freeCooling.averageMixedDb)}${tempUnit} -> ${displayTemp(freeCoolingHumifogAnalysis.annualComparison.humifog.averageMixedDb)}${tempUnit}`,
                    ],
                    [
                      language === 'fr' ? 'Chauffage reduit' : 'Reducing heating energy',
                      formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.annualHeatingSavingsKwh),
                    ],
                    [
                      language === 'fr' ? 'Humidification reduite' : 'Reducing humidification energy',
                      formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.annualHumidificationSavingsKwh),
                    ],
                    [
                      language === 'fr' ? 'Cout annuel reduit' : 'Reducing annual operating cost',
                      formatSavingsAnnualCost(freeCoolingHumifogAnalysis.netSavings.annualCostSavings),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-emerald-200 bg-white p-3">
                      <div className="text-xs uppercase font-bold text-emerald-700">{label}</div>
                      <div className="mt-2 text-lg font-bold text-emerald-950">
                        {freeCoolingCalculationComplete ? value : calculationIncompleteText}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {language === 'fr' ? 'Assistant HESA - Bêta' : 'HESA Assistant - Beta'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      {language === 'fr'
                        ? 'Fonction secondaire: explique les BIN, OA/RA, Tmix, Humifog, rechauffage et economies annuelles sans modifier les calculs.'
                        : 'Secondary feature: explains BINs, OA/RA, Tmix, Humifog, reheat and annual savings without changing calculations.'}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-sky-700 bg-white border border-sky-100 px-3 py-2 rounded-full">
                    {language === 'fr' ? 'Donnees Free Cooling affichees' : 'Displayed Free Cooling data'}
                  </div>
                </div>

                {assistantSetupPanel}

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <textarea
                    value={assistantQuestion}
                    onChange={(event) => setAssistantQuestion(event.target.value)}
                    placeholder={language === 'fr'
                      ? 'Ex.: Explique pourquoi le rechauffage Humifog apparait sur certains BIN.'
                      : 'Example: Explain why Humifog reheat appears on some BINs.'}
                    className="min-h-20 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-slate-900 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    onClick={askHesesAssistant}
                    disabled={assistantLoading}
                    className="h-12 rounded-xl bg-sky-700 px-5 font-bold text-white shadow-lg transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400 md:self-start"
                  >
                    {assistantLoading
                      ? (language === 'fr' ? 'Analyse...' : 'Analyzing...')
                      : (language === 'fr' ? 'Demander' : 'Ask')}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    language === 'fr' ? 'Explique le bilan annuel Free Cooling.' : 'Explain the Free Cooling annual balance.',
                    language === 'fr' ? 'Quels BIN contribuent le plus aux economies?' : 'Which BINs contribute most to savings?',
                    language === 'fr' ? 'Pourquoi il y a du rechauffage apres Humifog?' : 'Why is there reheat after Humifog?',
                    language === 'fr' ? 'Resume les resultats pour un client.' : 'Summarize the results for a client.',
                    language === 'fr' ? 'Redige un court texte technique pour un rapport.' : 'Write a short technical report text.',
                  ].map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => setAssistantQuestion(question)}
                      className="rounded-full border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:bg-sky-100"
                    >
                      {question}
                    </button>
                  ))}
                </div>

                {assistantError && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {assistantError}
                  </div>
                )}

                {assistantAnswer && (
                  <div className="mt-4 whitespace-pre-wrap rounded-xl border border-sky-100 bg-white p-4 leading-relaxed text-slate-800">
                    {assistantAnswer}
                  </div>
                )}
              </div>

              <div className="mt-8 rounded-2xl border border-slate-300 bg-slate-900 p-5 text-white">
                <h3 className="text-xl font-bold mb-4">
                  {language === 'fr' ? 'Sommaire d ingenierie' : 'Engineering summary'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    [language === 'fr' ? 'Energie annuelle totale vapeur' : 'Steam System Total Annual Energy', formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.freeCooling.totalEnergyKwh)],
                    [language === 'fr' ? 'Energie annuelle totale Humifog' : 'Humifog System Total Annual Energy', formatAnnualEnergyIfComplete(freeCoolingHumifogAnalysis.annualComparison.humifog.totalEnergyKwh)],
                    [language === 'fr' ? 'Economies annuelles nettes' : 'Net Annual Savings', freeCoolingCalculationComplete ? formatSavingsAnnualEnergy(freeCoolingHumifogAnalysis.netSavings.netAnnualEnergySavingsKwh) : calculationIncompleteText],
                    [language === 'fr' ? 'Economies cout annuel' : 'Net Annual Cost Savings', freeCoolingCalculationComplete ? formatSavingsAnnualCost(freeCoolingHumifogAnalysis.netSavings.annualCostSavings) : calculationIncompleteText],
                    [language === 'fr' ? 'OA recommande' : 'Recommended OA %', `${freeCoolingHumifogAnalysis.optimal.oaPercent}%`],
                    [language === 'fr' ? 'RA recommande' : 'Recommended RA %', `${freeCoolingHumifogAnalysis.optimal.raPercent}%`],
                    [language === 'fr' ? 'Tmix optimale' : 'Optimal Mixed Air Temperature', `${displayTemp(freeCoolingHumifogAnalysis.optimal.tmix)}${tempUnit}`],
                    [
                      'ASHRAE Compliance',
                      language === 'fr'
                        ? `Minimum OA sélectionné respecté : ${minimumOutsideAirPercent}%`
                        : `Selected OA minimum respected: ${minimumOutsideAirPercent}%`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/10 p-3">
                      <div className="text-xs uppercase font-bold text-slate-300">{label}</div>
                      <div className="mt-2 text-lg font-bold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {!showFreeCoolingTables && (
          <section className="w-full bg-white border border-sky-200 rounded-2xl shadow-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {language === 'fr' ? 'Assistant HESA - Bêta' : 'HESA Assistant - Beta'}
                </h2>
                <p className="text-slate-600 mt-1">
                  {language === 'fr'
                    ? 'Fonction secondaire: resume et explique les donnees affichees sans modifier les calculs.'
                    : 'Secondary feature: summarizes and explains displayed data without changing calculations.'}
                </p>
                <p className="mt-2 text-sm font-semibold text-sky-800">
                  {language === 'fr'
                    ? 'Mode 100% air exterieur: aucune hypothese de melange OA/RA.'
                    : '100% outdoor air mode: no OA/RA mixed-air assumption.'}
                </p>
              </div>
              <div className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-100 px-3 py-2 rounded-full">
                {language === 'fr' ? 'Mode explication' : 'Explanation mode'}
              </div>
            </div>

            {assistantSetupPanel}

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <textarea
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
                placeholder={language === 'fr'
                  ? 'Ex.: Compare la vapeur et le Humifog avec les resultats affiches.'
                  : 'Example: Compare steam and Humifog using the displayed results.'}
                className="min-h-24 w-full resize-y rounded-xl border border-slate-300 p-4 text-slate-900 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <button
                onClick={askHesesAssistant}
                disabled={assistantLoading}
                className="h-12 rounded-xl bg-sky-700 px-5 font-bold text-white shadow-lg transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400 md:self-start"
              >
                {assistantLoading
                  ? (language === 'fr' ? 'Analyse...' : 'Analyzing...')
                  : (language === 'fr' ? 'Demander' : 'Ask')}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                language === 'fr' ? 'Explique les economies annuelles.' : 'Explain the annual savings.',
                language === 'fr' ? 'Pourquoi Humifog economise de l energie?' : 'Why does Humifog save energy?',
                language === 'fr' ? 'Resume les resultats pour un client.' : 'Summarize the results for a client.',
                language === 'fr' ? 'Redige un court texte technique pour un rapport.' : 'Write a short technical report text.',
              ].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => setAssistantQuestion(question)}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                >
                  {question}
                </button>
              ))}
            </div>

            {assistantError && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {assistantError}
              </div>
            )}

            {assistantAnswer && (
              <div className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 leading-relaxed text-slate-800">
                {assistantAnswer}
              </div>
            )}
          </section>
          )}

          {/* Summary Footer */}
          <div className="w-full bg-gradient-to-r from-slate-900 to-sky-900 rounded-3xl shadow-2xl p-8 text-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm uppercase opacity-70">{t.energySavings}</div>
                <div className="text-4xl font-bold mt-2">{savings}%</div>
              </div>
              <div>
                <div className="text-sm uppercase opacity-70">{t.heatPumpCOP}</div>
                <div className="text-4xl font-bold mt-2">{heatPumpCOP.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-sm uppercase opacity-70">
                  {isFreeCoolingMode ? (language === 'fr' ? 'OA minimum' : 'Minimum OA') : t.thermalWheel}
                </div>
                <div className="text-4xl font-bold mt-2">
                  {isFreeCoolingMode ? `${minimumOutsideAirPercent}%` : `${wheelEfficiency}%`}
                </div>
              </div>
              <div>
                <div className="text-sm uppercase opacity-70">{t.globalPerformance}</div>
                <div className="text-4xl font-bold mt-2">{cappedRecoveryEfficiency}%</div>
              </div>
            </div>
            <div className="mt-8 border-t border-white/20 pt-4 text-xs text-white/70">© 2026 Enersol inc. / Carel Group. HESA - Humidification Energy System Analysis. All rights reserved.</div>
          </div>

      </div>
    </div>
  )
}



