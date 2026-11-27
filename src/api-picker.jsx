import { resolveRef } from './content.js'
import { Icon } from './ui.jsx'

const icons = new Set(['USDT', 'USDC', 'DAI', 'Ethereum', 'Polygon', 'Sepolia'])
const labels = { coin: 'asset', chain: 'network' }

export function ApiPicker({ parameters }) {
  const { in: location } = parameters[0]
  const pair = parameters.length === 2
  const selection = pair ? 'asset and network' : labels[parameters[0].name]
  const title = pair ? 'Choose an asset and network' : parameters[0].name === 'coin' ? 'Choose an asset' : 'Choose a network'
  const caption = location === 'query'
    ? pair ? 'Filter results by asset, network, or both.' : `Filter results by ${selection}.`
    : `Choose the ${selection} to use for this request.`
  const required = parameters.some((parameter) => parameter.required)
  const label = pair ? 'Asset & network' : parameters[0].name
  const id = `api-picker-${location}`
  return <div className="api-try-field api-picker-field" data-api-picker="">
    <span className="api-try-field-label"><code id={`${id}-label`}>{label}</code>{required && <small>Required</small>}</span>
    {parameters.map((parameter) => <input key={parameter.name} type="hidden" data-api-parameter={parameter.name}
      data-location={location} data-picker-required={parameter.required ? '' : undefined} />)}
    <button type="button" className="api-picker-trigger" data-dialog-open={id}
      aria-haspopup="dialog" aria-controls={id} aria-labelledby={`${id}-label ${id}-value`}>
      <span id={`${id}-value`} data-api-picker-value="">{title}</span>
      <Icon name="down" size={16} />
    </button>
    <small id={`${id}-error`} className="api-picker-error" data-api-picker-error="" hidden>{title}.</small>
    <dialog id={id} className="api-picker-sheet" aria-labelledby={`${id}-title`} aria-describedby={`${id}-caption`}>
      <div className="api-picker-handle" aria-hidden="true" />
      <header className="api-picker-heading">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-caption`}>{caption}</p>
        </div>
        <button type="button" className="icon-button" data-dialog-close="" aria-label="Close picker" autoFocus>
          <Icon name="close" size={18} />
        </button>
      </header>
      {['coin', 'chain'].map((name) => {
        const parameter = parameters.find((item) => item.name === name)
        if (!parameter) return null
        const choices = resolveRef(parameter.schema).enum
        return <fieldset className="api-picker-section" data-api-picker-choice={name} key={name}>
          <legend className={pair ? undefined : 'sr-only'}>{name === 'coin' ? 'Assets' : 'Networks'}</legend>
          <div className="api-picker-options">
            {choices.map((value) => <button type="button" className="api-picker-option" data-api-picker-option={value} key={value} aria-pressed="false">
              {icons.has(value) && <img src={`/images/api-picker/${value.toLowerCase()}.svg`} alt="" />}
              {value}
              <Icon name="check" size={12} className="api-picker-check" />
            </button>)}
            {!parameter.required && <button type="button" className="api-picker-option api-picker-any" data-api-picker-option="" aria-pressed="false">
              Any {labels[name]}
            </button>}
          </div>
        </fieldset>
      })}
      {pair && <button type="button" className="api-try-send api-picker-done" data-api-picker-done="">Done</button>}
    </dialog>
  </div>
}
