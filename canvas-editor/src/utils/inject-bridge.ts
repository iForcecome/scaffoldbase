import { getBridgeScript } from '../bridge/bridge-script'
import { renderDesignSystemCss } from '../design-system/render-css'

const injectedHtmlCache = new Map<string, string>()
const MAX_CACHE_ENTRIES = 10

export function injectBridge(rawHTML: string): string {
  const cached = injectedHtmlCache.get(rawHTML)
  if (cached) return cached

  let html = rawHTML

  // Strip only transient runtime IDs. Stable semantic IDs such as
  // data-sf-id="orders.list.filters" are part of the saved document.
  html = html.replace(/\s*data-sf-id="sf-\d+"/g, '')
  html = html.replace(/<script[^>]*>[\s\S]*?data-sf-id[\s\S]*?<\/script>/g, '')
  html = html.replace(/<style[^>]*data-sf-design-system[^>]*>[\s\S]*?<\/style>/g, '')

  const bridgeCode = getBridgeScript()
  const designSystemCss = renderDesignSystemCss()
  const injection = `<style data-sf-design-system>${designSystemCss}</style><script type="text/javascript">${bridgeCode}</script>`

  if (html.includes('</head>')) {
    return html.replace('</head>', injection + '</head>')
  }
  if (html.includes('</body>')) {
    html = html.replace('</body>', injection + '</body>')
  } else {
    html += injection
  }

  injectedHtmlCache.set(rawHTML, html)
  if (injectedHtmlCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = injectedHtmlCache.keys().next().value
    if (oldestKey) injectedHtmlCache.delete(oldestKey)
  }
  return html
}
