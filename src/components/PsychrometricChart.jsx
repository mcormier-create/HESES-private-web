import { saturationHumidityRatio } from '../calculations/psychrometrics'

const CHART_WIDTH = 980
const CHART_HEIGHT = 640
const PLOT = {
  left: 76,
  top: 34,
  right: 58,
  bottom: 150,
}

const pointColors = {
  oa: '#0ea5e9',
  ra: '#f97316',
  mixed: '#64748b',
  recovered: '#22c55e',
  recovery: '#22c55e',
  heating: '#ef4444',
  heatingCoil: '#ef4444',
  humifog: '#06b6d4',
  supply: '#2563eb',
  room: '#7c3aed',
}

const labelOffsets = {
  oa: { dx: -30, dy: 48, align: 'right' },
  ra: { dx: 34, dy: 52, align: 'left' },
  mixed: { dx: -34, dy: 68, align: 'right' },
  recovered: { dx: 34, dy: 54, align: 'left' },
  recovery: { dx: 34, dy: 54, align: 'left' },
  heating: { dx: 70, dy: 56, align: 'left' },
  heatingCoil: { dx: 42, dy: 56, align: 'left' },
  humifog: { dx: 42, dy: 56, align: 'left' },
  supply: { dx: 42, dy: 54, align: 'left' },
  room: { dx: -184, dy: 52, align: 'right' },
}

const markerOffsets = {
  oa: { dx: -6, dy: 0 },
  ra: { dx: -12, dy: -12 },
  mixed: { dx: -12, dy: 12 },
  recovered: { dx: -8, dy: -14 },
  recovery: { dx: -8, dy: -14 },
  heating: { dx: 16, dy: 18 },
  heatingCoil: { dx: 14, dy: 12 },
  humifog: { dx: 12, dy: -14 },
  supply: { dx: 12, dy: 6 },
  room: { dx: -18, dy: -18 },
}

