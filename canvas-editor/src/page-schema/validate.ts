import type { ComponentNode, PageLayout, PageSchema } from './types'
import { validateComponentNodeContract } from './component-validation'

export interface PageSchemaValidationResult {
  ok: boolean
  errors: string[]
}

const PAGE_LAYOUTS = new Set<PageLayout>(['dashboard', 'marketing', 'form-flow', 'detail', 'settings'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function validateId(id: unknown, path: string, errors: string[]) {
  if (!isString(id) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) {
    errors.push(`${path} must be a valid id string`)
  }
}

function validateNode(node: unknown, path: string, errors: string[]) {
  if (!isRecord(node)) {
    errors.push(`${path} must be an object`)
    return
  }

  validateId(node.id, `${path}.id`, errors)
  if (!isString(node.component) || !/^[A-Z][a-zA-Z0-9]*$/.test(node.component)) {
    errors.push(`${path}.component must be a PascalCase component name`)
  }
  if (node.role !== undefined && (!isString(node.role) || node.role.length > 80)) {
    errors.push(`${path}.role must be a string up to 80 chars`)
  }
  if (node.label !== undefined && (!isString(node.label) || node.label.length > 120)) {
    errors.push(`${path}.label must be a string up to 120 chars`)
  }
  if (node.variant !== undefined && (!isString(node.variant) || node.variant.length > 80)) {
    errors.push(`${path}.variant must be a string up to 80 chars`)
  }
  if (!isRecord(node.props) || Array.isArray(node.props)) {
    errors.push(`${path}.props must be an object`)
  } else {
    validateComponentNodeContract(node as unknown as ComponentNode, path, errors)
  }

  if (node.children !== undefined) {
    if (!Array.isArray(node.children) || node.children.length > 40) {
      errors.push(`${path}.children must be an array with at most 40 items`)
    } else {
      node.children.forEach((child, index) => validateNode(child, `${path}.children[${index}]`, errors))
    }
  }
}

export function validatePageSchema(input: unknown): PageSchemaValidationResult {
  const errors: string[] = []

  if (!isRecord(input)) {
    return { ok: false, errors: ['schema must be an object'] }
  }

  const page = input.page
  if (!isRecord(page)) {
    errors.push('page must be an object')
    return { ok: false, errors }
  }

  validateId(page.id, 'page.id', errors)
  if (!isString(page.title) || page.title.length < 1 || page.title.length > 120) {
    errors.push('page.title must be a non-empty string up to 120 chars')
  }
  if (!isString(page.layout) || !PAGE_LAYOUTS.has(page.layout as PageLayout)) {
    errors.push('page.layout must be one of dashboard, marketing, form-flow, detail, settings')
  }
  if (!Array.isArray(page.sections) || page.sections.length < 1 || page.sections.length > 30) {
    errors.push('page.sections must be an array with 1 to 30 items')
  } else {
    page.sections.forEach((section, index) => validateNode(section, `page.sections[${index}]`, errors))
  }

  return { ok: errors.length === 0, errors }
}

export function assertPageSchema(input: unknown): asserts input is PageSchema {
  const result = validatePageSchema(input)
  if (!result.ok) {
    throw new Error(`Invalid page schema: ${result.errors.join('; ')}`)
  }
}
