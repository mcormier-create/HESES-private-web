import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { calculateBinAnalysis, cityBinData } from '../calculations/binAnalysis'

const defaultInputs = {
  cityKey: 'montreal',
  roomDb: 22,
  roomRh: 40,
  outdoorAirPercent: 30,
  recoveryType: 'enthalpyWheel',
  humidificationType: 'humifog',
  humidificationTargetRh: 45,
  humifogEffectiveness: 85,
}

export default function Phase3Dashboard() {
  const [cityKey, setCityKey] = useState(defaultInputs.cityKey)
  const analysis = useMemo(() => calculateBinAnalysis({ ...defaultInputs, cityKey }), [cityKey])

  const savings = Math.max(0, analysis.comparison.freeCooling.totalKwh - analysis.comparison.humifog.totalKwh)
  const annualDollars = savings * 0.12
  const heatingReduction = Math.max(0, analysis.comparison.freeCooling.heatingKwh - analysis.comparison.humifog.heatingKwh)
  const humidificationReduction = Math.max(0, analysis.comparison.freeCooling.humidificationKwh - analysis.comparison.humifog.humidificationKwh)
  const roi = annualDollars > 0 ? 18000 / annualDollars : 0
  const ges = savings * 0.0015
  const totalRange = getRange(analysis.matrix.map((row) => row.total))
  const savingsByBin = analysis.rows.map((row) => ({
    bin: `${format(row.bin.tempC, 0)} C`,
    savings: Math.max(0, analysis.optimal.total / analysis.rows.length - row.totalKwh),
  }))

  const openPdfReport = () => {
    const win = window.open('', '_blank', 'width=1100,height=900')
    if (!win) return

    win.document.write(`
      <html>
        <head>
          <title>Rapport HVAC Phase 3</title>
          <style>
            body { font-family: Arial, sans-serif; color: #172033; padding: 32px; }
            h1 { font-size: 30px; margin-bottom: 8px; }
            h2 { margin-top: 28px; border-bottom: 1px solid #d7dee8; padding-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #e4e9ef; padding: 8px; text-align: left; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
            .card { border: 1px solid #d7dee8; border-radius: 8px; padding: 12px; }
            .value { font-size: 22px; font-weight: 800; }
          </style>
        </head>
        <body>
          <h1>Rapport HVAC Enersol - Phase 3</h1>
          <p>Ville: ${analysis.city.label}</p>
          <h2>Sommaire executif</h2>
          <div class="grid">
            <div class="card"><div>OA optimal</div><div class="value">${format(analysis.optimal.oaPercent, 0)}%</div></div>
            <div class="card"><div>Energie minimale</div><div class="value">${format(analysis.optimal.total, 0)} kWh</div></div>
            <div class="card"><div>Economies</div><div class="value">${format(savings, 0)} kWh</div></div>
          </div>
          <h2>Analyse psychrometrique</h2>
          <p>Tmix optimal: ${format(analysis.optimal.tmix)} C. OA moyen Humifog: ${format(analysis.comparison.humifog.averageOa, 0)}%.</p>
          <h2>Analyse BIN</h2>
          <table><thead><tr><th>BIN</th><th>Heures</th><th>Total</th></tr></thead><tbody>
            ${analysis.rows.map((row) => `<tr><td>${format(row.bin.tempC, 0)} C</td><td>${row.bin.hours}</td><td>${format(row.totalKwh, 0)} kWh</td></tr>`).join('')}
          </tbody></table>
          <h2>Optimisation OA/RA</h2>
          <p>OA optimal: ${format(analysis.optimal.oaPercent, 0)}%. RA optimal: ${format(analysis.optimal.raPercent, 0)}%.</p>
          <h2>Comparaison Free Cooling vs Humifog</h2>
          <p>Free Cooling: ${format(analysis.comparison.freeCooling.totalKwh, 0)} kWh. Humifog: ${format(analysis.comparison.humifog.totalKwh, 0)} kWh.</p>
          <h2>Economies annuelles</h2>
          <p>${format(savings, 0)} kWh / ${format(annualDollars, 0)} $.</p>
          <h2>ROI</h2>
          <p>${roi > 0 ? `${format(roi)} ans` : 'Non applicable'}</p>
          <h2>GES</h2>
          <p>Reduction estimee: ${format(ges, 1)} t CO2e.</p>
        </body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-cyan-700">Phase 3</div>
            <h1 className="mt-2 text-4xl font-black">Dashboard professionnel</h1>
            <p className="mt-2 text-slate-600">Visualisation seulement, basee sur les donnees deja calculees en Phase 2.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={cityKey}
              onChange={(event) => setCityKey(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold"
            >
              {Object.entries(cityBinData).map(([key, city]) => (
                <option key={key} value={key}>{city.label}</option>
              ))}
            </select>
            <button onClick={openPdfReport} className="rounded-xl bg-red-600 px-5 py-2 font-black text-white shadow">
              Rapport PDF
            </button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiGroup title="Free Cooling" items={[
            ['OA moyen', `${format(analysis.comparison.freeCooling.averageOa, 0)}%`],
            ['Tmix moyen', `${format(analysis.comparison.freeCooling.averageTmix)} C`],
            ['Energie annuelle', `${format(analysis.comparison.freeCooling.totalKwh, 0)} kWh`],
          ]} />
          <KpiGroup title="Humifog" items={[
            ['OA moyen', `${format(analysis.comparison.humifog.averageOa, 0)}%`],
            ['Tmix moyen', `${format(analysis.comparison.humifog.averageTmix)} C`],
            ['Energie annuelle', `${format(analysis.comparison.humifog.totalKwh, 0)} kWh`],
          ]} />
          <KpiGroup title="Economies" accent items={[
            ['kWh', `${format(savings, 0)} kWh`],
            ['$', `${format(annualDollars, 0)} $`],
            ['Reduction chauffage', `${format(heatingReduction, 0)} kWh`],
            ['Reduction humidification', `${format(humidificationReduction, 0)} kWh`],
          ]} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartPanel title="Graphique 1 - Energie totale vs OA %">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analysis.matrix}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="oaPercent" tickFormatter={(value) => `${value}%`} />
                <YAxis />
                <Tooltip formatter={(value) => `${format(value, 0)} kWh`} />
                <Bar dataKey="total" fill="#0891b2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Graphique 2 - Temperature de melange vs OA %">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analysis.matrix}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="oaPercent" tickFormatter={(value) => `${value}%`} />
                <YAxis />
                <Tooltip formatter={(value) => `${format(value)} C`} />
                <Line type="monotone" dataKey="tmix" stroke="#16a34a" strokeWidth={3} dot />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Graphique 3 - Economies par BIN">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={savingsByBin}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bin" />
                <YAxis />
                <Tooltip formatter={(value) => `${format(value, 0)} kWh`} />
                <Area type="monotone" dataKey="savings" stroke="#0f766e" fill="#99f6e4" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Graphique 4 - Carte thermique kWh">
            <HeatMap matrix={analysis.matrix} rows={analysis.rows} range={totalRange} />
          </ChartPanel>
        </section>
      </div>
    </main>
  )
}

function KpiGroup({ title, items, accent = false }) {
  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <h2 className="mb-4 text-xl font-black">{title}</h2>
      <dl className="grid gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
            <dt className="text-sm font-bold text-slate-500">{label}</dt>
            <dd className="text-lg font-black">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function ChartPanel({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  )
}

function HeatMap({ matrix, rows, range }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left">OA %</th>
            {rows.map((row) => (
              <th key={`${row.bin.tempC}-${row.bin.hours}`} className="p-2 text-center">
                {format(row.bin.tempC, 0)} C
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.oaPercent}>
              <th className="p-2 text-left">{row.oaPercent}%</th>
              {rows.map((binRow, index) => {
                const cellValue = row.total / rows.length + binRow.totalKwh * 0.08
                return (
                  <td
                    key={`${row.oaPercent}-${binRow.bin.tempC}`}
                    className="rounded-md p-2 text-center font-bold"
                    style={{ background: heatColor(cellValue, range), color: '#102033' }}
                  >
                    {format(cellValue, 0)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function getRange(values) {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function heatColor(value, range) {
  const ratio = range.max === range.min ? 0 : (value - range.min) / (range.max - range.min)
  const hue = 120 - ratio * 120
  return `hsl(${hue}, 78%, 78%)`
}

function format(value, digits = 1) {
  return new Intl.NumberFormat('fr-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}
