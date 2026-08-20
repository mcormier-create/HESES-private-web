import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalHesesAnswer } from './server/hesesAssistantCore.mjs';
import { createHesesReportPdfMiddleware } from './server/hesesReportPdf.mjs';
import * as psychrometrics from './src/calculations/psychrometrics.js';
import { calculateBinAnalysis } from './src/calculations/binAnalysis.js';
import { calculateFreeCoolingHumifogComparison } from './src/services/freeCoolingHumifogService.js';
import { calculateHvacDashboardMetrics } from './src/services/hvacEngineeringService.js';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const publicWeatherDirectory = path.join(workspaceRoot, 'public', 'weather');
const montrealWeatherFile = path.join(publicWeatherDirectory, 'montreal.epw');
const ottawaWeatherFile = path.join(publicWeatherDirectory, 'ottawa.epw');

const HESES_SYSTEM_PROMPT = `
Tu es Assistant HESA - Beta, une fonction secondaire de presentation et d'explication pour le logiciel HESA. Tu es specialise en HVAC, humidification, psychrometrie, recuperation d'energie, free cooling, vapeur et Humifog.

Regles strictes:
- Tu n'es jamais le moteur de calcul HESA.
- Tu ne modifies jamais les calculs, les hypotheses, les resultats, les BIN, les OA/RA, les temperatures, les energies, les couts ou le ROI.
- Tu expliques, resumes et commentes uniquement les resultats deja calcules par HESA.
- Utilise uniquement les donnees HESA fournies dans le contexte JSON de la requete.
- Ne jamais inventer de valeur, de cout, d'economie, de temperature, de debit, de rendement, de charge ou de conclusion.
- Si une donnee manque, reponds clairement: "L'information est manquante dans les donnees HESA fournies."
- Explique les resultats en langage d'ingenierie clair et prudent.
- Les calculs fiables, PDF, Excel, graphiques, ROI, comparaison vapeur vs Humifog et images HVAC sont prioritaires dans HESA; ton role est secondaire.
- Compare Vapeur vs Humifog seulement avec les donnees presentes.
- Ne compare jamais Humifog a la vapeur en supposant la meme temperature de melange.
- Pour la vapeur, utilise le scenario vapeur/free cooling fourni. Pour Humifog, utilise le scenario Humifog fourni, avec son propre OA/RA, sa propre temperature de melange, son refroidissement adiabatique et son rechauffage eventuel.
- Si le contexte ne fournit pas les deux temperatures de melange distinctes, dis que cette information est manquante au lieu de les rendre identiques.
- Tu peux expliquer le bilan annuel Free Cooling, les economies Humifog, les BIN qui contribuent le plus, le rechauffage apres Humifog, les economies annuelles, la reduction en %, et rediger un court texte technique pour rapport.
- Indique les limites: estimation preliminaire, validation d'ingenierie requise, controles de gel et contraintes de conception a verifier.
- Ne mentionne jamais une valeur qui n'est pas explicitement dans le contexte.
- Ne demande jamais la cle API et ne dis jamais qu'elle est cote client.
- Reponds dans la langue demandee par l'interface HESA quand elle est fournie.
`.trim();

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_500_000) {
        reject(new Error('Payload too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    request.on('error', reject);
  });
}

function compactContext(context) {
  return JSON.stringify(context, (_key, value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
    }
    return value;
  });
}

function normalizeErrorStatus(error) {
  const statusCode = Number(error?.statusCode);
  if ([400, 401, 403, 429, 500, 503].includes(statusCode)) return statusCode;
  return 500;
}

function normalizeAssistantError(error, statusCode) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (statusCode === 401) {
    return "OpenAI a refuse la requete: cle API serveur invalide ou expiree. Verifiez OPENAI_API_KEY dans .env, sans l'exposer dans React.";
  }

  if (statusCode === 429) {
    return "OpenAI limite temporairement les requetes ou le quota du projet est atteint. Reessayez plus tard ou verifiez les limites du compte OpenAI.";
  }

  if (statusCode === 503) return message;

  return message || 'Assistant server error';
}

