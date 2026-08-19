import { Fragment } from 'react'
import { BASELINE_TECHNOLOGIES, selectedHumifogTechnology, selectedReferenceTechnology, selectedTechnologiesForSystem, summarizeBuildingSavings, summarizeProjectEnergy } from './projectEnergySummary'
import { humidityRatioFromRH } from '../calculations/psychrometrics.js'

const PROFESSIONAL_REPORT_CSS = `
  .engineering-report {
    --report-ink: #0f172a;
    --report-muted: #475569;
    --report-line: #cbd5e1;
    --report-blue: #0f3a5b;
    --report-accent: #0284c7;
    --report-soft: #f8fafc;
    max-width: 1060px;
    margin: 0 auto;
    background: #ffffff;
    color: var(--report-ink);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.42;
  }

  .report-cover {
    position: relative;
    overflow: hidden;
    color: var(--report-ink);
    border: 1px solid var(--report-line);
    border-top: 14px solid var(--report-blue);
    border-radius: 12px;
    padding: 28px;
    min-height: 720px;
    margin-bottom: 18px;
    background:
      linear-gradient(120deg, rgba(14, 165, 233, 0.08), rgba(34, 197, 94, 0.05) 42%, transparent 42%),
      #ffffff;
  }

  .report-cover h1 {
    color: var(--report-blue);
    font-size: 38px;
    line-height: 1.04;
    letter-spacing: 0;
    margin: 6px 0 8px;
    max-width: 760px;
  }

  .cover-topline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    border-bottom: 1px solid var(--report-line);
    padding-bottom: 10px;
    margin-bottom: 16px;
    color: var(--report-muted);
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .cover-logo-lockup {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }

  .cover-logo-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 248px;
    max-width: 280px;
    min-height: 72px;
    padding: 10px 14px;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.1);
    border: 1px solid rgba(20, 184, 212, 0.2);
  }

  .cover-logo-title {
    font-size: 27px;
    font-weight: 900;
    color: #163b73;
    letter-spacing: 0.4px;
    line-height: 1;
  }

  .cover-logo-accent {
    width: 44px;
    height: 3px;
    margin-top: 5px;
    margin-bottom: 5px;
    border-radius: 999px;
    background: linear-gradient(90deg, #1e63b5, #14b8d4);
  }

  .cover-logo-subtitle {
    font-size: 11px;
    font-weight: 700;
    color: #5b6f8e;
    white-space: nowrap;
    line-height: 1.2;
  }

  .cover-brand {
    color: var(--report-accent);
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .cover-subtitle {
    max-width: 720px;
    color: var(--report-muted);
    font-size: 13px;
    margin: 0 0 10px;
  }

  .cover-badges,
  .document-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cover-badge,
  .document-meta-row span {
    border: 1px solid #bae6fd;
    background: #f0f9ff;
    color: #075985;
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 9px;
    font-weight: 800;
  }

  .document-meta-row {
    margin: 10px 0 12px;
  }

  .cover-grid,
  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    align-items: start;
  }

  .cover-meta {
    border: 1px solid var(--report-line);
    border-radius: 10px;
    overflow: hidden;
    background: #ffffff;
  }

  .cover-meta .report-table,
  .cover-meta .report-table tbody,
  .cover-meta .report-table tr:last-child th,
  .cover-meta .report-table tr:last-child td {
    margin-bottom: 0;
  }

  .cover-summary,
  .cover-certification,
  .professional-note {
    margin-top: 16px;
    border-left: 4px solid var(--report-accent);
    background: var(--report-soft);
    padding: 9px 12px;
    color: #334155;
  }

  .cover-summary strong,
  .cover-certification strong {
    display: block;
    color: var(--report-blue);
    margin-bottom: 5px;
  }

  .cover-certification span {
    display: block;
  }

  .cover-figure,
  .schematic-figure {
    margin: 0;
    border: 1px solid var(--report-line);
    border-radius: 12px;
    padding: 10px;
    background: #ffffff;
  }

  .cover-figure img,
  .schematic-figure img {
    width: 100%;
    max-height: 300px;
    object-fit: contain;
    display: block;
  }

  .cover-figure figcaption,
  .schematic-figure figcaption {
    margin-top: 8px;
    color: var(--report-muted);
    font-size: 10px;
    font-weight: 700;
  }

  .cover-kpi-row,
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 12px;
  }

  .kpi-grid {
    grid-template-columns: repeat(5, 1fr);
  }

  .cover-kpi,
  .kpi,
  .graph-card {
    border: 1px solid var(--report-line);
    border-radius: 10px;
    padding: 9px;
    background: #ffffff;
    break-inside: avoid;
  }

  .cover-kpi span,
  .kpi span,
  .eyebrow,
  .signature-grid span {
    display: block;
    color: #64748b;
    font-size: 9.5px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .cover-kpi strong,
  .kpi strong {
    display: block;
    color: var(--report-blue);
    font-size: 16px;
    margin-top: 5px;
  }

  .executive-callout {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .executive-callout > div {
    border: 1px solid #bae6fd;
    border-top: 5px solid var(--report-accent);
    border-radius: 10px;
    padding: 12px;
    background: #f0f9ff;
  }

  .executive-callout strong {
    display: block;
    color: var(--report-blue);
    font-size: 15px;
    margin-top: 5px;
  }

  .report-section {
    border: 1px solid var(--report-line);
    border-radius: 12px;
    padding: 17px;
    margin-bottom: 16px;
    background: #ffffff;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .report-section.allow-page-break {
    break-inside: auto;
    page-break-inside: auto;
  }

  .report-section h2 {
    color: var(--report-blue);
    font-size: 17px;
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--report-accent);
    text-transform: uppercase;
  }

  .report-section h3 {
    color: #334155;
    font-size: 13px;
    margin: 14px 0 8px;
  }

  .report-text {
    margin: 0 0 12px;
    color: #334155;
  }

  .report-table,
  .heatmap {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    color: var(--report-ink);
    background: #ffffff;
  }

  .report-table th,
  .report-table td,
  .heatmap th,
  .heatmap td {
    border: 1px solid var(--report-line);
    padding: 7px 8px;
    vertical-align: top;
  }

  .report-table th,
  .heatmap th {
    background: #eaf5fb;
    color: #0f3a5b;
    text-align: left;
    font-weight: 800;
  }

  .report-table tbody tr:nth-child(even) td {
    background: #f8fafc;
  }

  .report-table.compact th,
  .report-table.compact td {
    font-size: 10px;
    text-align: center;
    padding: 5px 6px;
  }

  .report-section.bin-summary-section {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .bin-summary-section .report-table.compact th,
  .bin-summary-section .report-table.compact td {
    font-size: 9px;
    padding: 4px 5px;
  }

  .report-table.compact th:first-child,
  .report-table.compact td:first-child {
    text-align: left;
  }

  .key-value th {
    width: 38%;
  }

  .toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .toc-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 700;
  }

  .toc-dots {
    flex: 1;
    border-bottom: 1px dotted #94a3b8;
    transform: translateY(3px);
  }

  .report-list {
    margin: 0;
    padding-left: 20px;
  }

  .report-list li {
    margin-bottom: 6px;
  }

  .formula-block {
    background: var(--report-soft);
    border-left: 4px solid var(--report-accent);
    padding: 10px 12px;
    margin-bottom: 12px;
    font-family: Consolas, monospace;
  }

  .graph-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .graph-card h3 {
    margin-top: 0;
  }

  .graph-card svg,
  .engineering-report svg {
    width: 100%;
    height: auto;
  }

  .heatmap {
    font-size: 8px;
  }

  .heatmap th,
  .heatmap td {
    padding: 4px;
    text-align: center;
  }

  .highlight-row td {
    background: #dcfce7 !important;
    font-weight: 800;
  }

  .signature-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 18px;
  }

  .signature-grid > div {
    min-height: 64px;
    border: 1px solid var(--report-line);
    border-radius: 10px;
    padding: 11px;
    background: #ffffff;
  }

  .signature-grid strong {
    display: block;
    margin-top: 8px;
    color: var(--report-blue);
  }

  .report-footer {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    border-top: 1px solid var(--report-line);
    margin-top: 18px;
    padding-top: 10px;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
  }

  img {
    max-width: 100%;
    height: auto;
  }

  @media print {
    .engineering-report {
      max-width: 100%;
      margin: 0;
      font-size: 11px;
    }

    .report-cover {
      min-height: auto;
      padding: 20px;
      break-after: page;
      page-break-after: always;
      border-radius: 0;
      margin-bottom: 0;
    }

    .report-cover h1 {
      font-size: 31px;
    }

    .cover-logo-card {
      box-shadow: none;
      border-color: #cbd5e1;
    }

    .report-cover .cover-figure {
      display: none;
    }

    .report-cover .cover-grid {
      grid-template-columns: 1fr;
    }

    .cover-figure img {
      max-height: 240px;
    }

      .cover-logo-card {
        min-width: 230px;
        max-width: 250px;
        min-height: 66px;
        padding: 8px 12px;
      }

      .cover-logo-title {
        font-size: 24px;
      }

      .cover-logo-subtitle {
        font-size: 10px;
      }

    .report-cover .cover-summary,
    .report-cover .cover-certification {
      display: none;
    }

    .cover-meta .report-table th,
    .cover-meta .report-table td {
      padding: 5px 6px;
      font-size: 10px;
    }

    .page-break {
      break-before: auto;
      page-break-before: auto;
    }

    .report-cover.page-break {
      break-before: auto;
      page-break-before: auto;
    }

    .report-section {
      border-radius: 0;
      box-shadow: none;
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 10mm;
    }

    .report-section.allow-page-break {
      break-inside: auto;
      page-break-inside: auto;
    }

    .report-section h2,
    .report-section h3 {
      break-after: avoid;
      page-break-after: avoid;
    }

    .kpi,
    .cover-kpi,
    .graph-card {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .report-table,
    .heatmap {
      break-inside: auto;
      page-break-inside: auto;
    }

    .report-table tr,
    .heatmap tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .report-footer {
      position: static;
      background: #ffffff;
    }
  }
`

let activeReportLanguage = 'en'

function fallbackHumidificationLoadLbHr(system = {}) {
  const settings = system.settings || {}
  const config = system.system || {}
  const design = system.design || {}
  const airflowCfm = Number(config.supplyAirflowCfm ?? settings.outsideAirCFM)
  if (!Number.isFinite(airflowCfm) || airflowCfm <= 0) return null
  const roomTemperature = Number(design.roomState?.db ?? settings.roomTemperature ?? 22)
  const roomRh = Number(design.roomState?.rh ?? settings.roomRelativeHumidity ?? 35)
  const cityWinterTemperatures = { Montreal: -23, Montréal: -23, Quebec: -28, Québec: -28, Ottawa: -25, Toronto: -18, Vancouver: -8, Calgary: -30, Winnipeg: -35 }
  const outdoorTemperature = Number(design.outdoorState?.db ?? cityWinterTemperatures[settings.selectedCityName] ?? -23)
  const outdoorRh = Number(design.outdoorState?.rh ?? 90)
  const is100OA = Boolean(system.mode?.is100OA || Number(settings.minimumOutsideAirPercent) >= 100)
  const requestedOaPercent = Number(config.selectedOaPercent ?? config.oaMinimumPercent ?? settings.minimumOutsideAirPercent ?? 100)
  const oaPercent = is100OA ? 100 : Math.max(0, Math.min(100, requestedOaPercent))
  const indoorW = humidityRatioFromRH(roomTemperature, roomRh)
  const outdoorW = humidityRatioFromRH(outdoorTemperature, outdoorRh)
  const enteringW = outdoorW + (1 - oaPercent / 100) * (indoorW - outdoorW)
  return Math.max(0, 4.5 * airflowCfm * Math.max(0, indoorW - enteringW))
}

