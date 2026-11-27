const textTypes = new Set(['text', 'search', 'password', 'email', 'url', 'tel', 'number'])
const fieldGap = 8
// Browser toolbars can also resize the visual viewport.
const minimumKeyboardHeight = 100

function focusedField() {
  const field = document.activeElement
  if (!field || field.matches(':disabled, [readonly], [inputmode="none"]')) return null
  if (field instanceof HTMLInputElement) return textTypes.has(field.type) ? field : null
  return field instanceof HTMLTextAreaElement ? field : null
}

export function initMobileKeyboard() {
  const viewport = window.visualViewport
  if (!viewport) return
  const root = document.documentElement
  const touch = matchMedia('(any-pointer: coarse)')
  let restingHeight = viewport.height
  let layoutWidth = root.clientWidth
  let activeField
  let frame
  let settleTimer

  function clearSpace() {
    root.style.removeProperty('--docs-field-space-before')
    root.style.removeProperty('--docs-field-space-after')
  }

  function clearKeyboard() {
    if (!root.dataset.docsKeyboard) return
    delete root.dataset.docsKeyboard
    root.style.removeProperty('--docs-keyboard-inset')
    root.style.removeProperty('--docs-visible-height')
    clearSpace()
    activeField = undefined
  }

  function positionPageField(field, keyboardTop) {
    const page = document.scrollingElement
    if (!page) return
    const delta = field.getBoundingClientRect().bottom - (keyboardTop - fieldGap)
    if (Math.abs(delta) < 1) return
    const next = page.scrollTop + delta
    const max = page.scrollHeight - page.clientHeight
    // Give the first or last field room to reach the keyboard edge.
    if (next < 0) {
      const padding = parseFloat(getComputedStyle(document.body).paddingTop)
      root.style.setProperty('--docs-field-space-before', `${padding - next}px`)
    } else if (next > max) {
      const padding = parseFloat(getComputedStyle(document.body).paddingBottom)
      root.style.setProperty('--docs-field-space-after', `${padding + Math.ceil(next - max)}px`)
    }
    page.scrollTo({ top: Math.max(0, next), behavior: 'instant' })
  }

  function update() {
    frame = undefined
    if (!touch.matches || Math.abs(viewport.scale - 1) > .01) {
      clearKeyboard()
      return
    }
    if (root.clientWidth !== layoutWidth) {
      clearKeyboard()
      layoutWidth = root.clientWidth
      restingHeight = viewport.height
    }
    const field = focusedField()
    const hasKeyboard = Math.max(restingHeight, root.clientHeight) - viewport.height >= minimumKeyboardHeight
    if (!field || !hasKeyboard) {
      if (!hasKeyboard) restingHeight = viewport.height
      clearKeyboard()
      return
    }
    if (field !== activeField) {
      activeField = field
      clearSpace()
    }
    const keyboardTop = viewport.offsetTop + viewport.height
    if (field.closest('.search-dialog[open]')) {
      root.dataset.docsKeyboard = 'search'
      root.style.setProperty('--docs-keyboard-inset', `${Math.max(0, root.clientHeight - keyboardTop)}px`)
      root.style.setProperty('--docs-visible-height', `${viewport.height}px`)
    } else {
      root.dataset.docsKeyboard = 'page'
      positionPageField(field, keyboardTop)
    }
  }

  function scheduleUpdate() {
    frame ??= requestAnimationFrame(update)
    // Recheck after the browser finishes its own focus scroll.
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      frame ??= requestAnimationFrame(update)
    }, 120)
  }

  document.addEventListener('focusin', scheduleUpdate)
  document.addEventListener('focusout', scheduleUpdate)
  viewport.addEventListener('resize', scheduleUpdate)
  viewport.addEventListener('scroll', scheduleUpdate)
  window.addEventListener('resize', scheduleUpdate)
  window.addEventListener('pageshow', scheduleUpdate)
  touch.addEventListener('change', scheduleUpdate)
  scheduleUpdate()
}
