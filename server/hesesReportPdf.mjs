import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const REPORTS = new Map()
const REPORT_TTL_MS = 60 * 60 * 1000
let latestReportId = ''
let latestRenderedPdf = null
const execFileAsync = promisify(execFile)
const GENERATED_REPORT_DIR = path.resolve(process.cwd(), 'generated')
const GENERATED_REPORT_PDF_PATH = path.join(GENERATED_REPORT_DIR, 'rapport-heses.pdf')
const GENERATED_REPORT_HTML_PATH = path.join(GENERATED_REPORT_DIR, 'rapport-heses.html')
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

function cleanOldReports() {
  const now = Date.now()
  for (const [id, report] of REPORTS.entries()) {
    if (now - report.createdAt > REPORT_TTL_MS) REPORTS.delete(id)
  }
}

function createReportId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getQueryValue(url, key) {
  const queryIndex = String(url || '').indexOf('?')
  if (queryIndex < 0) return ''
  const params = new URLSearchParams(String(url).slice(queryIndex + 1))
  return params.get(key) || ''
}

function isLikelyValidPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 500) return false
  const start = buffer.slice(0, 5).toString('utf8')
  const tail = buffer.slice(Math.max(0, buffer.length - 2048)).toString('latin1')
  return start === '%PDF-' && tail.includes('%%EOF') && tail.includes('startxref')
}

function isLikelyReportHtml(html) {
  const value = String(html || '')
  return value.includes('<!doctype html') && value.includes('engineering-report')
}

async function findChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // try next path
    }
  }
  return ''
}