export default function PsychrometricChart({
  title,
  description,
  points,
  processOrder,
  gains = [],
  language = 'fr',
  units = 'metric',
  referencePointKey = '',
}) {
  const cleanPoints = (points || [])
    .filter((point) => point?.state && Number.isFinite(point.state.db) && Number.isFinite(point.state.w))
    .map((point, index) => ({
      ...point,
      number: index + 1,
      color: point.color || pointColors[point.key] || '#0f172a',
    }))

  const plotWidth = CHART_WIDTH - PLOT.left - PLOT.right
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom
  const minDb = cleanPoints.length ? Math.min(...cleanPoints.map((point) => point.state.db)) : -20
  const maxDb = cleanPoints.length ? Math.max(...cleanPoints.map((point) => point.state.db)) : 35
  const maxW = cleanPoints.length ? Math.max(...cleanPoints.map((point) => point.state.w)) : 0.018
  const tempMin = clamp(Math.floor(Math.min(-20, minDb - 5) / 5) * 5, -45, 20)
  const tempMax = clamp(Math.ceil(Math.max(35, maxDb + 5) / 5) * 5, 25, 55)
  const humidityMax = clamp(Math.ceil(Math.max(0.024, maxW * 1.35) * 1000 / 2) * 2 / 1000, 0.018, 0.04)
  const tempTicks = range(tempMin, tempMax, 5)
  const humidityTickStep = humidityMax > 0.03 ? 0.005 : 0.004
  const humidityTicks = range(0, humidityMax, humidityTickStep)
  const enthalpyTicks = range(0, 100, 10).filter((h) => h >= -10)
  const pointByKey = new Map(cleanPoints.map((point) => [point.key, point]))
  const orderedKeys = processOrder || ['oa', 'mixed', 'recovered', 'humifog', 'heating', 'room']
  const processPath = pathForKeys(orderedKeys, pointByKey, xScale, yScale)
  const referencePath = referencePointKey
    ? pathForKeys([orderedKeys[orderedKeys.length - 1], referencePointKey], pointByKey, xScale, yScale)
    : ''
  const referenceLabelPosition = referencePathLabelPosition(
    orderedKeys[orderedKeys.length - 1],
    referencePointKey,
    pointByKey,
    xScale,
    yScale
  )
  const returnPath = pathForKeys(['ra', 'mixed'], pointByKey, xScale, yScale)
  const pointLayouts = buildPointLayouts(cleanPoints, xScale, yScale)
  const humidificationGain = gains.find((item) => item.key === 'humidification')
  const otherGains = gains.filter((item) => item.key !== 'humidification')

  function xScale(tempC) {
    return PLOT.left + ((tempC - tempMin) / (tempMax - tempMin)) * plotWidth
  }

  function yScale(humidityRatio) {
    return PLOT.top + plotHeight - (humidityRatio / humidityMax) * plotHeight
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 border border-cyan-200">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          <p className="text-slate-500 mt-1">{description}</p>
        </div>
        <div className="bg-cyan-100 text-cyan-700 px-4 py-2 rounded-full text-sm font-semibold">
          {language === 'fr' ? 'Méthode ASHRAE - 101,325 kPa' : 'ASHRAE method - 101.325 kPa'}
        </div>
      </div>

      <div className="bg-slate-50 rounded-3xl border border-slate-200 p-3 overflow-x-auto">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="min-w-[940px] w-full h-[640px]">
          <defs>
            <linearGradient id="psychroChartBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <marker id="psychroArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#dc2626" />
            </marker>
          </defs>

          <rect width={CHART_WIDTH} height={CHART_HEIGHT} rx="18" fill="url(#psychroChartBg)" />
          <rect x={PLOT.left} y={PLOT.top} width={plotWidth} height={plotHeight} fill="#ffffff" stroke="#94a3b8" strokeWidth="1.4" />

          {tempTicks.map((tempC) => (
            <g key={`temp-${tempC}`}>
              <line x1={xScale(tempC)} y1={PLOT.top} x2={xScale(tempC)} y2={PLOT.top + plotHeight} stroke="#e2e8f0" strokeWidth="1" />
              <text x={xScale(tempC)} y={PLOT.top + plotHeight + 24} textAnchor="middle" fontSize="12" fill="#475569">
                {formatTemperature(tempC, units)}
              </text>
            </g>
          ))}

          {humidityTicks.map((humidityRatio) => (
            <g key={`w-${humidityRatio}`}>
              <line x1={PLOT.left} y1={yScale(humidityRatio)} x2={PLOT.left + plotWidth} y2={yScale(humidityRatio)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PLOT.left - 10} y={yScale(humidityRatio) + 4} textAnchor="end" fontSize="12" fill="#475569">
                {formatHumidityRatio(humidityRatio, units)}
              </text>
            </g>
          ))}

          {enthalpyTicks.map((enthalpy) => {
            const path = enthalpyPath(enthalpy, tempMin, tempMax, humidityMax, xScale, yScale)
            return path ? (
              <path key={`h-${enthalpy}`} d={path} fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="7 7" opacity="0.42" />
            ) : null
          })}

          {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((rh) => {
            const curve = relativeHumidityCurve(rh, tempMin, tempMax, humidityMax, xScale, yScale)
            return curve.path ? (
              <g key={`rh-${rh}`}>
                <path d={curve.path} fill="none" stroke={rh === 100 ? '#0284c7' : '#38bdf8'} strokeWidth={rh === 100 ? 2.6 : 1.3} opacity={rh === 100 ? 0.9 : 0.58} />
                <text
                  x={curve.label[0] - 6}
                  y={curve.label[1] - 5}
                  textAnchor="end"
                  fontSize="11"
                  fill="#0284c7"
                  fontWeight={rh === 100 ? '700' : '500'}
                >
                  {rh}%
                </text>
              </g>
            ) : null
          })}

          {processPath && (
            <path d={processPath} fill="none" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#psychroArrow)" />
          )}
          {referencePath && (
            <path d={referencePath} fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 6" opacity="0.9" />
          )}
          {referenceLabelPosition && (
            <text
              x={referenceLabelPosition.x}
              y={referenceLabelPosition.y}
              textAnchor="middle"
              fontSize="11"
              fill="#334155"
              fontWeight="700"
            >
              {language === 'fr' ? 'Cible pièce - référence seulement' : 'Room target - reference only'}
            </text>
          )}
          {returnPath && (
            <path d={returnPath} fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="8 7" />
          )}

          {pointLayouts.map((layout) => {
            const {
              point,
              baseX,
              baseY,
              markerX,
              markerY,
              hasMarkerOffset,
              labelX,
              labelY,
              labelWidth,
              labelHeight,
              labelTargetX,
            } = layout

            return (
              <g key={point.key}>
                {hasMarkerOffset && (
                  <>
                    <circle cx={baseX} cy={baseY} r="3.5" fill={point.color} opacity="0.42" />
                    <line x1={baseX} y1={baseY} x2={markerX} y2={markerY} stroke={point.color} strokeWidth="1" opacity="0.45" />
                  </>
                )}
                <line x1={markerX} y1={markerY} x2={labelTargetX} y2={labelY + 18} stroke={point.color} strokeWidth="1.2" opacity="0.55" />
                <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} rx="8" fill="white" stroke={point.color} strokeWidth="1.4" opacity="0.96" />
                <text x={labelX + 10} y={labelY + 18} fontSize="12" fill="#0f172a" fontWeight="800">
                  {point.number}. {translatePoint(point, language)}
                </text>
                <text x={labelX + 10} y={labelY + 36} fontSize="11" fill={point.color} fontWeight="700">
                  DB {formatTemperature(point.state.db, units)} | WB {formatTemperature(point.state.wb, units)}
                </text>
                <text x={labelX + 10} y={labelY + 52} fontSize="11" fill="#334155" fontWeight="700">
                  RH {formatNumber(point.state.rh, 0)}% | W {formatHumidityRatio(point.state.w, units)} {units === 'imperial' ? 'gr/lb' : 'g/kg'}
                </text>
                <text x={labelX + 10} y={labelY + 68} fontSize="11" fill="#334155" fontWeight="700">
                  h {formatEnthalpy(point.state.h, units)} {units === 'imperial' ? 'Btu/lb' : 'kJ/kg'}
                </text>
                <circle cx={markerX} cy={markerY} r="11" fill={point.color} stroke="white" strokeWidth="3" />
                <text x={markerX} y={markerY + 4} textAnchor="middle" fontSize="11" fill="white" fontWeight="800">
                  {point.number}
                </text>
              </g>
            )
          })}

          <text x={PLOT.left + plotWidth / 2} y={CHART_HEIGHT - 24} textAnchor="middle" fontSize="15" fill="#334155" fontWeight="800">
            {language === 'fr' ? 'Température sèche' : 'Dry bulb temperature'} ({units === 'imperial' ? '°F' : '°C'})
          </text>
          <text x="23" y={PLOT.top + plotHeight / 2} transform={`rotate(-90 23 ${PLOT.top + plotHeight / 2})`} textAnchor="middle" fontSize="15" fill="#334155" fontWeight="800">
            {language === 'fr' ? "Ratio d'humidité" : 'Humidity ratio'} ({units === 'imperial' ? 'gr/lb' : 'g/kg'})
          </text>
          <text x={PLOT.left + plotWidth - 10} y={PLOT.top + 18} textAnchor="end" fontSize="12" fill="#0284c7" fontWeight="700">
            {language === 'fr' ? 'Courbes HR' : 'RH curves'}
          </text>
          <text x={PLOT.left + plotWidth - 10} y={PLOT.top + 36} textAnchor="end" fontSize="12" fill="#b45309" fontWeight="700">
            {language === 'fr' ? "Lignes d'enthalpie" : 'Enthalpy lines'}
          </text>
          {humidificationGain && (
            <g>
              <rect
                x={PLOT.left}
                y={CHART_HEIGHT - 58}
                width={plotWidth}
                height="40"
                rx="10"
                fill="#eef2ff"
                stroke="#7c3aed"
                strokeWidth="1.4"
              />
              <text x={PLOT.left + 18} y={CHART_HEIGHT - 33} fontSize="14" fill="#4c1d95" fontWeight="900">
                {humidificationGain.label}
              </text>
              <text x={PLOT.left + plotWidth - 18} y={CHART_HEIGHT - 33} textAnchor="end" fontSize="16" fill="#4c1d95" fontWeight="900">
                {humidificationGain.value}
              </text>
            </g>
          )}
        </svg>
      </div>

      {otherGains.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {otherGains.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto mt-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              {[
                language === 'fr' ? 'Point' : 'Point',
                'DB',
                'RH',
                'W',
                'h',
                'WB',
                'DP',
                'v',
              ].map((heading) => (
                <th key={heading} className="p-3 text-center font-semibold text-slate-700 first:text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cleanPoints.map((point) => (
              <tr key={`chart-row-${point.key}`} className="border-b border-slate-100">
                <td className="p-3 font-semibold text-slate-700">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 text-xs font-bold text-white" style={{ backgroundColor: point.color }}>
                    {point.number}
                  </span>
                  {translatePoint(point, language)}
                </td>
                <td className="p-3 text-center font-bold text-slate-800">{formatTemperature(point.state.db, units)}</td>
                <td className="p-3 text-center">{formatNumber(point.state.rh, 0)}%</td>
                <td className="p-3 text-center">{formatHumidityRatio(point.state.w, units)} {units === 'imperial' ? 'gr/lb' : 'g/kg'}</td>
                <td className="p-3 text-center">{formatEnthalpy(point.state.h, units)} {units === 'imperial' ? 'Btu/lb' : 'kJ/kg'}</td>
                <td className="p-3 text-center">{formatTemperature(point.state.wb, units)}</td>
                <td className="p-3 text-center">{formatTemperature(point.state.dp, units)}</td>
                <td className="p-3 text-center">{formatSpecificVolume(point.state.v, units)} {units === 'imperial' ? 'ft3/lb' : 'm3/kg'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function relativeHumidityCurve(relativeHumidity, tempMin, tempMax, humidityMax, xScale, yScale) {
  const samples = []

  for (let tempC = tempMin; tempC <= tempMax; tempC += 0.75) {
    const humidityRatio = saturationHumidityRatio(tempC) * relativeHumidity / 100
    if (humidityRatio >= 0 && humidityRatio <= humidityMax) {
      samples.push([xScale(tempC), yScale(humidityRatio)])
    }
  }

  return {
    path: pathFromSamples(samples),
    label: samples[Math.max(0, samples.length - 1)] || [xScale(tempMin), yScale(0)],
  }
}

function buildPointLayouts(points, xScale, yScale) {
  const labelWidth = 230
  const labelHeight = 82
  const layouts = points.map((point) => {
    const baseX = xScale(point.state.db)
    const baseY = yScale(point.state.w)
    const markerOffset = markerOffsetForPoint(point)

    return {
      point,
      baseX,
      baseY,
      markerX: baseX + markerOffset.dx,
      markerY: baseY + markerOffset.dy,
      labelWidth,
      labelHeight,
      hasMarkerOffset: markerOffset.dx !== 0 || markerOffset.dy !== 0,
    }
  })

  distributeCloseMarkers(layouts)
  lockRoomMarkerNearHumifog(layouts)

  const placedLabels = []
  let humifogLabelBox = null
  return layouts.map((layout) => {
    const labelOffset = offsetForPoint(layout.point)
    const preferredX = labelOffset.align === 'right'
      ? layout.markerX + labelOffset.dx - labelWidth
      : layout.markerX + labelOffset.dx
    const preferredY = layout.markerY + labelOffset.dy
    let labelBox = layout.point.key === 'humifog'
      ? {
        labelX: clamp(CHART_WIDTH - PLOT.right - labelWidth - 24, 8, CHART_WIDTH - labelWidth - 8),
        labelY: clamp(PLOT.top + 86, 8, CHART_HEIGHT - labelHeight - 58),
        labelWidth,
        labelHeight,
      }
      : placeLabel(preferredX, preferredY, labelWidth, labelHeight, layout.markerX, placedLabels)

    if (layout.point.key === 'room' && humifogLabelBox) {
      labelBox = {
        labelX: clamp(humifogLabelBox.labelX + 8, 8, CHART_WIDTH - labelWidth - 8),
        labelY: clamp(humifogLabelBox.labelY + labelHeight + 10, 8, CHART_HEIGHT - labelHeight - 58),
        labelWidth,
        labelHeight,
      }
    }

    if (layout.point.key === 'humifog') {
      humifogLabelBox = labelBox
    }

    placedLabels.push(labelBox)

    return {
      ...layout,
      ...labelBox,
      labelTargetX: nearestLabelEdge(layout.markerX, labelBox.labelX, labelWidth),
    }
  })
}

function lockRoomMarkerNearHumifog(layouts) {
  const humifogLayout = layouts.find((layout) => layout.point.key === 'humifog')
  const roomLayout = layouts.find((layout) => layout.point.key === 'room')
  if (!humifogLayout || !roomLayout) return

  const sameAirState = distance(
    humifogLayout.baseX,
    humifogLayout.baseY,
    roomLayout.baseX,
    roomLayout.baseY
  ) < 6

  if (!sameAirState) return

  roomLayout.markerX = clamp(humifogLayout.markerX - 20, PLOT.left + 8, CHART_WIDTH - PLOT.right - 8)
  roomLayout.markerY = clamp(humifogLayout.markerY, PLOT.top + 8, CHART_HEIGHT - PLOT.bottom - 8)
  roomLayout.hasMarkerOffset = true
}

function markerOffsetForPoint(point) {
  if (point.key === 'room') {
    return { dx: -18, dy: -12 }
  }

  if (point.key === 'humifog') {
    return { dx: 12, dy: 20 }
  }

  if (point.number === 2) {
    return { dx: -32, dy: 8 }
  }

  if (point.number === 5) {
    return { dx: 34, dy: 10 }
  }

  return markerOffsets[point.key] || { dx: 0, dy: 0 }
}

function offsetForPoint(point) {
  if (point.key === 'room') {
    return { dx: -70, dy: -64, align: 'right' }
  }

  if (point.key === 'humifog') {
    return { dx: 42, dy: 126, align: 'left' }
  }

  if (point.number === 2) {
    return { dx: -52, dy: 54, align: 'right' }
  }

  if (point.number === 5) {
    return { dx: 72, dy: 58, align: 'left' }
  }

  return labelOffsets[point.key] || { dx: 16, dy: 52, align: 'left' }
}

function distributeCloseMarkers(layouts) {
  const clusters = []

  layouts.forEach((layout) => {
    const cluster = clusters.find((candidate) =>
      candidate.some((other) => distance(layout.baseX, layout.baseY, other.baseX, other.baseY) < 34)
    )

    if (cluster) {
      cluster.push(layout)
    } else {
      clusters.push([layout])
    }
  })

  clusters
    .filter((cluster) => cluster.length > 1)
    .forEach((cluster) => {
      const radius = cluster.length > 4 ? 32 : 24

      cluster.forEach((layout, index) => {
        const angle = (-90 + (360 / cluster.length) * index) * Math.PI / 180
        layout.markerX = clamp(layout.markerX + Math.cos(angle) * radius, PLOT.left + 8, CHART_WIDTH - PLOT.right - 8)
        layout.markerY = clamp(layout.markerY + Math.sin(angle) * radius, PLOT.top + 8, CHART_HEIGHT - PLOT.bottom - 8)
        layout.hasMarkerOffset = true
      })
    })
}

function placeLabel(preferredX, preferredY, labelWidth, labelHeight, markerX, placedLabels) {
  const verticalCandidates = [0, 26, 52, 78, 104, -26, -52, -78, -104, 132, -132]
  const horizontalStep = markerX > CHART_WIDTH / 2 ? -34 : 34
  const horizontalCandidates = [0, horizontalStep, -horizontalStep, horizontalStep * 2, -horizontalStep * 2]

  for (const hx of horizontalCandidates) {
    for (const vy of verticalCandidates) {
      const labelX = clamp(preferredX + hx, 8, CHART_WIDTH - labelWidth - 8)
      const labelY = clamp(preferredY + vy, 8, CHART_HEIGHT - labelHeight - 58)
      const candidate = { labelX, labelY, labelWidth, labelHeight }

      if (!placedLabels.some((placed) => boxesOverlap(candidate, placed, 10))) {
        return candidate
      }
    }
  }

  const stackedY = clamp(8 + placedLabels.length * (labelHeight + 8), 8, CHART_HEIGHT - labelHeight - 58)
  return {
    labelX: clamp(preferredX, 8, CHART_WIDTH - labelWidth - 8),
    labelY: stackedY,
    labelWidth,
    labelHeight,
  }
}

function nearestLabelEdge(markerX, labelX, labelWidth) {
  const leftDistance = Math.abs(markerX - labelX)
  const rightDistance = Math.abs(markerX - (labelX + labelWidth))
  return leftDistance < rightDistance ? labelX : labelX + labelWidth
}

function boxesOverlap(a, b, padding = 0) {
  return !(
    a.labelX + a.labelWidth + padding < b.labelX ||
    b.labelX + b.labelWidth + padding < a.labelX ||
    a.labelY + a.labelHeight + padding < b.labelY ||
    b.labelY + b.labelHeight + padding < a.labelY
  )
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2)
}

function enthalpyPath(enthalpyKjKg, tempMin, tempMax, humidityMax, xScale, yScale) {
  const samples = []

  for (let tempC = tempMin; tempC <= tempMax; tempC += 0.75) {
    const humidityRatio = (enthalpyKjKg - 1.006 * tempC) / (2501 + 1.86 * tempC)
    const saturation = saturationHumidityRatio(tempC)

    if (humidityRatio >= 0 && humidityRatio <= humidityMax && humidityRatio <= saturation) {
      samples.push([xScale(tempC), yScale(humidityRatio)])
    }
  }

  return pathFromSamples(samples)
}

function pathForKeys(keys, pointByKey, xScale, yScale) {
  const samples = keys
    .map((key) => pointByKey.get(key))
    .filter(Boolean)
    .map((point) => [xScale(point.state.db), yScale(point.state.w)])

  return pathFromSamples(samples)
}

function pathFromSamples(samples) {
  if (samples.length < 2) return ''
  return samples.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`).join(' ')
}

function translatePoint(point, language) {
  const fr = {
    'Outdoor air': 'Air extérieur (OA)',
    'Return air': 'Air de retour (RA)',
    'Mixed air': 'Air mélangé',
    'After thermal wheel': 'Après roue thermique',
    'After recovery': 'Après récupération',
    'After Humifog': 'Après Humifog',
    'After preheat Humifog': 'Après préchauffage Humifog',
    'After heating': 'Après chauffage',
    'After heating coil': 'Après serpentin',
    'Supply air': "Air d'alimentation",
    Room: 'Pièce',
  }
  const en = {
    'Outdoor air': 'Outdoor air (OA)',
    'Return air': 'Return air (RA)',
    'Mixed air': 'Mixed air',
    'After thermal wheel': 'After thermal wheel',
    'After recovery': 'After recovery',
    'After Humifog': 'After Humifog',
    'After preheat Humifog': 'After Humifog preheat',
    'After heating': 'After heating',
    'After heating coil': 'After heating coil',
    'Supply air': 'Supply air',
    Room: 'Room',
  }
  const labels = language === 'fr' ? fr : en

  return labels[point.label] || labels[point.key] || point.label
}

function formatTemperature(tempC, units) {
  const value = units === 'imperial' ? tempC * 9 / 5 + 32 : tempC
  return `${formatNumber(value, 1)}${units === 'imperial' ? '°F' : '°C'}`
}

function formatHumidityRatio(humidityRatio, units) {
  const value = units === 'imperial' ? humidityRatio * 7000 : humidityRatio * 1000
  return formatNumber(value, units === 'imperial' ? 1 : 2)
}

function formatEnthalpy(enthalpyKjKg, units) {
  const value = units === 'imperial' ? enthalpyKjKg * 0.429923 : enthalpyKjKg
  return formatNumber(value, units === 'imperial' ? 1 : 1)
}

function formatSpecificVolume(specificVolumeM3Kg, units) {
  const value = units === 'imperial' ? specificVolumeM3Kg * 16.0185 : specificVolumeM3Kg
  return formatNumber(value, units === 'imperial' ? 2 : 3)
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString('fr-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function range(start, end, step) {
  const values = []
  const safeStep = step || 1

  for (let value = start; value <= end + safeStep / 2; value += safeStep) {
    values.push(Number(value.toFixed(6)))
  }

  return values
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function referencePathLabelPosition(fromKey, toKey, pointByKey, xScale, yScale) {
  const fromPoint = pointByKey.get(fromKey)
  const toPoint = pointByKey.get(toKey)
  if (!fromPoint || !toPoint) return null

  const fromX = xScale(fromPoint.state.db)
  const fromY = yScale(fromPoint.state.w)
  const toX = xScale(toPoint.state.db)
  const toY = yScale(toPoint.state.w)

  return {
    x: (fromX + toX) / 2,
    y: (fromY + toY) / 2 - 8,
  }
}

function round(value) {
  return Math.round(value * 10) / 10
}
