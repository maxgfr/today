#!/usr/bin/env node
// Turns the privacy promise into a build gate.
//
// "Your tasks never leave your device" is only worth something if something
// other than good intentions checks it. This walks the built bundle and fails
// when it finds an outbound origin, a runtime network API, or a weakened CSP —
// so a dependency that starts phoning home breaks CI instead of shipping.
//
// The Content-Security-Policy in index.html is the actual enforcement; the
// browser refuses the request either way. This scanner is the second line:
// it makes a new origin visible at build time rather than at incident time.

import { readdir, readFile } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import process from 'node:process'

const dist = process.argv[2] ?? 'dist'

// Hosts allowed to appear as inert strings. Each one is a documentation URL
// baked into a library's error message — never a fetch target. Anything added
// here needs a reason on the same line, and the fetch check below still applies.
const ALLOWED_HOSTS = [
  ['react.dev', 'React minified-error decoder URL inside thrown Error messages'],
  ['tailwindcss.com', 'license banner comment at the top of the generated stylesheet'],
  ['bit.ly', 'Workbox console.warn documentation link (bit.ly/wb-precache)'],
  ['w3.org', 'XML/SVG namespace declarations, never dereferenced'],
  ['maxgfr.github.io', "the app's own canonical address in meta tags and the manifest"],
  // An <a href> is navigation the user chooses to perform, not the app opening
  // a connection. The CSP's form-action/connect-src still block everything else,
  // and the FETCH_LITERAL check below would catch it if this ever became a fetch.
  ['github.com', 'the "read the source" link in Settings — an anchor, not a request'],
]

// Files worth reading. Images and fonts cannot issue requests.
const SCANNED = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.webmanifest'])

const URL_PATTERN = /(?:https?:)?\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})(?::\d+)?/gi

// Runtime APIs that can reach the network. None of them belong in this app.
const NETWORK_APIS = [
  [/\bnew\s+WebSocket\s*\(/, 'WebSocket'],
  [/\bnew\s+EventSource\s*\(/, 'EventSource'],
  [/\bnew\s+XMLHttpRequest\s*\(/, 'XMLHttpRequest'],
  [/\bnavigator\s*\.\s*sendBeacon\s*\(/, 'navigator.sendBeacon'],
  [/\bnew\s+RTCPeerConnection\s*\(/, 'RTCPeerConnection'],
]

// A literal external URL handed straight to fetch() or import() is an outbound
// request no matter which host it points at — the allowlist does not excuse it.
const FETCH_LITERAL = /\b(?:fetch|import)\s*\(\s*["'`](?:https?:)?\/\/[^"'`]+/gi

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else yield path
  }
}

const isAllowed = (host) =>
  ALLOWED_HOSTS.some(([allowed]) => host === allowed || host.endsWith(`.${allowed}`))

const violations = []
let scanned = 0
let sawIndexHtml = false

for await (const path of walk(dist)) {
  if (!SCANNED.has(extname(path))) continue
  scanned += 1

  const source = await readFile(path, 'utf8')
  const where = relative(dist, path)

  for (const [match, host] of source.matchAll(URL_PATTERN)) {
    if (!isAllowed(host.toLowerCase())) violations.push(`${where}: external origin ${match}`)
  }

  for (const [match] of source.matchAll(FETCH_LITERAL)) {
    violations.push(`${where}: outbound request ${match.slice(0, 70)}`)
  }

  for (const [pattern, name] of NETWORK_APIS) {
    if (pattern.test(source)) violations.push(`${where}: network API ${name}`)
  }

  if (where === 'index.html') {
    sawIndexHtml = true
    // The directives themselves contain single quotes ('self', 'none'), so the
    // attribute delimiter has to be captured and back-referenced, not guessed.
    const csp = source.match(
      /http-equiv=["']Content-Security-Policy["']\s+content=(["'])([\s\S]*?)\1/i,
    )?.[2]

    if (!csp) violations.push('index.html: missing Content-Security-Policy meta tag')
    else {
      for (const required of ["default-src 'self'", "connect-src 'self'", "object-src 'none'"]) {
        if (!csp.includes(required)) violations.push(`index.html: CSP is missing "${required}"`)
      }
    }
  }
}

if (!sawIndexHtml) violations.push(`${dist}/index.html not found — did the build run?`)

// One bundled file can repeat the same host dozens of times.
const unique = [...new Set(violations)]

if (unique.length > 0) {
  console.error(`\n  Privacy gate FAILED — ${unique.length} finding(s) across ${scanned} files:\n`)
  for (const violation of unique) console.error(`   x ${violation}`)
  console.error(
    '\n  Each of these can reach the network. Remove it, or add a deliberate\n' +
      '  exception with a reason to ALLOWED_HOSTS in scripts/check-no-network.mjs.\n',
  )
  process.exit(1)
}

console.log(`  Privacy gate passed — ${scanned} built files, zero outbound origins.`)
console.log(`  ${ALLOWED_HOSTS.length} documented inert-string exceptions, 0 fetchable.`)
