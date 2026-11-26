import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/inter/wght-italic.css'
import './style.css'

const root = document.documentElement
const systemTheme = matchMedia('(prefers-color-scheme: dark)')
const themeButtons = document.querySelectorAll('[data-theme-toggle]')
const currentTheme = () => root.dataset.theme ?? (systemTheme.matches ? 'dark' : 'light')

function updateThemeLabels() {
  const label = currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  for (const button of themeButtons) {
    button.setAttribute('aria-label', label)
    button.title = label
  }
}
function toggleTheme() {
  root.dataset.theme = currentTheme() === 'dark' ? 'light' : 'dark'
  try { localStorage.setItem('unifi-docs-theme', root.dataset.theme) } catch {}
  updateThemeLabels()
  if (visualizeDiagrams) void visualizeDiagrams()
}
themeButtons.forEach((button) => button.addEventListener('click', toggleTheme))
systemTheme.addEventListener('change', (event) => {
  try { if (localStorage.getItem('unifi-docs-theme')) return } catch {}
  root.dataset.theme = event.matches ? 'dark' : 'light'
  updateThemeLabels()
  if (visualizeDiagrams) void visualizeDiagrams()
})
updateThemeLabels()

const searchDialog = document.querySelector('#search')
const input = document.querySelector('#search-input')
const results = document.querySelector('#search-results')
const status = document.querySelector('#search-status')
const sectionNav = document.querySelector('.section-nav')
const activeSection = sectionNav.querySelector('[aria-current]')
if (activeSection?.offsetLeft + activeSection?.offsetWidth > sectionNav.clientWidth) {
  sectionNav.scrollLeft = activeSection.offsetLeft - 16
}
const shortcuts = document.querySelector('[data-shortcut]')
shortcuts.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'

let searchIndex
let activeResult = -1

async function loadSearch() {
  const [{ default: MiniSearch }, data] = await Promise.all([
    import('minisearch'),
    fetch('/search-index.json').then((response) => {
      if (!response.ok) throw new Error('Search index unavailable')
      return response.json()
    }),
  ])
  const engine = new MiniSearch({
    fields: ['title', 'section', 'heading', 'description', 'body'],
    storeFields: ['title', 'section', 'heading', 'description'],
    searchOptions: {
      boost: { title: 5, heading: 4, section: 2, description: 1.5 },
      prefix: true, fuzzy: 0.18, combineWith: 'AND',
    },
  })
  engine.addAll(data)
  const suggestedPaths = ['/quickstart', '/payment-gateway/quickstart', '/api-reference/authentication', '/webapp/pay_receipt']
  return { engine, suggestions: suggestedPaths.map((id) => data.find((page) => page.id === id)).filter(Boolean) }
}

function selectResult(index) {
  const links = [...results.querySelectorAll('a')]
  activeResult = links.length ? (index + links.length) % links.length : -1
  links.forEach((link, position) => link.toggleAttribute('data-active', position === activeResult))
  links[activeResult]?.scrollIntoView({ block: 'nearest' })
}

function showResults(matches, query) {
  results.replaceChildren()
  const seen = new Set()
  for (const match of matches) {
    const page = match.id.split('#')[0]
    if (seen.has(page)) continue
    seen.add(page)
    const entry = document.createElement('li')
    const link = document.createElement('a')
    link.href = match.id
    const section = document.createElement('span')
    section.textContent = match.section
    const title = document.createElement('strong')
    title.textContent = match.heading ? `${match.title} · ${match.heading}` : match.title
    const description = document.createElement('small')
    description.textContent = match.description
    link.append(section, title, description)
    entry.append(link)
    results.append(entry)
    if (seen.size === 9) break
  }
  status.textContent = seen.size ? (query ? '' : 'Suggested pages') : 'No results found.'
  selectResult(0)
}

let searchRequest = 0
async function search() {
  const request = ++searchRequest
  const query = input.value.trim()
  try {
    searchIndex ??= loadSearch()
    const { engine, suggestions } = await searchIndex
    if (request === searchRequest) showResults(query ? engine.search(query) : suggestions, query)
  } catch {
    searchIndex = undefined
    if (request === searchRequest) status.textContent = 'Search could not load. Try again.'
  }
}

function openDialog(dialog) {
  if (dialog.open) return
  dialog.showModal()
  if (dialog === searchDialog) {
    input.focus()
    void search()
  }
}

document.querySelectorAll('[data-dialog-open]').forEach((button) => {
  button.addEventListener('click', () => openDialog(document.getElementById(button.dataset.dialogOpen)))
})
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return
    const box = dialog.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close()
  })
})
results.addEventListener('click', (event) => {
  if (event.target.closest('a')) searchDialog.close()
})
input.addEventListener('input', search)
input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    selectResult(activeResult + (event.key === 'ArrowDown' ? 1 : -1))
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    results.querySelector('[data-active]')?.click()
  }
})
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    document.querySelector('#mobile-menu[open]')?.close()
    openDialog(searchDialog)
  }
})

