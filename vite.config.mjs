import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalHesesAnswer } from './server/hesesAssistantCore.mjs';
import { createHesesReportPdfMiddleware } from './server/hesesReportPdf.mjs';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const publicWeatherDirectory = path.join(workspaceRoot, 'public', 'weather');
const montrealWeatherFile = path.join(publicWeatherDirectory, 'montreal.epw');
const ottawaWeatherFile = path.join(publicWeatherDirectory, 'ottawa.epw');

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
                'Question utilisateur HESES:',
                question,
                '',
                'Contexte JSON HESES actuellement affiche dans linterface:',
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
        fallbackReason: "OpenAI ne repond pas; mode local HESES actif.",
      };
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        answer: createLocalHesesAnswer({ question, context }),
        configured: true,
        provider: 'local-heses-context',
        fallbackReason: payload?.error?.message || `OpenAI API error ${response.status}; mode local HESES actif.`,
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

function createHesesAccessGatePlugin(env) {
  const accessCode = env.HESES_ACCESS_CODE || process.env.HESES_ACCESS_CODE;
  const cookieName = 'heses_private_access';

  if (!accessCode) {
    return {
      name: 'heses-access-gate-disabled',
    };
  }

  const expectedToken = crypto.createHash('sha256').update(accessCode).digest('hex');

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

  function hasAccess(request) {
    const cookieHeader = request.headers.cookie || '';
    return cookieHeader
      .split(';')
      .map((entry) => entry.trim())
      .some((entry) => entry === `${cookieName}=${expectedToken}`);
  }

  function sendLogin(response, hasError = false) {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Acces prive HESES</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
    main { width: min(92vw, 420px); padding: 28px; border: 1px solid #cbd5e1; border-radius: 16px; background: #fff; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12); }
    h1 { margin: 0 0 8px; color: #0f3a5b; font-size: 26px; }
    p { margin: 0 0 20px; color: #475569; line-height: 1.45; }
    label { display: block; margin-bottom: 8px; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #94a3b8; border-radius: 10px; font-size: 16px; }
    button { width: 100%; margin-top: 14px; padding: 12px 14px; border: 0; border-radius: 10px; background: #0f3a5b; color: #fff; font-weight: 800; cursor: pointer; }
    .error { margin-bottom: 14px; padding: 10px 12px; border-radius: 10px; background: #fee2e2; color: #991b1b; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>HESES prive</h1>
    <p>Entrez le code d'acces pour valider la version web du logiciel.</p>
    ${hasError ? '<div class="error">Code invalide. Reessayez.</div>' : ''}
    <form method="post" action="/heses-login">
      <label for="accessCode">Code d'acces</label>
      <input id="accessCode" name="accessCode" type="password" autocomplete="current-password" autofocus />
      <button type="submit">Ouvrir HESES</button>
    </form>
  </main>
</body>
</html>`);
  }

  async function handleAccess(request, response, next) {
    const requestUrl = new URL(request.url || '/', 'http://heses.local');

    if (requestUrl.pathname === '/heses-login' && request.method === 'POST') {
      try {
        const form = await readFormBody(request);
        const submittedCode = String(form.get('accessCode') || '');
        if (submittedCode === accessCode) {
          response.statusCode = 302;
          response.setHeader('Set-Cookie', `${cookieName}=${expectedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
          response.setHeader('Location', '/');
          response.end();
          return;
        }
      } catch {
        // Fall through to the login page with an error.
      }
      sendLogin(response, true);
      return;
    }

    if (requestUrl.pathname === '/heses-login') {
      sendLogin(response);
      return;
    }

    if (hasAccess(request)) {
      next();
      return;
    }

    if (requestUrl.pathname.startsWith('/api/')) {
      sendJson(response, 401, { error: 'Acces prive HESES requis.' });
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

  return {
    plugins: [createHesesAccessGatePlugin(env), react(), createOttawaWeatherFilePlugin(), createHesesAssistantPlugin(env), createHesesReportPdfPlugin()],
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
