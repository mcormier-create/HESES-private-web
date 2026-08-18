import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as psychrometrics from './src/calculations/psychrometrics.js'
import { calculateBinAnalysis } from './src/calculations/binAnalysis.js'
import { calculateFreeCoolingHumifogComparison } from './src/services/freeCoolingHumifogService.js'
import { calculateHvacDashboardMetrics } from './src/services/hvacEngineeringService.js'
import { createLocalHesesAnswer } from './server/hesesAssistantCore.mjs'
import { createHesesReportPdfMiddleware } from './server/hesesReportPdf.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const distRoot = path.join(root, 'dist')
const port = Number(process.env.PORT || 4173)
const isProduction = process.env.NODE_ENV === 'production'
const accessPassword = process.env.HESA_ACCESS_PASSWORD || ''
const cookieName = 'heses_private_access'
const sessions = new Map()
const failedLogins = new Map()
const apiRequests = new Map()
const reportRequests = new Map()
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000
const loginWindowMs = 15 * 60 * 1000
const requestWindowMs = 60 * 1000
const reportLimit = 20
const apiLimit = 180
const loginLimit = 10
const reportMiddleware = createHesesReportPdfMiddleware()

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function securityHeaders(response) {
  response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; object-src 'none'")
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('X-Frame-Options', 'DENY')
}

function isCrossSiteRequest(request) {
  return String(request.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site'
}

function isAllowedOrigin(request) {
  const origin = String(request.headers.origin || '').trim()
  if (!origin) return true

  try {
    const originUrl = new URL(origin)
    const forwardedProto = String(request.headers['x-forwarded-proto'] || (isProduction ? 'https' : 'http')).split(',')[0].trim()
    const forwardedHost = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim()
    const sameOrigin = originUrl.origin === `${forwardedProto}://${forwardedHost}`
    const canonicalOrigin = originUrl.origin === 'https://hesahvac.com'
    return sameOrigin || (!isProduction && (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')) || canonicalOrigin
  } catch {
    return false
  }
}

function isStateChangingRequest(request, pathname) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) || pathname === '/heses-logout'
}

function clientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim()
}

function rateLimited(store, key, windowMs, limit) {
  const now = Date.now()
  const current = store.get(key)
  if (!current || now - current.startedAt >= windowMs) {
    store.set(key, { startedAt: now, count: 1 })
    return false
  }
  current.count += 1
  return current.count > limit
}

function cleanupState() {
  const now = Date.now()
  for (const [token, createdAt] of sessions.entries()) if (now - createdAt > sessionTtlMs) sessions.delete(token)
  for (const store of [failedLogins, apiRequests, reportRequests]) {
    for (const [key, value] of store.entries()) if (now - value.startedAt > loginWindowMs) store.delete(key)
  }
}

function cookies(request) {
  return String(request.headers.cookie || '').split(';').map((part) => part.trim().split('=')).filter(([name, value]) => name && value).reduce((result, [name, ...value]) => ({ ...result, [name]: value.join('=') }), {})
}

function authenticated(request) {
  cleanupState()
  const token = cookies(request)[cookieName]
  return Boolean(token && sessions.has(token))
}