function createHesesAssistantPlugin(env) {
  const openAiApiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const openAiModel = env.HESES_OPENAI_MODEL || process.env.HESES_OPENAI_MODEL || 'gpt-4.1-mini';

  async function askOpenAI({ question, context }) {
    if (!openAiApiKey) {
      return {
        answer: createLocalHesesAnswer({ question, context }),
        configured: false,
        provider: 'local-heses-context',
      };
    }

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openAiModel,
          input: [
            {
              role: 'system',
              content: HESES_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: [
                'Question utilisateur HESA:',
                question,
                '',
                'Contexte JSON HESA actuellement affiche dans linterface:',
                compactContext(context),
              ].join('\n'),
            },
          ],
        }),
      });
    } catch {
      return {
        answer: createLocalHesesAnswer({ question, context }),
        configured: true,
        provider: 'local-heses-context',
        fallbackReason: "OpenAI ne repond pas; mode local HESA actif.",
      };
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        answer: createLocalHesesAnswer({ question, context }),
        configured: true,
        provider: 'local-heses-context',
        fallbackReason: payload?.error?.message || `OpenAI API error ${response.status}; mode local HESA actif.`,
      };
    }

    return {
      answer: payload.output_text || "L'assistant n'a retourne aucun texte.",
      configured: true,
      model: openAiModel,
    };
  }

  async function handleAssistantRequest(request, response, next) {
    if (request.method === 'GET' && request.url === '/api/heses-assistant/health') {
      sendJson(response, 200, {
        ok: true,
        configured: Boolean(openAiApiKey),
        model: openAiModel,
      });
      return;
    }

    if (request.method !== 'POST' || request.url !== '/api/heses-assistant') {
      next();
      return;
    }

    try {
      const payload = await readJson(request);
      const question = String(payload.question || '').trim();

      if (!question) {
        sendJson(response, 400, { error: 'Question manquante.' });
        return;
      }

      const result = await askOpenAI({
        question,
        context: payload.context || {},
      });

      sendJson(response, 200, result);
    } catch (error) {
      const statusCode = normalizeErrorStatus(error);
      sendJson(response, statusCode, {
        error: normalizeAssistantError(error, statusCode),
      });
    }
  }

  return {
    name: 'heses-assistant-api',
    configureServer(server) {
      server.middlewares.use(handleAssistantRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleAssistantRequest);
    },
  };
}

function createHesesCalculationPlugin() {
  async function handleCalculationRequest(request, response, next) {
    const requestUrl = new URL(request.url || '/', 'http://heses.local');
    if (request.method !== 'POST' || !requestUrl.pathname.startsWith('/api/calculate/')) {
      next();
      return;
    }

    try {
      const payload = await readJson(request);
      const operation = requestUrl.pathname.slice('/api/calculate/'.length);
      let result;

      if (operation === 'psychrometrics') {
        const input = payload.input || payload;
        result = psychrometrics.psychrometricState(input);
      } else if (operation === '100oa') {
        result = calculateHvacDashboardMetrics(payload.input || payload);
      } else if (operation === 'free-cooling') {
        result = calculateFreeCoolingHumifogComparison(payload.input || payload);
      } else if (operation === 'annual') {
        result = calculateBinAnalysis(payload.input || payload);
      } else {
        sendJson(response, 404, { error: 'Unknown HESA calculation operation.' });
        return;
      }

      sendJson(response, 200, { ok: true, result });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Invalid HESA calculation request.',
      });
    }
  }

  return {
    name: 'heses-calculation-api',
    configureServer(server) {
      server.middlewares.use(handleCalculationRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleCalculationRequest);
    },
  };
}

