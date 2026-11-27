import { requestExamples, requestUrl } from './api-request.js'

function initApiPicker(picker) {
  const trigger = picker.querySelector('[data-dialog-open]')
  const value = trigger.querySelector('[data-api-picker-value]')
  const placeholder = value.textContent
  const error = picker.querySelector('[data-api-picker-error]')
  const dialog = picker.querySelector('dialog')
  const done = dialog.querySelector('[data-api-picker-done]')
  const fields = new Map(Array.from(picker.querySelectorAll('[data-api-parameter]'), (field) => [field.dataset.apiParameter, field]))
  const options = Array.from(dialog.querySelectorAll('[data-api-picker-option]'), (button) => ({
    button, name: button.closest('[data-api-picker-choice]').dataset.apiPickerChoice, value: button.dataset.apiPickerOption,
  }))
  let draft

  function updateOptions() {
    for (const option of options) option.button.setAttribute('aria-pressed', String(draft.get(option.name) === option.value))
    if (done) done.disabled = [...fields].some(([name, field]) => field.hasAttribute('data-picker-required') && !draft.get(name))
  }

  function commit() {
    for (const [name, field] of fields) field.value = draft.get(name)
    const selected = options.filter((option) => option.value && draft.get(option.name) === option.value)
    const icons = document.createElement('span')
    icons.className = 'api-picker-icons'
    for (const { button } of selected) {
      const icon = button.querySelector('img')
      if (icon) icons.append(icon.cloneNode())
    }
    value.replaceChildren(icons, selected.map((option) => option.value).join(' · ') || placeholder)
    error.hidden = true
    trigger.removeAttribute('aria-invalid')
    trigger.removeAttribute('aria-describedby')
    fields.values().next().value.dispatchEvent(new Event('input', { bubbles: true }))
    dialog.close()
  }

  trigger.addEventListener('click', () => {
    draft = new Map(Array.from(fields, ([name, field]) => [name, field.value]))
    updateOptions()
  }, { capture: true })
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }))
  for (const option of options) {
    option.button.addEventListener('click', () => {
      draft.set(option.name, option.value)
      if (done) updateOptions()
      else commit()
    })
  }
  done?.addEventListener('click', commit)

  return () => {
    if (![...fields.values()].some((field) => field.hasAttribute('data-picker-required') && !field.value)) return true
    error.hidden = false
    trigger.setAttribute('aria-invalid', 'true')
    trigger.setAttribute('aria-describedby', error.id)
    trigger.focus()
    return false
  }
}

export function initApiTry(form, refreshWrap) {
  const { operationId, server, route, method } = form.dataset
  const token = form.querySelector('[data-api-token]')
  const bodyField = form.querySelector('[data-api-body]')
  const mediaType = bodyField?.dataset.apiBody
  const fields = [...form.querySelectorAll('[data-api-parameter]')]
  const validatePickers = Array.from(form.querySelectorAll('[data-api-picker]'), initApiPicker)
  const examples = form.closest('.api-examples')
  const exampleCode = new Map(Array.from(examples.querySelectorAll('[data-api-example]'),
    (code) => [code.dataset.apiExample, code]))
  const response = form.querySelector('[data-api-response]')
  const responseCode = response.querySelector('code')
  const status = form.querySelector('[role="status"]')
  const send = form.querySelector('button[type="submit"]')
  let pending = false

  function readRequest() {
    const path = new Map()
    const query = new URLSearchParams()
    for (const field of fields) {
      const value = field.value.trim()
      if (value && field.validity.valid) {
        const values = field.dataset.location === 'path' ? path : query
        values.set(field.dataset.apiParameter, value)
      }
    }
    return { operationId, server, route, path, query, method, url: requestUrl(server, route, path, query),
      bearer: Boolean(token), mediaType, body: bodyField?.value.trim() }
  }

  function showExamples(request) {
    for (const { id, html } of requestExamples(request)) {
      const code = exampleCode.get(id)
      code.innerHTML = html
      refreshWrap(code.closest('pre'))
    }
  }

  form.addEventListener('input', (event) => {
    event.target.setCustomValidity('')
    if (event.target === token) return
    showExamples(readRequest())
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (pending || !validatePickers.every((validate) => validate())) return

    for (const field of fields) {
      const value = field.value.trim()
      if ((field.required && !value) || (field.dataset.location === 'path' && /^\.{1,2}$/.test(value))) {
        field.setCustomValidity('Enter a valid parameter value.')
        field.reportValidity()
        return
      }
    }
    const request = readRequest()
    const credential = token?.value.trim()
    if (token && (!credential || /[^\x21-\x7e]/.test(credential))) {
      token.setCustomValidity('Enter the API key without spaces or the Bearer prefix.')
      token.reportValidity()
      return
    }
    if ((request.body || bodyField?.required) && mediaType === 'application/json') {
      try {
        JSON.parse(request.body)
      } catch {
        bodyField.setCustomValidity('Enter a valid JSON request body.')
        bodyField.reportValidity()
        return
      }
    }

    const headers = new Headers()
    if (credential) headers.set('Authorization', `Bearer ${credential}`)
    if (request.body) headers.set('Content-Type', mediaType)
    showExamples(request)
    pending = send.disabled = true
    response.hidden = true
    responseCode.textContent = ''
    status.dataset.state = 'pending'
    status.textContent = 'Sending request…'
    try {
      const result = await fetch(request.url, {
        method, headers, body: request.body || undefined,
        credentials: 'omit', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      })
      let text = await result.text()
      if (text && result.headers.get('content-type')?.includes('json')) {
        try { text = JSON.stringify(JSON.parse(text), null, 2) } catch {}
      }
      status.dataset.state = result.ok ? 'success' : 'error'
      status.textContent = `HTTP ${result.status}${result.statusText ? ' ' + result.statusText : ''}`
      responseCode.textContent = text || '(Empty response)'
      response.hidden = false
      refreshWrap(responseCode.closest('pre'))
    } catch {
      status.dataset.state = 'error'
      status.textContent = method === 'GET'
        ? 'Could not read the API response.'
        : 'Could not read the API response. Check the request outcome before resending.'
    } finally {
      pending = send.disabled = false
    }
  })

  if (token) {
    window.addEventListener('pagehide', () => {
      token.value = ''
      token.setCustomValidity('')
    })
  }
  send.disabled = false
}