function readBody(request, maxBytes = 8_000_000) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > maxBytes) {
        request.destroy()
        reject(new Error('Payload too large'))
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function loginPage(language = 'fr', error = '') {
  const en = language === 'en'
  const copy = en
    ? { title: 'Private Testing Access', subtitle: 'Humidification Energy System Analysis', prompt: 'This pre-release version of HESA is currently available by invitation only.', security: 'For your security, only enter your HESA access password at hesahvac.com.', label: 'Password', submit: 'ACCESS HESA', error: 'Incorrect password. Please try again.' }
    : { title: 'Accès privé - Version d’essai', subtitle: 'Analyse énergétique des systèmes d’humidification', prompt: 'Cette version préliminaire de HESA est actuellement accessible sur invitation seulement.', security: 'Pour votre sécurité, entrez votre mot de passe HESA uniquement sur hesahvac.com.', label: 'Mot de passe', submit: 'ACCÉDER À HESA', error: 'Mot de passe incorrect. Veuillez réessayer.' }
  return `<!doctype html><html lang="${en ? 'en' : 'fr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HESA - ${copy.title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef3f7;font-family:Arial,sans-serif;color:#102f4e}main{width:min(90vw,430px);padding:36px;border:1px solid #d8e1ea;border-radius:24px;background:#fff;box-shadow:0 24px 60px #0f3a5b24}.brand{margin-bottom:26px;color:#0f3a5b;font-weight:800;letter-spacing:.12em}h1{margin:0 0 8px;font-size:28px}h2{margin:0 0 18px;color:#52677d;font-size:17px;font-weight:500}p{color:#475569;line-height:1.5}.security{font-size:13px;color:#52677d}label{display:block;margin:18px 0 8px;font-weight:700}input,button{box-sizing:border-box;width:100%;padding:13px 14px;border-radius:10px;font-size:16px}input{border:1px solid #94a3b8}button{margin-top:14px;border:0;background:#0f3a5b;color:#fff;font-weight:800}nav{display:flex;gap:12px;margin-top:20px}nav a{color:#0f3a5b}.error{padding:11px 12px;border-radius:10px;background:#fee2e2;color:#991b1b;font-weight:700}</style></head><body><main><div class="brand">HESA</div><h1>${copy.title}</h1><h2>${copy.subtitle}</h2><p>${copy.prompt}</p><p class="security">${copy.security}</p>${error ? `<div class="error">${error}</div>` : ''}<form method="post" action="/heses-login"><input type="hidden" name="language" value="${en ? 'en' : 'fr'}"><label for="password">${copy.label}</label><input id="password" name="accessPassword" type="password" autocomplete="current-password" autofocus><button type="submit">${copy.submit}</button></form><nav><a href="/heses-login?lang=fr">Français</a><a href="/heses-login?lang=en">English</a></nav></main></body></html>`
}

function sendLoginPage(response, language = 'fr', error = '') {
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end(loginPage(language, error))
}

async function handleAuth(request, response) {
  const url = new URL(request.url || '/', 'http://heses.local')
  if (isStateChangingRequest(request, url.pathname) && (isCrossSiteRequest(request) || !isAllowedOrigin(request))) {
    console.warn(`[HESA security] blocked cross-origin state change from ${clientIp(request)} on ${url.pathname}`)
    sendJson(response, 403, { error: 'Cross-origin request blocked.' })
    return true
  }
  if (!accessPassword) {
    response.statusCode = 503
    sendLoginPage(response, url.searchParams.get('lang') || 'fr', 'Private access is not configured on this server.')
    return true
  }
  if (url.pathname === '/heses-login' && request.method === 'POST') {
    const ip = clientIp(request)
    const state = failedLogins.get(ip)
    if (state && Date.now() - state.startedAt < loginWindowMs && state.count >= loginLimit) {
      response.statusCode = 429
      sendLoginPage(response, 'fr', 'Too many attempts. Please try again later.')
      return true
    }
    const form = new URLSearchParams(await readBody(request, 50_000))
    const language = form.get('language') === 'en' ? 'en' : 'fr'
    const expected = Buffer.from(accessPassword)
    const received = Buffer.from(String(form.get('accessPassword') || ''))
    const valid = expected.length === received.length && crypto.timingSafeEqual(expected, received)
    if (valid) {
      const token = crypto.randomBytes(32).toString('base64url')
      sessions.set(token, Date.now())
      response.statusCode = 302
      response.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProduction ? '; Secure' : ''}`)
      response.setHeader('Location', '/')
      response.end()
      return true
    }
    rateLimited(failedLogins, ip, loginWindowMs, loginLimit)
    console.warn(`[HESA security] failed login attempt for ${ip}`)
    response.statusCode = 200
    sendLoginPage(response, language, language === 'en' ? 'Incorrect password. Please try again.' : 'Mot de passe incorrect. Veuillez réessayer.')
    return true
  }
  if (url.pathname === '/heses-logout') {
    const token = cookies(request)[cookieName]
    if (token) sessions.delete(token)
    response.statusCode = 302
    response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`)
    response.setHeader('Location', '/heses-login')
    response.end()
    return true
  }
  if (url.pathname === '/heses-login') {
    sendLoginPage(response, url.searchParams.get('lang') || 'fr')
    return true
  }
  if (authenticated(request)) return false
  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 401, { error: 'Acces prive HESA requis.' })
    return true
  }
  sendLoginPage(response, 'fr')
  return true
}

