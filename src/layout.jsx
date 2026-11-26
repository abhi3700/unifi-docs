import { appLink, endpointSection, footerLinks, logos, sections, siteLink, supportLink } from './content.js'
import { Method } from './api.jsx'
import { Icon } from './ui.jsx'

export function Header({ activeSection }) {
  return <header className="site-header">
    <div className="header-row shell">
      <a className="brand" href="/" aria-label="UniFi documentation home">
        <img className="brand-light" src={logos.light} alt="UniFi" width="88" height="25" />
        <img className="brand-dark" src={logos.dark} alt="UniFi" width="88" height="25" />
        <span>Docs</span>
      </a>
      <button className="header-search" type="button" data-dialog-open="search" aria-label="Search documentation" aria-keyshortcuts="Control+k Meta+k">
        <Icon name="search" size={17} /><span>Search documentation</span><kbd data-shortcut="">⌘ K</kbd>
      </button>
      <div className="header-actions">
        <a className="header-link" href={siteLink.href}>Website <Icon name="external" size={13} /></a>
        <a className="header-link" href={supportLink.href}>Support</a>
        <button className="icon-button" type="button" data-theme-toggle="" aria-label="Toggle color theme" title="Toggle color theme">
          <Icon className="theme-sun" name="sun" size={19} /><Icon className="theme-moon" name="moon" size={19} />
        </button>
        <a className="launch" href={appLink} aria-label="Open app">
          <span>Open app</span><Icon className="launch-arrow" name="external" size={15} />
          <Icon className="launch-phone" name="phone" size={20} />
        </a>
        <button className="icon-button mobile-menu" type="button" data-dialog-open="mobile-menu" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="mobile-menu">
          <Icon name="menu" size={22} />
        </button>
      </div>
    </div>
    <nav className="section-nav shell" aria-label="Documentation sections">
      {sections.map((section) => <a key={section.label} href={section.path} aria-current={section.label === activeSection ? 'true' : undefined}>
        <Icon name={section.icon} size={16} />{section.label}
      </a>)}
    </nav>
  </header>
}

export function Sidebar({ page, showSectionLinks = true }) {
  const section = sections.find((item) => item.label === page.section)
  const onHome = page.path === '/'
  const groups = onHome ? [
    { label: 'Get started', pages: [
      { title: 'Overview', path: '/', icon: 'book' },
      { title: 'Quickstart', path: '/quickstart', icon: 'zap' },
      { title: 'How UniFi works', path: '/concepts/how-unifi-works', icon: 'layers' },
      { title: 'Security and permissions', path: '/concepts/security-and-permissions', icon: 'shield' },
    ] },
  ] : section.groups
  if (onHome && showSectionLinks) {
    groups.push({ label: 'Documentation', pages: sections.slice(1).map((item) => ({ title: item.label, path: item.path, icon: item.icon })) })
  }
  const firstEndpointGroup = groups.find((group) => group.endpoints)
  return <nav className="sidebar-nav" aria-label={`${section.label} pages`}>
    {!onHome && <a className="sidebar-home" href="/"><Icon name="back" size={14} /> Docs home</a>}
    {groups.map((group) => {
      const hasCurrent = group.pages.some((entry) => entry.path === page.path)
      const links = <ul>{group.pages.map((entry) => <li key={entry.path}>
        <a href={entry.path} aria-current={entry.path === page.path ? 'page' : undefined}>
          {entry.icon && <Icon name={entry.icon} size={16} />}
          {entry.endpoint && <Method method={entry.endpoint.method} />}
          <span>{entry.title}</span>
        </a>
      </li>)}</ul>
      return group.endpoints ? <div key={group.label}>
        {group === firstEndpointGroup && <p className="sidebar-heading">Endpoints</p>}
        <details className="sidebar-group endpoint-group" open={hasCurrent}>
        <summary>{group.label}<Icon name="chevron" size={15} /></summary>{links}
        </details>
      </div> : <div className="sidebar-group" key={group.label}>
        <p>{group.label}</p>{links}
      </div>
    })}
    {!onHome && section.label === endpointSection && <a className="sidebar-home download-spec" href="/api-reference/openapi.json"><Icon name="download" size={15} /> OpenAPI spec</a>}
  </nav>
}

