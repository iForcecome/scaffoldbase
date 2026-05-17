import type { SelectedElement } from '../stores/editor-store'

function slugify(value: string | null | undefined, fallback = 'node'): string {
  const next = String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return next || fallback
}

export function deriveSpecPath(pageId: string | null | undefined, element: Pick<SelectedElement, 'component' | 'role' | 'label' | 'sfId' | 'specPath'> | null | undefined): string {
  if (element?.specPath) return element.specPath

  const pageSegment = slugify(pageId, 'current')
  const componentSegment = slugify(element?.component, 'region')
  const roleSegment = slugify(element?.role ?? element?.label ?? element?.sfId, 'item')

  return `pages.${pageSegment}.${componentSegment}.${roleSegment}`
}

