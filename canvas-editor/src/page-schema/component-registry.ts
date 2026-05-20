import type { ComponentNode } from './types'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function toKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '-')
    .toLowerCase()
}

function renderInlineStyle(style: unknown): string {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return ''
  const entries: string[] = []
  for (const [prop, value] of Object.entries(style as Record<string, unknown>)) {
    if (typeof value !== 'string' || !value) continue
    entries.push(`${toKebab(prop)}: ${escapeAttr(value)}`)
  }
  return entries.join('; ')
}

function renderAttrs(node: ComponentNode, extraClass = ''): string {
  const classes = [`sf-${toKebab(node.component)}`]
  const variant = node.variant || 'default'
  if (variant) classes.push(`sf-${toKebab(node.component)}--${toKebab(variant)}`)
  if (extraClass) classes.push(extraClass)

  const styleStr = renderInlineStyle(node.props.style)
  const attrs = [
    `data-sf-id="${escapeAttr(node.id)}"`,
    `data-sf-component="${escapeAttr(node.component)}"`,
    node.role ? `data-sf-role="${escapeAttr(node.role)}"` : '',
    node.label ? `data-sf-label="${escapeAttr(node.label)}"` : '',
    node.variant ? `data-sf-variant="${escapeAttr(node.variant)}"` : '',
    `class="${classes.filter(Boolean).join(' ')}"`,
    styleStr ? `style="${styleStr}"` : '',
  ].filter(Boolean)

  return attrs.join(' ')
}

function renderChildren(children?: ComponentNode[]): string {
  if (!children || children.length === 0) return ''
  return children.map(renderComponentNode).join('\n')
}

function renderButton(node: ComponentNode, buttonProps: Record<string, unknown> = {}): string {
  const label = buttonProps.label ?? node.label ?? '按钮'
  const variant = String(buttonProps.variant ?? node.variant ?? 'default')
  const size = String(buttonProps.size ?? 'md')
  const extraClass = size === 'sm' ? 'sf-button--compact' : ''
  const attrs = renderAttrs({
    ...node,
    component: 'Button',
    variant,
  }, extraClass)
  return `<button type="button" ${attrs}>${escapeHtml(label)}</button>`
}

function renderField(node: ComponentNode, field: Record<string, unknown>, index: number): string {
  const fieldType = String(field.type ?? 'text')
  const fieldId = `${node.id}.field.${field.name ? String(field.name) : index}`
  const label = String(field.label ?? field.name ?? `字段${index + 1}`)
  const options = Array.isArray(field.options) ? field.options : []

  const control = fieldType === 'select'
    ? `<select data-sf-id="${escapeAttr(`${fieldId}.control`)}" data-sf-role="field-control">
        ${options.map(option => `<option>${escapeHtml(option)}</option>`).join('')}
      </select>`
    : fieldType === 'dateRange'
      ? `<div class="sf-date-range" data-sf-id="${escapeAttr(`${fieldId}.control`)}" data-sf-role="field-control">
          <input type="date" />
          <span>—</span>
          <input type="date" />
        </div>`
      : `<input type="${escapeAttr(fieldType === 'search' ? 'search' : 'text')}" placeholder="${escapeAttr(field.placeholder ?? label)}" data-sf-id="${escapeAttr(`${fieldId}.control`)}" data-sf-role="field-control" />`

  return `<label class="sf-filter-field" data-sf-id="${escapeAttr(fieldId)}" data-sf-role="field">
    <span class="sf-filter-field__label" data-sf-id="${escapeAttr(`${fieldId}.label`)}">${escapeHtml(label)}</span>
    ${control}
  </label>`
}