async function handleCalculation(request, response) {
  const url = new URL(request.url || '/', 'http://heses.local')
  if (request.method !== 'POST' || !url.pathname.startsWith('/api/calculate/')) return false
  const payload = JSON.parse(await readBody(request))
  const input = payload.input || payload
  const operation = url.pathname.slice('/api/calculate/'.length)
  const result = operation === 'psychrometrics'
    ? psychrometrics.psychrometricState(input)
    : operation === '100oa'
      ? calculateHvacDashboardMetrics(input)
      : operation === 'free-cooling'
        ? calculateFreeCoolingHumifogComparison(input)
        : operation === 'annual'
          ? calculateBinAnalysis(input)
          : null
  if (!result) {
    sendJson(response, 404, { error: 'Unknown HESA calculation operation.' })
    return true
  }
  sendJson(response, 200, { ok: true, result })
  return true
}

async function handleAssistant(request, response) {
  const url = new URL(request.url || '/', 'http://heses.local')
  if (request.method === 'GET' && url.pathname === '/api/heses-assistant/health') {
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.HESES_OPENAI_MODEL || 'gpt-4.1-mini',
    })
    return true
  }

  if (request.method !== 'POST' || url.pathname !== '/api/heses-assistant') return false

  try {
    const payload = JSON.parse(await readBody(request, 1_500_000))
    const question = String(payload.question || '').trim()
    if (!question) {
      sendJson(response, 400, { error: 'Question manquante.' })
      return true
    }
    sendJson(response, 200, {
      answer: createLocalHesesAnswer({ question, context: payload.context || {} }),
      configured: false,
      provider: 'local-heses-context',
    })
    return true
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Assistant request failed.' })
    return true
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url || '/', 'http://heses.local')
  let relative = decodeURIComponent(url.pathname)
  if (relative === '/') relative = '/index.html'
  const candidate = path.resolve(distRoot, `.${relative}`)
  const isAssetRequest = relative.startsWith('/assets/') || relative.startsWith('/images/') || relative.startsWith('/system-images/') || relative.startsWith('/weather/')
  const isSpaRoute = !path.extname(relative) && !isAssetRequest
  const safeCandidate = candidate.startsWith(`${distRoot}${path.sep}`) && !isSpaRoute
    ? candidate
    : path.join(distRoot, 'index.html')
  try {
    const data = await fs.readFile(safeCandidate)
    const extension = path.extname(safeCandidate).toLowerCase()
    const contentType = extension === '.html'
      ? 'text/html; charset=utf-8'
      : extension === '.js'
        ? 'text/javascript; charset=utf-8'
        : extension === '.css'
          ? 'text/css; charset=utf-8'
          : extension === '.svg'
            ? 'image/svg+xml'
            : extension === '.png'
              ? 'image/png'
              : extension === '.jpg' || extension === '.jpeg'
                ? 'image/jpeg'
                : extension === '.webp'
                  ? 'image/webp'
                  : extension === '.json'
                    ? 'application/json; charset=utf-8'
                    : 'application/octet-stream'
    response.setHeader('Content-Type', contentType)
    response.setHeader('Cache-Control', extension === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable')
    response.end(data)
  } catch {
    response.statusCode = 404
    response.end('Not found')
  }
}

const server = http.createServer(async (request, response) => {
  securityHeaders(response)
  try {
    if (await handleAuth(request, response)) return
    const url = new URL(request.url || '/', 'http://heses.local')
    if (url.pathname.startsWith('/api/')) {
      const store = url.pathname.startsWith('/api/heses-report') ? reportRequests : apiRequests
      if (rateLimited(store, clientIp(request), requestWindowMs, url.pathname.startsWith('/api/heses-report') ? reportLimit : apiLimit)) {
        console.warn(`[HESA security] API rate limit exceeded for ${clientIp(request)} on ${url.pathname}`)
        sendJson(response, 429, { error: 'Too many requests. Please try again later.' })
        return
      }
    }
    if (await handleCalculation(request, response)) return
    if (await handleAssistant(request, response)) return
    if (url.pathname.startsWith('/api/')) {
      await new Promise((resolve) => reportMiddleware(request, response, resolve))
      if (!response.writableEnded) sendJson(response, 404, { error: 'Not found' })
      return
    }
    await serveStatic(request, response)
  } catch (error) {
    if (!response.writableEnded) sendJson(response, 400, { error: error instanceof Error ? error.message : 'Request failed.' })
  }
})

server.listen(port, '0.0.0.0', () => console.log(`HESA production server listening on ${port}`))