export function Dialogs({ page }) {
  return <>
    <dialog id="search" className="search-dialog" aria-labelledby="search-label">
      <div className="search-field">
        <Icon name="search" size={22} />
        <input type="search" id="search-input" aria-label="Search documentation" placeholder="Search documentation…" autoComplete="off" spellCheck="false" />
        <button type="button" className="icon-button" data-dialog-close="" aria-label="Close search"><Icon name="close" size={18} /></button>
      </div>
      <h2 className="sr-only" id="search-label">Search UniFi docs</h2>
      <p id="search-status" role="status"></p>
      <ul id="search-results"></ul>
      <div className="search-hints"><span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
    </dialog>
    <dialog id="mobile-menu" className="mobile-dialog" aria-labelledby="mobile-menu-title">
      <div className="drawer-top">
        <div className="drawer-header">
          <strong id="mobile-menu-title">Documentation</strong>
          <button className="icon-button" type="button" data-dialog-close="" aria-label="Close navigation"><Icon name="close" size={21} /></button>
        </div>
        <nav className="drawer-sections" aria-label="Documentation sections">
          {sections.map((section) => <a href={section.path} key={section.label} aria-current={section.label === page.section ? 'true' : undefined}><Icon name={section.icon} size={15} /> {section.label}</a>)}
        </nav>
      </div>
      <div className="drawer-pages"><Sidebar page={page} showSectionLinks={false} /></div>
    </dialog>
    <dialog id="diagram-viewer" className="diagram-dialog" aria-labelledby="diagram-viewer-title">
      <div className="diagram-dialog-header">
        <h2 id="diagram-viewer-title">Mermaid diagram</h2>
        <div className="diagram-dialog-actions">
          <div className="diagram-zoom" role="group" aria-label="Diagram zoom">
            <button type="button" className="icon-button" data-zoom-out="" aria-label="Zoom out" title="Zoom out"><Icon name="minus" size={16} /></button>
            <button type="button" className="icon-button zoom-reset" data-zoom-reset="" title="Reset zoom">100%</button>
            <button type="button" className="icon-button" data-zoom-in="" aria-label="Zoom in" title="Zoom in"><Icon name="plus" size={16} /></button>
          </div>
          <button type="button" className="icon-button" data-dialog-close="" aria-label="Close diagram" title="Close diagram" autoFocus><Icon name="close" size={21} /></button>
        </div>
      </div>
      <div className="diagram diagram-viewport" tabIndex={0} role="region" aria-label="Diagram canvas" />
    </dialog>
  </>
}

export function Pager({ page }) {
  const siblings = sections.find((section) => section.label === page.section).groups.flatMap((group) => group.pages)
  const index = siblings.findIndex((entry) => entry.path === page.path)
  return <nav className="pager" aria-label="More in this section">
    {[siblings[index - 1], siblings[index + 1]].map((entry, side) => entry
      ? <a key={entry.path} href={entry.path} className={side ? 'next-page' : 'prev-page'}>
        <span>{side ? 'Next' : 'Previous'}</span>
        <strong>{entry.title}</strong><Icon name={side ? 'arrow' : 'back'} size={18} />
      </a>
      : <span key={side} />)}
  </nav>
}

export function Footer() {
  return <footer className="site-footer">
    <a className="footer-brand" href="/"><img src="/logo/unifi-2.0-favicon.svg" width="22" height="22" alt="" /><span>UniFi Docs</span></a>
    <div>
      {Object.entries(footerLinks).map(([name, href]) =>
        <a key={name} href={href}>{({ website: 'Website', linkedin: 'LinkedIn', x: 'X', github: 'GitHub' })[name]}</a>)}
    </div>
  </footer>
}

const featured = [
  { title: 'Web App', icon: 'monitor', path: '/webapp/overview', detail: 'Set up your wallet, send and request payments, and track receipts.', color: 'blue' },
  { title: 'Payment Gateway', icon: 'card', path: '/payment-gateway/overview', detail: 'Add stablecoin checkout with the React widget or headless SDK.', color: 'purple' },
  { title: 'API Reference', icon: 'code', path: '/api-reference/introduction', detail: 'Authenticate and integrate wallet, payment, and receipt operations.', color: 'cyan' },
  { title: 'Falcon Agent', icon: 'falcon', path: '/falcon/overview', detail: 'Prepare, schedule, and automate stablecoin payments through chat.', color: 'purple' },
  { title: 'CLI', icon: 'terminal', path: '/cli/overview', detail: 'Manage wallets and automate payments from your terminal.', color: 'cyan' },
  { title: 'Core concepts', icon: 'layers', path: '/concepts/how-unifi-works', detail: 'Understand authorization, execution, and payment finality.', color: 'blue' },
]

export function Landing() {
  return <>
    <div className="hero">
      <div className="hero-inner">
        <h1>UniFi documentation</h1>
        <p>Send stablecoin payments, add UniFi to your checkout, or build directly with the API.</p>
        <div className="hero-actions">
          <a className="hero-primary" href="/quickstart">Get started <Icon name="arrow" size={17} /></a>
          <a className="hero-secondary" href="/api-reference/introduction">API reference <Icon name="arrow" size={17} /></a>
        </div>
      </div>
    </div>
    <section className="landing-section" aria-labelledby="explore-unifi">
      <h2 id="explore-unifi">Explore UniFi</h2>
      <div className="featured-grid">
        {featured.map(({ path, title, detail, icon, color }) => <a key={path} className="featured-card" href={path}>
          <span className={`featured-icon ${color}`}><Icon name={icon} size={20} /></span>
          <Icon className="featured-arrow" name="arrow" size={18} />
          <h3>{title}</h3>
          <p>{detail}</p>
        </a>)}
      </div>
    </section>
  </>
}