export default function HvacEnergyOptimizationReport({ data }) {
  const normalizedLanguage = String(data.language || 'en').toLowerCase()
  const isFrench = normalizedLanguage.startsWith('fr')
  activeReportLanguage = isFrench ? 'fr' : 'en'
  const annual = data.annualComparison || {}
  const freeCooling = annual.freeCooling || {}
  const humifog = annual.humifog || {}
  const metrics = data.metrics || {}
  const mode = data.mode || {}
  const annualTechnologyResults = data.annualTechnologyResults || {}
  const energySummary = Object.keys(annualTechnologyResults).length
    ? {
      ...(data.energySummary || {}),
      steam: {
        ...(data.energySummary?.steam || {}),
        annualEnergyKwh: annualTechnologyResults.electricSteam?.annualEnergyKWh,
        annualCost: annualTechnologyResults.electricSteam?.annualOperatingCost,
      },
      naturalGasSteam: {
        ...(data.energySummary?.naturalGasSteam || {}),
        annualEnergyKwh: annualTechnologyResults.naturalGasSteam?.annualEnergyKWh,
        annualCost: annualTechnologyResults.naturalGasSteam?.annualOperatingCost,
      },
      atmosphericGasHumidifier: {
        ...(data.energySummary?.atmosphericGasHumidifier || {}),
        annualEnergyKwh: annualTechnologyResults.atmosphericGas?.annualEnergyKWh,
        annualCost: annualTechnologyResults.atmosphericGas?.annualOperatingCost,
      },
      humifog: {
        ...(data.energySummary?.humifog || {}),
        annualEnergyKwh: annualTechnologyResults[selectedHumifogTechnology({ mode: data.mode, system: data.system })]?.annualEnergyKWh,
        annualCost: annualTechnologyResults[selectedHumifogTechnology({ mode: data.mode, system: data.system })]?.annualOperatingCost,
      },
    }
    : (data.energySummary || {})
  const system = data.system || {}
  const project = data.project || {}
  const design = data.design || {}
  const economics = data.economics || {}
  const message = data.message || {}
  const points = data.psychrometricPoints || []
  const binRows = data.binRows || []
  const binValidationRows = data.binValidationRows || []
  const optimizationRows = data.optimizationRows || []
  const conventionalRows = data.conventionalRows || []
  const optimizedRows = data.optimizedHumifogRows || []
  const pointMap = new Map(points.map((point) => [point.key, point.state]))
  const outdoor = pointMap.get('oa') || design.outdoorState
  const returnAir = pointMap.get('ra') || design.roomState
  const mixed = pointMap.get('mixed')
  const recovered = pointMap.get('recovered')
  const afterHumifog = pointMap.get('humifog')
  const afterHeating = pointMap.get('heating')
  const tr = (fr, en) => (isFrench ? fr : en)
  const is100OA = Boolean(mode.is100OA)
  const includesFreeCoolingAnalysis = Boolean(mode.includesFreeCoolingAnalysis && !is100OA)
  const showBinAnalysis = !Boolean(mode.isCustomOperatingHours)
  const selectedOaPercent = system.selectedOaPercent ?? system.oaMinimumPercent ?? system.oaPercent
  const selectedRaPercent = system.selectedRaPercent ?? Math.max(0, 100 - selectedOaPercent)
  const calculatedAverageOaPercent = system.calculatedAverageOaPercent ?? system.oaPercent
  const recoverySensibleEfficiency = Number.isFinite(Number(system.recoverySensibleEfficiency))
    ? Number(system.recoverySensibleEfficiency)
    : Number(system.recoveryEfficiency || 0)
  const recoveryLatentEfficiency = Number.isFinite(Number(system.recoveryLatentEfficiency))
    ? Number(system.recoveryLatentEfficiency)
    : 0
  const hasLatentRecovery = Boolean(system.hasLatentRecovery)
  const sectionNumbers = includesFreeCoolingAnalysis
    ? {
      design: '1',
      schematic: '2',
      psychrometric: '3',
      calculations: '4',
      ...(showBinAnalysis ? { bins: '5' } : {}),
      optimization: '6',
      freeCooling: '7',
      energy: '8',
      economics: '9',
      ghg: '10',
      graphs: '11',
      recommendation: '12',
    }
    : {
      design: '1',
      schematic: '2',
      psychrometric: '3',
      calculations: '4',
      ...(showBinAnalysis ? { bins: '5' } : {}),
      recovery: '6',
      energy: '7',
      economics: '8',
      ghg: '9',
      recommendation: '10',
    }
  const reportSectionTitle = (key, title) => `SECTION ${sectionNumbers[key]} - ${title}`
  const tocSections = [
    [sectionNumbers.design, 'Design Conditions'],
    [sectionNumbers.schematic, 'HVAC System Schematic'],
    [sectionNumbers.psychrometric, 'Psychrometric Analysis'],
    [sectionNumbers.calculations, 'Psychrometric Calculations'],
    ...(showBinAnalysis ? [[sectionNumbers.bins, 'BIN Weather Analysis']] : []),
    ...(includesFreeCoolingAnalysis
      ? [
        [sectionNumbers.optimization, 'OA / RA Optimization'],
        [sectionNumbers.freeCooling, 'Free Cooling Analysis'],
      ]
      : []),
    ...(!includesFreeCoolingAnalysis ? [[sectionNumbers.recovery, 'Energy Recovery Analysis']] : []),
    [sectionNumbers.energy, 'Energy Analysis'],
    [sectionNumbers.economics, 'Economic Analysis'],
    [sectionNumbers.ghg, 'Greenhouse Gas Analysis'],
    ...(includesFreeCoolingAnalysis ? [[sectionNumbers.graphs, tr('Graphiques', 'Graphs')]] : []),
    [sectionNumbers.recommendation, 'Engineering Recommendation'],
    ['A', 'Psychrometric Equations'],
    ...(showBinAnalysis ? [['B', 'BIN Weather Data']] : []),
    ['C', 'Calculation Assumptions'],
    ['D', 'Engineering Notes'],
  ]
  const recoveredAnnualEnergy = Math.max(0, (metrics.recoveryEnergyReductionKW || 0) * (metrics.annualHumidificationHours || 0))
  const selectedAnnualEnergy = includesFreeCoolingAnalysis
    ? (humifog.totalEnergyKwh || 0)
    : (energySummary.humifog?.annualEnergyKwh || 0)
  const noRecoveryAnnualEnergy = selectedAnnualEnergy + recoveredAnnualEnergy
  const roiRows = economics.roiRows || []
  const tenYearSavings = Number.isFinite(economics.tenYearSavings)
    ? economics.tenYearSavings
    : (annual.annualSavings || 0) * 10
  const twentyYearSavings = Number.isFinite(economics.twentyYearSavings)
    ? economics.twentyYearSavings
    : (annual.annualSavings || 0) * 20
  const treesEquivalent = Math.max(0, Math.round(((metrics.eliminatedGES || 0) * 1000) / 21.77))
  const binSavingsRows = optimizedRows.map((row, index) => ({
    label: `${formatTemp(row.tempC, data.units)}`,
    value: Math.max(0, (conventionalRows[index]?.totalEnergyKwh || 0) - row.totalEnergyKwh),
  }))
  const humifogReheatKwh = humifog.reheatEnergyKwh || 0
  const selectedHumifogAnnualResult = annualTechnologyResults[selectedHumifogTechnology({ mode, system })] || {}
  const humifogReheatThermalKwh =
    humifog.thermalReheatEnergyKwh ?? annual.humifogDebug?.thermalReheatEnergyKwh ?? selectedHumifogAnnualResult.thermalReheatKWh ?? 0
  const humifogReheatAppliedKwh =
    annual.humifogDebug?.selectedReheatEnergyKwh ?? humifog.reheatEnergyKwh ?? selectedHumifogAnnualResult.reheatKWh ?? energySummary.humifog?.annualReheatEnergyKwh ?? 0
  const humifogReheatEquivalentHeatPumpKwh =
    humifog.adiabaticReheatElectricKwh ?? annual.humifogDebug?.adiabaticReheatElectricKwh ?? 0
  const heatPumpCop = annual.humifogDebug?.heatPumpCOP ?? data.system?.heatPumpCOP ?? null
  const selectedReheatName = system.reheatMethodLabel || system.heatingType || '-'
  const selectedReheatSource = annual.humifogDebug?.selectedReheatSource || ''
  const selectedReheatBasis = selectedReheatSource === 'heatPump' && heatPumpCop
    ? `${selectedReheatName} - COP ${formatNumber(heatPumpCop, 1)}`
    : selectedReheatName
  const reheatApplies = humifogReheatKwh > 0.5 || humifogReheatThermalKwh > 0.5 || humifogReheatAppliedKwh > 0.5
  const projectSystems = Array.isArray(data.projectSystems) && data.projectSystems.length
    ? data.projectSystems
    : [{ name: system.type || 'AHU-1', mode, system, economics, annualTechnologyResults }]
  const projectEnergy = summarizeProjectEnergy(projectSystems)
  const buildingSavings = summarizeBuildingSavings(projectSystems)
  const isMultiSystemReport = projectSystems.length > 1
  const economicAnnualSavings = isMultiSystemReport
    ? buildingSavings.totals.costSavings
    : (includesFreeCoolingAnalysis ? annual.annualSavings : energySummary.annualSavingsVsSteam)
  const economicPayback = isMultiSystemReport
    ? Number.isFinite(buildingSavings.totals.simplePaybackYears)
      ? `${formatNumber(buildingSavings.totals.simplePaybackYears, 1)} ${tr('ans', 'years')}`
      : '-'
    : economics.estimatedPayback
  const economicTenYearSavings = isMultiSystemReport
    ? buildingSavings.totals.costSavings * 10
    : tenYearSavings
  const economicTwentyYearSavings = isMultiSystemReport
    ? buildingSavings.totals.costSavings * 20
    : twentyYearSavings
  const technologyNames = {
    electricSteam: tr('Vapeur électrique', 'Electric Steam'),
    naturalGasSteam: tr('Vapeur gaz naturel', 'Natural Gas Steam'),
    atmosphericGas: tr('Humidificateur gaz atmosphérique', 'Atmospheric Gas Humidifier'),
    humifogSelected: tr('Humifog - solution sélectionnée', 'Humifog - Selected Solution'),
    humifogElectric: tr('Humifog + réchauffage électrique', 'Humifog + Electric Reheat'),
    humifogHeatPump: tr('Humifog + thermopompe Air/Eau', 'Humifog + Air/Water Heat Pump'),
    humifogFreeCooling: tr('Humifog + Free Cooling', 'Humifog + Free Cooling'),
  }
  const selectedHumifogKey = selectedHumifogTechnology({ mode, system })
  const pdfAnnualTechnologyKeys = [...BASELINE_TECHNOLOGIES, selectedHumifogKey]
  const pdfAnnualReferenceKey = selectedReferenceTechnology({ economics }, 'electricSteam')
  const pdfAnnualReference = annualTechnologyResults[pdfAnnualReferenceKey] || {}
  const pdfAnnualHumifog = annualTechnologyResults[selectedHumifogKey] || {}
  const pdfDetailedAnnualRows = [
    { key: 'heatingKWh', label: tr('Énergie annuelle chauffage', 'Annual heating energy'), cost: false },
    { key: 'humidificationKWh', label: tr('Énergie annuelle humidification', 'Annual humidification energy'), cost: false },
    { key: 'thermalReheatKWh', label: tr('Réchauffage thermique Humifog requis', 'Humifog thermal reheat requirement'), cost: false, humifogOnly: true },
    { key: 'reheatInputKWh', label: tr('Énergie d’entrée du réchauffage Humifog', 'Humifog reheat input energy'), cost: false, humifogOnly: true },
    { key: 'reheatKWh', label: tr('Énergie annuelle réchauffage', 'Annual reheat energy'), cost: false },
    { key: 'pumpKWh', label: tr('Énergie pompe Humifog', 'Humifog pump energy'), cost: false, humifogOnly: true },
    ...(selectedHumifogKey === 'humifogFreeCooling'
      ? [{ key: 'freeCoolingObtainedKWh', label: tr('Énergie de chauffage évitée grâce au Free Cooling', 'Heating Energy Avoided by Free Cooling'), cost: false, humifogOnly: true }]
      : []),
    { key: 'annualEnergyKWh', label: tr('Énergie annuelle totale', 'Total annual energy'), cost: false },
    { key: 'annualOperatingCost', label: tr('Coût annuel total', 'Total annual cost'), cost: true },
    { key: 'annualSavings', label: tr('Économie annuelle nette', 'Net annual savings'), cost: true, humifogOnly: true },
  ]
  const pdfDetailedValue = (row, key) => {
    if (row.humifogOnly && key !== selectedHumifogKey) return null
    if (row.key === 'annualSavings') return Number(pdfAnnualReference.annualOperatingCost) - Number(pdfAnnualHumifog.annualOperatingCost)
    const value = annualTechnologyResults[key]?.[row.key]
    return Number.isFinite(Number(value)) ? Number(value) : undefined
  }
  const buildingAnnualTechnologyKeys = [...BASELINE_TECHNOLOGIES, 'humifogSelected']
  const buildingAnnualValue = (key, field) => projectEnergy.totals[key]?.[field]
  const buildingAnnualRows = [
    { key: 'annualEnergyKWh', label: tr('Énergie annuelle totale', 'Total annual energy'), cost: false },
    { key: 'annualOperatingCost', label: tr('Coût annuel total', 'Total annual cost'), cost: true },
    { key: 'annualSavings', label: tr('Économies annuelles vs référence sélectionnée', 'Annual savings vs selected reference'), cost: true },
    { key: 'energyReductionPercent', label: tr('Réduction énergétique vs référence sélectionnée', 'Energy reduction vs selected reference'), cost: false, percent: true },
  ]
  const formatPdfDetailedValue = (row, value) => {
    if (value === null) return tr('Non applicable', 'Not applicable')
    if (!Number.isFinite(value)) return tr('Non disponible', 'Not available')
    return row.cost ? formatMoney(value) : formatEnergy(value)
  }
  const buildingTechnologyRows = [...BASELINE_TECHNOLOGIES, 'humifogSelected']
    .filter((key) => projectEnergy.totals[key].applicableSystems > 0)
  const projectPayback = (value, status = 'notAvailable') => Number.isFinite(value)
    ? `${formatNumber(value, 1)} ${tr('ans', 'years')}`
    : status === 'immediate'
      ? tr('Immédiat', 'Immediate')
      : status === 'notEconomical'
        ? tr('Non rentable', 'Not economical')
        : tr('Non disponible', 'Not available')
  const projectRoi = (value) => Number.isFinite(value) ? `${formatNumber(value, 1)}%` : '-'
  const equipmentCostCompositionRows = isMultiSystemReport
    ? projectSystems.flatMap((projectSystem, index) => {
      const systemBreakdown = projectSystem.economics?.installedCostBreakdown || {}
      const systemReference = buildingSavings.bySystem[index]?.savings?.referenceTechnology
      const systemTechnologies = [...BASELINE_TECHNOLOGIES, 'humifog']
      return systemTechnologies
        .filter((key) => systemBreakdown[key])
        .map((key) => ({
          label: `${projectSystem.name || projectSystem.system?.type || `AHU-${index + 1}`} - ${technologyNames[key] || key}`,
          reference: systemReference === (key === 'humifog' ? selectedHumifogTechnology(projectSystem) : key),
          ...systemBreakdown[key],
        }))
    })
    : roiRows.map((row) => {
      const breakdownKey = row.key === 'atmosphericGasHumidifier' ? 'atmosphericGasHumidifier' : row.key === 'humifog' ? 'humifog' : row.key
      return {
        label: row.label,
        reference: row.reference,
        ...(economics.installedCostBreakdown?.[breakdownKey] || {
          base: row.installedCost,
          heatRecoveryAdder: 0,
          freeCoolingControlsAdder: 0,
          total: row.installedCost,
        }),
      }
    })
  const hourlyWeatherDataSummary = mode.hourlyWeatherDataSummary || null
  const hourlyWeatherSummaryRows = hourlyWeatherDataSummary
    ? [
      [tr('Ville sélectionnée', 'Selected city'), hourlyWeatherDataSummary.selectedCity || '-'],
      [tr('Source météo', 'Weather source'), hourlyWeatherDataSummary.weatherSource || '-'],
      [tr('Organisation', 'Organization'), hourlyWeatherDataSummary.sourceOrganization || '-'],
      [tr('Type de fichier', 'File type'), hourlyWeatherDataSummary.climateFileType || '-'],
      [tr('Fichier chargé', 'Loaded file'), hourlyWeatherDataSummary.loadedFile || '-'],
      [tr('Validation', 'Validation'), hourlyWeatherDataSummary.validation || '-'],
      [tr('Enregistrements horaires', 'Hourly records'), `${formatNumber(hourlyWeatherDataSummary.recordsLoaded || 0, 0)}`],
      [tr('Heures d’exploitation utilisées', 'Operating hours used'), `${formatNumber(hourlyWeatherDataSummary.operatingHoursUsed || 0, 0)}`],
      [tr('Température extérieure moyenne', 'Average outdoor temperature'), `${formatNumber(hourlyWeatherDataSummary.averageOutdoorTemp || 0, 1)} °C`],
      [tr('Température extérieure minimale', 'Minimum outdoor temperature'), `${formatNumber(hourlyWeatherDataSummary.minOutdoorTemp || 0, 1)} °C`],
      [tr('Température extérieure maximale', 'Maximum outdoor temperature'), `${formatNumber(hourlyWeatherDataSummary.maxOutdoorTemp || 0, 1)} °C`],
      [tr('Humidité relative extérieure moyenne', 'Average outdoor RH'), `${formatNumber(hourlyWeatherDataSummary.averageOutdoorRh || 0, 1)}%`],
    ]
    : []
  const hourlyWeatherCompactRows = hourlyWeatherDataSummary
    ? [
      [tr('Heures d’exploitation utilisées', 'Operating hours used'), `${formatNumber(hourlyWeatherDataSummary.operatingHoursUsed || 0, 0)}`],
      [tr('Heures sous 0°C', 'Hours below 0°C'), `${formatNumber(hourlyWeatherDataSummary.hoursBelowZero || 0, 0)}`],
      [tr('Heures sous -10°C', 'Hours below -10°C'), `${formatNumber(hourlyWeatherDataSummary.hoursBelowMinusTen || 0, 0)}`],
      [tr('Heures sous -20°C', 'Hours below -20°C'), `${formatNumber(hourlyWeatherDataSummary.hoursBelowMinusTwenty || 0, 0)}`],
      [tr('Heures avec humidification requise', 'Hours requiring humidification'), `${formatNumber(hourlyWeatherDataSummary.hoursWithHumidificationRequired || 0, 0)}`],
    ]
    : []
  const formatHumidificationLoad = (value) => {
    if (!Number.isFinite(Number(value))) return tr('Non disponible', 'Not available')
    const poundsPerHour = Number(value || 0)
    const kilogramsPerHour = poundsPerHour * 0.45359237
    return `${formatNumber(kilogramsPerHour, 2)} kg/hr (${formatNumber(poundsPerHour, 2)} lb/hr)`
  }
  const reportInputValidationRows = [
    [tr('Emplacement du projet', 'Project location'), project.location || '-'],
    [tr('Mode du rapport', 'Report mode'), includesFreeCoolingAnalysis ? tr('Free Cooling', 'Free Cooling') : tr('100% air extérieur', '100% Outdoor Air')],
    [tr('Mode de ventilation sélectionné', 'Ventilation mode selected'), mode.ventilationModeName || '-'],
    [tr('Mode d’exploitation', 'Operating mode'), mode.selectedCalculationMethod?.toLowerCase().includes('hourly')
      ? tr('Simulation météo horaire 8760', 'Hourly weather simulation 8760')
      : mode.isCustomOperatingHours
        ? tr('Heures d’exploitation personnalisées', 'Custom operating hours')
        : tr('Heures BIN', 'BIN hours')],
    [tr('Méthode de calcul', 'Calculation method selected'), mode.selectedCalculationMethod || '-'],
    [tr('Source météo', 'Weather data source'), mode.weatherDataSource || tr('Gouvernement du Canada — CWEC_FMCCE / fichier météo horaire EPW', 'Government of Canada — CWEC_FMCCE / EPW hourly weather file')],
    [tr('Organisation', 'Weather source organization'), mode.weatherSourceOrganization || tr('Environnement et Changement climatique Canada', 'Environment and Climate Change Canada')],
    [tr('Type de fichier', 'Weather climate file type'), mode.weatherClimateFileType || '-'],
    [tr('Validation', 'Weather file validation status'), mode.weatherValidationStatus || '-'],
    [tr('Fichier chargé', 'Hourly weather file'), mode.hourlyWeatherFileName || '-'],
    [tr('Localisation du fichier météo', 'Hourly weather location'), mode.hourlyWeatherFileLocation || '-'],
    [tr('Enregistrements horaires', 'Hourly weather records loaded'), `${mode.hourlyWeatherRecordsLoaded || 0}`],
    [tr('Heures d’exploitation utilisées', 'Hourly operating hours used'), `${mode.hourlyWeatherOperatingHoursUsed || 0}`],
    [tr('Statut du fichier météo horaire', 'Hourly weather file status'), mode.hourlyWeatherParseError ? `${tr('Erreur', 'Error')}: ${mode.hourlyWeatherParseError}` : 'OK'],
    ...(mode.selectedCalculationMethod?.toLowerCase().includes('hourly') && mode.hourlyAnnualResults
      ? [
        [tr('Énergie annuelle vapeur', 'Annual steam kWh'), `${formatNumber(mode.hourlyAnnualResults.annualSteamKwh || 0, 0)} kWh/year`],
        [tr('Énergie annuelle gaz', 'Annual gas kWh'), `${formatNumber(mode.hourlyAnnualResults.annualGasKwh || 0, 0)} kWh/year`],
        [tr('Énergie annuelle Humifog', 'Annual Humifog kWh'), `${formatNumber(mode.hourlyAnnualResults.annualHumifogKwh || 0, 0)} kWh/year`],
        [tr('Coût annuel', 'Annual cost'), `${formatNumber(mode.hourlyAnnualResults.annualCost || 0, 0)} $/year`],
        [tr('Économies annuelles', 'Annual savings'), `${formatNumber(mode.hourlyAnnualResults.annualSavings || 0, 0)} $/year`],
        [tr('Réduction annuelle de GES', 'Annual GHG reduction'), `${formatNumber(mode.hourlyAnnualResults.annualGhgReduction || 0, 3)} tCO2e/year`],
        [tr('Consommation annuelle d’eau', 'Annual water consumption'), `${formatNumber(mode.hourlyAnnualResults.annualWaterConsumptionKg || 0, 0)} kg/year`],
      ]
      : []),
    ['Airflow entered in software', formatFlow(system.supplyAirflowCfm, data.units)],
    [includesFreeCoolingAnalysis ? 'Minimum OA entered in software' : 'OA entered in software', `${formatNumber(selectedOaPercent, 0)}%`],
    [includesFreeCoolingAnalysis ? 'RA available from software input' : 'RA shown in report', `${formatNumber(selectedRaPercent, 0)}%`],
    ['Outdoor design dry bulb used by PDF', formatTemp(outdoor?.db ?? design.outdoorState?.db, data.units)],
    ['Room dry bulb entered in software', formatTemp(returnAir?.db ?? design.roomState?.db, data.units)],
    ['Room RH entered in software', `${formatNumber(returnAir?.rh ?? design.roomState?.rh, 0)}%`],
    ['Recovery type selected', system.recoveryType || '-'],
    [tr('Efficacité sensible sélectionnée', 'Sensible recovery efficiency selected'), `${formatNumber(recoverySensibleEfficiency, 0)}%`],
    ...(hasLatentRecovery
      ? [[tr('Efficacité latente sélectionnée', 'Latent recovery efficiency selected'), `${formatNumber(recoveryLatentEfficiency, 0)}%`]]
      : []),
    ['Reheat / preheat method selected', selectedReheatName],
    ['Electricity rate entered', `${formatNumber(economics.electricityRate, 2)} $/kWh`],
    ['Natural gas rate entered', `${formatNumber(economics.naturalGasRate, 2)} $/m3`],
    ['Operating schedule', `${data.metrics?.scheduleDescription || ''}`],
    ['Schedule factor', `${formatNumber(data.metrics?.scheduleFactor * 100, 1)}%`],
    ['Annual humidification hours used', `${formatNumber(energySummary.annualHumidificationHours, 0)} h`],
    ...(includesFreeCoolingAnalysis
      ? [
        ['Calculated average Steam OA in report', `${formatNumber(freeCooling.averageOa, 1)}%`],
        ['Calculated average Humifog OA in report', `${formatNumber(humifog.averageOa, 1)}%`],
        ['Humifog reheat method used by PDF', selectedReheatName],
        ['Humifog reheat energy used by PDF', reheatApplies ? formatEnergy(humifogReheatAppliedKwh) : 'Not required'],
      ]
      : []),
  ]
  const systemValidationRows = projectSystems.map((projectSystem, index) => {
    const systemMode = projectSystem.mode || {}
    const systemConfig = projectSystem.system || {}
    const systemDesign = projectSystem.design || {}
    const systemMetrics = projectSystem.metrics || {}
    const systemResults = projectSystem.annualTechnologyResults || projectSystem.results || {}
    const systemEconomics = projectSystem.economics || {}
    const systemOutdoor = systemDesign.outdoorState
    const systemRoom = systemDesign.roomState
    const systemOaPercent = systemConfig.selectedOaPercent ?? systemConfig.oaMinimumPercent ?? systemConfig.oaPercent
    const systemRaPercent = systemConfig.selectedRaPercent ?? systemConfig.raPercent ?? Math.max(0, 100 - systemOaPercent)
    return {
      name: projectSystem.name || systemConfig.type || `AHU-${index + 1}`,
      rows: [
        [tr('Nom du système', 'System name'), projectSystem.name || systemConfig.type || `AHU-${index + 1}`],
        [tr('Emplacement du projet', 'Project location'), projectSystem.project?.location || project.location || '-'],
        [tr('Mode de ventilation', 'Ventilation mode'), systemMode.ventilationModeName || '-'],
        [tr('Mode d’exploitation', 'Operating mode'), systemMode.isCustomOperatingHours ? tr('Heures personnalisées', 'Custom operating hours') : tr('Heures BIN', 'BIN hours')],
        [tr('Méthode de calcul', 'Calculation method'), systemMode.selectedCalculationMethod || '-'],
        ['Airflow entered in software', formatFlow(systemConfig.supplyAirflowCfm, data.units)],
        [systemMode.includesFreeCoolingAnalysis ? 'Minimum OA entered in software' : 'OA entered in software', `${formatNumber(systemOaPercent, 0)}%`],
        [systemMode.includesFreeCoolingAnalysis ? 'RA available from software input' : 'RA shown in report', `${formatNumber(systemRaPercent, 0)}%`],
        ['Outdoor design dry bulb used by PDF', formatTemp(systemOutdoor?.db, data.units)],
        ['Room dry bulb entered in software', formatTemp(systemRoom?.db, data.units)],
        ['Room RH entered in software', `${formatNumber(systemRoom?.rh, 0)}%`],
        ['Recovery type selected', systemConfig.recoveryType || '-'],
        [tr('Efficacité sensible sélectionnée', 'Sensible recovery efficiency selected'), `${formatNumber(systemConfig.recoverySensibleEfficiency ?? systemConfig.recoveryEfficiency, 0)}%`],
        ['Reheat / preheat method selected', systemConfig.reheatMethodLabel || systemConfig.heatingType || '-'],
        ['Electricity rate entered', `${formatNumber(systemEconomics.electricityRate, 2)} $/kWh`],
        ['Natural gas rate entered', `${formatNumber(systemEconomics.naturalGasRate, 2)} $/m3`],
        ['Operating schedule', `${systemMetrics.scheduleDescription || ''}`],
        [tr('Charge massique d’humidification', 'Humidification mass load'), formatHumidificationLoad(systemMetrics.correctedHumidificationLoadRaw ?? systemMetrics.correctedHumidificationLoad ?? systemResults.electricSteam?.humidificationLoadLbHr ?? fallbackHumidificationLoadLbHr(projectSystem))],
        ['Annual humidification hours used', `${formatNumber(systemMetrics.annualHumidificationHours, 0)} h`],
        [tr('Statut météo', 'Weather validation status'), systemMode.weatherValidationStatus || '-'],
      ],
    }
  })
  const annualBreakdown = [
    { label: 'Heating', value: freeCooling.heatingEnergyKwh || 0, color: '#ef4444' },
    { label: 'Humidification', value: humifog.humidificationEnergyKwh || 0, color: '#0ea5e9' },
    { label: 'Reheat', value: humifogReheatAppliedKwh, color: '#f97316' },
  ]
  const freeCoolingOperatingHours = binRows.reduce((total, row) => {
    const minimumOa = Number(row.minimumOutdoorAirPercent ?? system.oaMinimumPercent ?? 0)
    return total + (Number(row.outdoorAirPercent) > minimumOa + 0.05 ? Number(row.hours || 0) : 0)
  }, 0)
  const freeCoolingOperatingRows = [
    [tr('OA moyen', 'Average OA'), `${formatNumber(freeCooling.averageAppliedOa ?? freeCooling.averageOa, 1)}%`, `${formatNumber(humifog.averageAppliedOa ?? humifog.averageOa, 1)}%`, `${formatNumber((humifog.averageAppliedOa ?? 0) - (freeCooling.averageAppliedOa ?? 0), 1)} points`],
    [tr('RA moyen', 'Average RA'), `${formatNumber(100 - (freeCooling.averageAppliedOa ?? freeCooling.averageOa ?? 0), 1)}%`, `${formatNumber(100 - (humifog.averageAppliedOa ?? humifog.averageOa ?? 0), 1)}%`, `${formatNumber((freeCooling.averageAppliedOa ?? 0) - (humifog.averageAppliedOa ?? 0), 1)} points`],
    [tr('Température moyenne de mélange', 'Average mixed-air temperature'), formatTemp(freeCooling.averageMixedDb, data.units, data.language), formatTemp(humifog.averageMixedDb, data.units, data.language), formatTemp((freeCooling.averageMixedDb ?? 0) - (humifog.averageMixedDb ?? 0), data.units, data.language)],
    [tr('Température avant Humifog', 'Temperature before Humifog'), '-', formatTemp(humifog.averageInletToHumifogDb, data.units, data.language), '-'],
    [tr('Température après Humifog', 'Temperature after Humifog'), '-', formatTemp(humifog.averageAfterHumifogDb, data.units, data.language), '-'],
    [tr('Heures de fonctionnement Free Cooling', 'Free Cooling operating hours'), `${formatNumber(freeCoolingOperatingHours, 0)} h`, `${formatNumber(freeCoolingOperatingHours, 0)} h`, '-'],
    [tr('Énergie de chauffage évitée grâce au Free Cooling', 'Heating Energy Avoided by Free Cooling'), formatEnergy(freeCooling.freeCoolingObtainedKwh), formatEnergy(humifog.freeCoolingObtainedKwh), formatEnergy(humifog.freeCoolingObtainedKwh ?? 0)],
    [tr('Besoin thermique annuel de réchauffage Humifog', 'Annual Humifog thermal reheat requirement'), '-', formatEnergy(humifogReheatThermalKwh), '-'],
    [tr('Énergie d’entrée réellement consommée pour le réchauffage', 'Actual reheat input energy consumed'), '-', formatEnergy(humifogReheatAppliedKwh), '-'],
    [tr('Énergie pompe Humifog', 'Humifog pump energy'), '-', formatEnergy(humifog.humidificationEnergyKwh), '-'],
    [tr('Énergie électrique totale réelle Humifog applicable au Free Cooling', 'Actual Humifog total energy applicable to Free Cooling'), '-', formatEnergy(humifog.totalEnergyKwh), '-'],
  ]
  const criticalReheatRow = binValidationRows.reduce(
    (critical, row) => (row.reheatLoadKw || 0) > (critical?.reheatLoadKw || -1) ? row : critical,
    null
  )
  const projectScope = projectSystems.length > 1
  ? tr(
      `Rapport d’optimisation énergétique du bâtiment comprenant ${projectSystems.length} systèmes HVAC avec analyse Humifog.`,
      `Building energy optimization report covering ${projectSystems.length} HVAC systems with Humifog analysis.`
    )
  : includesFreeCoolingAnalysis
    ? tr('Rapport d’optimisation Free Cooling + Humifog pour une UTA à air mélangé.', 'Free Cooling + Humifog optimization report for a mixed air AHU.')
    : tr('Rapport système 100 % air extérieur. Les sections Free Cooling / optimisation OA-RA ne sont pas incluses pour cette configuration.', '100% outdoor air system report. Free Cooling / OA / RA optimization sections are not included for this configuration.')
  const recommendationText = includesFreeCoolingAnalysis
    ? {
      fr: 'Humidification adiabatique Humifog avec contrôle optimisé de l’air extérieur',
      en: 'Humifog adiabatic humidification with optimized outdoor air control',
    }
    : {
      fr: 'Humidification adiabatique Humifog selon la configuration UTA sélectionnée',
      en: 'Humifog adiabatic humidification on the selected AHU configuration',
    }
  const selectedTechnology = cleanFrenchPdfText(isFrench ? recommendationText.fr : recommendationText.en, isFrench)
  const electricityRate = economics.electricityRate || 0
  const naturalGasRate = economics.naturalGasRate || 0
  const steamBoilerEfficiency = economics.steamBoilerEfficiency || 82
  const atmosphericGasHumidifierEfficiency = economics.atmosphericGasHumidifierEfficiency || 82
  const freeCoolingSteamHumidificationKwh = freeCooling.humidificationEnergyKwh || 0
  const freeCoolingCommonElectricKwh = Math.max(0, (freeCooling.totalEnergyKwh || 0) - freeCoolingSteamHumidificationKwh)
  const freeCoolingNaturalGasHumidificationKwh =
    freeCoolingSteamHumidificationKwh / Math.max(steamBoilerEfficiency / 100, 0.01)
  const freeCoolingAtmosphericGasHumidificationKwh =
    freeCoolingSteamHumidificationKwh / Math.max(atmosphericGasHumidifierEfficiency / 100, 0.01)
  const freeCoolingTechnologyOptions = [
    {
      label: tr('Vapeur électrique', 'Electric Steam'),
      basis: tr('Vapeur + économiseur', 'Steam + economizer'),
      annualEnergyKwh: freeCooling.totalEnergyKwh || 0,
      annualCost: freeCooling.annualCost || 0,
    },
    {
      label: tr('Vapeur gaz naturel', 'Natural Gas Steam'),
      basis: tr(
        `${formatNumber(steamBoilerEfficiency, 0)}% rendement de la chaudière vapeur`,
        `${formatNumber(steamBoilerEfficiency, 0)}% boiler efficiency`
      ),
      annualEnergyKwh: freeCoolingCommonElectricKwh + freeCoolingNaturalGasHumidificationKwh,
      annualCost:
        freeCoolingCommonElectricKwh * electricityRate +
        (freeCoolingNaturalGasHumidificationKwh / 10.35) * naturalGasRate,
    },
    {
      label: tr('Humidificateur gaz atmosphérique', 'Atmospheric Gas'),
      basis: tr(
        `${formatNumber(atmosphericGasHumidifierEfficiency, 0)}% rendement de l’humidificateur gaz atmosphérique`,
        `${formatNumber(atmosphericGasHumidifierEfficiency, 0)}% gas humidifier efficiency`
      ),
      annualEnergyKwh: freeCoolingCommonElectricKwh + freeCoolingAtmosphericGasHumidificationKwh,
      annualCost:
        freeCoolingCommonElectricKwh * electricityRate +
        (freeCoolingAtmosphericGasHumidificationKwh / 10.35) * naturalGasRate,
    },
    {
      label: tr('Humifog + Free Cooling', 'Humifog + Free Cooling'),
      basis: `Pump + ${selectedReheatBasis}`,
      annualEnergyKwh: humifog.totalEnergyKwh || 0,
      annualCost: humifog.annualCost || 0,
    },
  ]
  const lowestAnnualCostOption = freeCoolingTechnologyOptions.reduce(
    (best, option) => option.annualCost < best.annualCost ? option : best,
    freeCoolingTechnologyOptions[0]
  )
  const executiveRecommendationOptions = includesFreeCoolingAnalysis
    ? [
      { label: tr('Vapeur électrique', 'Electric Steam'), annualCost: freeCoolingTechnologyOptions[0]?.annualCost },
      { label: tr('Vapeur gaz naturel', 'Natural Gas Steam'), annualCost: freeCoolingTechnologyOptions[1]?.annualCost },
      { label: tr('Humidificateur gaz atmosphérique', 'Atmospheric Gas Humidifier'), annualCost: freeCoolingTechnologyOptions[2]?.annualCost },
      { label: tr('Humidification adiabatique Humifog', 'Humifog adiabatic humidification'), annualCost: freeCoolingTechnologyOptions[3]?.annualCost },
    ]
    : [
      { label: tr('Vapeur électrique', 'Electric Steam'), annualCost: energySummary.steam?.annualCost },
      { label: tr('Vapeur gaz naturel', 'Natural Gas Steam'), annualCost: energySummary.naturalGasSteam?.annualCost },
      { label: tr('Humidificateur gaz atmosphérique', 'Atmospheric Gas Humidifier'), annualCost: energySummary.atmosphericGasHumidifier?.annualCost },
      { label: tr('Humidification adiabatique Humifog', 'Humifog adiabatic humidification'), annualCost: energySummary.humifog?.annualCost },
    ]
  const executiveRecommendation = executiveRecommendationOptions.reduce((best, option) => {
    const optionCost = Number(option.annualCost)
    const bestCost = Number(best.annualCost)
    const safeOptionCost = Number.isFinite(optionCost) ? optionCost : Number.POSITIVE_INFINITY
    const safeBestCost = Number.isFinite(bestCost) ? bestCost : Number.POSITIVE_INFINITY
    return safeOptionCost < safeBestCost ? option : best
  }, executiveRecommendationOptions[0] || { label: selectedTechnology, annualCost: Number.POSITIVE_INFINITY })

  return (
    <article className="engineering-report">
      <style>{PROFESSIONAL_REPORT_CSS}</style>
      <header className="report-cover page-break">
        <div className="cover-topline">
          <span className="cover-logo-lockup">
            <span className="cover-logo-card" role="img" aria-label="HESA Humidification Energy System Analysis">
              <span className="cover-logo-title">HESA</span>
              <span className="cover-logo-accent" aria-hidden="true" />
              <span className="cover-logo-subtitle">{tr('Analyse énergétique des systèmes d’humidification', 'Humidification Energy System Analysis')}</span>
            </span>
            <span>ENERSOL / CAREL</span>
          </span>
          <span>Professional HVAC Engineering Report</span>
        </div>
        <div className="cover-title-block">
          <div className="cover-brand">HESA Energy Engineering Platform</div>
          <h1>HVAC ENERGY OPTIMIZATION REPORT</h1>
          <p className="cover-subtitle">Prepared for technical review, energy comparison and preliminary decision support</p>
          <div className="cover-badges">
  {projectSystems.length > 1 ? (
    <>
      <span className="cover-badge">
        {tr('Rapport bâtiment multi-systèmes', 'Multi-System Building Report')}
      </span>
      <span className="cover-badge">
        {`${projectSystems.length} ${tr('systèmes HVAC', 'HVAC systems')}`}
      </span>
    </>
  ) : (
    <>
      <span className="cover-badge">{system.type}</span>
      <span className="cover-badge">{system.recoveryType}</span>
      <span className="cover-badge">{mode.ventilationModeName || 'Selected System'}</span>
    </>
  )}
</div>
        </div>
        <div className="document-meta-row">
          <span>Document status: Preliminary engineering report</span>
          <span>Revision: HESA generated</span>
          <span>Units: {data.units === 'imperial' ? 'IP' : 'SI'}</span>
        </div>
        <div className="cover-grid">
          <div>
            <h3>Project Profile</h3>
            <div className="cover-meta">
              <KeyValueTable rows={[
                ['Project Name', project.name],
                ['Project Location', project.location],
                ['Prepared For', project.preparedFor],
                ['Prepared By', project.preparedBy],
                ['Engineer / Representative', project.engineerOrRepresentative || project.preparedBy],
                ['Date', project.date],
                ['Software Version', project.softwareVersion],
              ]} />
            </div>
            <div className="cover-summary">
              <strong>Project Scope</strong>
              <div>{projectScope}</div>
            </div>
            <div className="cover-certification">
              <strong>Engineering Use Notice</strong>
              <span>
                Results are generated from the displayed HESA inputs and are intended for preliminary HVAC comparison.
                Final equipment sizing, code compliance and stamped design remain by the engineer of record.
              </span>
            </div>
          </div>
          {projectSystems.length === 1 && system.imageSrc && (
            <figure className="cover-figure">
              <img src={system.imageSrc} alt={system.imageAlt || system.recoveryType} />
              <figcaption>Selected System - {system.imageAlt || system.recoveryType}</figcaption>
            </figure>
          )}
        </div>
                <div className="cover-kpi-row">
          <div className="cover-kpi">
            <span>
              {projectSystems.length > 1
                ? tr("Débit d'air total du bâtiment", 'Total Building Airflow')
                : tr("Débit d'air", 'Airflow')}
            </span>
            <strong>
              {formatFlow(
                projectSystems.length > 1
                  ? projectSystems.reduce(
                      (total, item) =>
                        total + Number(item.system?.supplyAirflowCfm || 0),
                      0
                    )
                  : system.supplyAirflowCfm,
                data.units
              )}
            </strong>
          </div>

          <div className="cover-kpi">
            <span>
              {projectSystems.length > 1
                ? tr('Nombre de systèmes HVAC', 'Number of HVAC Systems')
                : includesFreeCoolingAnalysis
                  ? 'Selected Minimum OA'
                  : 'OA %'}
            </span>
            <strong>
              {projectSystems.length > 1
                ? projectSystems.length
                : `${formatNumber(selectedOaPercent, 0)}%`}
            </strong>
          </div>

          <div className="cover-kpi">
            <span>
              {projectSystems.length > 1
                ? tr("Économies d'énergie annuelles", 'Annual Energy Savings')
                : hasLatentRecovery
                  ? tr('Récupération (S/L)', 'Recovery Efficiency (S/L)')
                  : tr('Efficacité de récupération', 'Recovery Efficiency')}
            </span>
            <strong>
              {projectSystems.length > 1
                ? formatEnergy(buildingSavings.totals.energySavings)
                : hasLatentRecovery
                  ? `${formatNumber(recoverySensibleEfficiency, 0)}% / ${formatNumber(recoveryLatentEfficiency, 0)}%`
                  : `${formatNumber(recoverySensibleEfficiency, 0)}%`}
            </strong>
          </div>

          <div className="cover-kpi">
            <span>
              {projectSystems.length > 1
                ? tr('Économies annuelles de coût', 'Annual Cost Savings')
                : tr('Type de chauffage', 'Heating Type')}
            </span>
            <strong>
              {projectSystems.length > 1
                ? formatMoney(buildingSavings.totals.costSavings)
                : selectedReheatName}
            </strong>
          </div>
        </div>
      </header>

      <ReportSection title={tr('BILAN ÉNERGÉTIQUE GLOBAL DU BÂTIMENT', 'BUILDING ENERGY SUMMARY')} pageBreak allowPageBreak>
        <KeyValueTable rows={[
          [tr('Systèmes HVAC actifs', 'Active HVAC systems'), `${projectSystems.length}`],
          [tr('Débit total du bâtiment', 'Total building airflow'), formatFlow(projectSystems.reduce((total, item) => total + Number(item.system?.supplyAirflowCfm || 0), 0), data.units)],
          [tr('Base horaire du bâtiment', 'Building operating-hour basis'), projectEnergy.operatingHourBasis === 'mixed' ? tr('Mixtes', 'Mixed') : (projectEnergy.operatingHourBasis || '-')],
          [tr('Scénario de référence du bâtiment', 'Building Reference Scenario'), projectEnergy.referenceTechnology ? technologyNames[projectEnergy.referenceTechnology] : tr('Référence bâtiment sélectionnée par UTA', 'Mixed selected building reference')],
          [tr('Solutions Humifog sélectionnées', 'Humifog - Selected Solutions'), tr('Solution sélectionnée par UTA', 'Selected solution per HVAC system')],
          [tr('Énergie de référence totale', 'Total reference energy'), formatEnergy(buildingSavings.totals.referenceEnergy)],
          [tr('Énergie Humifog totale', 'Total Humifog energy'), formatEnergy(buildingSavings.totals.humifogEnergy)],
          [tr('Économies d’énergie totales', 'Total energy savings'), formatEnergy(buildingSavings.totals.energySavings)],
          [tr('Réduction d’énergie totale', 'Total energy reduction'), Number.isFinite(buildingSavings.totals.energyReductionPercent) ? `${formatNumber(buildingSavings.totals.energyReductionPercent, 1)}%` : tr('Non disponible', 'Not available')],
          [tr('Coût de référence total', 'Total reference operating cost'), formatMoney(buildingSavings.totals.referenceCost)],
          [tr('Coût Humifog total', 'Total Humifog operating cost'), formatMoney(buildingSavings.totals.humifogCost)],
          [tr('Économies de coût annuelles totales', 'Total annual cost savings'), formatMoney(buildingSavings.totals.costSavings)],
          [tr('Investissement incrémental total', 'Total incremental investment'), formatMoney(buildingSavings.totals.incrementalInvestment)],
          [tr('Retour simple total', 'Total simple payback'), projectPayback(buildingSavings.totals.simplePaybackYears, buildingSavings.totals.paybackStatus)],
          [tr('ROI annuel simple total', 'Total annual simple ROI'), Number.isFinite(buildingSavings.totals.simpleAnnualRoiPercent) ? `${formatNumber(buildingSavings.totals.simpleAnnualRoiPercent, 1)}%` : tr('Non disponible', 'Not available')],
        ]} />
        <h3>{tr('Bases horaires par système', 'Operating-hour basis by system')}</h3>
        <KeyValueTable rows={projectEnergy.systemHourBases.map((entry) => [entry.name, entry.basis || '-'])} />
        <h3>{tr('Configuration Humifog par système', 'Humifog configuration by system')}</h3>
        <KeyValueTable rows={projectEnergy.systemHourBases.map((entry) => [entry.name, technologyNames[entry.humifogTechnology] || '-'])} />
        <h3>{tr('Totaux annuels du bâtiment', 'Building annual totals')}</h3>
        <table className="report-table compact">
          <thead>
            <tr>
              <th>{tr('Technologie', 'Technology')}</th>
              <th>{tr('Énergie annuelle', 'Annual Energy')}</th>
              <th>{tr('Coût annuel', 'Annual Operating Cost')}</th>
              <th>{tr('Investissement installé', 'Installed Investment')}</th>
              <th>{tr('Économies coût vs référence', 'Cost Savings vs Reference')}</th>
              <th>{tr('Économies énergie vs référence', 'Energy Savings vs Reference')}</th>
              <th>{tr('Investissement incrémental', 'Incremental Investment')}</th>
              <th>{tr('Retour simple', 'Simple Payback')}</th>
              <th>{tr('ROI annuel simple', 'Simple Annual ROI')}</th>
              <th>{tr('Réduction énergie', 'Energy Reduction')}</th>
            </tr>
          </thead>
          <tbody>
            {buildingTechnologyRows.map((key) => {
              const total = projectEnergy.totals[key]
              return (
                <tr key={key}>
                  <td>{technologyNames[key]}</td>
                  <td>{formatEnergy(total.annualEnergyKWh)}</td>
                  <td>{formatMoney(total.annualOperatingCost)}</td>
                  <td>{formatMoney(total.installedInvestmentCost)}</td>
                  <td>{projectEnergy.referenceTechnology === key ? tr('Référence', 'Reference') : formatMoney(total.annualSavings)}</td>
                  <td>{projectEnergy.referenceTechnology === key ? tr('Référence', 'Reference') : Number.isFinite(projectEnergy.referenceEnergy) && Number.isFinite(total.annualEnergyKWh) ? formatEnergy(projectEnergy.referenceEnergy - total.annualEnergyKWh) : tr('Non disponible', 'Not available')}</td>
                  <td>{projectEnergy.referenceTechnology === key ? '-' : formatMoney(total.incrementalInvestment)}</td>
                  <td>{projectEnergy.referenceTechnology === key ? '-' : projectPayback(total.simplePaybackYears, total.paybackStatus)}</td>
                  <td>{projectEnergy.referenceTechnology === key ? '-' : projectRoi(total.simpleAnnualRoiPercent)}</td>
                  <td>{projectEnergy.referenceTechnology === key ? tr('Référence', 'Reference') : Number.isFinite(total.energyReductionPercent) ? `${formatNumber(total.energyReductionPercent, 1)}%` : tr('Non disponible', 'Not available')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <h3>{tr('Économies par système', 'Savings by HVAC System')}</h3>
        <table className="report-table compact">
          <thead><tr>
            <th>{tr('Système', 'System')}</th><th>{tr('Mode', 'Mode')}</th><th>{tr('Débit', 'Airflow')}</th>
            <th>{tr('Référence', 'Reference')}</th><th>{tr('Énergie référence', 'Reference Energy')}</th>
            <th>{tr('Énergie Humifog', 'Selected Humifog Energy')}</th><th>{tr('Économies énergie', 'Energy Savings')}</th>
            <th>{tr('Réduction', 'Reduction')}</th><th>{tr('Coût référence', 'Reference Cost')}</th>
            <th>{tr('Coût Humifog', 'Humifog Cost')}</th><th>{tr('Économies coût', 'Annual Cost Savings')}</th><th>{tr('Retour', 'Payback')}</th>
          </tr></thead>
          <tbody>{buildingSavings.bySystem.map(({ system: item, savings: itemSavings }, index) => {
            const itemMode = item.mode || {}
            const isItemFreeCooling = Boolean(itemMode.includesFreeCoolingAnalysis || itemMode.isFreeCoolingMode)
            return <tr key={`${item.name || 'ahu'}-savings-${index}`}>
              <td>{item.name || `UTA-${index + 1}`}</td>
              <td>{itemMode.is100OA ? '100% OA' : (isItemFreeCooling ? 'Free Cooling' : itemMode.ventilationModeName || '-')}</td>
              <td>{formatFlow(item.system?.supplyAirflowCfm, data.units)}</td>
              <td>{technologyNames[itemSavings.referenceTechnology] || itemSavings.referenceTechnology}</td>
              <td>{formatEnergy(itemSavings.referenceEnergy)}</td><td>{formatEnergy(itemSavings.humifogEnergy)}</td>
              <td>{formatEnergy(itemSavings.energySavings)}</td><td>{Number.isFinite(itemSavings.energyReductionPercent) ? `${formatNumber(itemSavings.energyReductionPercent, 1)}%` : tr('Non disponible', 'Not available')}</td>
              <td>{formatMoney(itemSavings.referenceCost)}</td><td>{formatMoney(itemSavings.humifogCost)}</td><td>{formatMoney(itemSavings.costSavings)}</td>
              <td>{projectPayback(itemSavings.simplePaybackYears, itemSavings.paybackStatus)}</td>
            </tr>
          })}</tbody>
          <tfoot><tr>
            <th>{tr('TOTAL BÂTIMENT', 'TOTAL BUILDING')}</th><th colSpan="3" />
              <th>{formatEnergy(buildingSavings.totals.referenceEnergy)}</th><th>{formatEnergy(buildingSavings.totals.humifogEnergy)}</th><th>{formatEnergy(buildingSavings.totals.energySavings)}</th>
            <th>{Number.isFinite(buildingSavings.totals.energyReductionPercent) ? `${formatNumber(buildingSavings.totals.energyReductionPercent, 1)}%` : tr('Non disponible', 'Not available')}</th>
              <th>{formatMoney(buildingSavings.totals.referenceCost)}</th><th>{formatMoney(buildingSavings.totals.humifogCost)}</th><th>{formatMoney(buildingSavings.totals.costSavings)}</th><th>{projectPayback(buildingSavings.totals.simplePaybackYears, buildingSavings.totals.paybackStatus)}</th>
          </tr></tfoot>
        </table>
      </ReportSection>

      {projectSystems.map((projectSystem, index) => {
        const systemMode = projectSystem.mode || {}
        const systemData = projectSystem.system || {}
        const systemResults = projectSystem.annualTechnologyResults || projectSystem.results || {}
        const systemHumidificationLoad = projectSystem.metrics?.correctedHumidificationLoadRaw
          ?? projectSystem.metrics?.correctedHumidificationLoad
          ?? systemResults.electricSteam?.humidificationLoadLbHr
          ?? fallbackHumidificationLoadLbHr(projectSystem)
        const systemSavings = buildingSavings.bySystem[index]?.savings || summarizeBuildingSavings([projectSystem], projectEnergy.referenceTechnology).totals
        const systemIsFreeCooling = Boolean(systemMode.includesFreeCoolingAnalysis || systemMode.isFreeCoolingMode)
        const systemTechnologies = selectedTechnologiesForSystem(projectSystem).filter((key) => systemResults[key])
        const systemAnnualComparison = projectSystem.annualComparison || {}
        return (
          <ReportSection key={`${projectSystem.name || 'ahu'}-${index}`} title={`${tr('SYSTÈME', 'SYSTEM')} ${index + 1} - ${projectSystem.name || systemData.type || `AHU-${index + 1}`}`} pageBreak allowPageBreak>
            <KeyValueTable rows={[
              [tr('Nom du système', 'System name'), projectSystem.name || systemData.type || `AHU-${index + 1}`],
              [tr('Débit d’air', 'Airflow'), formatFlow(systemData.supplyAirflowCfm, data.units)],
              ['OA', `${formatNumber(systemData.selectedOaPercent ?? systemData.oaPercent, 0)}%`],
              ['RA', `${formatNumber(systemData.selectedRaPercent ?? systemData.raPercent, 0)}%`],
              [tr('Mode', 'Mode'), systemMode.is100OA ? '100% OA' : (systemIsFreeCooling ? 'Free Cooling' : systemMode.ventilationModeName || '-')],
              [tr('Climat', 'Climate'), projectSystem.project?.location || '-'],
              [tr('Base horaire', 'Operating-hour basis'), systemMode.selectedCalculationMethod || systemResults.electricSteam?.hoursBasis || '-'],
              [tr('Horaire', 'Operating schedule'), projectSystem.metrics?.scheduleDescription || '-'],
              [tr('Charge massique d’humidification', 'Humidification mass load'), formatHumidificationLoad(systemHumidificationLoad)],
              [tr('Récupération de chaleur', 'Heat recovery'), systemData.recoveryType || '-'],
            ]} />
            <h3>{tr('Bilan énergétique annuel', 'Annual Energy Balance')}</h3>
            <table className="report-table compact">
              <thead><tr><th>{tr('Technologie', 'Technology')}</th><th>{tr('Énergie annuelle', 'Annual Energy')}</th><th>{tr('Coût annuel', 'Annual Operating Cost')}</th></tr></thead>
              <tbody>{systemTechnologies.map((key) => (
                <tr key={key}><td>{technologyNames[key]}</td><td>{formatEnergy(systemResults[key].annualEnergyKWh)}</td><td>{formatMoney(systemResults[key].annualOperatingCost)}</td></tr>
              ))}</tbody>
            </table>
            {systemIsFreeCooling && (
              <>
                <h3>{tr('Analyse détaillée du refroidissement gratuit', 'Detailed Free Cooling Analysis')}</h3>
                <KeyValueTable rows={[
                  [tr('OA moyen vapeur', 'Average steam OA'), `${formatNumber(systemAnnualComparison.freeCooling?.averageAppliedOa ?? 0, 0)}%`],
                  [tr('OA moyen Humifog', 'Average Humifog OA'), `${formatNumber(systemAnnualComparison.humifog?.averageAppliedOa ?? 0, 0)}%`],
                  [tr('T mélange moyenne vapeur', 'Average steam mixed temperature'), formatTemp(systemAnnualComparison.freeCooling?.averageMixedDb ?? 0, data.units, data.language)],
                  [tr('T mélange moyenne Humifog', 'Average Humifog mixed temperature'), formatTemp(systemAnnualComparison.humifog?.averageMixedDb ?? 0, data.units, data.language)],
                  [tr('Température avant Humifog', 'Temperature before Humifog'), formatTemp(systemAnnualComparison.humifog?.averageInletToHumifogDb ?? 0, data.units, data.language)],
                  [tr('Température après Humifog', 'Temperature after Humifog'), formatTemp(systemAnnualComparison.humifog?.averageAfterHumifogDb ?? 0, data.units, data.language)],
                ]} />
              </>
            )}
          </ReportSection>
        )
      })}

      <ReportSection title={tr('SOMMAIRE EXÉCUTIF', 'EXECUTIVE SUMMARY')} pageBreak>
        <div className="executive-callout">
          <div>
            <span className="eyebrow">{tr('Option recommandée selon le coût annuel', 'Recommended option based on annual cost')}</span>
            <strong>{executiveRecommendation.label}</strong>
            <p className="report-text" style={{ marginTop: 6, marginBottom: 0, fontSize: 10 }}>
              {tr(
                'Recommandation basée uniquement sur le coût annuel d’exploitation estimé. Les critères d’énergie, de GES, d’eau, d’entretien et d’investissement initial doivent aussi être considérés.',
                'Recommendation based only on estimated annual operating cost. Energy, GHG, water, maintenance, and initial investment should also be considered.'
              )}
            </p>
          </div>
          <div>
            <span className="eyebrow">{tr('Débit d’air modélisé', 'Modeled airflow')}</span>
            <strong>
  {formatFlow(
    projectSystems.length > 1
      ? projectSystems.reduce(
          (total, item) => total + Number(item.system?.supplyAirflowCfm || 0),
          0
        )
      : system.supplyAirflowCfm,
    data.units,
    isFrench ? 'fr' : 'en'
  )}
</strong>
          </div>
          <div>
 <span className="eyebrow">
  {tr('Portée du rapport', 'Report scope')}
</span>

<strong>
  {projectSystems.length > 1
    ? tr(
        'Analyse énergétique globale du bâtiment',
        'Building-wide energy analysis'
      )
    : includesFreeCoolingAnalysis
      ? tr(
          'Comparaison en mode refroidissement gratuit',
          'Free Cooling comparison'
        )
      : tr(
          'Comparaison 100 % air extérieur',
          '100% outdoor air comparison'
        )}
</strong>
</div>
</div>

<h3>{tr('Aperçu du projet', 'Project Overview')}</h3>

<p className="report-text">
  {projectSystems.length > 1
    ? tr(
        `Ce rapport consolide l’analyse énergétique de ${projectSystems.length} systèmes HVAC du bâtiment. Les résultats de chaque UTA sont analysés individuellement puis regroupés afin de présenter le bilan énergétique global du bâtiment.`,
        `This report consolidates the energy analysis of ${projectSystems.length} HVAC systems in the building. Each HVAC system is analyzed individually and the results are then combined to present the overall building energy balance.`
      )
    : includesFreeCoolingAnalysis
      ? tr(
          'Ce rapport compare l’humidification à vapeur avec l’humidification adiabatique Humifog pour une unité de traitement d’air, en utilisant les conditions de la pièce comme cible de conception.',
          'This report compares steam humidification with Humifog adiabatic humidification for an HVAC air handling unit using the room condition as the design target.'
        )
      : tr(
          'Ce rapport documente la configuration UTA sélectionnée en 100 % air extérieur. Les résultats Free Cooling et d’optimisation OA / RA sont exclus intentionnellement parce que le système ne fonctionne pas comme un économiseur à air mélangé.',
          'This report documents the selected 100% outdoor air AHU configuration. Free Cooling and OA / RA optimization results are intentionally excluded because the system does not operate as a mixed air economizer.'
        )}
</p>

<h3>
  {projectSystems.length > 1
    ? tr('Description du bâtiment', 'Building Description')
    : tr('Description du système', 'System Description')}
</h3>

<KeyValueTable
  rows={
    projectSystems.length > 1
      ? [
          [
            tr('Systèmes HVAC actifs', 'Active HVAC systems'),
            `${projectSystems.length}`,
          ],
          [
            tr('Débit total du bâtiment', 'Total building airflow'),
            formatFlow(
              projectSystems.reduce(
                (total, item) =>
                  total + Number(item.system?.supplyAirflowCfm || 0),
                0
              ),
              data.units,
              isFrench ? 'fr' : 'en'
            ),
          ],
          [
            tr('Configurations HVAC', 'HVAC configurations'),
            tr(
              'Configuration propre à chaque UTA',
              'Configuration defined per HVAC system'
            ),
          ],
          [
            tr('Solution Humifog', 'Humifog solution'),
            tr(
              'Solution sélectionnée par UTA',
              'Selected per HVAC system'
            ),
          ],
        ]
      : [
          [
            tr('Configuration UTA sélectionnée', 'Selected AHU configuration'),
            system.type,
          ],
          [
            tr(
              'Humidification adiabatique Humifog',
              'Humifog adiabatic humidification'
            ),
            selectedTechnology,
          ],
          [
            tr(
              'Type de récupération d’énergie',
              'Energy Recovery Type'
            ),
            system.recoveryType,
          ],
          [
            tr('Type de chauffage', 'Heating Type'),
            selectedReheatName,
          ],
        ]
  }
/>        <h3>{tr('Résumé des résultats', 'Summary of Results')}</h3>
        <KpiGrid
  items={
    projectSystems.length > 1
      ? [
          [
            tr("Économies d'énergie annuelles", 'Annual Energy Savings'),
            formatEnergy(buildingSavings.totals.energySavings),
          ],
          [
            tr('Économies annuelles de coût', 'Annual Cost Savings'),
            formatMoney(buildingSavings.totals.costSavings),
          ],
          [
            tr("Énergie de référence du bâtiment", 'Building Reference Energy'),
            formatEnergy(buildingSavings.totals.referenceEnergy),
          ],
          [
            tr('Énergie Humifog du bâtiment', 'Building Humifog Energy'),
            formatEnergy(buildingSavings.totals.humifogEnergy),
          ],
          [
            tr("Réduction d'énergie", 'Energy Reduction'),
            Number.isFinite(buildingSavings.totals.energyReductionPercent)
              ? `${formatNumber(buildingSavings.totals.energyReductionPercent, 1)}%`
              : tr('Non disponible', 'Not available'),
          ],
          [
            tr('Systèmes HVAC analysés', 'HVAC Systems Analyzed'),
            `${projectSystems.length}`,
          ],
        ]
      : includesFreeCoolingAnalysis
        ? [
            [
              tr("Économies annuelles d'énergie", 'Annual Energy Savings'),
              formatEnergy(annual.savingsKwh),
            ],
            [
              tr('Économies annuelles de coût', 'Annual Cost Savings'),
              formatMoney(economicAnnualSavings),
            ],
            [
              tr('Réduction de GES', 'GHG Reduction'),
              `${formatNumber(metrics.eliminatedGES, 1)} tCO2e/year`,
            ],
            [
              tr('Retour estimé', 'Estimated Payback'),
              economicPayback,
            ],
            [
              tr('Coût annuel le plus bas', 'Lowest Annual Cost'),
              lowestAnnualCostOption.label,
            ],
            [
              tr('Réchauffage Humifog', 'Humifog Reheat'),
              reheatApplies
                ? `${formatEnergy(humifogReheatAppliedKwh)} - ${selectedReheatName}`
                : tr('Non requis', 'Not required'),
            ],
          ]
        : [
            [
              tr("Mode de débit d'air", 'Airflow Mode'),
              system.type,
            ],
            [
              tr('Estimation annuelle', 'Annual Estimate'),
              formatEnergy(energySummary.humifog?.annualEnergyKWh),
            ],
            [
              tr("Coût annuel d'exploitation", 'Annual Operating Cost'),
              formatMoney(energySummary.humifog?.annualCost),
            ],
            [
              tr('Réduction de GES', 'GHG Reduction'),
              `${formatNumber(metrics.eliminatedGES, 1)} tCO2e/year`,
            ],
            [
              tr('Réchauffage Humifog', 'Humifog Reheat'),
              (energySummary.humifog?.annualReheatCost || 0) > 0
                ? formatMoney(energySummary.humifog?.annualReheatCost)
                : tr('Non requis', 'Not required'),
            ],
            [
              tr('Sections Free Cooling non applicables', 'Free Cooling sections not applicable'),
              tr('100 % OA', '100% OA'),
            ],
          ]
  }
/>
        <div className="professional-note">
          {tr(
            'La comparaison est basée uniquement sur les valeurs disponibles dans le jeu de données du projet HESA. Les valeurs spécifiques au projet manquantes sont présentées intentionnellement comme intrants de projet ou hypothèses d’ingénierie plutôt que comme valeurs inférées.',
            'The comparison is based only on values available in the HESA project dataset. Missing project-specific values are intentionally shown as project inputs or engineering assumptions rather than inferred values.'
          )}
        </div>
      </ReportSection>

      <ReportSection title="TABLE OF CONTENTS" pageBreak>
        <ol className="toc-list">
          {tocSections.map(([number, title]) => (
            <li key={number}>
              <span>{number}. {title}</span>
              <span className="toc-dots" />
              <span>Auto</span>
            </li>
          ))}
        </ol>
      </ReportSection>

      {projectSystems.map((projectSystem, index) => {
        const systemName = projectSystem.name || projectSystem.system?.type || `AHU-${index + 1}`
        const systemDesign = projectSystem.design || (index === 0 ? design : {})
        const systemConfig = projectSystem.system || (index === 0 ? system : {})
        const systemMode = projectSystem.mode || (index === 0 ? mode : {})
        const systemSelectedOaPercent = systemConfig.selectedOaPercent ?? systemConfig.oaMinimumPercent ?? systemConfig.oaPercent
        const systemSelectedRaPercent = systemConfig.selectedRaPercent ?? Math.max(0, 100 - systemSelectedOaPercent)
        const systemIsFreeCooling = Boolean(systemMode.includesFreeCoolingAnalysis || systemMode.isFreeCoolingMode)
        const systemRecoverySensibleEfficiency = Number.isFinite(Number(systemConfig.recoverySensibleEfficiency))
          ? Number(systemConfig.recoverySensibleEfficiency)
          : Number(systemConfig.recoveryEfficiency || 0)
        const systemHasLatentRecovery = Boolean(systemConfig.hasLatentRecovery)
        const systemSelectedReheatName = systemConfig.reheatMethodLabel || systemConfig.heatingType || '-'
        return (
          <Fragment key={`design-schematic-${systemName}-${index}`}>
            <ReportSection title={`${reportSectionTitle('design', 'DESIGN CONDITIONS')} - ${systemName}`} pageBreak>
        <TwoColumn>
          <div>
            <h3>Outdoor Design Conditions</h3>
            <AirStateTable state={systemDesign.outdoorState} units={data.units} includeVolume />
          </div>
          <div>
            <h3>Room Design Conditions</h3>
            <AirStateTable state={systemDesign.roomState} units={data.units} />
          </div>
        </TwoColumn>
        <h3>System Design Parameters</h3>
        <KeyValueTable rows={[
          ['Airflow', formatFlow(systemConfig.supplyAirflowCfm, data.units)],
          [systemIsFreeCooling ? 'Selected Minimum OA %' : 'OA %', `${formatNumber(systemSelectedOaPercent, 0)}%`],
          [systemIsFreeCooling ? 'Selected RA Available %' : 'RA %', `${formatNumber(systemSelectedRaPercent, 0)}%`],
          ...(systemIsFreeCooling
            ? [['Calculated Average Humifog OA %', `${formatNumber(systemConfig.calculatedAverageOaPercent ?? systemConfig.oaPercent, 0)}%`]]
            : []),
          ['Recovery Type', systemConfig.recoveryType],
          [tr('Efficacité sensible', 'Sensible Efficiency'), `${formatNumber(systemRecoverySensibleEfficiency, 0)}%`],
          ...(systemHasLatentRecovery
            ? [[tr('Efficacité latente', 'Latent Efficiency'), `${formatNumber(systemConfig.recoveryLatentEfficiency, 0)}%`]]
            : []),
          ['Humidification Technology', systemConfig.humidificationTechnology],
          ['Heating Technology', systemSelectedReheatName],
        ]} />
            </ReportSection>

            <ReportSection title={`${reportSectionTitle('schematic', 'HVAC SYSTEM SCHEMATIC')} - ${systemName}`} pageBreak>
        {systemConfig.imageSrc && (
          <figure className="schematic-figure">
            <img src={systemConfig.imageSrc} alt={systemConfig.imageAlt || systemConfig.recoveryType} />
            <figcaption>Selected system image: {systemConfig.imageAlt || systemConfig.recoveryType}</figcaption>
          </figure>
        )}
        <TwoColumn>
          <div>
            <h3>Airflow Paths</h3>
            <OrderedList items={systemConfig.airflowPaths || []} />
          </div>
          <div>
            <h3>Component Sequence</h3>
            <OrderedList items={systemConfig.componentSequence || []} />
          </div>
        </TwoColumn>
        <h3>Design Temperatures</h3>
        <KeyValueTable rows={(systemConfig.designTemperatures || []).map((item) => [item.label, formatTemp(item.value, data.units)])} />
        <h3>{tr('États psychrométriques Humifog', 'Humifog Psychrometric States')}</h3>
        <KeyValueTable rows={(systemConfig.psychrometricStates || []).map((item) => [
          item.label,
          `${Number.isFinite(Number(item.temperature))
            ? formatTemp(item.temperature, data.units)
            : tr('Non disponible', 'Not available')} / ${Number.isFinite(Number(item.relativeHumidity))
            ? `${formatNumber(item.relativeHumidity, 1)}% RH`
            : tr('Non disponible', 'Not available')}`,
        ])} />
            </ReportSection>
          </Fragment>
        )
      })}

      <ReportSection title={reportSectionTitle('psychrometric', 'PSYCHROMETRIC ANALYSIS')} pageBreak allowPageBreak>
        <h3>{tr('Charges d’humidification', 'Humidification Loads')}</h3>
        <KeyValueTable rows={[
          [tr('Charge massique d’humidification corrigée', 'Corrected humidification mass load'), formatHumidificationLoad(metrics.correctedHumidificationLoadRaw ?? metrics.correctedHumidificationLoad)],
          [tr('Énergie vapeur équivalente', 'Equivalent steam energy'), `${formatNumber(metrics.steamEnergyKWRaw ?? metrics.steamEnergyKW ?? 0, 2)} kW`],
          [tr('Puissance pompe Humifog', 'Humifog pump power'), `${formatNumber(metrics.humifogPumpKWRaw ?? metrics.humifogPumpKW ?? 0, 2)} kW`],
          [tr('Chauffage CVC commun', 'Common HVAC heating'), `${formatNumber(metrics.commonHvacHeatingThermalKWRaw ?? metrics.commonHvacHeatingThermalKW ?? 0, 2)} kW`],
          [tr('Heures annuelles utilisées', 'Annual operating hours used'), `${formatNumber(metrics.annualHumidificationHours || energySummary.annualHumidificationHours || 0, 0)} h/year`],
        ]} />
        <table className="report-table compact">
          <thead>
            <tr>
              <th>{tr('Point', 'Point')}</th>
              <th>{tr('État de l’air', 'Air State')}</th>
              <th>{tr('Température', 'Temperature')}</th>
              <th>{tr('Humidité relative', 'Relative Humidity')}</th>
              <th>{tr('Rapport d’humidité', 'Humidity Ratio')}</th>
              <th>{tr('Enthalpie', 'Enthalpy')}</th>
              <th>{tr('Bulbe humide', 'Wet Bulb')}</th>
              <th>{tr('Point de rosée', 'Dew Point')}</th>
              <th>{tr('Volume spécifique', 'Specific Volume')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={`${point.key}-${index}`}>
                <td>Point {index + 1}</td>
                <td>{formatPointLabel(point.label)}</td>
                <td>{formatTemp(point.state.db, data.units, data.language)}</td>
                <td>{formatNumber(point.state.rh, 0)}%</td>
                <td>{formatHumidity(point.state.w, data.units)}</td>
                <td>{formatEnthalpy(point.state.h, data.units)}</td>
                <td>{formatTemp(point.state.wb, data.units, data.language)}</td>
                <td>{formatTemp(point.state.dp, data.units, data.language)}</td>
                <td>{formatSpecificVolume(point.state, data.units)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection title={reportSectionTitle('calculations', 'PSYCHROMETRIC CALCULATIONS')} pageBreak allowPageBreak>

      <ReportSection title={tr('RÉSULTATS GLOBAUX DU BÂTIMENT', 'OVERALL BUILDING RESULTS')} pageBreak allowPageBreak>
        <div className="executive-callout">
          <div><span className="eyebrow">{tr('Économies annuelles totales d’énergie', 'TOTAL ANNUAL ENERGY SAVINGS')}</span><strong>{formatEnergy(buildingSavings.totals.energySavings)}</strong></div>
          <div><span className="eyebrow">{tr('Réduction totale d’énergie', 'TOTAL ENERGY REDUCTION')}</span><strong>{Number.isFinite(buildingSavings.totals.energyReductionPercent) ? `${formatNumber(buildingSavings.totals.energyReductionPercent, 1)}%` : tr('Non disponible', 'Not available')}</strong></div>
          <div><span className="eyebrow">{tr('Économies annuelles totales de coût', 'TOTAL ANNUAL COST SAVINGS')}</span><strong>{formatMoney(buildingSavings.totals.costSavings)}</strong></div>
        </div>
        <KeyValueTable rows={[
          [tr('Énergie de référence totale', 'Total Reference Energy'), formatEnergy(buildingSavings.totals.referenceEnergy)],
          [tr('Énergie Humifog totale', 'Total Humifog Energy'), formatEnergy(buildingSavings.totals.humifogEnergy)],
          [tr('Investissement incrémental total', 'Total Incremental Investment'), formatMoney(buildingSavings.totals.incrementalInvestment)],
          [tr('Retour simple', 'Simple Payback'), projectPayback(buildingSavings.totals.simplePaybackYears, buildingSavings.totals.paybackStatus)],
          [tr('ROI annuel simple', 'Annual Simple ROI'), Number.isFinite(buildingSavings.totals.simpleAnnualRoiPercent) ? `${formatNumber(buildingSavings.totals.simpleAnnualRoiPercent, 1)}%` : tr('Non disponible', 'Not available')],
        ]} />
      </ReportSection>
        <FormulaBlock lines={includesFreeCoolingAnalysis
          ? [
            tr('Température de l’air mélangé : Tmix = (OA x Toa) + (RA x Tra)', 'Mixed Air Temperature: Tmix = (OA x Toa) + (RA x Tra)'),
            tr('Rapport d’humidité de l’air mélangé : Wmix = (OA x Woa) + (RA x Wra)', 'Mixed Air Humidity Ratio: Wmix = (OA x Woa) + (RA x Wra)'),
            tr('Enthalpie de l’air mélangé : hmix = (OA x hoa) + (RA x hra)', 'Mixed Air Enthalpy: hmix = (OA x hoa) + (RA x hra)'),
            tr('Récupération : Trec = Tmix + efficacité de récupération × (Tra - Tmix)', 'Recovery: Trec = Tmix + recovery_efficiency x (Tra - Tmix)'),
            tr('Humifog : Tout = Tentrée - eta x (Tentrée - Tbh_mélange)', 'Humifog: Tout = Tinlet - eta x (Tinlet - Twb_mix)'),
            tr('Charge de chauffage : Q = 1,08 × CFM × DeltaT', 'Heating Load: Q = 1.08 x CFM x DeltaT'),
            tr('Charge vapeur : lb/h = 4,5 × CFM × DeltaW', 'Steam Load: lb/hr = 4.5 x CFM x DeltaW'),
          ]
          : [
            tr('L’état psychrométrique de l’air extérieur est calculé à partir de la température sèche et de l’humidité relative.', 'Outdoor air psychrometric state is calculated from dry bulb temperature and relative humidity.'),
            tr('Récupération : Trec = Tentrée + efficacité de récupération × différence de température disponible', 'Recovery: Trec = Tinlet + recovery_efficiency x available temperature difference'),
            tr('Charge de chauffage : Q = 1,08 × CFM × DeltaT', 'Heating Load: Q = 1.08 x CFM x DeltaT'),
            tr('Humifog : l’état de sortie adiabatique est calculé à partir des conditions réelles de l’air entrant.', 'Humifog: adiabatic outlet state is calculated from the actual entering air condition.'),
            tr('Charge vapeur : lb/h = 4,5 × CFM × DeltaW', 'Steam Load: lb/hr = 4.5 x CFM x DeltaW'),
          ]} />
        <h3>{tr('Valeurs numériques calculées', 'Actual Numerical Values')}</h3>
        <KeyValueTable rows={[
          [tr('Température de l’air extérieur', 'Outdoor Air Temperature'), outdoor ? formatTemp(outdoor.db, data.units, data.language) : '-'],
          ...(!is100OA
            ? [
              [tr('Température de l’air de retour', 'Return Air Temperature'), returnAir ? formatTemp(returnAir.db, data.units, data.language) : '-'],
              [tr('Température de l’air mélangé', 'Mixed Air Temperature'), mixed ? formatTemp(mixed.db, data.units, data.language) : '-'],
              [tr('Rapport d’humidité de l’air mélangé', 'Mixed Air Humidity Ratio'), mixed ? formatHumidity(mixed.w, data.units) : '-'],
              [tr('Enthalpie de l’air mélangé', 'Mixed Air Enthalpy'), mixed ? formatEnthalpy(mixed.h, data.units) : '-'],
            ]
            : []),
          [tr('Température après récupération', 'After Recovery Temperature'), recovered ? formatTemp(recovered.db, data.units, data.language) : '-'],
          ...(!is100OA ? [[tr('Référence bulbe humide de l’air mélangé', 'Mixed Air Wet Bulb Reference'), mixed ? formatTemp(mixed.wb, data.units, data.language) : '-']] : []),
          [tr('Température après Humifog', 'After Humifog Temperature'), afterHumifog ? formatTemp(afterHumifog.db, data.units, data.language) : '-'],
          [tr('Température après chauffage', 'After Heating Temperature'), afterHeating ? formatTemp(afterHeating.db, data.units, data.language) : '-'],
          ...(includesFreeCoolingAnalysis
            ? [
              [tr('Température de l’air mélangé calculée', 'Calculated Mixed Air Temperature'), formatTemp(data.validation.calculatedMixedDb, data.units, data.language)],
              [tr('Température de l’air mélangé active', 'Active Mixed Air Temperature'), formatTemp(data.validation.activeMixedDb, data.units, data.language)],
              [tr('Validation air mélangé', 'Mixed Air Override'), data.validation.isOverridden ? tr('Valeur mesurée utilisée', 'Measured value used') : tr('Valeur calculée utilisée', 'Calculated value used')],
            ]
            : []),
        ]} />
      </ReportSection>

      {showBinAnalysis && (
        <ReportSection title={reportSectionTitle('bins', 'BIN WEATHER ANALYSIS')} pageBreak className="bin-summary-section">
          <h3>Weather BIN Summary</h3>
          <WeatherBinTable bins={data.bins || []} units={data.units} />
          {includesFreeCoolingAnalysis && (
            <p className="report-text">
              The complete BIN-by-BIN free cooling calculation table is provided in Appendix B to keep this section on one page.
            </p>
          )}
        </ReportSection>
      )}

      {includesFreeCoolingAnalysis && showBinAnalysis && (
        <ReportSection title={reportSectionTitle('optimization', 'OA / RA OPTIMIZATION')} pageBreak allowPageBreak>
          <h3>Optimization Matrix</h3>
          <OptimizationTable rows={optimizationRows} optimal={data.optimal} units={data.units} />
          <h3>Automatically Determined Optimal Point</h3>
          <KeyValueTable rows={[
            ['Optimal OA %', `${formatNumber(data.optimal.oaPercent, 0)}%`],
            ['Optimal RA %', `${formatNumber(data.optimal.raPercent, 0)}%`],
            ['Minimum Annual Energy', formatEnergy(data.optimal.totalEnergyKwh)],
            ['Annual Cost', formatMoney(data.optimal.annualCost)],
            [
              'ASHRAE Compliance',
              (humifog.averageOa || 0) >= (system.oaMinimumPercent || 0)
                ? `Average Humifog OA is above the ${formatNumber(system.oaMinimumPercent, 0)}% design minimum. Final code compliance to be verified by the engineer of record.`
                : `Humifog damper modulation calculates OA below the ${formatNumber(system.oaMinimumPercent, 0)}% design minimum in some BINs. Minimum ventilation compliance must be verified by the engineer of record.`,
            ],
          ]} />
        </ReportSection>
      )}

      {includesFreeCoolingAnalysis && (
        <ReportSection title={reportSectionTitle('freeCooling', 'FREE COOLING ANALYSIS')} pageBreak allowPageBreak>
          <h3>{tr('Fonctionnement et bénéfices Free Cooling', 'Free Cooling Operation and Benefits')}</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th>{tr('Paramètre', 'Parameter')}</th>
                <th>{tr('Vapeur / Référence', 'Steam / Reference')}</th>
                <th>{tr('Humifog optimisé', 'Optimized Humifog')}</th>
                <th>{tr('Écart / bénéfice', 'Difference / Benefit')}</th>
              </tr>
            </thead>
            <tbody>
              {freeCoolingOperatingRows.map(([label, referenceValue, humifogValue, difference]) => (
                <tr key={label}><td>{label}</td><td>{referenceValue}</td><td>{humifogValue}</td><td>{difference}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>Humifog Reheat Detail</h3>
          <KeyValueTable rows={[
            ['Reheat applies', reheatApplies ? 'Yes' : 'No'],
            ['Selected reheat method', selectedReheatName],
            ['Annual reheat thermal energy', reheatApplies ? formatEnergy(humifogReheatThermalKwh) : 'Not required'],
            ['Applied reheat energy by selected method', reheatApplies ? formatEnergy(humifogReheatAppliedKwh) : 'Not required'],
            ['Heat pump COP equivalent', selectedReheatSource === 'heatPump' && heatPumpCop ? `${formatEnergy(humifogReheatEquivalentHeatPumpKwh)} / COP ${formatNumber(heatPumpCop, 1)}` : '-'],
            ...(showBinAnalysis ? [
              ['Maximum BIN reheat input', criticalReheatRow && (criticalReheatRow.reheatLoadKw || 0) > 0 ? formatPower(criticalReheatRow.reheatLoadKw) : 'Not required'],
              ['Critical BIN', criticalReheatRow && (criticalReheatRow.reheatLoadKw || 0) > 0 ? `${formatTemp(criticalReheatRow.tempC, data.units, data.language)} / ${formatNumber(criticalReheatRow.hours, 0, data.language)} h` : '-'],
            ] : []),
          ]} />
        </ReportSection>
      )}

      {!includesFreeCoolingAnalysis && (
        <ReportSection title={reportSectionTitle('recovery', 'ENERGY RECOVERY ANALYSIS')} pageBreak allowPageBreak>
          <KeyValueTable rows={[
            ['Recovery Device', system.recoveryType],
            [tr('Efficacité sensible', 'Sensible Efficiency'), `${formatNumber(recoverySensibleEfficiency, 0)}%`],
            ...(hasLatentRecovery
              ? [[tr('Efficacité latente', 'Latent Efficiency'), `${formatNumber(recoveryLatentEfficiency, 0)}%`]]
              : []),
            ['Recovered Energy', formatEnergy(recoveredAnnualEnergy)],
            ['Annual Savings', formatMoney(recoveredAnnualEnergy * economics.electricityRate)],
          ]} />
          <h3>Comparison with No Recovery</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Annual Energy</th>
                <th>Annual Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>No Recovery</td>
                <td>{formatEnergy(noRecoveryAnnualEnergy)}</td>
                <td>{formatMoney(noRecoveryAnnualEnergy * economics.electricityRate)}</td>
              </tr>
              <tr>
                <td>Selected Recovery</td>
                <td>{formatEnergy(selectedAnnualEnergy)}</td>
                <td>{formatMoney(energySummary.humifog?.annualCost)}</td>
              </tr>
            </tbody>
          </table>
        </ReportSection>
      )}

      <ReportSection title={reportSectionTitle('energy', 'ENERGY ANALYSIS')} pageBreak allowPageBreak>
        <h3>{tr(isMultiSystemReport ? 'Comparaison énergétique annuelle du bâtiment' : 'Comparaison détaillée des calculs annuels', isMultiSystemReport ? 'Building Annual Energy Comparison' : 'Detailed Annual Energy Comparison')}</h3>
        <table className="report-table">
          <thead>
            <tr>
              <th>{tr('Paramètre', 'Parameter')}</th>
              {(isMultiSystemReport ? buildingAnnualTechnologyKeys : pdfAnnualTechnologyKeys).map((key) => <th key={key}>{isMultiSystemReport ? (technologyNames[key] || technologyNames.humifogSelected) : technologyNames[key]}</th>)}
              <th>{tr('Écart vs référence sélectionnée', 'Difference vs Selected Reference')}</th>
            </tr>
          </thead>
          <tbody>
            {isMultiSystemReport
              ? buildingAnnualRows.map((row) => {
                const referenceKey = projectEnergy.referenceTechnology
                const referenceValue = referenceKey ? buildingAnnualValue(referenceKey, row.key) : null
                return (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    {buildingAnnualTechnologyKeys.map((key) => {
                      const value = buildingAnnualValue(key, row.key)
                      if (row.percent) return <td key={key}>{Number.isFinite(value) ? `${formatNumber(value, 1)}%` : tr('Non disponible', 'Not available')}</td>
                      return <td key={key}>{formatPdfDetailedValue(row, value)}</td>
                    })}
                    <td>{projectEnergy.referenceTechnology
                      ? technologyNames[projectEnergy.referenceTechnology]
                      : tr('Référence sélectionnée par UTA', 'Selected per-system reference')}</td>
                  </tr>
                )
              })
              : pdfDetailedAnnualRows.map((row) => {
                const referenceValue = pdfDetailedValue(row, pdfAnnualReferenceKey)
                const humifogValue = pdfDetailedValue(row, selectedHumifogKey)
                const difference = Number.isFinite(referenceValue) && Number.isFinite(humifogValue)
                  ? referenceValue - humifogValue
                  : null
                return (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    {pdfAnnualTechnologyKeys.map((key) => <td key={key}>{formatPdfDetailedValue(row, pdfDetailedValue(row, key))}</td>)}
                    <td>{difference === null ? tr('Non applicable', 'Not applicable') : formatPdfDetailedValue(row, difference)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection title={reportSectionTitle('economics', tr('ANALYSE ÉCONOMIQUE', 'ECONOMIC ANALYSIS'))} pageBreak allowPageBreak>
        <KeyValueTable rows={isMultiSystemReport
          ? [
            [tr('Tarif d utilité - Électricité', 'Utility Rate - Electricity'), tr('Tarifs propres à chaque UTA', 'Rates defined per HVAC system')],
            [tr('Tarif d utilité - Gaz naturel', 'Utility Rate - Natural Gas'), tr('Tarifs propres à chaque UTA', 'Rates defined per HVAC system')],
            [tr('Coût annuel - Vapeur électrique', 'Annual Energy Cost - Electric Steam'), formatMoney(projectEnergy.totals.electricSteam.annualOperatingCost)],
            [tr('Coût annuel - Vapeur gaz naturel', 'Annual Energy Cost - Natural Gas Steam'), formatMoney(projectEnergy.totals.naturalGasSteam.annualOperatingCost)],
            [tr('Coût annuel - Humidificateur gaz atmosphérique', 'Annual Energy Cost - Atmospheric Gas Humidifier'), formatMoney(projectEnergy.totals.atmosphericGas.annualOperatingCost)],
            [tr('Coût annuel - Humifog sélectionné', 'Annual Energy Cost - Selected Humifog'), formatMoney(projectEnergy.totals.humifogSelected.annualOperatingCost)],
            [tr('Économies annuelles du bâtiment', 'Building Annual Savings'), formatMoney(economicAnnualSavings)],
            [tr('Retour simple du bâtiment', 'Building Simple Payback'), economicPayback],
            [tr('Économies sur 10 ans du bâtiment', 'Building 10-Year Savings'), formatMoney(economicTenYearSavings)],
            [tr('Économies sur 20 ans du bâtiment', 'Building 20-Year Savings'), formatMoney(economicTwentyYearSavings)],
          ]
          : includesFreeCoolingAnalysis
          ? [
            [tr('Tarif d utilité - Électricité', 'Utility Rate - Electricity'), formatUtilityRateWithUnit(economics.electricityRate, 3, 'kWh')],
            [tr('Tarif d utilité - Gaz naturel', 'Utility Rate - Natural Gas'), formatUtilityRateWithUnit(economics.naturalGasRate, 3, isFrench ? 'm³' : 'm3')],
            [tr('Rendement de la chaudière vapeur', 'Steam Boiler Efficiency'), `${formatNumber(economics.steamBoilerEfficiency, 0)}%`],
            [tr('Rendement de l’humidificateur gaz atmosphérique', 'Atmospheric Gas Humidifier Efficiency'), `${formatNumber(economics.atmosphericGasHumidifierEfficiency, 0)}%`],
            [tr('Coût annuel - Vapeur électrique', 'Annual Energy Cost - Electric Steam'), formatMoney(freeCoolingTechnologyOptions[0].annualCost)],
            [tr('Coût annuel - Vapeur gaz naturel', 'Annual Energy Cost - Natural Gas Steam'), formatMoney(freeCoolingTechnologyOptions[1].annualCost)],
            [tr('Coût annuel - Humidificateur gaz atmosphérique', 'Annual Energy Cost - Atmospheric Gas'), formatMoney(freeCoolingTechnologyOptions[2].annualCost)],
            [tr('Coût annuel - Humifog', 'Annual Energy Cost - Humifog'), formatMoney(freeCoolingTechnologyOptions[3].annualCost)],
            [tr('Option au coût annuel le plus bas', 'Lowest Annual Cost Option'), lowestAnnualCostOption.label],
            [tr('Économies annuelles', 'Annual Savings'), formatMoney(economicAnnualSavings)],
            [tr('Retour simple', 'Simple Payback'), economicPayback],
            [tr('Économies sur 10 ans', '10-Year Savings'), formatMoney(economicTenYearSavings)],
            [tr('Économies sur 20 ans', '20-Year Savings'), formatMoney(economicTwentyYearSavings)],
          ]
          : [
            [tr('Tarif d utilité - Électricité', 'Utility Rate - Electricity'), formatUtilityRateWithUnit(economics.electricityRate, 3, 'kWh')],
            [tr('Tarif d utilité - Gaz naturel', 'Utility Rate - Natural Gas'), formatUtilityRateWithUnit(economics.naturalGasRate, 3, isFrench ? 'm³' : 'm3')],
            [tr('Rendement de la chaudière vapeur', 'Steam Boiler Efficiency'), `${formatNumber(economics.steamBoilerEfficiency, 0)}%`],
            [tr('Rendement de l’humidificateur gaz atmosphérique', 'Atmospheric Gas Humidifier Efficiency'), `${formatNumber(economics.atmosphericGasHumidifierEfficiency, 0)}%`],
            [tr('Coût annuel - Vapeur électrique', 'Annual Energy Cost - Electric Steam'), formatMoney(energySummary.steam?.annualCost)],
            [tr('Coût annuel - Vapeur gaz naturel', 'Annual Energy Cost - Natural Gas Steam'), formatMoney(energySummary.naturalGasSteam?.annualCost)],
            [tr('Coût annuel - Humidificateur gaz atmosphérique', 'Annual Energy Cost - Atmospheric Gas Humidifier'), formatMoney(energySummary.atmosphericGasHumidifier?.annualCost)],
            [tr('Coût annuel - Humifog', 'Annual Energy Cost - Humifog'), formatMoney(energySummary.humifog?.annualCost)],
            [tr('Économies annuelles vs vapeur électrique', 'Annual Savings vs Electric Steam'), formatMoney(economicAnnualSavings)],
            [tr('Retour simple', 'Simple Payback'), economicPayback],
          ]} />

        {roiRows.length > 0 && (
          <>
            <h3>{tr('Coût installé et intrants ROI', 'Installed Cost and ROI Inputs')}</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>{tr('Système', 'System')}</th>
                  <th>{tr('Coût installé', 'Installed Cost')}</th>
                  <th>{tr('Coût annuel énergie', 'Annual Energy Cost')}</th>
                  <th>{tr('Économies annuelles', 'Annual Savings')}</th>
                  <th>{tr('Coût incrémental', 'Incremental Cost')}</th>
                  <th>{tr('Retour simple', 'Simple Payback')}</th>
                </tr>
              </thead>
              <tbody>
                {roiRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{formatMoney(row.installedCost)}</td>
                    <td>{formatMoney(row.annualCost)}</td>
                    <td>{row.reference ? '-' : formatSignedMoney(row.annualSavings)}</td>
                    <td>{row.reference ? '-' : formatSignedMoney(row.incrementalCost)}</td>
                    <td>{formatPayback(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {equipmentCostCompositionRows.length > 0 && (
          <>
            <h3>{tr('Composition du coût d’équipement', 'Equipment Cost Composition')}</h3>
            <p className="report-text">
              {tr(
                'Le total installé présenté ici est le même montant utilisé pour le calcul du coût incrémental, du retour simple et du ROI.',
                'The installed total shown here is the same amount used to calculate incremental cost, simple payback and ROI.'
              )}
            </p>
            <table className="report-table">
              <thead>
                <tr>
                  <th>{tr('Système / technologie', 'System / Technology')}</th>
                  <th>{tr('Équipement de base', 'Base Equipment')}</th>
                  <th>{tr('Adder récupération', 'Heat Recovery Adder')}</th>
                  <th>{tr('Adder contrôles Free Cooling', 'Free Cooling Controls Adder')}</th>
                  <th>{tr('Total utilisé pour ROI', 'Total Used for ROI')}</th>
                  <th>{tr('Référence', 'Reference')}</th>
                </tr>
              </thead>
              <tbody>
                {equipmentCostCompositionRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatMoney(row.base)}</td>
                    <td>{formatMoney(row.heatRecoveryAdder)}</td>
                    <td>{formatMoney(row.freeCoolingControlsAdder)}</td>
                    <td><strong>{formatMoney(row.total)}</strong></td>
                    <td>{row.reference ? tr('Oui', 'Yes') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </ReportSection>

      <ReportSection title={reportSectionTitle('ghg', 'GREENHOUSE GAS ANALYSIS')} pageBreak>
        <KeyValueTable rows={[
          [tr('Émissions du système vapeur', 'Steam System Emissions'), `${formatNumber(metrics.naturalGasGES, 1)} ${tr('tCO2e/an', 'tCO2e/year')}`],
          ...(!includesFreeCoolingAnalysis
            ? [[tr('Émissions de l’humidificateur gaz atmosphérique', 'Atmospheric Gas Humidifier Emissions'), `${formatNumber(metrics.atmosphericGasHumidifierGES, 1)} ${tr('tCO2e/an', 'tCO2e/year')}`]]
            : []),
          [tr('Émissions du système Humifog', 'Humifog System Emissions'), `${formatNumber(metrics.adiabaticGES, 1)} ${tr('tCO2e/an', 'tCO2e/year')}`],
          [tr('Réduction des émissions', 'Emission Reduction'), `${formatNumber(metrics.eliminatedGES, 1)} ${tr('tCO2e/an', 'tCO2e/year')}`],
          [tr('Équivalent en arbres', 'Equivalent Trees'), `${formatNumber(treesEquivalent, 0)} ${tr('arbres/an', 'trees/year')}`],
          [tr('Réduction équivalente de CO2e', 'Equivalent CO2 Reduction'), `${formatNumber(metrics.eliminatedGES, 1)} ${tr('tonnes métriques CO2e/an', 'metric tonnes CO2e/year')}`],
        ]} />
      </ReportSection>

      {includesFreeCoolingAnalysis && (
        <ReportSection title={reportSectionTitle('graphs', tr('GRAPHIQUES', 'GRAPHS'))} pageBreak allowPageBreak>
          <div className="graph-grid">
            <LineGraph
              title="Graph 1 - Energy vs OA %"
              data={optimizationRows.map((row) => ({ x: row.oaPercent, y: row.totalEnergyKwh }))}
              color="#0ea5e9"
              yLabel="kWh"
            />
            <LineGraph
              title="Graph 2 - Mixed Air Temperature vs OA %"
              data={optimizationRows.map((row) => ({ x: row.oaPercent, y: row.tmix }))}
              color="#f97316"
              yLabel={data.units === 'imperial' ? (isFrench ? '°F' : 'deg F') : (isFrench ? '°C' : 'deg C')}
              yTransform={(value) => data.units === 'imperial' ? value * 9 / 5 + 32 : value}
            />
            {showBinAnalysis && <BarGraph title="Graph 3 - Annual Savings by BIN" data={binSavingsRows} color="#22c55e" />}
            <HeatMap title="Graph 4 - OA / Temperature Heat Map" rows={optimizationRows} units={data.units} />
            <EnergyBreakdownGraph title="Graph 5 - Annual Energy Breakdown" data={annualBreakdown} />
          </div>
        </ReportSection>
      )}

      <ReportSection title={reportSectionTitle('recommendation', 'ENGINEERING RECOMMENDATION')} pageBreak>
        <p className="report-text">
          {includesFreeCoolingAnalysis
            ? 'The Humifog optimized strategy recalculates evaporative cooling, then adjusts outdoor air or reheat to meet the target condition.'
            : 'The selected 100% outdoor air system should be evaluated as a dedicated outside air AHU. Outdoor air is fixed at 100%, so OA / RA optimization and Free Cooling economizer comparisons are not applicable to this project configuration.'}
        </p>
        <TwoColumn>
          <div>
            <h3>Advantages</h3>
            <OrderedList items={includesFreeCoolingAnalysis
              ? [
                'Reduced outdoor air load during cold weather operation',
                'Lower annual heating and humidification energy',
                'Lower operating cost with optimized OA/RA control',
                'Improved integration with heat recovery and mixed air AHU operation',
              ]
              : [
                'Clear 100% outdoor air operating sequence',
                'No mixed air or return air assumption in the report',
                'Humifog and heating results are aligned with the selected AHU configuration',
                'Energy recovery and humidification technologies remain documented for design review',
              ]} />
          </div>
          <div>
            <h3>Limitations</h3>
            <OrderedList items={includesFreeCoolingAnalysis
              ? [
                'Final ventilation minimum must be confirmed against applicable code and occupancy',
                'Installed cost is required for final simple payback',
                ...(showBinAnalysis ? ['BIN data should be validated against project-specific weather files'] : ['Custom operating hours are used for the annual energy calculation']),
                'Field mixed air measurements should be used when available',
              ]
              : [
                'Free Cooling savings are not calculated because the selected system is not a mixed air economizer',
                'Installed cost is required for final simple payback',
                ...(showBinAnalysis ? ['BIN data should be validated against project-specific weather files'] : ['Custom operating hours are used for the annual energy calculation']),
                'Final equipment selection must be coordinated with manufacturer data',
              ]} />
          </div>
        </TwoColumn>
        <KeyValueTable rows={includesFreeCoolingAnalysis
          ? [
            ['Recommended Configuration', `${system.recoveryType}, ${selectedReheatName}, Humifog adiabatic humidification`],
            ['Expected Annual Savings', formatMoney(economicAnnualSavings)],
            ['Expected Payback', economicPayback],
            ['Final Recommendation', `Proceed with Humifog optimized outdoor air control at ${formatNumber(data.optimal.oaPercent, 0)}% OA, subject to final design review.`],
          ]
          : [
            ['Recommended Configuration', `${system.recoveryType}, ${selectedReheatName}, Humifog adiabatic humidification, 100% OA`],
            ['Expected Annual Savings', formatMoney(economicAnnualSavings)],
            ['Expected Payback', economicPayback],
            ['Final Recommendation', 'Proceed with the selected 100% outdoor air AHU configuration and exclude Free Cooling OA/RA optimization from this project report.'],
          ]} />
      </ReportSection>

      <ReportSection title="APPENDIX A - PSYCHROMETRIC EQUATIONS" pageBreak>
        <FormulaBlock lines={[
          'Saturation vapor pressure is calculated from dry bulb temperature.',
          'Humidity ratio: W = 0.62198 x Pw / (P - Pw)',
          'Relative humidity: RH = Pw / Pws',
          'Enthalpy: h = 1.006 x T + W x (2501 + 1.86 x T)',
          'Wet bulb and dew point are calculated from psychrometric correlations.',
          'Specific volume: v = Rda x Tdb,K x (1 + 1.6078W) / P',
        ]} />
      </ReportSection>

      {showBinAnalysis && (
        <ReportSection title="APPENDIX B - BIN WEATHER DATA" pageBreak allowPageBreak>
          <WeatherBinTable bins={data.bins || []} units={data.units} />
          {includesFreeCoolingAnalysis && (
            <>
              <h3>Complete BIN-by-BIN Free Cooling Calculation</h3>
              <CompleteBinCalculationTable rows={binRows} conventionalRows={conventionalRows} units={data.units} />
            </>
          )}
        </ReportSection>
      )}

      <ReportSection title="APPENDIX C - PDF DATA VALIDATION" pageBreak allowPageBreak>
        <p className="report-text">
          This audit lists the HESA software inputs and calculated values used directly by this PDF report.
        </p>
        {hourlyWeatherSummaryRows.length > 0 && (
          <>
            <h3>{tr('Données météorologiques utilisées', 'Weather data used')}</h3>
            <p className="report-text">
              {tr(
                'Les résultats de simulation horaire sont basés sur un fichier météorologique typique CWEC_FMCCE du Gouvernement du Canada. Ces fichiers représentent une année météorologique typique pour les calculs énergétiques et ne représentent pas une année réelle spécifique.',
                'Hourly simulation results are based on a Government of Canada CWEC_FMCCE typical weather file. These files represent a typical meteorological year for energy calculations and do not represent one specific real year.'
              )}
            </p>
            <KeyValueTable rows={hourlyWeatherSummaryRows} />
            <h3>{tr('Résumé météo pendant les heures d’exploitation', 'Weather summary during operating hours')}</h3>
            <KeyValueTable rows={hourlyWeatherCompactRows} />
          </>
        )}
        {projectSystems.length > 1 ? (
          <>
            <h3>{tr('Validation des données par UTA', 'Data validation by HVAC system')}</h3>
            {systemValidationRows.map((systemValidation) => (
              <div key={systemValidation.name}>
                <h3>{systemValidation.name}</h3>
                <KeyValueTable rows={systemValidation.rows} />
              </div>
            ))}
          </>
        ) : (
          <KeyValueTable rows={reportInputValidationRows} />
        )}
      </ReportSection>

      <ReportSection title="APPENDIX D - CALCULATION ASSUMPTIONS" pageBreak>
        <OrderedList items={[
          'Atmospheric pressure is assumed at 101.325 kPa.',
          ...(is100OA ? [] : ['Room design condition is used as the return air condition.']),
          is100OA
            ? 'Humifog outlet temperature is recalculated after evaporative cooling.'
            : 'Humifog outlet temperature uses the mixed air wet bulb reference.',
          'Heating load uses Q = 1.08 x CFM x DeltaT for IP airflow basis.',
          ...(includesFreeCoolingAnalysis ? ['No Recovery comparison is estimated by adding recovered annual energy back to the selected recovery case.'] : []),
          'Payback requires installed project cost and is therefore shown as a project input requirement.',
        ]} />
      </ReportSection>

      <ReportSection title="APPENDIX E - ENGINEERING NOTES" pageBreak>
        <OrderedList items={[
          'This report is intended for preliminary HVAC engineering comparison and energy optimization.',
          'Final equipment selection must be coordinated with manufacturer data and project specifications.',
          'Ventilation rates, humidification loads, and energy recovery performance must be validated by the engineer of record.',
          ...(includesFreeCoolingAnalysis ? ['Free cooling operation must respect minimum outdoor air requirements and freeze protection controls.'] : ['Free Cooling operation is not included for the selected 100% outdoor air report scope.']),
        ]} />
        <div className="signature-grid">
          <div>
            <span>Prepared by</span>
            <strong>{project.preparedBy || 'HESA'}</strong>
          </div>
          <div>
            <span>Reviewed by</span>
            <strong>Engineer of record</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{project.date || '-'}</strong>
          </div>
        </div>
      </ReportSection>
      <footer className="report-footer">
        <span>HESA - Humidification Energy System Analysis | https://hesahvac.com</span>
        <span>© 2026 Enersol inc. / Carel Group. All rights reserved. Unauthorized reproduction, distribution, reverse engineering or commercial use is prohibited.</span>
        <span>{project.name || 'Project report'}</span>
      </footer>
    </article>
  )
}

function ReportSection({ title, children, pageBreak = false, allowPageBreak = false, className = '' }) {
  return (
    <section className={`report-section ${pageBreak ? 'page-break' : ''} ${allowPageBreak ? 'allow-page-break' : ''} ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function TwoColumn({ children }) {
  return <div className="two-column">{children}</div>
}

function KeyValueTable({ rows }) {
  return (
    <table className="report-table key-value">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th>{label}</th>
            <td>{value || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WeatherBinTable({ bins, units }) {
  return (
    <table className="report-table compact">
      <thead>
        <tr>
          <th>Temperature</th>
          <th>Hours</th>
          <th>Relative Humidity</th>
        </tr>
      </thead>
      <tbody>
        {bins.map((bin) => (
          <tr key={`weather-${bin.tempC}-${bin.hours}`}>
            <td>{formatTemp(bin.tempC, units)}</td>
            <td>{formatNumber(bin.hours, 0)}</td>
            <td>{formatNumber(bin.rh, 0)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CompleteBinCalculationTable({ rows, conventionalRows, units }) {
  if (!rows || rows.length === 0) {
    return <p className="report-text">No detailed free cooling BIN rows are available in the current HESA dataset.</p>
  }

  return (
    <table className="report-table compact appendix-bin-table">
      <thead>
        <tr>
          <th>BIN</th>
          <th>Hours</th>
          <th>Calculated Steam OA</th>
          <th>Calculated Humifog OA</th>
          <th>Mixed Air Temperature</th>
          <th>Humidity Ratio</th>
          <th>Humifog Load</th>
          <th>Heating Load</th>
          <th>Reheat Load</th>
          <th>Total Energy</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const referenceRow = conventionalRows[index] || {}
          const steamRequestedOa = referenceRow.requestedOutdoorAirPercent ?? referenceRow.outdoorAirPercent
          const humifogRequestedOa = row.requestedOutdoorAirPercent ?? row.outdoorAirPercent

          return (
            <tr key={`bin-detail-${row.tempC}-${row.hours}`}>
              <td>{formatTemp(row.tempC, units)}</td>
              <td>{formatNumber(row.hours, 0)}</td>
              <td>
                {formatNumber(referenceRow.outdoorAirPercent, 1)}%
                {Math.abs((steamRequestedOa ?? 0) - (referenceRow.outdoorAirPercent ?? 0)) > 0.05
                  ? ` / target ${formatNumber(steamRequestedOa, 1)}%`
                  : ''}
              </td>
              <td>
                {formatNumber(row.outdoorAirPercent, 1)}%
                {Math.abs((humifogRequestedOa ?? 0) - (row.outdoorAirPercent ?? 0)) > 0.05
                  ? ` / target ${formatNumber(humifogRequestedOa, 1)}%`
                  : ''}
              </td>
              <td>{formatTemp(row.mixed.db, units)}</td>
              <td>{formatHumidity(row.mixed.w, units)}</td>
              <td>{formatWater(row.humifogLoadLbHr, units)}</td>
              <td>{formatEnergy(row.comparisonHeatingEnergyKwh)}</td>
              <td>{formatEnergy(row.reheatEnergyKwh)}</td>
              <td>{formatEnergy(row.totalEnergyKwh)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function OptimizationTable({ rows, optimal, units }) {
  return (
    <table className="report-table compact">
      <thead>
        <tr>
          <th>OA %</th>
          <th>RA %</th>
          <th>Mixed Air Temperature</th>
          <th>Humidity Ratio</th>
          <th>Enthalpy</th>
          <th>Heating Energy</th>
          <th>Humifog Pump Energy</th>
          <th>Total Energy</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`opt-report-${row.oaPercent}`} className={row.oaPercent === optimal.oaPercent ? 'highlight-row' : ''}>
            <td>{formatNumber(row.oaPercent, 0)}%</td>
            <td>{formatNumber(row.raPercent, 0)}%</td>
            <td>{formatTemp(row.tmix, units)}</td>
            <td>{formatHumidity(row.wmix, units)}</td>
            <td>{formatEnthalpy(row.hmix, units)}</td>
            <td>{formatEnergy(row.heatingEnergyKwh)}</td>
            <td>{formatEnergy(row.humidificationEnergyKwh)}</td>
            <td>{formatEnergy(row.totalEnergyKwh)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AirStateTable({ state, units, includeVolume = false }) {
  if (!state) return null

  return (
    <KeyValueTable rows={[
      ['Dry Bulb', formatTemp(state.db, units)],
      ['Relative Humidity', `${formatNumber(state.rh, 0)}%`],
      ['Humidity Ratio', formatHumidity(state.w, units)],
      ['Enthalpy', formatEnthalpy(state.h, units)],
      ['Wet Bulb', formatTemp(state.wb, units)],
      ['Dew Point', formatTemp(state.dp, units)],
      ...(includeVolume ? [['Specific Volume', formatSpecificVolume(state, units)]] : []),
    ]} />
  )
}

function OrderedList({ items }) {
  return (
    <ol className="report-list">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ol>
  )
}

function KpiGrid({ items }) {
  return (
    <div className="kpi-grid">
      {items.map(([label, value]) => (
        <div className="kpi" key={label}>
          <span>{label}</span>
          <strong>{value || '-'}</strong>
        </div>
      ))}
    </div>
  )
}

function FormulaBlock({ lines }) {
  return (
    <div className="formula-block">
      {lines.map((line) => <div key={line}>{line}</div>)}
    </div>
  )
}

function LineGraph({ title, data, color, yLabel, yTransform = (value) => value }) {
  const values = data.map((item) => yTransform(item.y)).filter(Number.isFinite)
  const minY = Math.min(...values, 0)
  const maxY = Math.max(...values, 1)
  const points = data.map((item, index) => {
    const x = 34 + index * (286 / Math.max(data.length - 1, 1))
    const y = 150 - ((yTransform(item.y) - minY) / Math.max(maxY - minY, 1)) * 112
    return { x, y, label: item.x }
  })

  return (
    <div className="graph-card">
      <h3>{title}</h3>
      <svg viewBox="0 0 360 210">
        <line x1="34" y1="150" x2="330" y2="150" stroke="#94a3b8" />
        <line x1="34" y1="24" x2="34" y2="150" stroke="#94a3b8" />
        <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth="3" />
        {points.map((point) => (
          <g key={`${title}-${point.label}`}>
            <circle cx={point.x} cy={point.y} r="4" fill={color} />
            <text x={point.x} y="174" textAnchor="middle" fontSize="9">{point.label}%</text>
          </g>
        ))}
        <text x="330" y="28" textAnchor="end" fontSize="10" fill="#475569">{yLabel}</text>
      </svg>
    </div>
  )
}

function BarGraph({ title, data, color }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const barWidth = 280 / Math.max(data.length, 1)

  return (
    <div className="graph-card">
      <h3>{title}</h3>
      <svg viewBox="0 0 360 225">
        <line x1="34" y1="150" x2="330" y2="150" stroke="#94a3b8" />
        <line x1="34" y1="28" x2="34" y2="150" stroke="#94a3b8" />
        {data.map((item, index) => {
          const height = (item.value / maxValue) * 112
          const x = 42 + index * barWidth
          const labelX = x + Math.max(8, barWidth - 6) / 2
          return (
            <g key={`${title}-${item.label}`}>
              <rect x={x} y={150 - height} width={Math.max(8, barWidth - 6)} height={height} fill={color} opacity="0.82" />
              <text
                x={labelX}
                y="165"
                textAnchor="start"
                fontSize="7"
                transform={`rotate(55 ${labelX} 165)`}
              >
                {item.label}
              </text>
            </g>
          )
        })}
        <text x="330" y="28" textAnchor="end" fontSize="10" fill="#475569">kWh</text>
      </svg>
    </div>
  )
}

function EnergyBreakdownGraph({ title, data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  let offset = 34

  return (
    <div className="graph-card">
      <h3>{title}</h3>
      <svg viewBox="0 0 360 190">
        <rect x="34" y="70" width="292" height="42" fill="#e2e8f0" />
        {data.map((item) => {
          const width = (item.value / total) * 292
          const x = offset
          offset += width
          return (
            <g key={item.label}>
              <rect x={x} y="70" width={width} height="42" fill={item.color} />
              <text x={x + width / 2} y="96" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">
                {width > 42 ? item.label : ''}
              </text>
            </g>
          )
        })}
        {data.map((item, index) => (
          <g key={`legend-${item.label}`}>
            <rect x="42" y={132 + index * 16} width="10" height="10" fill={item.color} />
            <text x="58" y={141 + index * 16} fontSize="10">{item.label}: {formatEnergy(item.value)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function HeatMap({ title, rows, units }) {
  const bins = rows[0]?.rows || []
  const values = rows.flatMap((row) => (row.rows || []).map((bin) => bin.totalEnergyKwh))
  const minValue = Math.min(...values, 0)
  const maxValue = Math.max(...values, 1)

  return (
    <div className="graph-card heatmap-card">
      <h3>{title}</h3>
      <table className="heatmap">
        <thead>
          <tr>
            <th>OA%</th>
            {bins.map((bin) => <th key={`hm-head-${bin.tempC}`}>{formatTemp(bin.tempC, units)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`hm-row-${row.oaPercent}`}>
              <th>{formatNumber(row.oaPercent, 0)}%</th>
              {(row.rows || []).map((bin) => (
                <td
                  key={`hm-${row.oaPercent}-${bin.tempC}`}
                  style={{ backgroundColor: heatColor(bin.totalEnergyKwh, minValue, maxValue) }}
                >
                  {formatNumber(bin.totalEnergyKwh, 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatPointLabel(label) {
  const isFrench = activeReportLanguage === 'fr'
  const labels = {
    'Outdoor air': isFrench ? 'Air extérieur' : 'Outdoor Air',
    'Return air': isFrench ? 'Air de retour' : 'Return Air',
    'Mixed air': isFrench ? 'Air mélangé' : 'Mixed Air',
    'After Thermal Wheel': isFrench ? 'Après roue thermique' : 'After Thermal Wheel',
    'After thermal wheel': isFrench ? 'Après roue thermique' : 'After Thermal Wheel',
    'After Recovery': isFrench ? 'Après récupération' : 'After Energy Recovery',
    'After recovery': isFrench ? 'Après récupération' : 'After Energy Recovery',
    'After Humifog': isFrench ? 'Après Humifog' : 'After Humifog',
    'After preheat Humifog': isFrench ? 'Après préchauffage Humifog' : 'After Preheat Humifog',
    'After heating': isFrench ? 'Après chauffage' : 'After Heating',
    Room: isFrench ? 'Conditions de la pièce' : 'Room Conditions',
  }

  return labels[label] || label
}

function cleanFrenchPdfText(value, isFrench) {
  if (!isFrench) return value

  return String(value || '')
    .replace(
      /Humifog\s+adiabatique\s+humidification\s+on\s+the\s+selected\s+AHU\s+configuration/gi,
      'Humidification adiabatique Humifog selon la configuration UTA sélectionnée'
    )
    .replace(
      /Humifog\s+adiabatic\s+humidification\s+on\s+the\s+selected\s+AHU\s+configuration/gi,
      'Humidification adiabatique Humifog selon la configuration UTA sélectionnée'
    )
}

function formatTemp(tempC, units, language = activeReportLanguage) {
  const value = units === 'imperial' ? tempC * 9 / 5 + 32 : tempC
  const unitLabel = units === 'imperial'
    ? (language === 'fr' ? '°F' : 'deg F')
    : (language === 'fr' ? '°C' : 'deg C')
  return `${formatNumber(value, 1, language)} ${unitLabel}`
}

function formatHumidity(humidityRatio, units) {
  const value = units === 'imperial' ? humidityRatio * 7000 : humidityRatio * 1000
  return `${formatNumber(value, units === 'imperial' ? 1 : 2, activeReportLanguage)} ${units === 'imperial' ? 'gr/lb' : 'g/kg'}`
}

function formatEnthalpy(enthalpyKjKg, units) {
  const value = units === 'imperial' ? enthalpyKjKg * 0.429923 : enthalpyKjKg
  const unitLabel = units === 'imperial'
    ? (activeReportLanguage === 'fr' ? 'BTU/lb' : 'Btu/lb')
    : 'kJ/kg'
  return `${formatNumber(value, 1, activeReportLanguage)} ${unitLabel}`
}

function formatSpecificVolume(state, units) {
  const valueM3Kg = 287.055 * (state.db + 273.15) * (1 + 1.6078 * state.w) / 101325

  if (units === 'imperial') {
    const unitLabel = activeReportLanguage === 'fr' ? 'pi³/lb da' : 'ft3/lb da'
    return `${formatNumber(valueM3Kg * 16.0185, 2, activeReportLanguage)} ${unitLabel}`
  }

  return `${formatNumber(valueM3Kg, 3, activeReportLanguage)} m3/kg da`
}

function formatFlow(cfm, units, language = activeReportLanguage) {
  if (units === 'metric') return `${formatNumber(cfm * 0.47195, 0, language)} L/s`
  return `${formatNumber(cfm, 0, language)} CFM`
}

function formatWater(lbHr, units) {
  if (units === 'metric') return `${formatNumber(lbHr * 0.453592, 1, activeReportLanguage)} kg/h`
  return `${formatNumber(lbHr, 1, activeReportLanguage)} lb/h`
}

function formatEnergy(kwh) {
  if (!Number.isFinite(Number(kwh))) return activeReportLanguage === 'fr' ? 'Non disponible' : 'Not available'
  return `${formatNumber(kwh, 0, activeReportLanguage)} kWh`
}

function formatPower(kw) {
  return `${formatNumber(kw, 1, activeReportLanguage)} kW`
}

function formatMoney(value) {
  if (!Number.isFinite(Number(value))) return activeReportLanguage === 'fr' ? 'Non disponible' : 'Not available'
  if (activeReportLanguage === 'fr') {
    return `${formatNumber(value, 0, activeReportLanguage)} $`
  }
  return `$${formatNumber(value, 0, activeReportLanguage)}`
}

function formatUtilityRate(value, digits = 3) {
  if (activeReportLanguage === 'fr') {
    return `${formatNumber(value, digits, activeReportLanguage)} $`
  }
  return `$${formatNumber(value, digits, activeReportLanguage)}`
}

function formatUtilityRateWithUnit(value, digits = 3, unit = '') {
  const rate = formatUtilityRate(value, digits)
  if (activeReportLanguage === 'fr') {
    return `${rate}/${unit}`
  }
  return `${rate} / ${unit}`
}

function formatSignedMoney(value) {
  const numeric = Number(value || 0)
  const sign = numeric > 0 ? '+' : numeric < 0 ? '-' : ''
  return `${sign}$${formatNumber(Math.abs(numeric), 0, activeReportLanguage)}`
}

function formatPayback(row) {
  if (row.reference) return 'Reference'
  if ((row.annualSavings || 0) <= 0 || row.paybackYears == null) return 'Not economical'
  if (row.paybackYears === 0) return 'Immediate'
  if (activeReportLanguage === 'fr') {
    const rounded = Number(formatNumber(row.paybackYears, 1, activeReportLanguage).replace(',', '.'))
    const unit = Math.abs(rounded - 1) < 0.0001 ? 'an' : 'ans'
    return `${formatNumber(row.paybackYears, 1, activeReportLanguage)} ${unit}`
  }
  return `${formatNumber(row.paybackYears, 1, activeReportLanguage)} years`
}

function formatNumber(value, digits = 1, language = activeReportLanguage) {
  const locale = String(language || '').toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA'
  return Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function heatColor(value, minValue, maxValue) {
  const ratio = (value - minValue) / Math.max(maxValue - minValue, 1)
  const hue = 120 - ratio * 120
  return `hsl(${hue}, 78%, 88%)`
}

