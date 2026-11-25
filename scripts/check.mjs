import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { load } from 'cheerio'

const build = 'dist'
const files = new Set(await readdir(build, { recursive: true }))
const documents = new Map()
const invalid = []
const localOrigin = 'https://docs.payunifi.com'
const redirects = new Map((await readFile('dist/_redirects', 'utf8')).trim().split('\n')
  .map((line) => line.split(' ').slice(0, 2)))

function findFile(path) {
  const relative = decodeURIComponent(path).replace(/^\//, '')
  if (path === '/') return 'index.html'
  if (files.has(relative)) return relative
  const html = relative.replace(/\/$/, '') + '.html'
  return files.has(html) ? html : undefined
}

for (const file of files) {
  if (!file.endsWith('.html')) continue
  const $ = load(await readFile(`${build}/${file}`, 'utf8'))
  assert.equal($('h1').length, 1, file + ' must have a single page title')
  const ids = $('[id]').map((_, element) => $(element).attr('id')).get()
  assert.equal(new Set(ids).size, ids.length, file + ' has duplicate anchor IDs')
  documents.set(file, { $, ids: new Set(ids) })
}

function checkLink(reference, source) {
  const url = new URL(reference, `${localOrigin}/${source}`)
  if (url.origin !== localOrigin) return
  const target = findFile(redirects.get(url.pathname) ?? url.pathname)
  if (!target || (url.hash && !documents.get(target)?.ids.has(decodeURIComponent(url.hash.slice(1))))) {
    invalid.push(`${source} → ${reference}`)
  }
}

for (const [file, { $ }] of documents) {
  $('[href], [src]').each((_, element) => checkLink($(element).attr('href') ?? $(element).attr('src'), file))
}
for (const [path, target] of redirects) {
  if (!findFile(target)) invalid.push(`Redirect ${path} → ${target}`)
}

const spec = JSON.parse(await readFile('api-reference/openapi.json', 'utf8'))
const operations = Object.values(spec.paths).flatMap((item) => Object.values(item).filter((value) => value?.operationId))
const endpoints = [...documents].filter(([path]) => path.startsWith('api-reference/endpoints/'))
assert.equal(endpoints.length, operations.length, 'All documented API operations must have a page')
assert.equal(await readFile('dist/api-reference/openapi.json', 'utf8'), await readFile('api-reference/openapi.json', 'utf8'))
for (const entry of JSON.parse(await readFile('dist/search-index.json', 'utf8'))) checkLink(entry.id, 'search index')

assert.deepEqual([...new Set(invalid)], [], 'Broken local docs links')
console.log(`Checked ${documents.size - 1} pages, ${endpoints.length} API operations, and local links, images, and anchors.`)
