import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import rust from 'highlight.js/lib/languages/rust'
import typescript from 'highlight.js/lib/languages/typescript'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('typescript', typescript)

const requestLanguages = [
  { id: 'curl', title: 'cURL', language: 'bash', generate: curlRequest },
  { id: 'rust', title: 'Rust', language: 'rust', generate: rustRequest },
  { id: 'typescript', title: 'TypeScript', language: 'typescript', generate: typescriptRequest },
]

// The last column marks operations whose SDK signatures need more than the route arguments.
const sdkOperations = {
  getHealth: ['health_check', 'healthCheck'],
  getApiAccount: ['get_api', 'getApiAccount'],
  getUserWalletAddress: ['get_user_wallet_address', 'getUserWalletAddress'],
  getUserWalletAddresses: ['get_user_wallet_addresses', 'getUserWalletAddresses'],
  getStablecoinBalance: ['get_oc_chain_coin_balance', 'getStablecoinBalance'],
  getChainStablecoinBalances: ['get_oc_chain_all_coins_balances', 'getChainStablecoinBalances'],
  getWalletBalances: ['get_wallet_balances', 'getWalletBalances'],
  getWalletBalanceByPair: ['get_wallet_balance_by_pair_with_finality', 'getWalletBalanceByPairWithFinality'],
  getWalletBalancesByChain: ['get_wallet_balances_by_chain', 'getWalletBalancesByChain'],
  getWalletBalancesByCoin: ['get_wallet_balances_by_coin', 'getWalletBalancesByCoin'],
  getContacts: ['get_all_contacts', 'getContacts', 'ContactListParams'],
  getContact: ['get_user_contact', 'getContact'],
  upsertContacts: ['upsert_contacts', 'upsertContacts'],
  previewDeleteContacts: ['preview_delete_contacts', 'previewDeleteContacts', 'contactIds'],
  deleteContacts: ['delete_contacts', 'deleteContacts', 'contactIds'],
  getContactBatches: ['get_contact_batches', 'getContactBatches', 'ContactBatchListParams'],
  getContactBatch: ['get_contact_batch', 'getContactBatch'],
  deleteContactBatch: ['delete_contacts_batch', 'deleteContactBatch', 'deleteBatch'],
  getPaymentNetBalance: ['fetch_pre_ocp_net_balance', 'getPaymentNetBalance', 'pair'],
  getEstimatedPaymentFee: ['fetch_pre_ocp_total_est_fee', 'getEstimatedPaymentFee', 'pair'],
  getPaymentBalanceAndFee: ['fetch_pre_ocp_balance_and_est_fee', 'getPaymentPreflight', 'pairWithContacts'],
  getManagedWalletBulkPaymentInputs: ['fetch_pre_ocp_balance_and_est_fee_bulkpay', 'getManagedBulkPaymentPreflight', 'coins'],
  getSelfCustodialPaymentBalanceAndFee: ['fetch_pre_ocp_balance_and_est_fee_ncw', 'getSelfCustodialPaymentPreflight', 'payloadBeforeFee'],
  getSelfCustodialBulkPaymentBalanceAndFee: ['fetch_pre_ocp_balance_and_est_fee_ncw_bulkpay', 'getSelfCustodialBulkPaymentPreflight', 'items'],
  getSelfCustodialPaymentCalculationInputs: ['prefetch_ncw_balance_fee_params', 'prefetchSelfCustodialPaymentFeeParams', 'pairWithContacts'],
  getSelfCustodialBulkPaymentCalculationInputs: ['prefetch_ncw_balance_fee_params_bulkpay', 'prefetchSelfCustodialBulkPaymentFeeParams', 'coins'],
  createManagedWalletPayment: ['pay_onchain', 'createManagedWalletPayment'],
  createManagedWalletBulkPayment: ['bulk_pay_cw', 'createManagedBulkPayment', 'borrowBody'],
  createManagedWalletMerchantPayment: ['pay_onchain_merchant', 'createManagedMerchantPayment'],
  createSelfCustodialPaymentPermit: ['create_domain_permit_for_sig', 'createSelfCustodialPaymentPermit', 'borrowBody'],
  createSelfCustodialBulkPaymentPermit: ['create_domain_permit_for_sig_bulkpay', 'createSelfCustodialBulkPaymentPermit', 'borrowBody'],
  createSelfCustodialPayment: ['pay_onchain_ncw', 'createSelfCustodialPayment'],
  createSelfCustodialBulkPayment: ['bulk_pay_ncw', 'createSelfCustodialBulkPayment'],
  createSelfCustodialMerchantPayment: ['pay_onchain_merchant_ncw', 'createSelfCustodialMerchantPayment'],
  getPaymentSessionStatus: ['get_payment_session_status', 'getPaymentSessionStatus'],
  getPaymentReceipt: ['get_ocp_receipt', 'getPaymentReceipt'],
  getBulkPaymentReceipts: ['get_bulk_pay_receipts', 'getBulkPaymentReceipts'],
  getPaymentReceipts: ['get_ocp_receipts', 'getPaymentHistory', 'history'],
}

