import {
  cassetteSystemTypeImages,
  crossflowSystemTypeImages,
  freeCoolingSystemTypeImages,
  getSystemSchematic,
  glycolLoopSystemTypeImages,
  systemImages,
  thermalWheelSystemTypeImages,
} from '../utils/systemImages'

const componentText = {
  fr: {
    heading: 'Schéma du système sélectionné',
    imageAlt: 'Schéma CTA professionnel',
    outsideAirMode: '100 % air extérieur',
    freeCoolingReturnAir: 'Free Cooling + retour air',
    freeCoolingNoRecovery: 'Free Cooling sans récupération thermique',
    plateExchanger: 'Échangeur à plaques',
    noRecovery: 'Aucune récupération',
    thermalWheel: 'Roue thermique',
    outdoorAirPercent: '% air extérieur',
    returnAirPercent: '% air retour',
    totalAirflow: 'Débit total',
    humifogLoad: 'Charge Humifog',
    outdoorTemp: 'Temp. extérieure',
    returnTemp: 'Temp. retour',
    mixedAirTemp: 'Temp\u00e9rature m\u00e9lange',
    supplyTemp: 'Temp. soufflage',
    energySavings: 'Économies énergie',
    recovery: 'Énergie récupérée',
    hpHeating: 'Réchauffage HP',
    humifogPump: 'Humifog HP',
    oaAirflow: 'Débit OA',
    outdoorAir: 'Air extérieur (OA)',
    returnAir: 'Air repris (RA)',
    oaDamper: 'Volet OA',
    returnDamper: 'Volet retour',
    exhaustDamper: 'Volet rejet',
    supplyAirflow: 'Débit soufflé',
    afterThermalWheel: 'Après roue thermique',
    afterRecovery: 'Après récupération',
    afterHumifog: 'Après Humifog',
    afterHeating: 'Après préchauffage Humifog',
    supplyAir: "Air d'alimentation (SA)",
  },
  en: {
    heading: 'Selected System Schematic',
    imageAlt: 'Professional AHU schematic',
    outsideAirMode: '100% Outdoor Air',
    freeCoolingReturnAir: 'Free Cooling + return air',
    freeCoolingNoRecovery: 'Free Cooling without heat recovery',
    plateExchanger: 'Plate heat exchanger',
    noRecovery: 'No heat recovery',
    thermalWheel: 'Thermal wheel',
    outdoorAirPercent: '% outdoor air',
    returnAirPercent: '% return air',
    totalAirflow: 'Total airflow',
    humifogLoad: 'Humifog load',
    outdoorTemp: 'Outdoor temp.',
    returnTemp: 'Return temp.',
    mixedAirTemp: 'Mixed air temperature',
    supplyTemp: 'Supply temp.',
    energySavings: 'Energy savings',
    recovery: 'Recovered energy',
    hpHeating: 'HP heating',
    humifogPump: 'Humifog pump',
    oaAirflow: 'OA airflow',
    outdoorAir: 'Outdoor air (OA)',
    returnAir: 'Return air (RA)',
    oaDamper: 'OA damper',
    returnDamper: 'Return damper',
    exhaustDamper: 'Exhaust damper',
    supplyAirflow: 'Supply airflow',
    afterThermalWheel: 'After thermal wheel',
    afterRecovery: 'After recovery',
    afterHumifog: 'After Humifog',
    afterHeating: 'After Humifog preheat',
    supplyAir: 'Supply air (SA)',
  },
}

