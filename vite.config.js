import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import mdx from '@mdx-js/rollup'
import GithubSlugger from 'github-slugger'
import rehypeHighlight from 'rehype-highlight'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkGfm from 'remark-gfm'
import { defineConfig } from 'vite'

function headingIds() {
  return (tree) => {
    const slugger = new GithubSlugger()
    const text = (node) => node.value ?? (node.children ?? []).map(text).join('')
    function walk(node) {
      if (/^h[2-6]$/.test(node.tagName ?? '')) node.properties.id = slugger.slug(text(node))
      node.children?.forEach(walk)
    }
    walk(tree)
  }
}

function docsPreview() {
  return {
    name: 'unifi-docs-dev',
    configureServer(server) {
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
  }
}

export default defineConfig({
  publicDir: false,
  appType: 'mpa',
  oxc: { jsx: { runtime: 'automatic' } },
  plugins: [
    { ...mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm],
      rehypePlugins: [headingIds, [rehypeHighlight, { plainText: ['mermaid', 'text', 'powershell', 'makefile', 'http'] }]],
    }), enforce: 'pre' },
    docsPreview(),
  ],
})
