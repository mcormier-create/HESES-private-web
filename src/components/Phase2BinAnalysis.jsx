import { useMemo, useState } from 'react'
import { calculateBinAnalysis, cityBinData } from '../calculations/binAnalysis'

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

export default function Phase2BinAnalysis() {
  const [inputs, setInputs] = useState({
    cityKey: 'montreal',
    roomDb: 22,
    roomRh: 40,
    outdoorAirPercent: 30,
    recoveryType: 'enthalpyWheel',
    humidificationType: 'humifog',
    humidificationTargetRh: 45,
    humifogEffectiveness: 85,
  })

  const analysis = useMemo(() => calculateBinAnalysis(inputs), [inputs])

  const updateNumber = (key, value) => {
    setInputs((current) => ({ ...current, [key]: Number(value) }))
  }

  const updateValue = (key, value) => {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="bg-slate-100 px-6 pb-8 text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 border-t border-slate-300 pt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-cyan-700">Phase 2</div>
          <h1 className="text-4xl font-black mt-2">Analyse BIN et optimisation OA/RA</h1>
          <p className="text-slate-600 mt-2">
            Reutilise le moteur psychrometrique de la Phase 1 pour chaque BIN.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <aside className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Entrees Phase 2</h2>
            <InputGroup title="Ville">
              <SelectField value={inputs.cityKey} onChange={(value) => updateValue('cityKey', value)}>
                {Object.entries(cityBinData).map(([key, city]) => (
                  <option key={key} value={key}>{city.label}</option>
                ))}
              </SelectField>
            </InputGroup>
            <InputGroup title="Piece">
              <NumberField label="Temperature piece" value={inputs.roomDb} unit="C" onChange={(value) => updateNumber('roomDb', value)} />
              <NumberField label="HR piece" value={inputs.roomRh} unit="%" min={0} max={100} onChange={(value) => updateNumber('roomRh', value)} />
            </InputGroup>
            <InputGroup title="Ventilation">
              <NumberField label="OA" value={inputs.outdoorAirPercent} unit="%" min={0} max={100} onChange={(value) => updateNumber('outdoorAirPercent', value)} />
              <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-200 text-sm">
                RA <strong className="float-right">{100 - inputs.outdoorAirPercent}%</strong>
              </div>
            </InputGroup>
            <InputGroup title="Recuperation">
              <SelectField value={inputs.recoveryType} onChange={(value) => updateValue('recoveryType', value)}>
                {recoveryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </SelectField>
            </InputGroup>
            <InputGroup title="Humidification">
              <SelectField value={inputs.humidificationType} onChange={(value) => updateValue('humidificationType', value)}>
                {humidificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </SelectField>
              <NumberField label="Cible HR" value={inputs.humidificationTargetRh} unit="%" min={0} max={100} onChange={(value) => updateNumber('humidificationTargetRh', value)} />
              <NumberField label="Efficacite Humifog" value={inputs.humifogEffectiveness} unit="%" min={0} max={100} onChange={(value) => updateNumber('humifogEffectiveness', value)} />
            </InputGroup>
          </aside>

          <div className="grid gap-6">
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Kpi label="OA optimal" value={`${format(analysis.optimal.oaPercent, 0)}%`} />
              <Kpi label="RA optimal" value={`${format(analysis.optimal.raPercent, 0)}%`} />
              <Kpi label="Tmix optimal" value={`${format(analysis.optimal.tmix)} C`} />
              <Kpi label="Energie minimale" value={`${format(analysis.optimal.total, 0)} kWh`} />
            </section>

            <Panel title="Tableau BIN">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200">
                      {['BIN', 'Hrs', 'OA', 'RA', 'Tmix', 'Wmix', 'hmix', 'Chauffage', 'Total'].map((heading) => (
                        <th key={heading} className="py-2 pr-4 font-black text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.rows.map((row) => (
                      <tr key={`${row.bin.tempC}-${row.bin.hours}`} className="border-b border-slate-100">
                        <td className="py-2 pr-4">{format(row.bin.tempC, 0)} C / {format(row.bin.rh, 0)}% RH</td>
                        <td className="py-2 pr-4">{row.bin.hours}</td>
                        <td className="py-2 pr-4">{format(row.outdoorAirPercent, 0)}%</td>
                        <td className="py-2 pr-4">{format(row.returnAirPercent, 0)}%</td>
                        <td className="py-2 pr-4">{format(row.mixed.db)} C</td>
                        <td className="py-2 pr-4">{format(row.mixed.w * 1000, 3)} g/kg</td>
                        <td className="py-2 pr-4">{format(row.mixed.h)} kJ/kg</td>
                        <td className="py-2 pr-4">{format(row.heatingKwh, 0)} kWh</td>
                        <td className="py-2 pr-4 font-black">{format(row.totalKwh, 0)} kWh</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Optimisation OA/RA">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200">
                      {['OA %', 'Tmix', 'Chauffage', 'Humifog', 'Total'].map((heading) => (
                        <th key={heading} className="py-2 pr-4 font-black text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.matrix.map((row) => (
                      <tr key={row.oaPercent} className={`border-b border-slate-100 ${row.oaPercent === analysis.optimal.oaPercent ? 'bg-emerald-50' : ''}`}>
                        <td className="py-2 pr-4 font-black">{row.oaPercent}%</td>
                        <td className="py-2 pr-4">{format(row.tmix)} C</td>
                        <td className="py-2 pr-4">{format(row.heating, 0)} kWh</td>
                        <td className="py-2 pr-4">{format(row.humifog, 0)} kWh</td>
                        <td className="py-2 pr-4 font-black">{format(row.total, 0)} kWh</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Comparaison Free Cooling versus Humifog">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ComparisonCard title="Free Cooling" data={analysis.comparison.freeCooling} />
                <ComparisonCard title="Humifog" data={analysis.comparison.humifog} />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </section>
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

function NumberField({ label, value, unit, min, max, onChange }) {
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
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2"
        />
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
    </label>
  )
}

function SelectField({ value, children, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
    >
      {children}
    </select>
  )
}

function Panel({ title, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h2 className="text-lg font-black mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Kpi({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <div className="text-3xl font-black mt-2">{value}</div>
    </div>
  )
}

function ComparisonCard({ title, data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-xl font-black mb-3">{title}</h3>
      <dl className="grid gap-2">
        <Metric label="OA moyen" value={`${format(data.averageOa, 0)}%`} />
        <Metric label="Tmix moyen" value={`${format(data.averageTmix)} C`} />
        <Metric label="Chauffage" value={`${format(data.heatingKwh, 0)} kWh`} />
        <Metric label="Humidification" value={`${format(data.humidificationKwh, 0)} kWh`} />
        <Metric label="Energie totale" value={`${format(data.totalKwh, 0)} kWh`} />
      </dl>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
      <dt className="text-sm font-bold text-slate-500">{label}</dt>
      <dd className="font-black">{value}</dd>
    </div>
  )
}

function format(value, digits = 1) {
  return new Intl.NumberFormat('fr-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}