function observePathWrap(block, code, button) {
  const route = document.createRange()
  route.selectNodeContents(code)
  function update() {
    const routeWidth = Array.from(route.getClientRects()).reduce((total, rect) => total + rect.width, 0)
    const controlWidth = button.hidden ? 0 : button.getBoundingClientRect().width + parseFloat(getComputedStyle(block).columnGap)
    const availableWidth = code.getBoundingClientRect().width + controlWidth
    button.hidden = routeWidth <= availableWidth + .5
    code.tabIndex = button.hidden ? -1 : 0
  }
  new ResizeObserver(update).observe(block)
  document.fonts.ready.then(update)
}

const mobileExamples = matchMedia('(max-width: 760px)')
document.querySelectorAll('[data-wrap-lines]').forEach((button) => {
  const block = button.closest('[data-wrap-container]')
  const code = block.querySelector('[data-wrap-content]')
  if (button.hasAttribute('data-wrap-if-needed')) {
    observePathWrap(block, code, button)
  } else if (!block.dataset.wrap) {
    function syncDefault() {
      if (!block.dataset.wrap) button.setAttribute('aria-pressed', String(!mobileExamples.matches))
    }
    syncDefault()
    mobileExamples.addEventListener('change', syncDefault)
  }
  button.addEventListener('click', () => {
    const wrap = button.getAttribute('aria-pressed') === 'false'
    block.dataset.wrap = wrap ? 'on' : 'off'
    button.setAttribute('aria-pressed', String(wrap))
    if (wrap) code.scrollLeft = 0
  })
})

document.querySelectorAll('[data-copy]').forEach((button) => {
  let reset
  button.addEventListener('click', async () => {
    const text = button.closest('.code-block').querySelector('pre').textContent
    try {
      await navigator.clipboard.writeText(text)
      button.dataset.copied = 'true'
      button.setAttribute('aria-label', 'Copied')
    } catch {
      button.setAttribute('aria-label', 'Could not copy')
    }
    clearTimeout(reset)
    reset = setTimeout(() => {
      delete button.dataset.copied
      button.setAttribute('aria-label', 'Copy code')
    }, 1600)
  })
})

document.querySelectorAll('[data-tabs]').forEach((group, groupIndex) => {
  const tabs = [...group.querySelectorAll(':scope > .tab-list > [role="tab"]')]
  const panels = [...group.querySelectorAll(':scope > [role="tabpanel"]')]
  function activate(index, focus = false) {
    tabs.forEach((tab, position) => {
      tab.setAttribute('aria-selected', position === index)
      tab.tabIndex = position === index ? 0 : -1
      panels[position].hidden = position !== index
    })
    if (focus) tabs[index].focus()
  }
  tabs.forEach((tab, index) => {
    const id = `example-${groupIndex}-${index}`
    tab.id = id
    tab.setAttribute('aria-controls', id + '-panel')
    panels[index].id = id + '-panel'
    panels[index].setAttribute('aria-labelledby', id)
    panels[index].tabIndex = 0
    tab.addEventListener('click', () => activate(index))
    tab.addEventListener('keydown', (event) => {
      const indexByKey = { Home: 0, End: tabs.length - 1, ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length }
      if (!(event.key in indexByKey)) return
      event.preventDefault()
      activate(indexByKey[event.key], true)
    })
  })
  activate(0)
})

const diagrams = [...document.querySelectorAll('.diagram-source')]
let diagramPass = 0
const visualizeDiagrams = diagrams.length ? async () => {
  const pass = ++diagramPass
  const { default: mermaid } = await import('mermaid')
  if (pass !== diagramPass) return
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: currentTheme() === 'dark' ? 'dark' : 'neutral', suppressErrorRendering: true })
  for (const [index, block] of diagrams.entries()) {
    const pre = block.querySelector('pre')
    try {
      const { svg } = await mermaid.render(`diagram-${pass}-${index}`, pre.textContent)
      if (pass !== diagramPass) return
      const figure = block.querySelector('.diagram') ?? document.createElement('div')
      figure.className = 'diagram'
      figure.innerHTML = svg
      if (!figure.parentNode) block.append(figure)
      pre.hidden = true
    } catch (error) {
      console.error('Could not render Mermaid diagram', error)
    }
  }
} : undefined
if (visualizeDiagrams) visualizeDiagrams().catch(console.error)

const anchors = [...document.querySelectorAll('.on-this-page a')]
function updateOutline() {
  let current = anchors[0]
  for (const anchor of anchors) {
    const target = document.getElementById(decodeURIComponent(anchor.hash.slice(1)))
    if (target?.getBoundingClientRect().top <= 156) current = anchor
  }
  anchors.forEach((anchor) => {
    if (anchor === current) anchor.setAttribute('aria-current', 'location')
    else anchor.removeAttribute('aria-current')
  })
}
if (anchors.length) {
  addEventListener('scroll', updateOutline, { passive: true })
  updateOutline()
}