export function requestUrl(server, route, pathValues, query = new URLSearchParams()) {
  const path = route.replace(/\{([^}]+)\}/g, (placeholder, name) => {
    const value = pathValues.get(name)
    return value && !/^\.{1,2}$/.test(value) ? encodeURIComponent(value) : placeholder
  })
  return server + path + (query.size ? `?${query}` : '')
}

export function requestExamples(request) {
  const sdk = sdkArguments(request)
  return requestLanguages.map(({ id, title, language, generate }) => ({
    id, title, html: hljs.highlight(generate(request, sdk), { language }).value.replaceAll('\r', '&#13;'),
  }))
}

function shellQuote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'"
}

function curlRequest({ method, url, bearer, mediaType, body }) {
  return [
    `curl${method === 'GET' ? '' : ` -X ${method}`} ${shellQuote(url)}`,
    bearer && '  -H "Authorization: Bearer ${UNIFI_API_KEY}"',
    body && `  -H ${shellQuote(`Content-Type: ${mediaType}`)}`,
    body && `  --data ${shellQuote(body)}`,
  ].filter(Boolean).join(' \\\n')
}

function rustString(value) {
  const escaped = value.replace(/["\\\x00-\x09\x0b-\x1f\x7f]/g, (char) => {
    if (char === '"' || char === '\\') return `\\${char}`
    return `\\u{${char.codePointAt(0).toString(16)}}`
  })
  return `"${escaped}"`
}

function rustBody(value) {
  // Use a delimiter the request body cannot close.
  let hashes = 1
  for (const [match] of value.matchAll(/"#+/g)) hashes = Math.max(hashes, match.length)
  if (hashes > 255 || value.includes('\r')) return rustString(value)
  const delimiter = '#'.repeat(hashes)
  return `r${delimiter}"${value}"${delimiter}`
}

const defaultPathValues = { chain: 'Ethereum', coin: 'USDT', is_fee_incl: false, sort_by_latest: true, from_start: true }
const rustEnums = { chain: 'ChainName', coin: 'StableCoin' }
const booleanQuery = new Set(['fetch_contacts', 'pending', 'next_or_previous', 'with_batch', 'is_own_wallet'])
const numericQuery = new Set(['limit', 'batch_limit'])
const missingBody = '// Enter the JSON request body in Try it to generate this example.'

function queryValues(query) {
  return Object.fromEntries(Array.from(query, ([name, value]) => [
    name, booleanQuery.has(name) ? value === 'true' : numericQuery.has(name) ? Number(value) : value,
  ]))
}

function sdkArguments({ operationId, route, path, query = new URLSearchParams(), body, mediaType }) {
  const [rustMethod, typescriptMethod, kind] = sdkOperations[operationId] ?? []
  if (!rustMethod) throw new Error(`Missing UniFi SDK methods for ${operationId}`)

  let payload
  if (mediaType) {
    try { payload = JSON.parse(body) } catch { return { message: missingBody } }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { message: missingBody }
  }

  const rustTypes = new Set()
  const rustArgs = []
  const typescriptArgs = []
  for (const [, name] of route.matchAll(/\{([^}]+)\}/g)) {
    const fallback = defaultPathValues[name] ?? name.toUpperCase()
    const value = path.get(name) ?? fallback
    if (typeof fallback === 'boolean') {
      const literal = String(value === true || value === 'true')
      rustArgs.push(literal)
      typescriptArgs.push(literal)
    } else {
      const rustType = rustEnums[name]
      if (rustType) {
        rustTypes.add(rustType)
        rustArgs.push(`${rustType}::${value}`)
      } else {
        rustArgs.push(rustString(value))
      }
      typescriptArgs.push(JSON.stringify(value))
    }
  }

  const fetchContacts = String(query.get('fetch_contacts') === 'true')
  let rustBodyType
  let rustBodyLiteral
  let cursor
  if (kind === 'pair' || kind === 'pairWithContacts') {
    const [chain, coin] = rustArgs.splice(1)
    rustTypes.add('PreOcpPayload')
    rustArgs.push(`PreOcpPayload { chain: ${chain}, coin: ${coin} }`)
    if (kind === 'pairWithContacts') {
      rustArgs.push(fetchContacts)
      if (query.has('fetch_contacts')) typescriptArgs.push(fetchContacts)
    }
  } else if (kind === 'coins') {
    if (!Array.isArray(payload.coins)) return { message: missingBody }
    rustBodyType = 'BulkPreOcpRequest'
    rustArgs.push('&body.coins', fetchContacts)
    typescriptArgs.push(JSON.stringify(payload.coins))
    if (query.has('fetch_contacts')) typescriptArgs.push(fetchContacts)
  } else if (kind === 'items') {
    if (typeof payload.chain !== 'string' || !Array.isArray(payload.items)) return { message: missingBody }
    rustBodyType = 'BulkPayItemRequest'
    rustArgs.splice(1, 0, 'body.chain', '&body.items')
    typescriptArgs.push(JSON.stringify(payload.chain), printJson(payload.items))
  } else if (kind === 'history') {
    const filters = queryValues([...query].filter(([name]) => name !== 'cursor'))
    const hasFilters = Object.keys(filters).length > 0
    rustArgs.push(hasFilters ? `Some(serde_json::from_str(${rustBody(JSON.stringify(filters))})?)` : 'None')
    cursor = query.get('cursor')
    if (cursor) rustArgs.push(`Some(${rustString(cursor)})`)
    if (hasFilters || cursor) typescriptArgs.push(printJson(cursor ? { ...filters, cursor } : filters))
  } else if (kind === 'ContactListParams' || kind === 'ContactBatchListParams') {
    rustTypes.add(kind)
    const filters = queryValues(query)
    if (query.size) {
      rustArgs.push(`&serde_json::from_str::<${kind}>(${rustBody(JSON.stringify(filters))})?`)
      typescriptArgs.push(printJson(filters))
    } else {
      rustArgs.push(`&${kind}::default()`)
    }
  } else if (kind === 'contactIds') {
    const ids = payload.contact_ids
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) return { message: missingBody }
    rustTypes.add('DeleteContactsPayload')
    const rustIds = ids.map((id) => `${rustString(id)}.to_owned()`).join(', ')
    rustBodyLiteral = `DeleteContactsPayload {\n        contact_ids: vec![${rustIds}],\n    }`
    rustArgs.push('body.contact_ids')
    typescriptArgs.push(printJson(ids))
  } else if (kind === 'deleteBatch') {
    if (typeof payload.del_its_contacts !== 'boolean') return { message: missingBody }
    rustBodyType = 'DeleteContactBatchPayload'
    rustArgs.push('body.del_its_contacts')
    typescriptArgs.push(String(payload.del_its_contacts))
  } else if (payload) {
    const borrowBody = kind === 'borrowBody' || kind === 'payloadBeforeFee'
    rustArgs.splice(kind === 'payloadBeforeFee' ? 1 : rustArgs.length, 0, borrowBody ? '&body' : 'body')
    typescriptArgs.push(printJson(payload))
  }

  if (rustBodyType) rustTypes.add(rustBodyType)
  return { rustMethod: cursor ? 'get_ocp_receipts_with_cursor' : rustMethod, rustArgs, rustTypes, rustBodyType, rustBodyLiteral, typescriptMethod, typescriptArgs }
}

