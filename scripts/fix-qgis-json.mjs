/**
 * Strips invalid control characters (U+0000–U+001F) inside JSON string literals.
 * QGIS exports sometimes embed raw ETX/etc. inside "alamat" or "nama".
 */
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/fix-qgis-json.mjs <path-to.json>')
  process.exit(1)
}

const abs = path.resolve(file)
const raw = fs.readFileSync(abs, 'utf8')

function stripControlsInJsonStrings(text) {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    const code = c.charCodeAt(0)

    if (!inString) {
      if (c === '"') inString = true
      out += c
      continue
    }

    if (escape) {
      out += c
      escape = false
      continue
    }

    if (c === '\\') {
      out += c
      escape = true
      continue
    }

    if (c === '"') {
      inString = false
      out += c
      continue
    }

    if (code < 32) {
      out += ' '
      continue
    }

    out += c
  }

  return out
}

const fixed = stripControlsInJsonStrings(raw)
try {
  JSON.parse(fixed)
} catch (e) {
  console.error('Still invalid after fix:', e.message)
  process.exit(1)
}

const backup = `${abs}.bak`
if (!fs.existsSync(backup)) {
  fs.copyFileSync(abs, backup)
  console.log('Backup:', backup)
}

fs.writeFileSync(abs, fixed, 'utf8')
console.log('Fixed and wrote:', abs)