const localizedSchematics = {
  outsideAirBasic: {
    fr: {
      modeLabel: '100 % air extérieur',
      recoveryLabel: 'Aucune récupération',
      recoveryPointLabel: 'Après filtration',
    },
    en: {
      modeLabel: '100% outdoor air',
      recoveryLabel: 'No heat recovery',
      recoveryPointLabel: 'After filtration',
    },
  },
  thermalWheelHumifog: {
    fr: {
      modeLabel: 'CTA avec retour/extraction',
      recoveryLabel: 'Roue thermique',
      recoveryPointLabel: 'Après roue thermique',
    },
    en: {
      modeLabel: 'AHU with return/exhaust air',
      recoveryLabel: 'Thermal wheel',
      recoveryPointLabel: 'After thermal wheel',
    },
  },
  crossflowHumifog: {
    fr: {
      modeLabel: 'CTA avec retour/extraction',
      recoveryLabel: 'Échangeur à débit croisé',
      recoveryPointLabel: 'Après échangeur à débit croisé',
    },
    en: {
      modeLabel: 'AHU with return/exhaust air',
      recoveryLabel: 'Cross-flow heat exchanger',
      recoveryPointLabel: 'After cross-flow exchanger',
    },
  },
  cassetteHumifog: {
    fr: {
      modeLabel: 'CTA avec retour/extraction',
      recoveryLabel: 'Échangeur à cassettes',
      recoveryPointLabel: 'Après échangeur à cassettes',
    },
    en: {
      modeLabel: 'AHU with return/exhaust air',
      recoveryLabel: 'Cassette heat exchanger',
      recoveryPointLabel: 'After cassette exchanger',
    },
  },
  glycolLoopHumifog: {
    fr: {
      modeLabel: 'CTA avec retour/extraction',
      recoveryLabel: 'Boucle glycolée',
      recoveryPointLabel: 'Après boucle glycolée',
    },
    en: {
      modeLabel: 'AHU with return/exhaust air',
      recoveryLabel: 'Run-around glycol loop',
      recoveryPointLabel: 'After glycol loop',
    },
  },
  freeCoolingHumifog: {
    fr: {
      modeLabel: 'Free Cooling + retour air',
      recoveryLabel: 'Aucune récupération thermique',
      recoveryPointLabel: 'Après mélange',
    },
    en: {
      modeLabel: 'Free Cooling + return air',
      recoveryLabel: 'No heat recovery',
      recoveryPointLabel: 'After mixing',
    },
  },
}

function parseDisplayNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const match = value.match(/-?[\d\s.,\u00A0]+/)
  if (!match) return null
  const normalized = match[0]
    .replace(/[\s\u00A0]/g, '')
    .replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseFlowWithUnit(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/(-?[\d\s.,\u00A0]+)(.*)/)
  if (!match) return null

  const parsedValue = parseDisplayNumber(match[1])
  if (!Number.isFinite(parsedValue)) return null
  return {
    value: parsedValue,
    unit: (match[2] || '').trim(),
  }
}

function formatFlowWithUnit(value, unit, lang) {
  if (!Number.isFinite(value)) return '-'
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const formattedValue = Math.round(value).toLocaleString(locale)
  return unit ? `${formattedValue} ${unit}` : formattedValue
}