async function createChromePdfBufferFromHtml(html, id) {
  const chromePath = await findChromeExecutable()
  if (!chromePath) throw new Error('Chrome ou Edge introuvable pour generer le PDF.')

  const workDir = path.join(os.tmpdir(), 'heses-report-pdf')
  await fs.mkdir(workDir, { recursive: true })

  const htmlPath = path.join(workDir, `rapport-heses-${id}.html`)
  const pdfPath = path.join(workDir, `rapport-heses-${id}.pdf`)
  const profilePath = path.join(workDir, `profile-${id}`)
  const htmlForPrint = String(html || '').replace(
    '</head>',
    `<style>
      @page { size: letter; margin: 12mm; }
      body { background: #fff !important; }
      .print-actions { display: none !important; }
      .engineering-report { margin: 0 auto !important; }
      .report-cover { min-height: auto !important; padding: 18px !important; break-after: page; page-break-after: always; }
      .report-cover h1 { font-size: 31px !important; margin: 6px 0 8px !important; }
      .cover-topline { padding-bottom: 10px !important; margin-bottom: 14px !important; }
      .cover-logo { width: 135px !important; }
      .cover-subtitle { font-size: 13px !important; margin-bottom: 10px !important; }
      .cover-badge, .document-meta-row span { padding: 4px 8px !important; font-size: 9px !important; }
      .document-meta-row { margin: 10px 0 12px !important; }
      .cover-grid { gap: 12px !important; }
      .cover-summary, .cover-certification { display: none !important; }
      .report-cover .cover-figure { display: none !important; }
      .report-cover .cover-grid { grid-template-columns: 1fr !important; }
      .cover-figure img { max-height: 240px !important; }
      .cover-meta .report-table th, .cover-meta .report-table td { padding: 5px 6px !important; font-size: 10px !important; }
      .cover-kpi-row { gap: 8px !important; margin-top: 10px !important; }
      .cover-kpi { padding: 8px !important; }
      .page-break { break-before: auto !important; page-break-before: auto !important; }
      .report-cover.page-break { break-before: auto !important; page-break-before: auto !important; }
      .report-section { break-inside: avoid !important; page-break-inside: avoid !important; margin-bottom: 10mm !important; }
      .report-section.allow-page-break { break-inside: auto !important; page-break-inside: auto !important; }
      .report-section h2, .report-section h3 { break-after: avoid !important; page-break-after: avoid !important; }
      .report-table, .heatmap { break-inside: auto !important; page-break-inside: auto !important; }
      .report-table tr, .heatmap tr { break-inside: avoid !important; page-break-inside: avoid !important; }
      .report-footer { position: static !important; }
    </style></head>`
  )

  await fs.writeFile(htmlPath, htmlForPrint, 'utf8')
  await fs.rm(pdfPath, { force: true }).catch(() => {})

  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`
  await execFileAsync(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',
    `--user-data-dir=${profilePath}`,
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=2500',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ], { timeout: 30000, windowsHide: true })

  const pdfBuffer = await fs.readFile(pdfPath)
  if (!isLikelyValidPdf(pdfBuffer)) throw new Error('Chrome a genere un PDF invalide.')

  fs.rm(htmlPath, { force: true }).catch(() => {})
  fs.rm(pdfPath, { force: true }).catch(() => {})
  fs.rm(profilePath, { recursive: true, force: true }).catch(() => {})

  return pdfBuffer
}

async function writeLatestReportFiles({ html, pdfBuffer }) {
  await fs.mkdir(GENERATED_REPORT_DIR, { recursive: true })
  if (html) await fs.writeFile(GENERATED_REPORT_HTML_PATH, html, 'utf8')
  if (pdfBuffer) await fs.writeFile(GENERATED_REPORT_PDF_PATH, pdfBuffer)
}

function localReportPdfPath(id) {
  const safeId = String(id || '').replace(/[^a-z0-9-]/gi, '')
  return safeId
    ? path.join(GENERATED_REPORT_DIR, `rapport-heses-${safeId}.pdf`)
    : GENERATED_REPORT_PDF_PATH
}

async function openLocalPdfInWindows(id = '') {
  const report = id ? REPORTS.get(id) : null
  const localPdfPath = localReportPdfPath(id)

  if (report?.renderedPdf) {
    await fs.mkdir(GENERATED_REPORT_DIR, { recursive: true })
    await fs.writeFile(localPdfPath, report.renderedPdf)
  } else if (id) {
    throw new Error('PDF courant introuvable. Regenerer le rapport depuis HESES.')
  }

  await fs.access(localPdfPath)
  if (process.platform === 'win32') {
    await execFileAsync('cmd.exe', ['/c', 'start', '', localPdfPath], { windowsHide: true })
    return localPdfPath
  }
  if (process.platform === 'darwin') {
    await execFileAsync('open', [localPdfPath])
    return localPdfPath
  }
  await execFileAsync('xdg-open', [localPdfPath])
  return localPdfPath
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

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function decodeHtmlEntities(text) {
  const named = {
    amp: '&',
    apos: "'",
    nbsp: ' ',
    quot: '"',
    lt: '<',
    gt: '>',
    deg: '°',
    eacute: 'é',
    egrave: 'è',
    ecirc: 'ê',
    euml: 'ë',
    agrave: 'à',
    acirc: 'â',
    auml: 'ä',
    ccedil: 'ç',
    icirc: 'î',
    iuml: 'ï',
    ocirc: 'ô',
    ougrave: 'ù',
    ugrave: 'ù',
    ucirc: 'û',
    uuml: 'ü',
    Eacute: 'É',
    Egrave: 'È',
    Ecirc: 'Ê',
    Agrave: 'À',
    Ccedil: 'Ç',
  }

  return String(text || '').replace(/&(#x[0-9a-f]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10))
    return named[entity] ?? match
  })
}

function normalizeText(text) {
  return decodeHtmlEntities(text)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripReportHtmlToLines(html) {
  const body = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' [schéma] ')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, ' $1 ')
    .replace(/<img[^>]*>/gi, ' [image] ')
    .replace(/<\/(h1|h2|h3|p|li|tr|table|section|div)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return normalizeText(body)
    .split(/\s*\n\s*/)
    .map(normalizeText)
    .filter(Boolean)
}

function wrapText(text, maxLength) {
  const words = normalizeText(text).split(' ').filter(Boolean)
  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxLength && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }

  if (current) lines.push(current)
  return lines
}

function utf16BeHex(text) {
  let hex = 'FEFF'
  for (const character of String(text || '')) {
    const code = character.codePointAt(0)
    if (code > 0xffff) {
      const adjusted = code - 0x10000
      const high = 0xd800 + (adjusted >> 10)
      const low = 0xdc00 + (adjusted & 0x3ff)
      hex += high.toString(16).padStart(4, '0').toUpperCase()
      hex += low.toString(16).padStart(4, '0').toUpperCase()
    } else {
      hex += code.toString(16).padStart(4, '0').toUpperCase()
    }
  }
  return hex
}

export function createPdfBufferFromReportHtml(html, title = 'Rapport HESES') {
  const sourceLines = stripReportHtmlToLines(html)
  const pages = []
  let page = []
  let y = 742

  const addLine = (text, options = {}) => {
    const size = options.size || 9
    const lineHeight = Math.max(11, size + 3)
    const wrapped = wrapText(text, options.maxLength || 105)

    for (const line of wrapped) {
      if (y < 54) {
        pages.push(page)
        page = []
        y = 742
      }
      page.push({ text: line, size, y, bold: Boolean(options.bold) })
      y -= lineHeight
    }
  }

  addLine(title, { size: 18, bold: true, maxLength: 72 })
  y -= 10

  for (const line of sourceLines) {
    const isTitle = /^(rapport|heses|section|executive|sommaire|analyse|conditions|energy|economic|greenhouse|recommendation)/i.test(line)
    addLine(line, {
      size: isTitle ? 11 : 8.5,
      bold: isTitle,
      maxLength: isTitle ? 88 : 118,
    })
    if (isTitle) y -= 3
  }

  if (page.length) pages.push(page)
  if (!pages.length) pages.push([{ text: title, size: 18, y: 742, bold: true }])

  const objects = []
  const addObject = (body) => {
    objects.push(body)
    return objects.length
  }

  const catalogId = addObject('')
  const pagesId = addObject('')
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  const pageIds = []

  pages.forEach((lines, pageIndex) => {
    const content = [
      `BT /F2 8 Tf 54 28 Td <${utf16BeHex(`HESES - ${pageIndex + 1}/${pages.length}`)}> Tj ET`,
      ...lines.map((line) => {
        const font = line.bold ? 'F2' : 'F1'
        return `BT /${font} ${line.size} Tf 54 ${line.y.toFixed(1)} Td <${utf16BeHex(line.text)}> Tj ET`
      }),
    ].join('\n')
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`)
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    pageIds.push(pageId)
  })

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}

