(() => {
  const standalone = matchMedia('(display-mode: standalone)')
  let deferredPrompt
  let installed = false
  let prompting = false

  function updateInstallLink() {
    document.documentElement.toggleAttribute(
      'data-docs-installed', installed || standalone.matches || navigator.standalone === true,
    )
  }
  updateInstallLink()
  standalone.addEventListener('change', updateInstallLink)

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = undefined
    updateInstallLink()
  })
  document.addEventListener('click', async (event) => {
    const link = event.target.closest?.('[data-install-docs]')
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (prompting) {
      event.preventDefault()
      return
    }
    if (!deferredPrompt) return
    event.preventDefault()
    const prompt = deferredPrompt
    deferredPrompt = undefined
    prompting = true
    try {
      await prompt.prompt()
    } catch {
      location.assign(link.href)
    } finally {
      prompting = false
    }
  })
})()
