import { getBridgeScript } from '../bridge/bridge-script'

export function injectBridge(rawHTML: string): string {
  const bridgeCode = getBridgeScript()
  const injection = `<script type="text/javascript">${bridgeCode}</script>`

  if (rawHTML.includes('</head>')) {
    return rawHTML.replace('</head>', injection + '</head>')
  }
  if (rawHTML.includes('</body>')) {
    return rawHTML.replace('</body>', injection + '</body>')
  }
  return rawHTML + injection
}
