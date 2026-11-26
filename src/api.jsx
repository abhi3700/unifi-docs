import { Fragment } from 'react'
import { resolveRef } from './content.js'
import { CodeBlock, Icon, WrapLinesButton } from './ui.jsx'

export function Method({ method }) {
  return <span className={`method method-${method}`}>{method.toUpperCase()}</span>
}

function shape(schema) {
  if (!schema) return 'any'
  if (schema.type === 'array') return `${shape(schema.items)}[]`
  if (schema.$ref) return schema.$ref.split('/').at(-1)
  if (schema.oneOf || schema.anyOf) return (schema.oneOf ?? schema.anyOf).map(shape).join(' | ')
  return schema.type ?? 'object'
}

function Fields({ schema: input, seen = [] }) {
  if (!input || seen.includes(input.$ref)) return null
  const schema = resolveRef(input)
  if (input.$ref) seen = [...seen, input.$ref]
  if (schema.type === 'array') return <Fields schema={schema.items} seen={seen} />
  if (schema.oneOf || schema.anyOf || schema.allOf) {
    return (schema.oneOf ?? schema.anyOf ?? schema.allOf).map((variant, index) =>
      <details className="schema-details" key={index}>
        <summary><code>{shape(variant)}</code></summary><Fields schema={variant} seen={seen} />
      </details>)
  }
  if (!schema.properties) return null
  return <div className="field-list">{Object.entries(schema.properties).map(([name, field]) => {
    const definition = resolveRef(field)
    return <div className="field" key={name}>
      <FieldLabel name={name} type={shape(field)} required={schema.required?.includes(name)} />
      <FieldDetails {...definition} />
      {(definition.properties || definition.items || definition.oneOf || definition.anyOf || definition.allOf) && !seen.includes(field.$ref) &&
        <details className="schema-details"><summary>Show fields</summary><Fields schema={field} seen={seen} /></details>}
    </div>
  })}</div>
}

function FieldLabel({ name, type, required }) {
  return <div className="field-label"><code>{name}</code><span>{type}</span>{required && <small>required</small>}</div>
}

function FieldDetails({ description, ...schema }) {
  return <>
    {description && <p>{description}</p>}
    {schema.enum && <p className="field-values">Allowed values {schema.enum.map((value) => <code key={String(value)}>{String(value)}</code>)}</p>}
    {schema.default !== undefined && <p className="field-values">Default <code>{String(schema.default)}</code></p>}
  </>
}

const parameterGroups = { path: 'Path parameters', query: 'Query parameters', header: 'Headers', cookie: 'Cookies' }

function inlineCode(value) {
  return value.split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)
}

function endpointExamples(endpoint) {
  const request = resolveRef(endpoint.requestBody)
  const requestType = Object.keys(request?.content ?? {})[0]
  const body = request?.content[requestType]?.example
  const parameters = (endpoint.parameters ?? []).map(resolveRef)
  const route = endpoint.route.replace(/\{([^}]+)\}/g, (_, name) => {
    const parameter = parameters.find((item) => item.name === name)
    const schema = resolveRef(parameter?.schema)
    return encodeURIComponent(String(parameter?.example ?? schema?.example ?? schema?.enum?.[0] ?? `{${name}}`)).replace(/%7B|%7D/g, (match) => match === '%7B' ? '{' : '}')
  })
  const fragments = [
    `curl${endpoint.method === 'get' ? '' : ` -X ${endpoint.method.toUpperCase()}`} '${endpoint.server}${route}'`,
    endpoint.security?.length && `  -H "Authorization: Bearer \${UNIFI_API_KEY}"`,
    body !== undefined && `  -H 'Content-Type: ${requestType}'`,
    body !== undefined && `  --data '${JSON.stringify(body).replaceAll("'", "'\\''")}'`,
  ].filter(Boolean)
  return fragments.join(' \\\n')
}

export function ApiEndpointInfo({ endpoint }) {
  const { route, method } = endpoint
  return <>
    <div className="endpoint-path" data-wrap-container="" data-wrap="on">
      <Method method={method} />
      <code data-wrap-content="">{route.split(/(?=\/)/).map((segment, index) =>
        <Fragment key={index}>{index > 0 && <wbr />}{segment}</Fragment>)}</code>
      <WrapLinesButton label="Wrap endpoint path" pressed />
    </div>
    {endpoint.security?.length > 0 && <div className="api-auth">
      <Icon name="lock" size={15} /><a href="/api-reference/authentication">Bearer authentication</a><span>Required</span>
    </div>}
  </>
}

export function ApiDetails({ endpoint }) {
  const params = (endpoint.parameters ?? []).map(resolveRef)
  const request = resolveRef(endpoint.requestBody)
  return <>
    {Object.entries(parameterGroups).map(([location, title]) => {
      const fields = params.filter((param) => param.in === location)
      if (!fields.length) return null
      return <section key={location}>
        <h2 id={`${location}-parameters`}>{title}</h2>
        <div className="field-list">{fields.map((param) => <div className="field" key={param.name}>
          <FieldLabel name={param.name} type={shape(resolveRef(param.schema))} required={param.required} />
          <FieldDetails {...resolveRef(param.schema)} description={param.description} />
        </div>)}</div>
      </section>
    })}
    {request && <section>
      <h2 id="request-body">Request body</h2>
      {request.description && <p>{inlineCode(request.description)}</p>}
      {Object.entries(request.content).map(([type, { schema }]) => <div key={type}>
        <p className="api-media"><code>{type}</code>{request.required && ' · Required'}</p>
        <Fields schema={schema} />
      </div>)}
    </section>}
    <section>
      <h2 id="responses">Responses</h2>
      <div className="api-responses">
        {Object.entries(endpoint.responses).map(([status, value]) => {
          const response = resolveRef(value)
          const success = status.startsWith('2')
          return <details className="accordion api-response" key={status} open={success}>
            <summary>
              <span className={`response-status ${success ? 'response-ok' : 'response-error'}`}>{status}</span>{' '}
              <span>{response.description}</span><Icon name="down" size={16} />
            </summary>
            <div>{Object.entries(response.content ?? {}).map(([type, { schema }]) => <div key={type}>
              <p className="api-media"><code>{type}</code>{schema && <> · <code className="api-schema-name">{shape(schema)}</code></>}</p>
              <Fields schema={schema} />
            </div>)}</div>
          </details>
        })}
      </div>
    </section>
  </>
}

export function ApiExamples({ endpoint }) {
  const success = Object.entries(endpoint.responses).find(([status]) => status.startsWith('2'))
  const content = resolveRef(success?.[1])?.content
  const response = content && Object.values(content).find((type) => type.example !== undefined)
  return <section className="api-examples" aria-label="API examples">
    <CodeBlock label="cURL request" wrap="responsive"><code>{endpointExamples(endpoint)}</code></CodeBlock>
    {response && <CodeBlock label={`${success[0]} response`} wrap="responsive"><code className="json-example">{JSON.stringify(response.example, null, 2)}</code></CodeBlock>}
    <a className="utility-link" href="/api-reference/openapi.json"><Icon name="download" size={15} /> OpenAPI specification</a>
  </section>
}