export function createHesesReportPdfMiddleware() {
  return async function handleReportPdf(request, response, next) {
    cleanOldReports()

    if ((request.method === 'POST' || request.method === 'GET') && request.url === '/api/heses-report-open-local-pdf') {
      try {
        let id = ''
        if (request.method === 'POST') {
          const rawBody = await readBody(request, 200_000).catch(() => '')
          if (rawBody) {
            try {
              const payload = JSON.parse(rawBody)
              id = String(payload.id || '').trim()
            } catch {
              id = ''
            }
          }
        }
        const localPdfPath = await openLocalPdfInWindows(id)
        if (request.method === 'GET') {
          response.statusCode = 200
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:32px"><h1>PDF HESES ouvert dans Windows</h1><p>Utilisez Ctrl+P dans le lecteur PDF externe pour imprimer ou enregistrer.</p><p><a href="/">Retour à HESES</a></p></body></html>')
          return
        }
        sendJson(response, 200, { ok: true, localPdfPath })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible douvrir le PDF local.'
        if (request.method === 'GET') {
          response.statusCode = 500
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(`<!doctype html><html><body style="font-family:Arial,sans-serif;padding:32px"><h1>Impossible douvrir le PDF HESES</h1><p>${message}</p><p>Regenerer le rapport depuis HESES.</p><p><a href="/">Retour à HESES</a></p></body></html>`)
          return
        }
        sendJson(response, 500, { error: message })
      }
      return
    }

    if (request.method === 'POST' && request.url === '/api/heses-report-pdf') {
      try {
        const rawBody = await readBody(request)
        const payload = JSON.parse(rawBody || '{}')
        const html = String(payload.html || '')
        const title = normalizeText(payload.title || 'Rapport HESES')

        if (!html.trim()) {
          sendJson(response, 400, { error: 'Rapport HTML manquant.' })
          return
        }

        if (!isLikelyReportHtml(html)) {
          sendJson(response, 400, { error: 'Rapport HTML invalide. Generez le rapport depuis HESES.' })
          return
        }

        const id = createReportId()
        const report = {
          html,
          title,
          createdAt: Date.now(),
        }
        REPORTS.set(id, report)
        latestReportId = id

        let pdfReady = false
        let pdfError = ''
        try {
          const pdfBuffer = await createChromePdfBufferFromHtml(html, id)
          report.renderedPdf = pdfBuffer
          latestRenderedPdf = pdfBuffer
          await writeLatestReportFiles({ html, pdfBuffer })
          pdfReady = true
        } catch (error) {
          await writeLatestReportFiles({ html })
          pdfError = error instanceof Error ? error.message : 'Erreur generation PDF Chrome.'
        }

        sendJson(response, 200, {
          id,
          pdfUrl: `/generated/rapport-heses.pdf?t=${id}`,
          htmlUrl: `/generated/rapport-heses.html?t=${id}`,
          apiPdfUrl: `/api/heses-report-pdf/${id}`,
          apiHtmlUrl: `/api/heses-report-html/${id}`,
          localPdfPath: localReportPdfPath(id),
          localHtmlPath: GENERATED_REPORT_HTML_PATH,
          pdfReady,
          pdfError,
        })
      } catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : 'Erreur rapport PDF.' })
      }
      return
    }

    if (request.method === 'POST' && request.url === '/api/heses-report-pdf-upload') {
      try {
        const rawBody = await readBody(request, 50_000_000)
        const payload = JSON.parse(rawBody || '{}')
        const id = String(payload.id || latestReportId || '').trim()
        const pdfBase64 = String(payload.pdfBase64 || '').trim()
        const report = REPORTS.get(id)

        if (!id || !report) {
          sendJson(response, 404, { error: 'Rapport HESES introuvable.' })
          return
        }

        if (!pdfBase64) {
          sendJson(response, 400, { error: 'PDF visuel manquant.' })
          return
        }

        const pdfBuffer = Buffer.from(pdfBase64, 'base64')
        if (!isLikelyValidPdf(pdfBuffer)) {
          sendJson(response, 400, { error: 'Le fichier recu nest pas un PDF valide.' })
          return
        }

        report.renderedPdf = pdfBuffer
        report.createdAt = Date.now()
        latestReportId = id
        latestRenderedPdf = pdfBuffer
        await writeLatestReportFiles({ html: report.html, pdfBuffer })

        sendJson(response, 200, {
          id,
          pdfUrl: `/generated/rapport-heses.pdf?t=${id}`,
          localPdfPath: localReportPdfPath(id),
        })
      } catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : 'Erreur televersement PDF.' })
      }
      return
    }

    const pdfMatch = request.url.match(/^\/api\/heses-report-pdf\/([a-z0-9-]+)$/i)
    if (request.method === 'GET' && pdfMatch) {
      const report = REPORTS.get(pdfMatch[1])
      if (!report) {
        response.statusCode = 404
        response.end('Rapport expire ou introuvable.')
        return
      }

      if (!report.renderedPdf) {
        response.statusCode = 409
        response.end('PDF visuel non disponible. Regenerer le rapport HESES.')
        return
      }

      const pdf = report.renderedPdf
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/pdf')
      response.setHeader('Content-Disposition', 'attachment; filename="rapport-heses.pdf"')
      response.setHeader('Content-Length', String(pdf.length))
      response.end(pdf)
      return
    }

    const generatedPdfMatch = request.url.match(/^\/generated\/rapport-heses\.pdf(?:\?.*)?$/i)
    if (request.method === 'GET' && generatedPdfMatch) {
      const requestedId = getQueryValue(request.url, 't')
      const report = REPORTS.get(requestedId) || REPORTS.get(latestReportId)
      if (!report) {
        try {
          const pdfFromDisk = await fs.readFile(GENERATED_REPORT_PDF_PATH)
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/pdf')
          response.setHeader('Content-Disposition', 'inline; filename="rapport-heses.pdf"')
          response.setHeader('Content-Length', String(pdfFromDisk.length))
          response.end(pdfFromDisk)
          return
        } catch {
          response.statusCode = 404
          response.end('Aucun rapport HESES genere.')
          return
        }
      }

      if (!report.renderedPdf) {
        response.statusCode = 409
        response.end('PDF visuel non disponible. Regenerer le rapport HESES.')
        return
      }

      const pdf = report.renderedPdf
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/pdf')
      response.setHeader('Content-Disposition', 'inline; filename="rapport-heses.pdf"')
      response.setHeader('Content-Length', String(pdf.length))
      response.end(pdf)
      return
    }

    const generatedHtmlMatch = request.url.match(/^\/generated\/rapport-heses\.html(?:\?.*)?$/i)
    if (request.method === 'GET' && generatedHtmlMatch) {
      const requestedId = getQueryValue(request.url, 't')
      const report = REPORTS.get(requestedId) || REPORTS.get(latestReportId)
      if (!report) {
        try {
          const htmlFromDisk = await fs.readFile(GENERATED_REPORT_HTML_PATH)
          response.statusCode = 200
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.setHeader('Content-Disposition', 'inline; filename="rapport-heses.html"')
          response.setHeader('Content-Length', String(htmlFromDisk.length))
          response.end(htmlFromDisk)
          return
        } catch {
          response.statusCode = 404
          response.end('Aucun rapport HESES genere.')
          return
        }
      }

      const html = Buffer.from(report.html, 'utf8')
      response.statusCode = 200
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.setHeader('Content-Disposition', 'inline; filename="rapport-heses.html"')
      response.setHeader('Content-Length', String(html.length))
      response.end(html)
      return
    }

    const htmlMatch = request.url.match(/^\/api\/heses-report-html\/([a-z0-9-]+)$/i)
    if (request.method === 'GET' && htmlMatch) {
      const report = REPORTS.get(htmlMatch[1])
      if (!report) {
        response.statusCode = 404
        response.end('Rapport expire ou introuvable.')
        return
      }

      const html = Buffer.from(report.html, 'utf8')
      response.statusCode = 200
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.setHeader('Content-Disposition', 'attachment; filename="rapport-heses.html"')
      response.setHeader('Content-Length', String(html.length))
      response.end(html)
      return
    }

    next()
  }
}
