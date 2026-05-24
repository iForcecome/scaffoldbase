import { getBridgeScript } from '../bridge/bridge-script'

const injectedHtmlCache = new Map<string, string>()
const MAX_CACHE_ENTRIES = 10

export function injectBridge(rawHTML: string): string {
  const cached = injectedHtmlCache.get(rawHTML)
  if (cached) return cached

  let html = rawHTML

  // 移除上一次 inject 留下的痕迹（重新 inject 时干净）
  html = html.replace(/\s*data-sf-id="sf-\d+"/g, '')
  html = html.replace(/<script[^>]*>[\s\S]*?data-sf-id[\s\S]*?<\/script>/g, '')

  const bridgeCode = getBridgeScript()
  const injection = `<script type="text/javascript">${bridgeCode}</script>`

  if (html.includes('</head>')) {
    html = html.replace('</head>', injection + '</head>')
  } else if (html.includes('</body>')) {
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