function printJson(value) {
  return JSON.stringify(value, null, 2).replaceAll('\n', '\n  ')
}

function rustRequest({ server, bearer, body }, { message, rustMethod, rustArgs, rustTypes, rustBodyType, rustBodyLiteral }) {
  if (message) return message
  const bodyExpression = rustBodyLiteral ?? (body ? `serde_json::from_str(${rustBody(body)})?` : '')
  const bodyBinding = rustBodyType ? `body: ${rustBodyType}` : 'body'
  const call = `sdk.${rustMethod}(${rustArgs.join(', ')})`
  const lines = call.length > 80
    ? [`    let result = sdk.${rustMethod}(`, ...rustArgs.map(arg => `        ${arg},`), '    ).await?;']
    : [`    let result = ${call}.await?;`]
  return [
    '// Save as src/main.rs',
    '// cargo run',
    '',
    'use unifi_sdk_rs::Sdk;',
    ...[...rustTypes].sort().map(type => `use unifi_sdk_primitives::types::${type};`),
    '',
    '#[tokio::main(flavor = "current_thread")]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
    ...(bearer ? ['    let api_key = std::env::var("UNIFI_API_KEY")?;'] : []),
    `    let sdk = Sdk::new(${rustString(server)}, ${bearer ? '&api_key' : '""'});`,
    ...(bodyExpression ? [`    let ${bodyBinding} = ${bodyExpression};`] : []),
    ...lines,
    '    println!("{result:#?}");',
    '    Ok(())',
    '}',
  ].join('\n')
}

function typescriptRequest({ server, bearer }, { message, typescriptMethod, typescriptArgs }) {
  if (message) return message
  return [
    '// Save as example.ts (Node.js 22.18+)',
    '// Run: node example.ts',
    '',
    'async function main() {',
    '  const { UnifiClient } = await import("unifi-sdk-ts")',
    '  const sdk = new UnifiClient({',
    ...(bearer ? ['    apiKey: process.env.UNIFI_API_KEY,'] : []),
    `    baseUrl: ${JSON.stringify(server)},`,
    '  })',
    `  const result = await sdk.${typescriptMethod}(${typescriptArgs.join(', ')})`,
    '  console.log(result)',
    '}',
    '',
    'main().catch((error: unknown) => {',
    '  console.error(error)',
    '  process.exitCode = 1',
    '})',
  ].join('\n')
}
