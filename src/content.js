import nav from '../docs.json'
import spec from '../api-reference/openapi.json'

const documents = import.meta.glob('../**/*.mdx', { eager: true })
export const home = { path: '/', title: 'UniFi documentation', description: 'Send stablecoin payments, build checkout, and integrate with the UniFi API.', section: 'Guides', document: documents['../index.mdx'].default }
export const pages = new Map([[home.path, home]])

const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])
const endpointGroups = new Map()
const endpointIndex = '/api-reference/endpoints'
export const redirects = new Map([
  ['/index', '/'],
  [endpointIndex, '/api-reference/introduction'],
  [`${endpointIndex}/health/check-api-dependencies`, `${endpointIndex}/health/check-api-health`],
])
export const endpointSection = 'API Reference'

export function resolveRef(value) {
  while (value?.$ref) {
    value = value.$ref.slice(2).split('/').reduce((node, segment) => node[segment.replaceAll('~1', '/').replaceAll('~0', '~')], spec)
  }
  return value
}

export function endpointSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

for (const [path, item] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (!methods.has(method)) continue
    const tag = operation.tags[0]
    const slug = endpointSlug(operation.summary)
    const page = {
      path: `${endpointIndex}/${endpointSlug(tag)}/${slug}`,
      title: operation.summary,
      description: operation.description,
      section: endpointSection,
      endpoint: { ...operation, method, route: path, server: spec.servers[0].url, security: operation.security ?? spec.security },
    }
    if (pages.has(page.path)) throw new Error(`Duplicate API endpoint slug ${page.path}`)
    pages.set(page.path, page)
    if (!endpointGroups.has(tag)) endpointGroups.set(tag, [])
    endpointGroups.get(tag).push(page)
  }
}

const labels = ['Guides', 'Web App', 'Falcon Agent', 'Payment Gateway', 'CLI', endpointSection]
const icons = ['book', 'monitor', 'bot', 'card', 'terminal', 'code']
export const sections = nav.navigation.tabs.map((tab, index) => {
  const label = labels[index]
  const groups = (tab.groups ?? [{ group: label, pages: tab.pages }]).flatMap((group) => {
    if (group.openapi) return Array.from(endpointGroups, ([label, pages]) => ({ label, pages, endpoints: true }))
    const entries = group.pages.map((route) => {
      const { default: document, frontmatter } = documents[`../${route}.mdx`]
      const page = { path: '/' + route, title: frontmatter.title, description: frontmatter.description, section: label, document }
      pages.set(page.path, page)
      return page
    })
    return [{ label: group.group, pages: entries }]
  })
  return { label, icon: icons[index], groups, path: groups[0].pages[0].path }
})

export const [siteLink, supportLink] = nav.navbar.links
export const appLink = nav.navbar.primary.href
export const logos = nav.logo
export const footerLinks = nav.footer.socials
