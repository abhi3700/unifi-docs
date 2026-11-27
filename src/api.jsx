import { Fragment } from 'react'
import { ApiPicker } from './api-picker.jsx'
import { requestExamples, requestUrl } from './api-request.js'
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

export function inlineCode(value) {
  return value.split(/(`[^`]+`)/g).map((part, index) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)
}

function ApiParameterInput({ parameter }) {
  const schema = resolveRef(parameter.schema)
  const choices = schema.enum ?? (schema.type === 'boolean' ? ['true', 'false'] : undefined)
  const props = { 'data-api-parameter': parameter.name, 'data-location': parameter.in, required: parameter.required }
  const numeric = schema.type === 'integer' || schema.type === 'number'
  return <label className="api-try-field">
    <span className="api-try-field-label"><code>{parameter.name}</code>{parameter.required && <small>Required</small>}</span>
    <span className="api-try-control">
      {choices
        ? <select {...props} defaultValue="">
          <option value="">{parameter.required ? 'Select a value' : 'Omit'}</option>
          {choices.map((value) => <option key={String(value)} value={String(value)}>{String(value)}</option>)}
        </select>
        : <input {...props} type={numeric ? 'number' : 'text'} step={schema.type === 'number' ? 'any' : undefined}
          placeholder={parameter.name === 'user_id' ? 'Email or wallet address' : undefined}
          min={schema.minimum} max={schema.maximum} minLength={schema.minLength} pattern={schema.pattern} spellCheck={false} />}
    </span>
  </label>
}

function resolvedBodySchema(value) {
  const schema = resolveRef(value)
  return {
    ...schema,
    ...(schema.properties && { properties: Object.fromEntries(
      Object.entries(schema.properties).map(([name, child]) => [name, resolvedBodySchema(child)])) }),
    ...(schema.items && { items: resolvedBodySchema(schema.items) }),
    ...(schema.oneOf && { oneOf: schema.oneOf.map(resolvedBodySchema) }),
  }
}

function ApiTry({ endpoint, params, request, mediaType, example }) {
  const payment = endpoint.tags.includes('Pay') && !endpoint.operationId.endsWith('Permit')
  const schema = mediaType === 'application/json' && request.content[mediaType].schema
  return <div className="api-try">
    <details>
      <summary>
        <span className="api-try-terminal"><Icon name="terminal" size={17} /></span>
        Try it
        <Icon name="down" size={16} className="api-try-chevron" />
      </summary>
      <form data-api-try="" data-method={endpoint.method.toUpperCase()} data-server={endpoint.server} data-operation-id={endpoint.operationId}
        data-route={endpoint.route} method="post" autoComplete="off" autoCapitalize="none">
        <p className="api-try-destination"><Method method={endpoint.method} /><code>{new URL(endpoint.server).host}</code></p>
        {endpoint.security?.length > 0 && <label className="api-try-field">
          <span className="api-try-field-label">Bearer token <small>Required</small></span>
          <span className="api-try-token">
            <Icon name="lock" size={16} />
            <span className="api-try-control">
              <input type="password" data-api-token="" placeholder="Enter your UniFi API key" required spellCheck={false} />
            </span>
          </span>
        </label>}
        {['path', 'query'].map((location) => {
          const fields = params.filter((parameter) => parameter.in === location)
          if (!fields.length) return null
          const pickerFields = fields.filter((parameter) =>
            ['chain', 'coin'].includes(parameter.name) && resolveRef(parameter.schema).enum)
          return <fieldset className="api-try-parameters" key={location} data-api-parameter-group={location}>
            <legend>{parameterGroups[location]}</legend>
            <div className="api-try-fields">{fields.map((parameter) => {
              if (parameter === pickerFields[0]) return <ApiPicker key={parameter.name} parameters={pickerFields} />
              return !pickerFields.includes(parameter) && <ApiParameterInput key={parameter.name} parameter={parameter} />
            })}</div>
          </fieldset>
        })}
        {mediaType && <div data-request-body-schema={schema ? JSON.stringify(resolvedBodySchema(schema)) : undefined}
          data-request-body-mobile="760">
          <label className="api-try-field" data-request-body-raw="">
            <span className="api-try-field-label">{mediaType === 'application/json' ? 'JSON request body' : 'Request body'}{request.required && <small>Required</small>}</span>
            <span className="api-try-control api-try-editor-field">
              <textarea data-api-body={mediaType} required={request.required} rows={6} defaultValue={JSON.stringify(example, null, 2)} spellCheck={false} />
            </span>
          </label>
          {schema && <div data-request-body-fields="" />}
        </div>}
        {payment && <p className="api-try-payment">
          <Icon name="warning" size={16} /> This request can submit a payment. Review the recipient and amount before sending.
        </p>}
        <button className="api-try-send" type="submit" disabled>
          <Icon name="send" size={15} /> {payment ? 'Send payment request' : 'Send request'}
        </button>
        <p className="api-try-status" role="status"></p>
        <div data-api-response="" hidden><CodeBlock label="Live response" wrap="responsive"><code /></CodeBlock></div>
      </form>
    </details>
    <a className="api-try-web-app icon-button" data-api-web-app="" href={endpoint.webAppUrl}
      aria-label="Open playground in the UniFi web app" title="Open playground" target="_blank" rel="noopener">
      <span className="api-try-web-app-icon" aria-hidden="true" />
    </a>
  </div>
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
  const params = (endpoint.parameters ?? []).map(resolveRef)
  const request = resolveRef(endpoint.requestBody)
  const [mediaType, requestContent] = Object.entries(request?.content ?? {})[0] ?? []
  const example = requestContent?.example
  const pathExamples = new Map()
  for (const parameter of params.filter((item) => item.in === 'path')) {
    const schema = resolveRef(parameter.schema)
    const value = parameter.example ?? schema?.example ?? schema?.enum?.[0]
    if (value !== undefined) pathExamples.set(parameter.name, String(value))
  }
  const examples = requestExamples({
    operationId: endpoint.operationId,
    server: endpoint.server,
    route: endpoint.route,
    path: pathExamples,
    method: endpoint.method.toUpperCase(),
    url: requestUrl(endpoint.server, endpoint.route, pathExamples),
    bearer: endpoint.security?.length > 0,
    mediaType,
    body: JSON.stringify(example, null, 2),
  })
  const success = Object.entries(endpoint.responses).find(([status]) => status.startsWith('2'))
  const content = resolveRef(success?.[1])?.content
  const response = content && Object.values(content).find((type) => type.example !== undefined)
  const tabs = examples.map(({ id, title, html }) => ({
    id, title, content: <code data-api-example={id} dangerouslySetInnerHTML={{ __html: html }} />,
  }))
  return <section className="api-examples" aria-label="API examples">
    {endpoint.webAppUrl && <ApiTry endpoint={endpoint} params={params} request={request} mediaType={mediaType} example={example} />}
    <CodeBlock label="Request examples" wrap="responsive" tabs={tabs} />
    <a className="utility-link" href="/api-reference/introduction#sdk-setup"><Icon name="book" size={15} /> SDK setup</a>
    {response && <CodeBlock label={`${success[0]} response`} wrap="responsive"><code className="json-example">{JSON.stringify(response.example, null, 2)}</code></CodeBlock>}
    <a className="utility-link" href="/api-reference/openapi.json"><Icon name="download" size={15} /> OpenAPI specification</a>
  </section>
}
