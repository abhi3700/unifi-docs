import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mdx from '@mdx-js/rollup'
import GithubSlugger from 'github-slugger'
import rehypeHighlight from 'rehype-highlight'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import { defineConfig } from 'vite'

function nodeText(node) {
  return node.value ?? (node.children ?? []).map(nodeText).join('')
}

function headingIds() {
  return (tree) => {
    const slugger = new GithubSlugger()
    function walk(node) {
      if (/^h[2-6]$/.test(node.tagName ?? '')) node.properties.id = slugger.slug(nodeText(node))
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

function responsiveTables() {
  const elements = (node) => node?.children?.filter((child) => child.type === 'element') ?? []

  function formatTable(table) {
    const [head, body] = elements(table)
    const [headerRow] = elements(head)
    const headers = elements(headerRow)
    const rows = elements(body)
    if (!headers.length || !rows.length) return

    const stacked = headers.length > 2 && headers.slice(1).some((cell) => cell.properties.align !== 'right')
    if (stacked) {
      table.properties.className = ['stack-on-mobile']
      table.properties.role = 'table'
      head.properties.role = body.properties.role = 'rowgroup'
      headerRow.properties.role = 'row'
    }
    for (const header of headers) {
      header.properties.scope = 'col'
      if (stacked) header.properties.role = 'columnheader'
    }
    for (const row of rows) {
      if (stacked) row.properties.role = 'row'
      for (const [index, cell] of elements(row).entries()) {
        if (index === 0) {
          cell.tagName = 'th'
          cell.properties.scope = 'row'
          if (stacked) cell.properties.role = 'rowheader'
        } else if (stacked) {
          cell.properties.role = 'cell'
          cell.children = [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['mobile-column-label'], ariaHidden: 'true' },
              children: [{ type: 'text', value: nodeText(headers[index]) }],
            },
            { type: 'element', tagName: 'span', properties: {}, children: cell.children },
          ]
        }
      }
    }
  }

  return (tree) => {
    function walk(node) {
      if (node.tagName === 'table') formatTable(node)
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

function docsPreview() {
  function allowSpecReads(req, res, next) {
    if (req.url?.split('?')[0] === '/api-reference/openapi.json') res.setHeader('Access-Control-Allow-Origin', '*')
    next()
  }
  return {
    name: 'unifi-docs-dev',
    configureServer(server) {
      server.middlewares.use(allowSpecReads)
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const path = url.pathname.replace(/\/$/, '') || '/'
        if (!req.headers.accept?.includes('text/html') && path !== '/search-index.json') {
          if (!/^\/(images|logo)\//.test(path) && path !== '/api-reference/openapi.json') return next()
          const file = resolve('.' + path)
          if (!file.startsWith(process.cwd() + '/') || !await stat(file).then((s) => s.isFile(), () => false)) return next()
          const type = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' }[extname(file)]
          res.setHeader('Content-Type', type ?? 'application/octet-stream')
          return res.end(await readFile(file))
        }
        if (path.startsWith('/@')) return next()
        try {
          const docs = await server.ssrLoadModule('/src/site.jsx')
          if (path === '/search-index.json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            return res.end(docs.searchIndex())
          }
          const canonical = docs.redirects.get(path)
          if (canonical) {
            res.writeHead(302, { Location: canonical })
            return res.end()
          }
          const page = docs.pages.get(path)
          const template = await readFile('index.html', 'utf8')
          const html = await server.transformIndexHtml(path, docs.renderDocument(template, page))
          res.statusCode = page ? 200 : 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch (error) {
          server.ssrFixStacktrace(error)
          next(error)
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(allowSpecReads)
    },
  }
}

const chunkSizeLimit = 500
const mermaidParserSizeLimit = 650

function checkClientChunkSizes() {
  return {
    name: 'unifi-docs-chunk-sizes',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        const size = Buffer.byteLength(chunk.code) / 1000
        if (size <= chunkSizeLimit || size > mermaidParserSizeLimit) continue
        // Mermaid ships this lazy parser as a single prebuilt module.
        const [module] = chunk.moduleIds
        if (chunk.moduleIds.length === 1 && /\/node_modules\/@mermaid-js\/parser\/dist\/chunks\//.test(module)) continue
        this.warn(`${chunk.fileName} is ${size.toFixed(2)} kB after minification (limit ${chunkSizeLimit} kB).`)
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  appType: 'mpa',
  server: { port: 3001, strictPort: true },
  preview: { port: 3001, strictPort: true },
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: command === 'build' ? {
    alias: [{ find: /^elkjs\/lib\/elk\.bundled\.js$/, replacement: fileURLToPath(new URL('./src/elk-worker.js', import.meta.url)) }],
  } : undefined,
  // Vite reports every chunk over the parser's limit. The plugin keeps the normal limit for the rest.
  build: { chunkSizeWarningLimit: mermaidParserSizeLimit },
  plugins: [
    { ...mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm],
      rehypePlugins: [headingIds, responsiveTables, [rehypeHighlight, { plainText: ['mermaid', 'text', 'powershell', 'makefile', 'http'] }]],
    }), enforce: 'pre' },
    docsPreview(),
    checkClientChunkSizes(),
  ],
}))
