import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { ApiArticle, ApiExamples } from './api.jsx'
import { home, pages, redirects } from './content.js'
import { Dialogs, Footer, Header, Landing, Pager, Sidebar } from './layout.jsx'
import { Icon, mdxComponents } from './ui.jsx'

export { pages, redirects }

function normalized(value) {
  return value.replace(/\s+/g, ' ').trim()
}

const rendered = new Map()
function articleFor(page) {
  if (!rendered.has(page.path)) {
    const markup = renderToStaticMarkup(page.endpoint
      ? <ApiArticle endpoint={page.endpoint} />
      : <page.document components={mdxComponents} />)
    const $ = load(markup, {}, false)
    $('p, li, h2, h3, h4, div.card-body, td, th, pre').append(' ')
    const targeted = $('h2[id], h3[id]')
    const headings = targeted.toArray().map((node) => ({
      id: node.attribs.id,
      level: node.name,
      title: normalized($(node).text()),
      text: normalized($(node).nextUntil('h2, h3').text()),
    })).filter((heading) => heading.title)
    const text = normalized($.root().text()).slice(0, 2300)
    rendered.set(page.path, { markup, headings, text })
  }
  return rendered.get(page.path)
}

let search
export function searchIndex() {
  search ??= JSON.stringify(Array.from(pages.values()).flatMap((page) => {
    const { headings, text } = articleFor(page)
    const record = {
      id: page.path, title: page.title, section: page.section,
      description: page.description ?? '',
      body: page.endpoint ? `${page.endpoint.method} ${page.endpoint.route} ${text}` : text,
    }
    return [record, ...headings.map((heading) => ({
      ...record,
      id: `${page.path}#${heading.id}`,
      heading: heading.title,
      description: heading.text.slice(0, 155) || record.description,
      body: heading.text,
    }))]
  }))
  return search
}

function Contents({ headings }) {
  return <aside className="on-this-page">
    <nav aria-label="On this page">
      <p><Icon name="list" size={16} /> On this page</p>
      <ul>{headings.map(({ id, level, title }) => <li key={id} className={level}>
        <a href={`#${id}`}>{title}</a>
      </li>)}</ul>
    </nav>
  </aside>
}

function DocHeading({ page }) {
  return <div className="article-header">
    <div className="breadcrumb"><a href="/">Docs</a><Icon name="chevron" size={13} />{page.section}</div>
    <h1>{page.title}</h1>
    {page.description && <p>{page.description}</p>}
  </div>
}

function Site({ page }) {
  const current = page ?? home
  const isHome = page === home
  const article = page && articleFor(page)
  return <>
    <a className="skip-link" href="#content">Skip to content</a>
    <Header activeSection={current.section} />
    <div className="site-layout shell">
      <aside className="desktop-sidebar"><Sidebar page={current} /></aside>
      <main id="content" className={isHome ? 'home-content' : 'main-content'}>
        {isHome && <>
          <Landing />
          <div className="landing-article prose" dangerouslySetInnerHTML={{ __html: article.markup }} />
        </>}
        {page && !isHome && <div className={`article-layout ${page.endpoint ? 'api-layout' : ''}`}>
          <article>
            <DocHeading page={page} />
            <div className="prose" dangerouslySetInnerHTML={{ __html: article.markup }} />
            <Pager page={page} />
          </article>
          {page.endpoint ? <ApiExamples endpoint={page.endpoint} /> : article.headings.length > 1 && <Contents headings={article.headings} />}
        </div>}
        {!page && <div className="missing-page">
          <h1>Page not found</h1>
          <p>Try searching the docs or return to the overview.</p>
          <a href="/">Back to docs <Icon name="arrow" size={17} /></a>
        </div>}
        <Footer />
      </main>
    </div>
    <Dialogs page={current} />
  </>
}

function PageMeta({ page }) {
  const title = page === home ? page.title : `${page?.title ?? 'Page not found'} · UniFi Docs`
  return <>
    <title>{title}</title>
    {page?.description && <meta name="description" content={page.description} />}
    <meta property="og:title" content={title} />
    {page?.description && <meta property="og:description" content={page.description} />}
  </>
}

export function renderDocument(template, page) {
  return template.replace('<!--head-->', () => renderToStaticMarkup(<PageMeta page={page} />))
    .replace('<!--body-->', () => renderToStaticMarkup(<Site page={page} />))
}
