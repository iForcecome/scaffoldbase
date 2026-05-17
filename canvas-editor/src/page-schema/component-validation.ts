import { componentRecipes } from '../design-system/component-recipes'
import type { ComponentNode } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateStringProp(props: Record<string, unknown>, key: string, path: string, errors: string[], max = 300) {
  if (props[key] !== undefined && (typeof props[key] !== 'string' || props[key].length > max)) {
    errors.push(`${path}.${key} must be a string up to ${max} chars`)
  }
}

function validateActionList(value: unknown, path: string, errors: string[]) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 12) {
    errors.push(`${path} must be an array with at most 12 actions`)
    return
  }
  value.forEach((action, index) => {
    if (!isRecord(action)) {
      errors.push(`${path}[${index}] must be an object`)
      return
    }
    validateStringProp(action, 'label', `${path}[${index}]`, errors, 80)
    validateStringProp(action, 'variant', `${path}[${index}]`, errors, 80)
  })
}

function validateFieldList(value: unknown, path: string, errors: string[]) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 40) {
    errors.push(`${path} must be an array with at most 40 fields`)
    return
  }
  value.forEach((field, index) => {
    if (!isRecord(field)) {
      errors.push(`${path}[${index}] must be an object`)
      return
    }
    validateStringProp(field, 'name', `${path}[${index}]`, errors, 80)
    validateStringProp(field, 'label', `${path}[${index}]`, errors, 120)
    validateStringProp(field, 'type', `${path}[${index}]`, errors, 40)
    if (field.options !== undefined && (!Array.isArray(field.options) || field.options.length > 60)) {
      errors.push(`${path}[${index}].options must be an array with at most 60 items`)
    }
  })
}

function validateItems(value: unknown, path: string, errors: string[]) {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 40) {
    errors.push(`${path} must be an array with at most 40 items`)
    return
  }
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`${path}[${index}] must be an object`)
      return
    }
    validateStringProp(item, 'label', `${path}[${index}]`, errors, 120)
    validateStringProp(item, 'href', `${path}[${index}]`, errors, 300)
  })
}

export function validateComponentNodeContract(node: ComponentNode, path: string, errors: string[]) {
  const recipe = componentRecipes[node.component]
  if (recipe && node.variant && !recipe.variants[node.variant]) {
    errors.push(`${path}.variant must be one of ${Object.keys(recipe.variants).join(', ')}`)
  }

  const props = node.props
  switch (node.component) {
    case 'PageHeader':
      validateStringProp(props, 'title', `${path}.props`, errors, 160)
      validateStringProp(props, 'description', `${path}.props`, errors, 600)
      validateActionList(props.actions, `${path}.props.actions`, errors)
      break
    case 'FilterBar':
    case 'FormSection':
      validateStringProp(props, 'title', `${path}.props`, errors, 160)
      validateStringProp(props, 'description', `${path}.props`, errors, 600)
      validateFieldList(props.fields, `${path}.props.fields`, errors)
      break
    case 'DataTable':
      if (props.columns !== undefined && (!Array.isArray(props.columns) || props.columns.length > 60)) {
        errors.push(`${path}.props.columns must be an array with at most 60 columns`)
      }
      if (props.rows !== undefined && (!Array.isArray(props.rows) || props.rows.length > 200)) {
        errors.push(`${path}.props.rows must be an array with at most 200 rows`)
      }
      break
    case 'Button':
      validateStringProp(props, 'label', `${path}.props`, errors, 80)
      validateStringProp(props, 'size', `${path}.props`, errors, 20)
      break
    case 'Modal':
      validateStringProp(props, 'title', `${path}.props`, errors, 160)
      validateStringProp(props, 'description', `${path}.props`, errors, 600)
      if (props.open !== undefined && typeof props.open !== 'boolean') {
        errors.push(`${path}.props.open must be a boolean`)
      }
      break
    case 'EmptyState':
      validateStringProp(props, 'title', `${path}.props`, errors, 160)
      validateStringProp(props, 'description', `${path}.props`, errors, 600)
      validateActionList(props.actions, `${path}.props.actions`, errors)
      break
    case 'Navigation':
      validateItems(props.items, `${path}.props.items`, errors)
      break
    case 'Section':
    case 'Region':
      validateStringProp(props, 'title', `${path}.props`, errors, 160)
      validateStringProp(props, 'description', `${path}.props`, errors, 1000)
      break
    default:
      break
  }
}
