import { readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

const root = join(process.cwd(), 'src')
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.css'])

const replacements = [
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2', '\u2019'],
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u00c5\u201c', '"'],
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u009d', '"'],
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u0153', '-'],
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d', '-'],
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2', '|'],
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a6', '...'],
  ['\u00c3\u00a2\u00e2\u201a\u00ac\u017d', '€'],
  ['\u00c3\u0192\u00c2\u20ac', 'À'],
  ['\u00c3\u0192\u00e2\u20ac\u00b0', 'É'],
  ['\u00c3\u0192\u00c2\u2030', 'É'],
  ['\u00c3\u0192\u00cb\u2020', 'È'],
  ['\u00c3\u0192\u00c5\u00a0', 'Ê'],
  ['\u00c3\u0192\u00e2\u20ac\u00a1', 'Ç'],
  ['\u00c3\u0192\u00c2\u00a9', 'é'],
  ['\u00c3\u0192\u00c2\u00a8', 'è'],
  ['\u00c3\u0192\u00c2\u00aa', 'ê'],
  ['\u00c3\u0192\u00c2\u00ab', 'ë'],
  ['\u00c3\u0192\u00c2\u00a0', 'à'],
  ['\u00c3\u0192\u00c2\u00a2', 'â'],
  ['\u00c3\u0192\u00c2\u00a7', 'ç'],
  ['\u00c3\u0192\u00c2\u00ae', 'î'],
  ['\u00c3\u0192\u00c2\u00af', 'ï'],
  ['\u00c3\u0192\u00c2\u00b4', 'ô'],
  ['\u00c3\u0192\u00c2\u00bb', 'û'],
  ['\u00c3\u0192\u00c2\u00bc', 'ü'],
  ['\u00c3\u0192\u00c2\u00b9', 'ù'],
  ['\u00e2\u20ac\u2122', '\u2019'],
  ['\u00e2\u20ac\u02dc', '\u2018'],
  ['\u00e2\u20ac\u0153', '"'],
  ['\u00e2\u20ac\u009d', '"'],
  ['\u00e2\u20ac\u201c', '-'],
  ['\u00e2\u20ac\u201d', '-'],
  ['\u00e2\u20ac\u00a2', '|'],
  ['\u00e2\u20ac\u00a6', '...'],
  ['\u00e2\u201e\u00a2', 'TM'],
  ['\u00c3\u20ac', 'À'],
  ['\u00c3\u201a', 'Â'],
  ['\u00c3\u2021', 'Ç'],
  ['\u00c3\u2030', 'É'],
  ['\u00c3\u02c6', 'È'],
  ['\u00c3\u0160', 'Ê'],
  ['\u00c3\u2039', 'Ë'],
  ['\u00c3\u017d', 'Î'],
  ['\u00c3\u008f', 'Ï'],
  ['\u00c3\u201d', 'Ô'],
  ['\u00c3\u2122', 'Ù'],
  ['\u00c3\u203a', 'Û'],
  ['\u00c3\u0153', 'Ü'],
  ['\u00c3\u00a0', 'à'],
  ['\u00c3\u00a2', 'â'],
  ['\u00c3\u00a7', 'ç'],
  ['\u00c3\u00a9', 'é'],
  ['\u00c3\u00a8', 'è'],
  ['\u00c3\u00aa', 'ê'],
  ['\u00c3\u00ab', 'ë'],
  ['\u00c3\u00ae', 'î'],
  ['\u00c3\u00af', 'ï'],
  ['\u00c3\u00b4', 'ô'],
  ['\u00c3\u00b9', 'ù'],
  ['\u00c3\u00bb', 'û'],
  ['\u00c3\u00bc', 'ü'],
  ['\u00c3\u00b1', 'ñ'],
  ['\u00c3\u00b8', 'ø'],
  ['\u00c2\u00b0C', '°C'],
  ['\u00c2\u00b0F', '°F'],
  ['\u00c2\u00b0', '°'],
  ['\u00c2\u00b3', '³'],
  ['\u00c2\u00b2', '²'],
  ['\u00c2\u00a0', ' '],
]

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return listFiles(path)
    return extensions.has(extname(path)) ? [path] : []
  })
}

let changed = 0
for (const file of listFiles(root)) {
  let text = readFileSync(file, 'utf8')
  const original = text
  for (const [bad, good] of replacements) {
    text = text.split(bad).join(good)
  }
  if (text !== original) {
    writeFileSync(file, text, 'utf8')
    changed += 1
  }
}

console.log(`Repaired encoding in ${changed} file(s).`)
