import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalHesesAnswer } from './hesesAssistantCore.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

loadEnvFile(path.join(projectRoot, '.env'))

const PORT = Number(process.env.HESES_ASSISTANT_PORT || 8787)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.HESES_OPENAI_MODEL || 'gpt-4.1-mini'

const HESES_SYSTEM_PROMPT = `
Tu es Assistant HESES - Beta, une fonction secondaire de presentation et d'explication pour le logiciel HESES. Tu es specialise en HVAC, humidification, psychrometrie, recuperation d'energie, free cooling, vapeur et Humifog.

Regles strictes:
- Tu n'es jamais le moteur de calcul HESES.
- Tu ne modifies jamais les calculs, les hypotheses, les resultats, les BIN, les OA/RA, les temperatures, les energies, les couts ou le ROI.
- Tu expliques, resumes et commentes uniquement les resultats deja calcules par HESES.
- Utilise uniquement les donnees HESES fournies dans le contexte JSON de la requete.
- Ne jamais inventer de valeur, de cout, d'economie, de temperature, de debit, de rendement, de charge ou de conclusion.
- Si une donnee manque, reponds clairement: "L'information est manquante dans les donnees HESES fournies."
- Explique les resultats en langage d'ingenierie clair et prudent.
- Les calculs fiables, PDF, Excel, graphiques, ROI, comparaison vapeur vs Humifog et images HVAC sont prioritaires dans HESES; ton role est secondaire.
- Compare Vapeur vs Humifog seulement avec les donnees presentes.
- Ne compare jamais Humifog a la vapeur en supposant la meme temperature de melange.
- Pour la vapeur, utilise le scenario vapeur/free cooling fourni. Pour Humifog, utilise le scenario Humifog fourni, avec son propre OA/RA, sa propre temperature de melange, son refroidissement adiabatique et son rechauffage eventuel.
- Si le contexte ne fournit pas les deux temperatures de melange distinctes, dis que cette information est manquante au lieu de les rendre identiques.
- Tu peux expliquer le bilan annuel Free Cooling, les economies Humifog, les BIN qui contribuent le plus, le rechauffage apres Humifog, les economies annuelles, la reduction en %, et rediger un court texte technique pour rapport.
- Indique les limites: estimation preliminaire, validation d'ingenierie requise, controles de gel et contraintes de conception a verifier.
- Ne mentionne jamais une valeur qui n'est pas explicitement dans le contexte.
- Ne demande jamais la cle API et ne dis jamais qu'elle est cote client.
- Reponds dans la langue demandee par l'interface HESES quand elle est fournie.
`.trim()

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(payload))
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1).trim()
    const value = rawValue
      .replace(/^['"]/, '')
      .replace(/['"]$/, '')

    if (!process.env[key]) process.env[key] = value
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_500_000) {
        request.destroy()
        reject(new Error('Payload too large'))
      }
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON payload'))
      }
    })
    request.on('error', reject)
  })
}

function compactContext(context) {
  return JSON.stringify(context, (_key, value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value.toFixed(4)) : null
    }
    return value
  })
}

async function askOpenAI({ question, context }) {
  if (!OPENAI_API_KEY) {
    return {
      answer: createLocalHesesAnswer({ question, context }),
      configured: false,
      provider: 'local-heses-context',
    }
  }

  let response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: HESES_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              'Question utilisateur HESES:',
              question,
              '',
              'Contexte JSON HESES actuellement affiche dans linterface:',
              compactContext(context),
            ].join('\n'),
          },
        ],
      }),
    })
  } catch {
    return {
      answer: createLocalHesesAnswer({ question, context }),
      configured: true,
      provider: 'local-heses-context',
      fallbackReason: "OpenAI ne repond pas; mode local HESES actif.",
    }
  }

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    return {
      answer: createLocalHesesAnswer({ question, context }),
      configured: true,
      provider: 'local-heses-context',
      fallbackReason: payload?.error?.message || `OpenAI API error ${response.status}; mode local HESES actif.`,
    }
  }

  return {
    answer: payload.output_text || "L'assistant n'a retourne aucun texte.",
    configured: true,
    model: OPENAI_MODEL,
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(OPENAI_API_KEY),
      model: OPENAI_MODEL,
    })
    return
  }

  if (request.method !== 'POST' || request.url !== '/api/heses-assistant') {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  try {
    const payload = await readJson(request)
    const question = String(payload.question || '').trim()

    if (!question) {
      sendJson(response, 400, { error: 'Question manquante.' })
      return
    }

    const result = await askOpenAI({
      question,
      context: payload.context || {},
    })

    sendJson(response, 200, result)
  } catch (error) {
    const statusCode = normalizeErrorStatus(error)
    sendJson(response, statusCode, {
      error: normalizeAssistantError(error, statusCode),
    })
  }
})

function normalizeErrorStatus(error) {
  const statusCode = Number(error?.statusCode)
  if ([400, 401, 403, 429, 500, 503].includes(statusCode)) return statusCode
  return 500
}

function normalizeAssistantError(error, statusCode) {
  const message = error instanceof Error ? error.message : String(error || '')

  if (statusCode === 401) {
    return "OpenAI a refuse la requete: cle API serveur invalide ou expiree. Verifiez OPENAI_API_KEY dans .env, sans l'exposer dans React."
  }

  if (statusCode === 429) {
    return "OpenAI limite temporairement les requetes ou le quota du projet est atteint. Reessayez plus tard ou verifiez les limites du compte OpenAI."
  }

  if (statusCode === 503) {
    return message
  }

  return message || 'Assistant server error'
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`HESES assistant server listening on http://127.0.0.1:${PORT}`)
})
