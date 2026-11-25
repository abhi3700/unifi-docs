import { Children } from 'react'
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bot, Braces, Check, ChevronDown, ChevronRight,
  CircleAlert, CodeXml, Copy, CreditCard, FileCode2, GitBranch, Globe2, Info, Layers3, Link2,
  List, LockKeyhole, Menu, Monitor, Moon, Search, ShieldCheck, Smartphone, Sparkles, Sun, Terminal, TriangleAlert, X, Zap,
} from 'lucide-react'

const icons = {
  arrow: ArrowRight, back: ArrowLeft, external: ArrowUpRight, book: BookOpen, bot: Bot, brackets: Braces,
  check: Check, chevron: ChevronRight, down: ChevronDown, code: CodeXml, copy: Copy, card: CreditCard,
  branch: GitBranch, globe: Globe2, info: Info, layers: Layers3, link: Link2, list: List, menu: Menu,
  monitor: Monitor, moon: Moon, search: Search, shield: ShieldCheck, sparkles: Sparkles, sun: Sun,
  terminal: Terminal, warning: TriangleAlert, note: CircleAlert, close: X, zap: Zap, lock: LockKeyhole,
  download: ArrowDownToLine, file: FileCode2, phone: Smartphone,
}

export function Icon({ name, size = 18, ...props }) {
  const Component = icons[name] ?? FileCode2
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" {...props} />
}

const docIcons = {
  globe: 'globe', desktop: 'monitor', robot: 'bot', 'credit-card': 'card', terminal: 'terminal', code: 'code',
  send: 'arrow', shuffle: 'branch', box: 'layers', bolt: 'zap', plug: 'code', key: 'lock', history: 'branch',
  'shield-halved': 'shield', shield: 'shield', 'diagram-project': 'branch', sparkles: 'sparkles', link: 'link',
  github: 'github', 'arrow-up-right-from-square': 'external', 'cart-shopping': 'card', 'triangle-exclamation': 'warning',
}

function Columns({ cols = 2, children }) {
  return <div className="doc-columns" style={{ '--columns': cols }}>{children}</div>
}

function Card({ title, icon, href, children }) {
  const content = <>
    <span className="card-title">
      {icon && <Icon name={docIcons[icon]} size={17} />}
      {title}
      {href && <Icon className="card-arrow" name={href.startsWith('http') ? 'external' : 'arrow'} size={16} />}
    </span>
    {children && <div className="card-body">{children}</div>}
  </>
  return href ? <a className="doc-card" href={href}>{content}</a> : <div className="doc-card">{content}</div>
}

function Steps({ children }) {
  return <ol className="steps">{children}</ol>
}

function Step({ title, children }) {
  return <li><strong className="step-title">{title}</strong><div>{children}</div></li>
}

function Callout({ type, children }) {
  return <aside className={`callout callout-${type}`} aria-label={type}>
    <Icon name={{ Tip: 'sparkles', Note: 'note', Info: 'info', Warning: 'warning' }[type]} size={19} />
    <div>{children}</div>
  </aside>
}

function Frame({ caption, children }) {
  return <figure className="frame">{children}{caption && <figcaption>{caption}</figcaption>}</figure>
}

function Accordion({ title, children }) {
  return <details className="accordion"><summary>{title}<Icon name="down" size={16} /></summary><div>{children}</div></details>
}
function Tab({ children }) {
  return children
}
function Tabs({ children }) {
  const tabs = Children.toArray(children).filter((tab) => tab?.props?.title)
  return <div className="doc-tabs" data-tabs="">
    <div className="tab-list" role="tablist" aria-label="Examples">
      {tabs.map((tab, index) => <button key={tab.props.title} type="button" role="tab" aria-selected={index === 0} tabIndex={index ? -1 : 0}>{tab.props.title}</button>)}
    </div>
    {tabs.map((tab) => <div key={tab.props.title} role="tabpanel">{tab.props.children}</div>)}
  </div>
}

export function CodeBlock({ language, label, children }) {
  return <div className={`code-block${language === 'mermaid' ? ' diagram-source' : ''}`}>
    <div className="code-bar">
      <span>{label || ({ ts: 'TypeScript', tsx: 'TSX', sh: 'Shell', bash: 'Shell', json: 'JSON', http: 'HTTP', mermaid: 'Mermaid', text: 'Text' }[language] ?? language) || 'Code'}</span>
      <button type="button" className="icon-button code-copy" data-copy="" aria-label="Copy code" title="Copy code">
        <Icon name="copy" size={16} />
      </button>
    </div>
    <pre>{children}</pre>
  </div>
}

function Pre({ children }) {
  const code = Children.toArray(children)[0]
  const language = /language-([\w+-]+)/.exec(code?.props?.className ?? '')?.[1]
  return <CodeBlock language={language}>{children}</CodeBlock>
}

function titleLink(Tag) {
  return function Heading({ id, children }) {
    return <Tag id={id}>{children}{id && <a className="heading-anchor" href={`#${id}`} aria-label="Link to this section"><Icon name="link" size={16} /></a>}</Tag>
  }
}

export const mdxComponents = {
  Card, Columns, CardGroup: Columns, Steps, Step, Frame, Accordion, AccordionGroup: 'div', Tabs, Tab,
  Tip: (props) => <Callout type="Tip" {...props} />,
  Note: (props) => <Callout type="Note" {...props} />,
  Info: (props) => <Callout type="Info" {...props} />,
  Warning: (props) => <Callout type="Warning" {...props} />,
  h2: titleLink('h2'), h3: titleLink('h3'), h4: titleLink('h4'),
  pre: Pre,
  table: (props) => <div className="table-wrap" tabIndex={0} role="region" aria-label="Table"><table {...props} /></div>,
  img: (props) => <img loading="lazy" decoding="async" {...props} />,
}
