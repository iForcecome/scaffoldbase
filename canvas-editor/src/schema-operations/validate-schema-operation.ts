import type { ComponentNode } from '../page-schema/types'
import type { SchemaOperation, SchemaOperationValidationResult } from './types'
import { validateComponentNodeContract } from '../page-schema/component-validation'

const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/
const COMPONENT_RE = /^[A-Z][a-zA-Z0-9]*$/
const POSITIONS = new Set(['before', 'after', 'inside:start', 'inside:end'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonSafe(value: unknown, depth = 0): boolean {
  if (depth > 8) return false
  if (value === null) return true
  if (['string', 'number', 'boolean'].includes(typeof value)) return Number.isFinite(value as number) || typeof value !== 'number'
  if (Array.isArray(value)) return value.length <= 80 && value.every(item => isJsonSafe(item, depth + 1))
  if (isRecord(value)) {
    return Object.keys(value).length <= 80 && Object.entries(value).every(([key, item]) => (
      key.length <= 80 && isJsonSafe(item, depth + 1)
    ))
  }
  return false
}

function validateId(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    errors.push(`${path} must be a valid id`)
  }
}

function validateNode(node: unknown, path: string, errors: string[]) {
  if (!isRecord(node)) {
    errors.push(`${path} must be an object`)
    return
  }
  validateId(node.id, `${path}.id`, errors)
  if (typeof node.component !== 'string' || !COMPONENT_RE.test(node.component)) {
    errors.push(`${path}.component must be a PascalCase component name`)
  }
  if (node.role !== undefined && (typeof node.role !== 'string' || node.role.length > 80)) {
    errors.push(`${path}.role must be a string up to 80 chars`)
  }
  if (node.label !== undefined && (typeof node.label !== 'string' || node.label.length > 120)) {
    errors.push(`${path}.label must be a string up to 120 chars`)
  }
  if (node.variant !== undefined && (typeof node.variant !== 'string' || node.variant.length > 80)) {
    errors.push(`${path}.variant must be a string up to 80 chars`)
  }
  if (!isRecord(node.props) || !isJsonSafe(node.props)) {
    errors.push(`${path}.props must be a JSON-safe object`)
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

function validateOperation(operation: unknown, index: number, errors: string[]): operation is SchemaOperation {
  const path = `operations[${index}]`
  if (!isRecord(operation) || typeof operation.type !== 'string') {
    errors.push(`${path} must be an operation object`)
    return false
  }

  switch (operation.type) {
    case 'replaceText':
      validateId(operation.target, `${path}.target`, errors)
      if (typeof operation.text !== 'string' || operation.text.length > 2000) {
        errors.push(`${path}.text must be a string up to 2000 chars`)
      }
      return true
    case 'setVariant':
      validateId(operation.target, `${path}.target`, errors)
      if (typeof operation.variant !== 'string' || operation.variant.length > 80) {
        errors.push(`${path}.variant must be a string up to 80 chars`)
      }
      return true
    case 'updateProps':
      validateId(operation.target, `${path}.target`, errors)
      if (!isRecord(operation.props) || !isJsonSafe(operation.props)) {
        errors.push(`${path}.props must be a JSON-safe object`)
      }
      return true
    case 'insertComponent':
      validateId(operation.target, `${path}.target`, errors)
      if (typeof operation.position !== 'string' || !POSITIONS.has(operation.position)) {
        errors.push(`${path}.position must be a supported insertion position`)
      }
      validateNode(operation.node as ComponentNode, `${path}.node`, errors)
      return true
    case 'removeNode':
      validateId(operation.target, `${path}.target`, errors)
      return true
    case 'moveNode':
      validateId(operation.target, `${path}.target`, errors)
      validateId(operation.reference, `${path}.reference`, errors)
      if (typeof operation.position !== 'string' || !POSITIONS.has(operation.position)) {
        errors.push(`${path}.position must be a supported insertion position`)
      }
      return true
    default:
      errors.push(`${path}.type is not supported`)
      return false
  }
}

export function validateSchemaOperationResponse(input: unknown): SchemaOperationValidationResult {
  const errors: string[] = []
  if (!isRecord(input) || !Array.isArray(input.operations)) {
    return { ok: false, errors: ['response.operations must be an array'] }
  }
  if (input.operations.length < 1 || input.operations.length > 20) {
    errors.push('response.operations must contain 1 to 20 operations')
  }

  const operations = input.operations.filter((operation, index) => validateOperation(operation, index, errors)) as SchemaOperation[]
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, errors: [], value: { operations } }
}
