import { useMemo, useState } from 'react'
import {
  applyHeatingToDryBulb,
  applyHeatRecovery,
  applyHumifogCooling,
  applySteamHumidification,
  mixAirStates,
  overrideDryBulbKeepingHumidityRatio,
  psychrometricState,
} from '../calculations/psychrometrics'

const recoveryOptions = [
  { value: 'none', label: 'Aucun' },
  { value: 'sensibleWheel', label: 'Roue sensible' },
  { value: 'enthalpyWheel', label: 'Roue enthalpique' },
  { value: 'crossflowPlate', label: 'Plaque debit croise' },
]

const humidificationOptions = [
  { value: 'steam', label: 'Vapeur' },
  { value: 'humifog', label: 'Humifog' },
]

export default function PsychrometricPhase1() {
  const [inputs, setInputs] = useState({
    outdoorDb: -10,
    outdoorRh: 70,
    roomDb: 22,
    roomRh: 40,
    outdoorAirPercent: 30,
    recoveryType: 'none',
    humidificationType: 'steam',
    humidificationTargetRh: 45,
    humifogEffectiveness: 85,
    useValidatedMixDb: false,
    validatedMixDb: 12,
  })

  const results = useMemo(() => {
    const oa = psychrometricState({
      dryBulbC: inputs.outdoorDb,
      relativeHumidity: inputs.outdoorRh,
    })
    const ra = psychrometricState({
      dryBulbC: inputs.roomDb,
      relativeHumidity: inputs.roomRh,
    })
    const calculatedMixed = mixAirStates(oa, ra, inputs.outdoorAirPercent)
    const mixed = inputs.useValidatedMixDb
      ? overrideDryBulbKeepingHumidityRatio(calculatedMixed, inputs.validatedMixDb)
      : calculatedMixed
    const recovered = applyHeatRecovery(mixed, ra, inputs.recoveryType)
    const afterHumidification = inputs.humidificationType === 'humifog'
      ? applyHumifogCooling(recovered, inputs.humifogEffectiveness / 100)
      : applySteamHumidification(recovered, inputs.humidificationTargetRh)
    const heated = applyHeatingToDryBulb(afterHumidification, inputs.roomDb)

    return {
      oa,
      ra,
      calculatedMixed,
      mixed,
      recovered,
      afterHumidification,
      heated,
    }
  }, [inputs])

  const updateNumber = (key, value) => {
    setInputs((current) => ({ ...current, [key]: Number(value) }))
  }

  const updateValue = (key, value) => {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  const updateChecked = (key, value) => {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  const returnAirPercent = 100 - inputs.outdoorAirPercent

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="text-xs font-bold uppercase tracking-widest text-cyan-700">Phase 1</div>
          <h1 className="text-4xl font-black mt-2">Moteur psychrometrique</h1>
          <p className="text-slate-600 mt-2">
            Calculs de base seulement: OA, RA, recuperation, melange et humidification.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Entrees</h2>

            <InputGroup title="Conditions exterieures">
              <NumberField label="Temperature exterieure" value={inputs.outdoorDb} unit="C" onChange={(value) => updateNumber('outdoorDb', value)} />
              <NumberField label="HR exterieure" value={inputs.outdoorRh} unit="%" min={0} max={100} onChange={(value) => updateNumber('outdoorRh', value)} />
            </InputGroup>

            <InputGroup title="Conditions piece">
              <NumberField label="Temperature piece" value={inputs.roomDb} unit="C" onChange={(value) => updateNumber('roomDb', value)} />
              <NumberField label="HR piece" value={inputs.roomRh} unit="%" min={0} max={100} onChange={(value) => updateNumber('roomRh', value)} />
            </InputGroup>

            <InputGroup title="Ventilation">
              <NumberField label="OA" value={inputs.outdoorAirPercent} unit="%" min={0} max={100} onChange={(value) => updateNumber('outdoorAirPercent', value)} />
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-200">
                <span className="text-sm font-semibold text-slate-600">RA</span>
                <strong>{returnAirPercent}%</strong>
              </div>
            </InputGroup>

            <InputGroup title="Validation">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={inputs.useValidatedMixDb}
                  onChange={(event) => updateChecked('useValidatedMixDb', event.target.checked)}
                />
                <span className="text-sm font-semibold text-slate-700">Utiliser T melange validee</span>
              </label>
              <NumberField
                label="T melange validee"
                value={inputs.validatedMixDb}
                unit="C"
                disabled={!inputs.useValidatedMixDb}
                onChange={(value) => updateNumber('validatedMixDb', value)}
              />
              <div className="rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900 border border-cyan-100">
                T melange calculee: <strong>{format(results.calculatedMixed.db)} C</strong>
              </div>
            </InputGroup>

            <InputGroup title="Recuperation">
              <SelectField value={inputs.recoveryType} options={recoveryOptions} onChange={(value) => updateValue('recoveryType', value)} />
            </InputGroup>

            <InputGroup title="Humidification">
              <SelectField value={inputs.humidificationType} options={humidificationOptions} onChange={(value) => updateValue('humidificationType', value)} />
              <NumberField label="Cible HR melange" value={inputs.humidificationTargetRh} unit="%" min={0} max={100} onChange={(value) => updateNumber('humidificationTargetRh', value)} />
              <NumberField label="Efficacite Humifog" value={inputs.humifogEffectiveness} unit="%" min={0} max={100} onChange={(value) => updateNumber('humifogEffectiveness', value)} />
            </InputGroup>
          </section>

          <section className="grid gap-5">
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-bold mb-4">Affichage du procede</h2>
              <div className="grid gap-3">
                <ProcessPoint label="OA" state={results.oa} />
                <ProcessArrow />
                <ProcessPoint label="MELANGE" state={results.mixed} note={`${inputs.outdoorAirPercent}% OA / ${returnAirPercent}% RA`} />
                <ProcessArrow />
                <ProcessPoint label="RECUPERATION" state={results.recovered} note={selectedLabel(recoveryOptions, inputs.recoveryType)} />
                <ProcessArrow />
                <ProcessPoint
                  label={inputs.humidificationType === 'humifog' ? 'HUMIFOG' : 'VAPEUR'}
                  state={results.afterHumidification}
                  note={inputs.humidificationType === 'humifog'
                    ? `T sortie = T recuperation - eta x (T recuperation - Twb recuperation)`
                    : `Cible ${inputs.humidificationTargetRh}% RH`}
                />
                <ProcessArrow />
                <ProcessPoint label="CHAUFFAGE" state={results.heated} note={`Chauffage a ${inputs.roomDb} C`} />
                <ProcessArrow />
                <ProcessPoint label="PIECE" state={results.ra} />
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-bold mb-4">Calculer</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <StateCard title="OA" subtitle="Air exterieur" state={results.oa} />
                <StateCard title="RA" subtitle="Air retour piece" state={results.ra} />
                <StateCard title="Melange" subtitle={inputs.useValidatedMixDb ? 'T melange validee' : 'T melange calculee'} state={results.mixed} />
                <StateCard title="Apres recuperation" subtitle={selectedLabel(recoveryOptions, inputs.recoveryType)} state={results.recovered} compact />
                <StateCard title={inputs.humidificationType === 'humifog' ? 'Apres Humifog' : 'Apres vapeur'} subtitle={`Eau ajoutee ${format(results.afterHumidification.addedWaterGKg ?? 0, 2)} g/kg`} state={results.afterHumidification} compact />
                <StateCard title="Apres chauffage" subtitle={`DB cible ${inputs.roomDb} C`} state={results.heated} compact />
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  )
}

function InputGroup({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</h3>
      <div className="grid gap-2">{children}</div>
    </div>
  )
}

function NumberField({ label, value, unit, min, max, disabled = false, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <div className="grid grid-cols-[1fr_48px] gap-2 items-center">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step="0.1"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
        />
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
    </label>
  )
}

function SelectField({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

function StateCard({ title, subtitle, state, compact = false }) {
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="mb-4">
        <h2 className={compact ? 'text-xl font-black' : 'text-2xl font-black'}>{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <StateTable rows={stateRows(state, compact)} />
    </article>
  )
}

function ProcessPoint({ label, state, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h3 className="text-xl font-black">{label}</h3>
        {note && <span className="text-xs font-bold text-slate-500">{note}</span>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniMetric label="T" value={`${format(state.db)} C`} />
        <MiniMetric label="RH" value={`${format(state.rh)} %`} />
        <MiniMetric label="W" value={`${format(state.w * 1000, 3)} g/kg`} />
        <MiniMetric label="h" value={`${format(state.h)} kJ/kg`} />
      </div>
    </div>
  )
}

function ProcessArrow() {
  return <div className="text-center text-2xl font-black text-cyan-700 leading-none">↓</div>
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
      <div className="text-xs font-bold text-slate-400">{label}</div>
      <div className="text-base font-black">{value}</div>
    </div>
  )
}

function stateRows(state, compact) {
  const rows = [
        ['DB', `${format(state.db)} C`],
        ['RH', `${format(state.rh)} %`],
        ['W', `${format(state.w * 1000, 3)} g/kg`],
        ['h', `${format(state.h)} kJ/kg`],
  ]

  if (!compact) {
    rows.push(['WB', `${format(state.wb)} C`], ['DP', `${format(state.dp)} C`])
  }

  return rows
}

function StateTable({ rows }) {
  return (
    <dl className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-2">
          <dt className="text-sm font-bold text-slate-500">{label}</dt>
          <dd className="text-base font-black">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function selectedLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value
}

function format(value, digits = 1) {
  return new Intl.NumberFormat('fr-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}
