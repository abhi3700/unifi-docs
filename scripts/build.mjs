import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { build } from 'vite'

const { values: { mode } } = parseArgs({ options: { mode: { type: 'string' } } })
await build({ mode })
await build({
  mode,
  build: {
    ssr: 'src/site.jsx',
    outDir: '.dist-ssr',
    rollupOptions: { output: { entryFileNames: 'site.js' } },
  },
})

try {
  const { pages, redirects, renderDocument, searchIndex } = await import('../.dist-ssr/site.js')
  const template = await readFile('dist/index.html', 'utf8')
  await Promise.all(Array.from(pages, async ([route, page]) => {
    const path = route === '/' ? 'dist/index.html' : `dist${route}.html`
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, renderDocument(template, page))
  }))
  await Promise.all([
    cp('logo', 'dist/logo', { recursive: true }),
    cp('images', 'dist/images', { recursive: true }),
    cp('api-reference/openapi.json', 'dist/api-reference/openapi.json'),
    writeFile('dist/404.html', renderDocument(template)),
    writeFile('dist/search-index.json', searchIndex()),
    writeFile('dist/_redirects', Array.from(redirects)
      .filter(([from, to]) => from !== to && !pages.has(from))
      .map(([from, to]) => `${from} ${to} 301`).join('\n') + '\n'),
    writeFile('dist/_headers', [
      '/assets/*\n  Cache-Control: public, max-age=31536000, immutable',
      '/api-reference/openapi.json\n  Access-Control-Allow-Origin: *',
      '/install.js\n  Cache-Control: no-cache',
      '/manifest.webmanifest\n  Cache-Control: no-cache\n  Content-Type: application/manifest+json; charset=utf-8',
    ].join('\n\n') + '\n'),
  ])
} finally {
  await rm('.dist-ssr', { recursive: true, force: true })
}