function renderPageHeader(node: ComponentNode): string {
  const props = node.props ?? {}
  const actions = Array.isArray(props.actions) ? props.actions : []
  const title = String(props.title ?? node.label ?? '页面标题')
  const description = props.description ? String(props.description) : ''

  return `<section ${renderAttrs(node)}>
    <div>
      <h1 data-sf-id="${escapeAttr(`${node.id}.title`)}" data-sf-role="title">${escapeHtml(title)}</h1>
      ${description ? `<p data-sf-id="${escapeAttr(`${node.id}.description`)}" data-sf-role="description">${escapeHtml(description)}</p>` : ''}
    </div>
    <div class="sf-page-header__actions" data-sf-id="${escapeAttr(`${node.id}.actions`)}" data-sf-role="actions">
      ${actions.map((action: Record<string, unknown>, index: number) => renderButton({
        id: `${node.id}.action.${index}`,
        component: 'Button',
        role: 'action',
        label: String(action.label ?? `操作${index + 1}`),
        variant: String(action.variant ?? 'default'),
        props: {},
      }, action)).join('')}
    </div>
    ${renderChildren(node.children)}
  </section>`
}

function renderFilterBar(node: ComponentNode): string {
  const props = node.props ?? {}
  const fields = Array.isArray(props.fields) ? props.fields : []

  return `<section ${renderAttrs(node)}>
    <div class="sf-filter-bar__fields" data-sf-id="${escapeAttr(`${node.id}.fields`)}" data-sf-role="fields">
      ${fields.map((field: Record<string, unknown>, index: number) => renderField(node, field, index)).join('')}
    </div>
    ${renderChildren(node.children)}
  </section>`
}