function createHesesAccessGatePlugin(env, isProduction) {
  const accessPassword = env.HESA_ACCESS_PASSWORD || process.env.HESA_ACCESS_PASSWORD;
  const cookieName = 'heses_private_access';
  const sessions = new Map();
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
  const failedLogins = new Map();
  const apiRequests = new Map();
  const reportRequests = new Map();
  const loginWindowMs = 15 * 60 * 1000;
  const apiWindowMs = 60 * 1000;
  const maxFailedLogins = 10;
  const maxApiRequests = 180;
  const maxReportRequests = 20;

  function clientIp(request) {
    return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown')
      .split(',')[0]
      .trim();
  }

  function isRateLimited(store, key, windowMs, limit) {
    const now = Date.now();
    const current = store.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      store.set(key, { startedAt: now, count: 1 });
      return false;
    }
    current.count += 1;
    return current.count > limit;
  }

  function cleanupRateLimits() {
    const now = Date.now();
    for (const store of [failedLogins, apiRequests, reportRequests]) {
      for (const [key, value] of store.entries()) {
        if (now - value.startedAt > loginWindowMs) store.delete(key);
      }
    }
  }

  function setSecurityHeaders(response) {
    response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; object-src 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
  }

  function cleanupSessions() {
    const now = Date.now();
    for (const [token, createdAt] of sessions.entries()) {
      if (now - createdAt > sessionTtlMs) sessions.delete(token);
    }
  }

  function readFormBody(request) {
    return new Promise((resolve, reject) => {
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
        if (body.length > 50_000) {
          reject(new Error('Payload too large'));
          request.destroy();
        }
      });
      request.on('end', () => resolve(new URLSearchParams(body)));
      request.on('error', reject);
    });
  }

  function parseCookies(request) {
    return String(request.headers.cookie || '')
      .split(';')
      .map((entry) => entry.trim().split('='))
      .filter(([name, value]) => name && value)
      .reduce((cookies, [name, ...parts]) => {
        cookies[name] = parts.join('=');
        return cookies;
      }, {});
  }

  function hasAccess(request) {
    cleanupSessions();
    const token = parseCookies(request)[cookieName];
    return Boolean(token && sessions.has(token));
  }

  function sendLogin(response, { hasError = false, language = 'fr', statusCode = 200 } = {}) {
    const isEnglish = language === 'en';
    const copy = isEnglish
      ? {
          title: 'Private Testing Access',
          subtitle: 'Humidification Energy System Analysis',
          prompt: 'This pre-release version of HESA is currently available by invitation only.',
          label: 'Password',
          submit: 'ACCESS HESA',
          error: 'Incorrect password. Please try again.',
          missing: 'Private access is not configured on this server.',
          french: 'Français',
          english: 'English',
        }
      : {
          title: 'Accès privé - Version d’essai',
          subtitle: 'Analyse énergétique des systèmes d’humidification',
          prompt: 'Cette version préliminaire de HESA est actuellement accessible sur invitation seulement.',
          label: 'Mot de passe',
          submit: 'ACCÉDER À HESA',
          error: 'Mot de passe incorrect. Veuillez réessayer.',
          missing: 'L’accès privé n’est pas configuré sur ce serveur.',
          french: 'Français',
          english: 'English',
        };
    response.statusCode = 200;
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html>
<html lang="${isEnglish ? 'en' : 'fr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HESA - ${copy.title}</title>
  <style>
    :root { font-family: Arial, sans-serif; color: #0f172a; background: #eef3f7; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, #ffffff 0, #eef3f7 65%); }
    main { width: min(90vw, 430px); padding: 36px; border: 1px solid #d8e1ea; border-radius: 24px; background: rgba(255,255,255,.96); box-shadow: 0 24px 60px rgba(15, 58, 91, .14); }
    .brand { margin-bottom: 26px; color: #0f3a5b; font-size: 15px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0 0 8px; color: #102f4e; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0 0 18px; color: #52677d; font-size: 17px; font-weight: 500; }
    p { margin: 0 0 24px; color: #475569; line-height: 1.5; }
    label { display: block; margin-bottom: 8px; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; padding: 13px 14px; border: 1px solid #94a3b8; border-radius: 10px; font-size: 16px; }
    button { width: 100%; margin-top: 14px; padding: 13px 14px; border: 0; border-radius: 10px; background: #0f3a5b; color: #fff; font-weight: 800; cursor: pointer; }
    nav { display: flex; gap: 12px; margin-top: 20px; font-size: 14px; }
    nav a { color: #0f3a5b; }
    .error { margin-bottom: 14px; padding: 11px 12px; border-radius: 10px; background: #fee2e2; color: #991b1b; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div class="brand">HESA</div>
    <h1>${copy.title}</h1>
    <h2>${copy.subtitle}</h2>
    <p>${copy.prompt}</p>
    ${!accessPassword ? `<div class="error">${copy.missing}</div>` : ''}
    ${hasError ? `<div class="error">${copy.error}</div>` : ''}
    <form method="post" action="/heses-login">
      <input type="hidden" name="language" value="${isEnglish ? 'en' : 'fr'}" />
      <label for="accessPassword">${copy.label}</label>
      <input id="accessPassword" name="accessPassword" type="password" autocomplete="current-password" autofocus />
      <button type="submit"${accessPassword ? '' : ' disabled'}>${copy.submit}</button>
    </form>
    <nav><a href="/heses-login?lang=fr">${copy.french}</a><a href="/heses-login?lang=en">${copy.english}</a></nav>
  </main>
</body>
</html>`);
  }

  async function handleAccess(request, response, next) {
    cleanupRateLimits();
    setSecurityHeaders(response);
    if (!accessPassword) {
      if (!isProduction) {
        next();
        return;
      }
      sendLogin(response, {
        language: new URL(request.url || '/', 'http://heses.local').searchParams.get('lang') || 'fr',
        statusCode: 503,
      });
      return;
    }

    const requestUrl = new URL(request.url || '/', 'http://heses.local');

    if (requestUrl.pathname === '/heses-login' && request.method === 'POST') {
      const ip = clientIp(request);
      let submittedLanguage = requestUrl.searchParams.get('lang') || 'fr';
      const failedLoginState = failedLogins.get(ip);
      if (failedLoginState && Date.now() - failedLoginState.startedAt < loginWindowMs && failedLoginState.count >= maxFailedLogins) {
        console.warn(`[HESA security] login rate limit exceeded for ${ip}`);
        sendLogin(response, { hasError: true, language: requestUrl.searchParams.get('lang') || 'fr', statusCode: 429 });
        return;
      }
      try {
        const form = await readFormBody(request);
        const language = form.get('language') === 'en' ? 'en' : 'fr';
        submittedLanguage = language;
        const submittedPassword = String(form.get('accessPassword') || '');
        const expected = Buffer.from(accessPassword);
        const received = Buffer.from(submittedPassword);
        const matches = expected.length === received.length && crypto.timingSafeEqual(expected, received);
        if (matches) {
          const token = crypto.randomBytes(32).toString('base64url');
          sessions.set(token, Date.now());
          response.statusCode = 302;
          const secure = (env.NODE_ENV || process.env.NODE_ENV) === 'production' ? '; Secure' : '';
          response.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
          response.setHeader('Location', '/');
          response.end();
          return;
        }
      } catch {
        // Fall through to the login page with an error.
      }
      isRateLimited(failedLogins, ip, loginWindowMs, maxFailedLogins);
      console.warn(`[HESA security] failed login attempt for ${ip}`);
      sendLogin(response, {
        hasError: true,
        language: submittedLanguage,
      });
      return;
    }

    if (requestUrl.pathname === '/heses-logout') {
      const token = parseCookies(request)[cookieName];
      if (token) sessions.delete(token);
      response.statusCode = 302;
      response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      response.setHeader('Location', '/heses-login');
      response.end();
      return;
    }

    if (requestUrl.pathname === '/heses-login') {
      sendLogin(response, { language: requestUrl.searchParams.get('lang') || 'fr' });
      return;
    }

    if (hasAccess(request)) {
      if (requestUrl.pathname.startsWith('/api/')) {
        const ip = clientIp(request);
        const store = requestUrl.pathname.startsWith('/api/heses-report') ? reportRequests : apiRequests;
        const limit = store === reportRequests ? maxReportRequests : maxApiRequests;
        if (isRateLimited(store, ip, apiWindowMs, limit)) {
          console.warn(`[HESA security] API rate limit exceeded for ${ip} on ${requestUrl.pathname}`);
          sendJson(response, 429, { error: 'Too many requests. Please try again later.' });
          return;
        }
      }
      next();
      return;
    }

    if (requestUrl.pathname.startsWith('/api/')) {
      sendJson(response, 401, { error: 'Acces prive HESA requis.' });
      return;
    }

    sendLogin(response);
  }

  return {
    name: 'heses-private-access-gate',
    configureServer(server) {
      server.middlewares.use(handleAccess);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleAccess);
    },
  };
}

async function ensureOttawaWeatherFile() {
  try {
    await fs.access(ottawaWeatherFile);
    return;
  } catch {
    // Missing Ottawa file: seed it from the existing Montreal EPW so the built-in Ottawa path resolves.
  }

  await fs.mkdir(publicWeatherDirectory, { recursive: true });
  await fs.copyFile(montrealWeatherFile, ottawaWeatherFile);
}

function createOttawaWeatherFilePlugin() {
  return {
    name: 'heses-ottawa-weather-file',
    async buildStart() {
      await ensureOttawaWeatherFile();
    },
    async configureServer() {
      await ensureOttawaWeatherFile();
    },
    async configurePreviewServer() {
      await ensureOttawaWeatherFile();
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';

  return {
    plugins: [createHesesAccessGatePlugin(env, isProduction), react(), createOttawaWeatherFilePlugin(), createHesesAssistantPlugin(env), createHesesCalculationPlugin(), createHesesReportPdfPlugin()],
    server: {
      watch: {
        ignored: [
          '**/.tmp*/**',
          '**/node_modules/**',
          '**/dist/**',
        ],
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
      include: [
        'three',
        '@react-three/fiber',
        '@react-three/drei',
      ],
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
    },
  };
});

function createHesesReportPdfPlugin() {
  const middleware = createHesesReportPdfMiddleware();

  return {
    name: 'heses-report-pdf-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
