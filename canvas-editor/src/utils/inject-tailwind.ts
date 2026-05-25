// Tailwind Play CDN 兜底注入。
//
// 为什么编辑器要做这件事？
// v2 阶段 iframe srcDoc 是隔离环境，外层的 tailwind 编译产物不会带进去。
// 用户/AI 在 contentHtml 里写 `class="text-3xl flex bg-blue-500"` 这类
// Tailwind 工具类很常见，但 iframe 内没有引擎 → 全部失效。
//
// 兜底策略：检查 composed html 里是否已含 tailwind 引用（用户在 sharedHead
// 写了自己的版本、或自带了 CDN）。没有就在 </head> 前注入 Play CDN。
// 用户的自定义 link 跟在我们注入之后，优先级更高，可覆盖。

const TAILWIND_CDN_TAG = '<script src="https://cdn.tailwindcss.com"></script>'

const HAS_TAILWIND_RE = /cdn\.tailwindcss\.com|tailwindcss[/-]\d|tailwind\.min\.css|@tailwind\s+(?:base|components|utilities)/i

export function ensureTailwindCdn(html: string): string {
  if (!html) return html
  if (HAS_TAILWIND_RE.test(html)) return html
  if (html.includes('</head>')) {
    return html.replace('</head>', TAILWIND_CDN_TAG + '</head>')
  }
  // 没 </head> 的极端情况：直接前置（Play CDN 自带 DOMContentLoaded 处理）
  return TAILWIND_CDN_TAG + html
}
