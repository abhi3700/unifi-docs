import ELK from 'elkjs/lib/elk-api.js'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'

let elk

// Mermaid creates an ELK instance on each render. Reuse the worker across diagrams and theme changes.
export default class ELKWorker {
  layout(graph, options) {
    elk ??= new ELK({ workerUrl })
    // Mermaid attaches DOM nodes and drawing callbacks to the layout data.
    const layoutGraph = JSON.parse(JSON.stringify(graph, (_, value) => value instanceof Node ? undefined : value))
    return elk.layout(layoutGraph, options)
  }
}
