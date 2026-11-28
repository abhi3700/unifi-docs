(() => {
  if (globalThis.unifiRequestBodyFields) {
    globalThis.unifiRequestBodyFields()
    return
  }

  const selector = '[data-request-body-schema]'
  const editors = new WeakMap()
  const paymentIcons = new WeakMap()
  const breakpoints = new Map()
  const integer = /^-?(0|[1-9]\d*)$/
  const labels = {
    batch: 'Batch payments', batch_contact_ids: 'Batch contact IDs', batch_id: 'Batch ID',
    contact_id: 'Contact ID', contact_ids: 'Contact IDs', del_its_contacts: 'Delete contacts in this batch',
    est_fee: 'Estimated fee', id: 'Schedule ID', is_own_wallet: 'Own wallet', is_recurring: 'Recurring',
    items: 'Payments', payload: 'Payment details', base: 'Permit details', nonce: 'Permit2 nonce', sched: 'Schedule',
    scheds: 'Schedules', sig: 'Permit2 signature', to_address: 'Recipient address', tot_est_fee: 'Total estimated fee',
    BulkPay: 'Bulk pay', FliqPayMerchant: 'FliQPay merchant', SubscribeApi: 'API subscription',
  }
  const itemLabels = {
    batch: 'Payment', batch_contact_ids: 'Contact ID', coins: 'Coin', contact_ids: 'Contact ID',
    contacts: 'Contact', items: 'Payment', scheds: 'Schedule', updates: 'Contact update',
  }
  const inputHints = {
    address: '0x… (40 hex digits)', to_address: '0x… (40 hex digits)',
    amount: 'e.g. 10.25', est_fee: 'e.g. 0.12', tot_est_fee: 'e.g. 0.18',
    deadline: 'Unix time in seconds, e.g. 1893456000', nonce: 'Whole number, e.g. 0',
    sig: '0x… (Permit2 signature)', Custom: 'e.g. Invoice 1042',
    id: 'Paste schedule ID', batch_name: 'e.g. Payroll team', name: 'e.g. Alice',
    contact_id: 'e.g. 6738a2009c3f472a4e000001', contact_ids: 'e.g. 6738a2009c3f472a4e000001',
    batch_contact_ids: 'e.g. 6738a2009c3f472a4e000001', batch_id: 'e.g. b6e5bc278b0132662739ef500',
  }

  class JsonNumber {
    constructor(text) { this.text = text }
  }

  function parseBody(text) {
    if (!text.trim()) return {}
    // Store numeric tokens as text so editing a deadline never rounds a large integer.
    let marker = '__unifi_number__'
    while (text.includes(marker)) marker += '_'
    const entries = []
    const protectedText = text.replace(/"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
      if (token.startsWith('"')) return token
      const index = entries.push(token) - 1
      return JSON.stringify({ [marker]: index })
    })
    return JSON.parse(protectedText, (_, value) => {
      if (isObject(value) && Object.keys(value).length === 1 &&
        Number.isInteger(value[marker]) && entries[value[marker]] !== undefined) {
        return new JsonNumber(entries[value[marker]])
      }
      return value
    })
  }

  function stringifyBody(value, depth = 0) {
    if (value instanceof JsonNumber) return value.text
    if (!Array.isArray(value) && !isObject(value)) return JSON.stringify(value ?? null)
    const array = Array.isArray(value)
    const padding = '  '.repeat(depth)
    const lines = array
      ? Array.from(value, item => stringifyBody(item, depth + 1))
      : Object.entries(value).map(([key, child]) => JSON.stringify(key) + ': ' + stringifyBody(child, depth + 1))
    const [open, close] = array ? ['[', ']'] : ['{', '}']
    return lines.length ? open + '\n' + lines.map(line => padding + '  ' + line).join(',\n') + '\n' + padding + close : open + close
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof JsonNumber)
  }

  function supportsSchema(schema) {
    if (!schema) return false
    if (schema.oneOf) return schema.oneOf.every(variant =>
      variant.enum || (variant.type === 'object' &&
        Object.values(variant.properties ?? {}).length === 1 && supportsSchema(variant)))
    if (schema.type === 'object') return schema.properties && Object.values(schema.properties).every(supportsSchema)
    if (schema.type === 'array') return supportsSchema(schema.items)
    return ['string', 'boolean', 'integer'].includes(schema.type)
  }

  function labelFor(name) {
    return labels[name] ?? name.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
  }

  function element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  function button(text, action, className = 'request-fields-action') {
    const node = element('button', className, text)
    node.type = 'button'
    node.addEventListener('click', action)
    return node
  }

  function fieldHelp(title, detail, host) {
    const infoIconClass = host.dataset.requestBodyInfoIcon
    const trigger = button('', () => {
      const dialog = element('dialog', 'request-fields-dialog')
      dialog.setAttribute('aria-label', title)
      const panel = element('div', 'request-fields-dialog-panel')
      const heading = element('header', 'request-fields-heading')
      const iconClass = host.dataset.requestBodyCloseIcon
      const close = button(iconClass ? '' : '×', () => dialog.close(),
        iconClass ? 'unifi-close-button' : 'request-fields-close')
      if (iconClass) {
        const icon = element('i', iconClass)
        icon.setAttribute('aria-hidden', 'true')
        close.append(icon)
      }
      close.setAttribute('aria-label', 'Close ' + title)
      close.autofocus = true
      heading.append(element('h3', '', title), close)
      panel.append(heading, element('p', '', detail))
      dialog.append(panel)
      dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close()
      })
      dialog.addEventListener('close', () => {
        dialog.remove()
        trigger.focus({ preventScroll: true })
      }, { once: true })
      host.append(dialog)
      dialog.showModal()
    }, infoIconClass ? 'unifi-api-contact-filter-info' : 'request-fields-info')
    const icon = infoIconClass ? element('i', infoIconClass) : element('span', 'unifi-filled-info-icon', 'i')
    icon.setAttribute('aria-hidden', 'true')
    trigger.append(icon)
    trigger.setAttribute('aria-label', 'About ' + title)
    trigger.setAttribute('aria-haspopup', 'dialog')
    return trigger
  }

  function choices(options, value, write, label, { icons, pillClass, coins, multiple = false } = {}) {
    const group = element('div', 'request-fields-options')
    if (icons) group.classList.add(coins ? 'unifi-api-reference-coin-options' : 'unifi-api-reference-network-options')
    if (pillClass) group.classList.add(pillClass)
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', label)
    const isSelected = option => multiple ? value.includes(option) : value === option
    const entries = options.map(([option, text]) => {
      const control = button(text, () => {
        if (multiple) {
          value = isSelected(option) ? value.filter(item => item !== option) : [...value, option]
        } else {
          value = option
        }
        entries.forEach(([item, node]) => node.setAttribute('aria-pressed', String(isSelected(item))))
        write(value)
      }, 'request-fields-option')
      if (icons && Object.hasOwn(icons, option)) {
        if (coins) control.dataset.coin = option
        const icon = element('img')
        icon.src = icons[option]
        icon.alt = ''
        control.prepend(icon)
      }
      control.setAttribute('aria-pressed', String(isSelected(option)))
      group.append(control)
      return [option, control]
    })
    return group
  }

  function toggleSwitch(toggleClass, label, checked, write) {
    const track = element('span', toggleClass + '-track')
    track.setAttribute('aria-hidden', 'true')
    const status = element('span')
    const toggle = button('', () => {
      checked = !checked
      updateToggle()
      write(checked)
    }, toggleClass)
    toggle.setAttribute('role', 'switch')
    toggle.setAttribute('aria-label', label)
    function updateToggle() {
      toggle.setAttribute('aria-checked', String(checked))
      status.textContent = checked ? 'Yes' : 'No'
    }
    updateToggle()
    toggle.append(track, status)
    return toggle
  }

  function hasOptionalToggle(name, required, host) {
    return !required && host.hasAttribute('data-request-body-toggle') &&
      (name === 'sched' || name === 'scheds' || (paymentIcons.has(host) && name === 'batch_name'))
  }

  const variants = schema => schema.oneOf.flatMap(option =>
    option.enum ? option.enum.map(name => ({ name })) :
      Object.entries(option.properties ?? {}).map(([name, child]) => ({ name, child })))
  const variantName = value => isObject(value) ? Object.keys(value)[0] : value
  const blankValue = schema => schema.type === 'object' ? {} : schema.type === 'array' ? [] : undefined
  const blankSchedule = () => ({ is_recurring: false })

  function bulkPaymentCount(body) {
    const payments = body.batch ?? body.payload?.base?.batch
    return Array.isArray(payments) ? payments.length : 0
  }

  function renderBulkSchedules(schema, value, write, host, paymentCount) {
    const area = element('div', 'request-fields-group')
    const schedules = Array.isArray(value) ? value.slice() : []
    function draw() {
      area.replaceChildren()
      if (paymentCount === 0) {
        area.append(element('p', 'request-fields-note', 'Add a payment to enter its schedule.'))
      }
      schedules.forEach((schedule, index) => {
        const title = index < paymentCount ? 'Payment ' + (index + 1) : 'Unmatched schedule ' + (index + 1)
        const row = element('div', 'request-fields-item')
        row.setAttribute('role', 'group')
        row.setAttribute('aria-label', index < paymentCount ? 'Schedule for ' + title.toLowerCase() : title)
        row.append(element('div', 'request-fields-heading', title),
          renderValue(schema, schedule, next => {
            schedules[index] = next
            write(schedules)
          }, 'sched', title, true, host))
        area.append(row)
      })
      if (schedules.length > paymentCount) {
        const remove = button('Remove unmatched schedules', () => {
          const field = area.closest('.request-fields-field')
          schedules.splice(paymentCount)
          write(schedules)
          draw()
          const focusTarget = area.querySelector('input') ?? field.querySelector('[role="switch"], .request-fields-remove')
          focusTarget?.focus()
        })
        area.append(remove)
      }
    }
    draw()
    return area
  }

  function renderValue(schema, value, write, name, label, required, host, paymentIndex) {
    const area = element('div', 'request-fields-group')
    if (schema.oneOf) {
      const options = variants(schema)
      const childArea = element('div', 'request-fields-group')
      const renderVariant = (key, current) => {
        const variant = options.find(option => option.name === key)
        childArea.replaceChildren()
        if (variant?.child) {
          childArea.append(renderField(variant.child, key, current, next => write({ [key]: next ?? null }), true, host, paymentIndex))
        }
      }
      const current = variantName(value)
      area.append(choices(options.map(option => [option.name, labelFor(option.name)]), current, key => {
        const variant = options.find(item => item.name === key)
        const child = variant.child && blankValue(variant.child)
        write(variant.child ? { [key]: child ?? null } : key)
        renderVariant(key, child)
      }, label, { pillClass: name === 'memo' ? host.dataset.requestBodyMemoOptions : undefined }), childArea)
      renderVariant(current, isObject(value) ? value[current] : undefined)
      return area
    }
    if (schema.type === 'object') {
      const object = Object.assign(Object.create(null), isObject(value) ? value : {})
      const optional = element('details', host.dataset.requestBodyDisclosure ?? 'request-fields-optional')
      const summary = element('summary', '', 'Optional fields')
      if (host.dataset.requestBodyDisclosureIcon) {
        const icon = element('i', host.dataset.requestBodyDisclosureIcon)
        icon.setAttribute('aria-hidden', 'true')
        summary.append(icon)
      }
      optional.append(summary)
      const batchNameSlot = schema.required?.includes('save_batch') && schema.properties.batch_name
        ? element('div', 'request-fields-group') : null
      const schedulesSlot = schema.properties.scheds ? element('div', 'request-fields-group') : null
      function renderProperty(key, needed) {
        const paymentCount = key === 'scheds' ? bulkPaymentCount(object) : undefined
        return renderField(schema.properties[key], key, object[key], (next, batchChange) => {
          if (next === undefined) delete object[key]
          else object[key] = next
          if (batchNameSlot && key === 'save_batch') {
            if (next !== true) delete object.batch_name
            drawBatchName()
          }
          if (schedulesSlot && batchChange) {
            if (Array.isArray(object.scheds)) {
              const schedules = object.scheds.slice()
              if (batchChange.removed) schedules.splice(batchChange.index, 1)
              else schedules.splice(batchChange.index, 0, blankSchedule())
              object.scheds = schedules
            }
            drawSchedules()
          }
          write(object, batchChange)
        }, needed, host, paymentIndex, paymentCount)
      }
      function drawBatchName() {
        batchNameSlot.replaceChildren()
        if (object.save_batch === true) batchNameSlot.append(renderProperty('batch_name', false))
      }
      function drawSchedules() {
        schedulesSlot.replaceChildren(renderProperty('scheds', false))
      }
      let normalized = false
      if (batchNameSlot && object.save_batch !== true && Object.hasOwn(object, 'batch_name')) {
        delete object.batch_name
        normalized = true
      }
      for (const key of ['sched', 'scheds']) {
        if (schema.properties[key] && object[key] === null) {
          delete object[key]
          normalized = true
        }
      }
      if (schedulesSlot && Array.isArray(object.scheds)) {
        const missing = bulkPaymentCount(object) - object.scheds.length
        if (missing > 0) {
          object.scheds = [...object.scheds, ...Array.from({ length: missing }, blankSchedule)]
          normalized = true
        }
      }
      if (normalized) write(object)
      const names = new Set([...(schema.required ?? []), ...Object.keys(schema.properties)])
      for (const key of names) {
        if (batchNameSlot && key === 'batch_name') {
          optional.append(batchNameSlot)
          drawBatchName()
          if (object[key] != null) optional.open = true
          continue
        }
        if (schedulesSlot && key === 'scheds') {
          const group = hasOptionalToggle(key, false, host) || object[key] == null ? optional : area
          group.append(schedulesSlot)
          drawSchedules()
          if (group === optional && object[key] != null) optional.open = true
          continue
        }
        const needed = schema.required?.includes(key) ?? false
        const field = renderProperty(key, needed)
        if (hasOptionalToggle(key, needed, host)) {
          optional.append(field)
          if (object[key] != null) optional.open = true
        } else {
          const group = needed || Object.hasOwn(object, key) ? area : optional
          group.append(field)
        }
      }
      if (optional.childElementCount > 1) area.append(optional)
      return area
    }
    if (schema.type === 'array') {
      const items = Array.isArray(value) ? value.slice() : []
      const coinIcons = paymentIcons.get(host)?.coin
      if (coinIcons && name === 'coins' && schema.uniqueItems && schema.items.enum) {
        return choices(schema.items.enum.map(coin => [coin, coin]), items, write, label, { icons: coinIcons, coins: true, multiple: true })
      }
      if (name === 'SubscribeApi' && items.length <= 2 && schema.minItems === 2 && schema.maxItems === 2) {
        for (const [index, caption] of ['Plan', 'Billing duration'].entries()) {
          const row = element('div', 'request-fields-field')
          row.append(element('span', 'request-fields-label', caption),
            renderValue({ ...schema.items, example: schema.example?.[index] ?? schema.items.example }, items[index], next => {
              items[index] = next
              write(items)
            }, name, caption, true, host))
          area.append(row)
        }
        return area
      }
      const itemLabel = itemLabels[name] ?? 'Item'
      const inline = !schema.items.oneOf && ['string', 'integer', 'boolean'].includes(schema.items.type)
      function draw() {
        area.replaceChildren()
        items.forEach((item, index) => {
          const row = element('div', inline ? 'request-fields-inline-item' : 'request-fields-item')
          const title = itemLabel + ' ' + (index + 1)
          const remove = button('', () => {
            items.splice(index, 1)
            write(items, name === 'batch' ? { index, removed: true } : undefined)
            draw()
            const next = area.children[Math.min(index, items.length)]
            const focusTarget = next.querySelector('.request-fields-item-remove') ?? next
            focusTarget.focus()
          }, 'request-fields-item-remove')
          remove.setAttribute('aria-label', 'Remove ' + title)
          const editor = renderValue(schema.items, item, next => {
            items[index] = next
            write(items)
          }, name, title, true, host, name === 'batch' || name === 'items' ? index : paymentIndex)
          if (inline) {
            row.append(editor, remove)
          } else {
            const header = element('div', 'request-fields-heading')
            header.append(element('span', '', title), remove)
            row.append(header, editor)
          }
          area.append(row)
        })
        const add = button('Add ' + itemLabel[0].toLowerCase() + itemLabel.slice(1), () => {
          const index = items.length
          items.push(blankValue(schema.items))
          write(items, name === 'batch' ? { index, removed: false } : undefined)
          draw()
          area.lastElementChild.previousElementSibling?.querySelector('input, .request-fields-option')?.focus()
        }, 'request-fields-action request-fields-add')
        const plus = element('span', '', '+')
        plus.setAttribute('aria-hidden', 'true')
        add.prepend(plus)
        add.disabled = schema.maxItems !== undefined && items.length >= schema.maxItems
        area.append(add)
      }
      draw()
      return area
    }
    if (schema.enum || schema.type === 'boolean') {
      const options = schema.enum ? schema.enum.map(option => [option, String(option)]) : [[true, 'Yes'], [false, 'No']]
      if (!required) options.unshift([undefined, 'Omit'])
      const icons = schema.enum ? paymentIcons.get(host)?.[name] : undefined
      return choices(options, value, write, label, { icons, coins: name === 'coin' })
    }
    const input = element('input', 'request-fields-input')
    input.type = 'text'
    input.setAttribute('aria-label', label)
    input.autocomplete = 'off'
    input.spellcheck = false
    input.autocapitalize = 'none'
    const example = schema.example ?? schema.default
    input.placeholder = typeof example === 'number' || (typeof example === 'string' && example.trim())
      ? 'e.g. ' + example
      : inputHints[name] ?? (schema.type === 'integer' ? 'Enter a whole number' : 'Enter text')
    if (schema.type === 'integer' || name === 'nonce') input.inputMode = 'numeric'
    if (name === 'amount' || name.endsWith('fee')) input.inputMode = 'decimal'
    input.value = value instanceof JsonNumber ? value.text : typeof value === 'string' ? value : ''
    input.addEventListener('input', event => {
      event.stopPropagation()
      const text = input.value
      write(schema.type === 'integer' && integer.test(text) ? new JsonNumber(text) : text)
    })
    const frame = element('div', 'request-fields-input-frame')
    frame.append(input)
    return frame
  }

  function renderField(schema, name, value, write, required, host, paymentIndex, paymentCount) {
    const label = labelFor(name)
    if (required && schema.type === 'object' && !schema.description && (name === 'payload' || name === 'base')) {
      return renderValue(schema, value, write, name, label, required, host, paymentIndex)
    }
    const field = element('div', 'request-fields-field')
    const heading = element('div', 'request-fields-heading')
    const caption = element('span', 'request-fields-label', label)
    heading.append(caption)
    if (schema.description) heading.append(fieldHelp(label, schema.description, host))
    field.append(heading)
    const toggleClass = host.dataset.requestBodyToggle
    if (toggleClass && required && schema.type === 'boolean' &&
      (name === 'is_recurring' || (paymentIcons.has(host) && name === 'save_batch'))) {
      heading.classList.add(toggleClass + '-row')
      heading.append(toggleSwitch(toggleClass, label, value === true, write))
      if (value === undefined) write(false)
      return field
    }
    const content = element('div', 'request-fields-group')
    field.append(content)
    const optionalToggle = hasOptionalToggle(name, required, host)
    const scheduling = name === 'sched' || paymentCount !== undefined
    function initialValue() {
      if (paymentCount !== undefined) return Array.from({ length: paymentCount }, blankSchedule)
      return name === 'sched' ? blankSchedule() : blankValue(schema) ?? ''
    }
    if (optionalToggle) {
      heading.classList.add(toggleClass + '-row')
      heading.append(toggleSwitch(toggleClass, label, value != null, checked => {
        value = checked ? initialValue() : undefined
        write(value)
        draw()
      }))
    }
    const paymentField = host.hasAttribute('data-request-body-payment-errors') &&
      (name === 'to_address' || name === 'amount')
    let inputId
    if (paymentField) {
      const paymentSuffix = paymentIndex === undefined ? '' : '-' + paymentIndex
      inputId = host.querySelector('textarea').id + paymentSuffix + '-' + name
      field.dataset.requestBodyPaymentField = name
      field.dataset.requestBodyPaymentIndex = paymentIndex ?? 0
      const error = element('p', 'request-fields-error')
      error.id = inputId + '-error'
      error.hidden = true
      error.setAttribute('aria-live', 'polite')
      field.append(error)
    }
    const choice = schema.enum || schema.type === 'boolean'
    function draw() {
      content.replaceChildren()
      if (optionalToggle && value == null) return
      heading.querySelector('.request-fields-remove')?.remove()
      if (!required && !choice && !optionalToggle) {
        if (value === undefined || value === null) {
          const add = button(value === null ? 'Set value' : 'Include', () => {
            value = initialValue()
            write(value)
            draw()
            content.querySelector('input, button')?.focus()
          })
          add.setAttribute('aria-label', 'Include ' + label)
          if (value === null) {
            content.append(element('span', 'request-fields-note', 'Null'))
            content.append(button('Omit', () => {
              value = undefined
              write(undefined)
              draw()
              content.querySelector('button')?.focus()
            }))
          }
          content.append(add)
          return
        }
        const omit = button('Omit', () => {
          value = undefined
          write(undefined)
          draw()
          content.querySelector('button')?.focus()
        }, 'request-fields-action request-fields-remove')
        omit.setAttribute('aria-label', 'Omit ' + label)
        heading.append(omit)
      }
      function writeValue(next, batchChange) {
        value = next
        write(next, batchChange)
      }
      content.append(paymentCount === undefined
        ? renderValue(schema, value, writeValue, name, label, required, host, paymentIndex)
        : renderBulkSchedules(schema.items, value, writeValue, host, paymentCount))
      const input = inputId && content.querySelector('input')
      if (input) input.id = inputId
      if (schema.nullable && !required && !choice && !optionalToggle && !scheduling) {
        content.append(button('Set null', () => {
          value = null
          write(null)
          draw()
          content.querySelector('button')?.focus()
        }))
      }
    }
    draw()
    return field
  }

  function validate(schema, value, label, required = true) {
    if (value === undefined || value === null) {
      if (required && !(value === null && schema.nullable)) return 'Enter ' + label + '.'
      return
    }
    if (schema.oneOf) {
      const key = variantName(value)
      const variant = variants(schema).find(option => option.name === key)
      if (!variant) return 'Choose ' + label + '.'
      return variant.child && validate(variant.child, value[key], labelFor(key))
    }
    if (schema.enum && !schema.enum.includes(value)) return 'Choose ' + label + '.'
    if (schema.type === 'object') {
      if (!isObject(value)) return 'Enter ' + label + '.'
      if (schema.properties?.scheds && Array.isArray(value.scheds) && value.scheds.length !== bulkPaymentCount(value)) {
        return 'Each payment needs one schedule.'
      }
      for (const [name, child] of Object.entries(schema.properties ?? {})) {
        const error = validate(child, value[name], labelFor(name), schema.required?.includes(name) ?? false)
        if (error) return error
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) return 'Enter ' + label + '.'
      if (value.length < (schema.minItems ?? 0)) return 'Add at least ' + schema.minItems +
        (schema.minItems === 1 ? ' item' : ' items') + ' to ' + label + '.'
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return label + ' allows up to ' + schema.maxItems + ' items.'
      if (schema.uniqueItems && new Set(value.map(item => stringifyBody(item))).size !== value.length) return 'Choose distinct values for ' + label + '.'
      for (const item of value) {
        const error = validate(schema.items, item, label)
        if (error) return error
      }
    } else if (schema.type === 'integer' && (!(value instanceof JsonNumber) || !integer.test(value.text))) {
      return 'Enter a whole number for ' + label + '.'
    } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
      return 'Choose Yes or No for ' + label + '.'
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') return 'Enter ' + label + '.'
      if ((schema.pattern && !new RegExp(schema.pattern).test(value)) ||
        (schema.minLength !== undefined && value.length < schema.minLength) ||
        (schema.maxLength !== undefined && value.length > schema.maxLength)) return 'Check the format of ' + label + '.'
    }
  }

  function mount(host) {
    const raw = host.querySelector('textarea')
    const target = host.querySelector('[data-request-body-fields]')
    if (!raw || !target) return
    if (editors.has(host)) {
      editors.get(host)()
      return
    }
    const schema = JSON.parse(host.dataset.requestBodySchema)
    if (schema.type !== 'object' || !supportsSchema(schema)) return
    if (host.dataset.requestBodyPaymentIcons) {
      paymentIcons.set(host, JSON.parse(host.dataset.requestBodyPaymentIcons))
    }
    const width = host.dataset.requestBodyMobile
    if (!breakpoints.has(width)) {
      const query = matchMedia('(max-width: ' + width + 'px)')
      query.addEventListener('change', () => globalThis.unifiRequestBodyFields())
      breakpoints.set(width, query)
    }
    const mobile = breakpoints.get(width)
    const required = raw.required
    const error = element('p', 'request-fields-error')
    error.tabIndex = -1
    error.setAttribute('role', 'alert')
    error.hidden = true
    let draft
    let lastText
    let active = false

    function write(value) {
      draft = value
      lastText = stringifyBody(value)
      raw.value = lastText
      error.hidden = true
      raw.dispatchEvent(new Event('input', { bubbles: true }))
    }

    function showPaymentErrors() {
      const messages = host.dataset.requestBodyPaymentErrors
      if (!messages) return
      const errors = JSON.parse(messages)
      for (const field of target.querySelectorAll('[data-request-body-payment-field]')) {
        const { requestBodyPaymentField: name, requestBodyPaymentIndex: index } = field.dataset
        const message = errors[index]?.[name === 'to_address' ? 'address' : 'amount'] ?? ''
        const input = field.querySelector('input')
        const notice = field.querySelector('.request-fields-error')
        if (!input || !notice) continue
        if (notice.textContent !== message) notice.textContent = message
        notice.hidden = !message
        if (message) {
          input.setAttribute('aria-invalid', 'true')
          input.setAttribute('aria-describedby', notice.id)
        } else {
          input.removeAttribute('aria-invalid')
          input.removeAttribute('aria-describedby')
        }
      }
    }

    function sync() {
      const text = host.dataset.requestBodyText ?? raw.value
      if (active && mobile.matches && text === lastText) {
        showPaymentErrors()
        return
      }
      let value
      if (mobile.matches) {
        try { value = parseBody(text) } catch {}
      }
      active = mobile.matches && isObject(value)
      host.toggleAttribute('data-request-body-active', active)
      raw.required = required && !active
      if (active) {
        draft = value
        lastText = text
        error.hidden = true
        target.replaceChildren(element('p', 'request-fields-caption', 'Request body'),
          renderValue(schema, value, write, '', 'Request body', true, host), error)
        showPaymentErrors()
      } else target.replaceChildren()
    }

    function submit(event) {
      if (!active) return
      const message = validate(schema, draft, 'Request body')
      if (message) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const invalid = target.querySelector('[data-request-body-payment-field] input[aria-invalid="true"]')
        if (invalid) {
          invalid.focus()
        } else {
          error.textContent = message
          error.hidden = false
          error.focus()
        }
      } else if (!raw.value.trim()) {
        write(draft)
      }
    }

    const form = raw.closest('form')
    form?.addEventListener('submit', submit, { capture: true })
    const observer = new MutationObserver(sync)
    observer.observe(host, { attributes: true, attributeFilter: [
      'data-request-body-text', 'data-request-body-payment-errors',
    ] })
    editors.set(host, sync)
    sync()
  }

  globalThis.unifiRequestBodyFields = () => document.querySelectorAll(selector).forEach(mount)
  globalThis.unifiRequestBodyFields()
})()