export default function HVACSystemImage({
  schematicId = '',
  recoveryType = 'enthalpy',
  recoveryLabel = '',
  location = 'Montreal - Zone 6',
  systemDescription = 'AHU - Thermal wheel - Humifog - HP coil',
  isFreeCoolingMode = false,
  language = 'fr',
  data = {},
}) {
  const lang = language === 'en' ? 'en' : 'fr'
  const text = componentText[lang]
  const imageMap = {
    enthalpy: systemImages.thermalWheel,
    enthalpyWheel: systemImages.thermalWheel,
    thermalWheel: systemImages.thermalWheel,
    sensibleWheel: systemImages.thermalWheel,
    wheel: systemImages.thermalWheel,
    ...thermalWheelSystemTypeImages,
    freeCooling: systemImages.freeCooling,
    freeCoolingHumifog: systemImages.freeCoolingHumifog,
    freeCoolingHumifogHeating: systemImages.freeCoolingHumifogHeating,
    ...freeCoolingSystemTypeImages,
    crossflow: systemImages.crossflow,
    crossflowPlate: systemImages.crossflow,
    ...crossflowSystemTypeImages,
    cassette: systemImages.cassette,
    cassetteSensible: systemImages.cassetteSensible,
    cassetteEnthalpy: systemImages.cassetteEnthalpy,
    ...cassetteSystemTypeImages,
    glycol: systemImages.glycolLoop,
    glycolLoop: systemImages.glycolLoop,
    ...glycolLoopSystemTypeImages,
    plate: systemImages.crossflow,
    basic: systemImages.basic,
    none: systemImages.basic,
    humifog: systemImages.humifog,
    heating: systemImages.heatingCoilHumifog,
    heatingCoil: systemImages.heatingCoilHumifog,
    serpentin: systemImages.heatingCoilHumifog,
    serpentinChauffage: systemImages.heatingCoilHumifog,
  }

  const normalizedRecoveryType = String(recoveryType || 'enthalpy')
  const normalizedRecoveryTypeKey = normalizedRecoveryType
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const isCrossflow =
    normalizedRecoveryTypeKey.includes('crossflow') ||
    normalizedRecoveryTypeKey.includes('cross-flow') ||
    normalizedRecoveryTypeKey.includes('debit croise')
  const isCassette = normalizedRecoveryTypeKey.includes('cassette')
  const isGlycolLoop =
    normalizedRecoveryTypeKey.includes('glycol') ||
    normalizedRecoveryTypeKey.includes('glycolée') ||
    normalizedRecoveryTypeKey.includes('glycolee') ||
    normalizedRecoveryTypeKey.includes('run-around')
  const isFreeCoolingSystem =
    isFreeCoolingMode ||
    normalizedRecoveryTypeKey.includes('freecooling') ||
    normalizedRecoveryTypeKey.includes('free cooling') ||
    normalizedRecoveryTypeKey.includes('free_cooling')
  const isHeatingCoilSystem =
    normalizedRecoveryTypeKey.includes('heating') ||
    normalizedRecoveryTypeKey.includes('chauffage') ||
    normalizedRecoveryTypeKey.includes('serpentin')
  const isWheelSystem =
    normalizedRecoveryTypeKey.includes('wheel') ||
    normalizedRecoveryTypeKey.includes('roue') ||
    normalizedRecoveryTypeKey.includes('enthalpy')
  const inferredSchematicId = isFreeCoolingSystem
    ? 'freeCoolingHumifog'
    : isCassette
      ? 'cassetteHumifog'
      : isGlycolLoop
        ? 'glycolLoopHumifog'
        : isCrossflow
          ? 'crossflowHumifog'
          : isWheelSystem
            ? 'thermalWheelHumifog'
            : 'outsideAirBasic'
  const schematic = getSystemSchematic(schematicId || inferredSchematicId)
  const localizedSchematic = localizedSchematics[schematic.id]?.[lang] ?? localizedSchematics.outsideAirBasic[lang]
  const fallbackImageSrc = systemImages.fallback
  const legacyImageSrc = isFreeCoolingSystem
    ? systemImages.freeCooling
    : isCassette
      ? systemImages.cassette
      : isGlycolLoop
        ? systemImages.glycolLoop
        : isCrossflow
          ? systemImages.crossflow
          : isHeatingCoilSystem
            ? systemImages.heatingCoilHumifog
            : imageMap[normalizedRecoveryType] || fallbackImageSrc
  const imageSrc = schematic.imageSrc || legacyImageSrc
  const isPlate = isCrossflow || ['crossflow', 'crossflowPlate', 'plate'].includes(normalizedRecoveryType)
  const recoveryBadgeLabel = recoveryLabel || (
    localizedSchematic.recoveryLabel ||
    (isFreeCoolingSystem
      ? text.freeCoolingNoRecovery
      : isPlate
        ? text.plateExchanger
        : normalizedRecoveryType === 'none'
          ? text.noRecovery
          : text.thermalWheel)
  )
  const kpis = isFreeCoolingSystem
    ? [
        { title: text.outdoorAirPercent, value: data.oaPercent ?? '-' },
        { title: text.returnAirPercent, value: data.raPercent ?? '-' },
        { title: text.totalAirflow, value: data.totalAirflow ?? data.airflow ?? '-' },
        { title: text.humifogLoad, value: data.humifogLoad ?? '-' },
        { title: text.outdoorTemp, value: data.oaTemp ?? '-' },
        { title: text.returnTemp, value: data.raTemp ?? '-' },
        { title: text.supplyTemp, value: data.saTemp ?? '-' },
        { title: text.energySavings, value: data.energySavings ?? '-' },
      ]
    : [
        { title: normalizedRecoveryType === 'none' ? text.noRecovery : text.recovery, value: data.recoveryKw ?? '-' },
        { title: text.hpHeating, value: data.heatingKw ?? '-' },
        { title: text.humifogPump, value: data.humifogKw ?? '-' },
        { title: text.oaAirflow, value: data.airflow ?? '-' },
      ]
  const parsedTotalFlow = parseFlowWithUnit(String(data.totalAirflow ?? data.supplyAirFlow ?? data.airflow ?? ''))
  const parsedOaPercent = parseDisplayNumber(String(data.oaPercent ?? ''))
  const canComputeFreeCoolingFlows = Boolean(
    isFreeCoolingSystem &&
    parsedTotalFlow &&
    Number.isFinite(parsedTotalFlow.value) &&
    Number.isFinite(parsedOaPercent)
  )
  const computedOutdoorAirFlow = canComputeFreeCoolingFlows
    ? parsedTotalFlow.value * (parsedOaPercent / 100)
    : null
  const computedReturnAirFlow = canComputeFreeCoolingFlows
    ? parsedTotalFlow.value - computedOutdoorAirFlow
    : null
  const computedExhaustAirFlow = canComputeFreeCoolingFlows
    ? computedOutdoorAirFlow
    : null
  const computedSupplyAirFlow = canComputeFreeCoolingFlows
    ? parsedTotalFlow.value
    : null
  const displayedOutdoorAirFlow = canComputeFreeCoolingFlows
    ? formatFlowWithUnit(computedOutdoorAirFlow, parsedTotalFlow.unit, lang)
    : (data.outsideAirFlow ?? data.airflow ?? '-')
  const displayedReturnAirFlow = canComputeFreeCoolingFlows
    ? formatFlowWithUnit(computedReturnAirFlow, parsedTotalFlow.unit, lang)
    : (data.returnAirFlow ?? '-')
  const displayedExhaustAirFlow = canComputeFreeCoolingFlows
    ? formatFlowWithUnit(computedExhaustAirFlow, parsedTotalFlow.unit, lang)
    : (data.exhaustAirFlow ?? data.outsideAirFlow ?? '-')
  const displayedSupplyAirFlow = canComputeFreeCoolingFlows
    ? formatFlowWithUnit(computedSupplyAirFlow, parsedTotalFlow.unit, lang)
    : (data.supplyAirFlow ?? data.totalAirflow ?? '-')
  const labelPositions = isFreeCoolingSystem
    ? {
        outdoorAir: 'left-[4%] top-[38%]',
        returnAir: 'right-[4%] top-[21%]',
        oaDamper: 'left-[14%] top-[46%]',
        returnDamper: 'right-[13%] top-[30%]',
        exhaustDamper: 'left-[3%] top-[21%]',
        mixedAir: 'left-[39%] top-[62%]',
        supplyAirflow: 'right-[4%] top-[47%]',
        afterHumifog: 'left-[62%] top-[33%]',
        afterHeating: 'left-[53%] top-[33%]',
        supplyAir: 'right-[4%] top-[58%]',
      }
    : {
        outdoorAir: 'left-[4%] top-[38%]',
        afterHumifog: 'left-[70%] top-[10%]',
        afterHeating: 'left-[56%] top-[10%]',
        supplyAir: 'right-[4%] top-[38%]',
      }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {text.heading}
          </h2>
          <p className="text-lg text-slate-600">{location}</p>
          <p className="mt-2 inline-flex rounded-lg bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            {systemDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-4 py-2 font-semibold ${
            isFreeCoolingSystem
              ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {localizedSchematic.modeLabel || (isFreeCoolingSystem ? text.freeCoolingReturnAir : text.outsideAirMode)}
          </span>
          {!isFreeCoolingSystem && (
            <span className="rounded-full bg-blue-600 px-4 py-2 font-semibold text-white">
              {recoveryBadgeLabel}
            </span>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <img
          key={imageSrc}
          src={imageSrc}
          alt={text.imageAlt}
          className={isFreeCoolingSystem ? 'hvac-system-image hvac-system-image--free-cooling' : 'hvac-system-image'}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onLoad={(event) => {
            console.info(`HVAC image loaded: ${new URL(event.currentTarget.src).pathname}`)
          }}
          onError={(event) => {
            const image = event.currentTarget
            if (image.dataset.fallbackApplied === 'true') return
            console.error(`HVAC image not found: ${imageSrc}`)
            image.dataset.fallbackApplied = 'true'
            image.src = fallbackImageSrc
          }}
        />

        <OverlayLabel
          className={labelPositions.outdoorAir}
          title={text.outdoorAir}
          value={data.oaTemp ?? '-'}
          sub={isFreeCoolingSystem && data.oaPercent ? `${data.oaPercent} OA` : localizeHumidityText(data.oaRh, lang)}
          color="blue"
        />

        {isFreeCoolingSystem && (
          <OverlayLabel
            className={labelPositions.returnAir}
            title={text.returnAir}
            value={data.raTemp ?? '-'}
            sub={data.raPercent ? `${data.raPercent} RA` : localizeHumidityText(data.raRh, lang)}
            color="orange"
          />
        )}

        {isFreeCoolingSystem && (
          <>
            <AnimatedFlowLabel
              className={labelPositions.oaDamper}
              title={text.oaDamper}
              value={displayedOutdoorAirFlow}
              color="blue"
            />
            <AnimatedFlowLabel
              className={labelPositions.returnDamper}
              title={text.returnDamper}
              value={displayedReturnAirFlow}
              color="orange"
            />
            <AnimatedFlowLabel
              className={labelPositions.exhaustDamper}
              title={text.exhaustDamper}
              value={displayedExhaustAirFlow}
              color="red"
            />
            <OverlayLabel
              className={labelPositions.mixedAir}
              title={text.mixedAirTemp}
              value={data.mixedAirTemp ?? '-'}
              sub={data.mixedAirSub ?? ''}
              color="green"
            />
            <AnimatedFlowLabel
              className={labelPositions.supplyAirflow}
              title={text.supplyAirflow}
              value={displayedSupplyAirFlow}
              color="blue"
            />
          </>
        )}

        {!isFreeCoolingSystem && (
          <OverlayLabel
            className="left-[40%] top-[10%]"
            title={localizedSchematic.recoveryPointLabel || (isWheelSystem ? text.afterThermalWheel : text.afterRecovery)}
            value={data.afterRecoveryTemp ?? '-'}
            sub={localizeHumidityText(data.afterRecoveryRh, lang)}
            color="green"
          />
        )}

        <OverlayLabel
          className={labelPositions.afterHumifog}
          title={text.afterHumifog}
          value={data.afterHumifogTemp ?? '-'}
          sub={localizeHumidityText(data.afterHumifogRh, lang)}
          color="purple"
        />

        <OverlayLabel
          className={labelPositions.afterHeating}
          title={text.afterHeating}
          value={data.afterHeatingTemp ?? '-'}
          sub={localizeHumidityText(data.afterHeatingRh, lang)}
          color="red"
        />

        <OverlayLabel
          className={labelPositions.supplyAir}
          title={text.supplyAir}
          value={data.saTemp ?? '-'}
          sub={localizeHumidityText(data.saRh, lang)}
          color="blue"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {kpis.map((item) => (
          <Kpi key={item.title} title={item.title} value={item.value} />
        ))}
      </div>
    </section>
  )
}

function localizeHumidityText(value, language) {
  if (!value) return ''
  return language === 'en' ? String(value).replace(/^HR\b/i, 'RH') : value
}

function AnimatedFlowLabel({ className, title, value, color }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }

  const dotColors = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  }

  return (
    <div className={`absolute rounded-full border px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur ${colors[color]} ${className}`}>
      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${dotColors[color]} animate-pulse`} />
      <span>{title}</span>
      <span className="ml-2 font-bold">{value}</span>
    </div>
  )
}

function OverlayLabel({ className, title, value, sub, color }) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <div
      className={`absolute rounded-xl border px-3 py-2 text-center text-xs shadow-sm backdrop-blur ${colors[color]} ${className}`}
    >
      <div className="font-semibold">{title}</div>
      <div className="text-lg font-bold">{value}</div>
      <div>{sub}</div>
    </div>
  )
}

function Kpi({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
    </div>
  )
}