function renderDataTable(node: ComponentNode): string {
  const props = node.props ?? {}
  const columns = Array.isArray(props.columns) ? props.columns : []
  const rows = Array.isArray(props.rows) ? props.rows : []

  const normalizedColumns = columns.map((column: unknown, index: number) => {
    if (typeof column === 'string') {
      return { key: `col-${index}`, label: column }
    }
    if (column && typeof column === 'object') {
      const record = column as Record<string, unknown>
      return {
        key: String(record.key ?? `col-${index}`),
        label: String(record.label ?? record.key ?? `列${index + 1}`),
      }
    }
    return { key: `col-${index}`, label: `列${index + 1}` }
  })

  const renderRow = (row: Record<string, unknown> | unknown[], rowIndex: number) => {
    if (Array.isArray(row)) {
      return `<tr data-sf-id="${escapeAttr(`${node.id}.row.${rowIndex}`)}">${row.map((cell, cellIndex) => `<td data-sf-id="${escapeAttr(`${node.id}.row.${rowIndex}.cell.${cellIndex}`)}">${escapeHtml(cell)}</td>`).join('')}</tr>`
    }
    const record = row as Record<string, unknown>
    return `<tr data-sf-id="${escapeAttr(`${node.id}.row.${rowIndex}`)}">${normalizedColumns.map(col => `<td data-sf-id="${escapeAttr(`${node.id}.row.${rowIndex}.cell.${col.key}`)}">${escapeHtml(record[col.key] ?? '—')}</td>`).join('')}</tr>`
  }

  const fallbackRow = normalizedColumns.map(col => `<td data-sf-id="${escapeAttr(`${node.id}.row.0.cell.${col.key}`)}">—</td>`).join('')
  const body = rows.length > 0
    ? rows.map((row, index) => renderRow(row as Record<string, unknown>, index)).join('')
    : `<tr data-sf-id="${escapeAttr(`${node.id}.row.0`)}">${fallbackRow}</tr>`

  return `<section ${renderAttrs(node)}>
    <table class="sf-data-table__table" data-sf-id="${escapeAttr(`${node.id}.table`)}" data-sf-role="table">
      <thead>
        <tr data-sf-id="${escapeAttr(`${node.id}.header`)}">
          ${normalizedColumns.map(col => `<th data-sf-id="${escapeAttr(`${node.id}.column.${col.key}`)}">${escapeHtml(col.label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
    ${renderChildren(node.children)}
  </section>`
}

function renderFormSection(node: ComponentNode): string {
  const props = node.props ?? {}
  const fields = Array.isArray(props.fields) ? props.fields : []
  return `<section ${renderAttrs(node)}>
    ${props.title ? `<h2 data-sf-id="${escapeAttr(`${node.id}.title`)}">${escapeHtml(props.title)}</h2>` : ''}
    ${props.description ? `<p data-sf-id="${escapeAttr(`${node.id}.description`)}">${escapeHtml(props.description)}</p>` : ''}
    <div class="sf-form-section__fields" data-sf-id="${escapeAttr(`${node.id}.fields`)}">
      ${fields.map((field: Record<string, unknown>, index: number) => renderField(node, field, index)).join('')}
    </div>
    ${renderChildren(node.children)}
  </section>`
}

function renderModal(node: ComponentNode): string {
  const props = node.props ?? {}
  const open = props.open === true
  const title = String(props.title ?? node.label ?? '弹窗')
  return `<div ${renderAttrs(node, 'sf-modal__overlay')} ${open ? '' : 'hidden'}>
    <section class="sf-modal" data-sf-id="${escapeAttr(`${node.id}.dialog`)}" data-sf-role="dialog" role="dialog" aria-modal="true">
      <header class="sf-modal__header">
        <h2 data-sf-id="${escapeAttr(`${node.id}.title`)}">${escapeHtml(title)}</h2>
      </header>
      ${props.description ? `<p data-sf-id="${escapeAttr(`${node.id}.description`)}">${escapeHtml(props.description)}</p>` : ''}
      <div class="sf-modal__body" data-sf-id="${escapeAttr(`${node.id}.body`)}">
        ${renderChildren(node.children)}
      </div>
    </section>
  </div>`
}

function renderEmptyState(node: ComponentNode): string {
  const props = node.props ?? {}
  const actions = Array.isArray(props.actions) ? props.actions : []
  return `<section ${renderAttrs(node)}>
    ${props.title ? `<h3 data-sf-id="${escapeAttr(`${node.id}.title`)}">${escapeHtml(props.title)}</h3>` : ''}
    ${props.description ? `<p data-sf-id="${escapeAttr(`${node.id}.description`)}">${escapeHtml(props.description)}</p>` : ''}
    ${actions.length > 0 ? `<div class="sf-empty-state__actions" data-sf-id="${escapeAttr(`${node.id}.actions`)}">${actions.map((action: Record<string, unknown>, index: number) => renderButton({
      id: `${node.id}.action.${index}`,
      component: 'Button',
      role: 'action',
      label: String(action.label ?? `操作${index + 1}`),
      variant: String(action.variant ?? 'default'),
      props: {},
    }, action)).join('')}</div>` : ''}
    ${renderChildren(node.children)}
  </section>`
}

function renderNavigation(node: ComponentNode): string {
  const props = node.props ?? {}
  const items = Array.isArray(props.items) ? props.items : []
  return `<nav ${renderAttrs(node)}>
    ${items.map((item: Record<string, unknown>, index: number) => {
      const href = String(item.href ?? '#')
      const label = String(item.label ?? `链接${index + 1}`)
      return `<a data-sf-id="${escapeAttr(`${node.id}.item.${index}`)}" href="${escapeAttr(href)}">${escapeHtml(label)}</a>`
    }).join('')}
    ${renderChildren(node.children)}
  </nav>`
}

function renderSection(node: ComponentNode): string {
  const props = node.props ?? {}
  return `<section ${renderAttrs(node)}>
    ${props.title ? `<h2 data-sf-id="${escapeAttr(`${node.id}.title`)}" data-sf-role="title">${escapeHtml(props.title)}</h2>` : ''}
    ${props.description ? `<p data-sf-id="${escapeAttr(`${node.id}.description`)}" data-sf-role="description">${escapeHtml(props.description)}</p>` : ''}
    ${renderChildren(node.children)}
  </section>`
}

function renderGeneric(node: ComponentNode): string {
  const tag = ['Section', 'Region'].includes(node.component) ? 'section' : 'div'
  return `<${tag} ${renderAttrs(node)}>
    ${renderChildren(node.children)}
  </${tag}>`
}

export function renderComponentNode(node: ComponentNode): string {
  switch (node.component) {
    case 'PageHeader':
      return renderPageHeader(node)
    case 'FilterBar':
      return renderFilterBar(node)
    case 'DataTable':
      return renderDataTable(node)
    case 'Button':
      return renderButton(node)
    case 'FormSection':
      return renderFormSection(node)
    case 'Modal':
      return renderModal(node)
    case 'EmptyState':
      return renderEmptyState(node)
    case 'Navigation':
      return renderNavigation(node)
    case 'Section':
    case 'Region':
      return renderSection(node)
    default:
      return renderGeneric(node)
  }
}
