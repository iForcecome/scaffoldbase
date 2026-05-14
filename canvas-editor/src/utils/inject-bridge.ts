import { getBridgeScript } from '../bridge/bridge-script'

export function injectBridge(rawHTML: string): string {
  let html = rawHTML

  // Strip existing bridge artifacts (data-sf-id attrs and bridge script blocks)
  html = html.replace(/\s*data-sf-id="[^"]*"/g, '')
  html = html.replace(/<script[^>]*>[\s\S]*?data-sf-id[\s\S]*?<\/script>/g, '')

  const bridgeCode = getBridgeScript()
  const injection = `<script type="text/javascript">${bridgeCode}</script>`

  if (html.includes('</head>')) {
    return html.replace('</head>', injection + '</head>')
  }
  if (html.includes('</body>')) {
    return html.replace('</body>', injection + '</body>')
  }
  return html + injection
}
