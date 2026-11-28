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
  [`${endpointIndex}/history/get-a-bulk-payment`, `${endpointIndex}/history/get-a-bulk-payment-receipt`],
  [`${endpointIndex}/pay/create-managed-wallet-bulk-payments`, `${endpointIndex}/pay/create-custodial-bulk-payments`],
  [`${endpointIndex}/pay/create-a-managed-wallet-merchant-payment`, `${endpointIndex}/pay/create-a-custodial-merchant-payment`],
])
export const endpointSection = 'API Reference'
const local = ['development', 'test', 'canvas'].includes(import.meta.env.MODE)
const dev = import.meta.env.MODE === 'dev'
const webAppOrigin = import.meta.env.VITE_WEB_APP_BASE_URL?.trim() ||
  (local ? 'http://localhost:3334' : dev ? 'https://dev.payunifi.com' : 'https://payunifi.com')
const apiOrigin = import.meta.env.VITE_API_BASE_URL?.trim() || (local ? 'http://localhost:3333' : spec.servers[0].url)

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
    const playgroundId = operation['x-playground-id']
    if (playgroundId !== undefined && (!Number.isInteger(playgroundId) || playgroundId < 1)) {
      throw new Error(`Invalid playground number for ${method} ${path}`)
    }
    const tag = operation.tags[0]
    const slug = endpointSlug(operation.summary)
    const page = {
      path: `${endpointIndex}/${endpointSlug(tag)}/${slug}`,
      title: operation.summary,
      description: operation.description?.replace(/`([^`]+)`/g, '$1'),
      section: endpointSection,
      endpoint: {
        ...operation, method, route: path,
        server: new URL(apiOrigin).origin,
        webAppUrl: playgroundId && new URL(`/app/api/playground/${playgroundId}`, webAppOrigin).href,
        security: operation.security ?? spec.security,
      },
    }
    if (pages.has(page.path)) throw new Error(`Duplicate API endpoint slug ${page.path}`)
    pages.set(page.path, page)
    if (!endpointGroups.has(tag)) endpointGroups.set(tag, [])
    endpointGroups.get(tag).push(page)
  }
}

const labels = ['Guides', 'Web App', 'Falcon Agent', 'Payment Gateway', 'CLI', endpointSection]
const icons = ['book', 'monitor', 'falcon', 'card', 'terminal', 'code']
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
