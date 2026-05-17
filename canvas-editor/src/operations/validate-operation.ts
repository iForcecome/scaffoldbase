import type { Operation, OperationResponse, OperationValidationResult } from './types'

const MAX_OPERATIONS = 20
const TARGET_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/
const VARIANT_RE = /^[a-zA-Z0-9_-]+$/
const UNSAFE_CLASS_RE = /[<>"'`=]|javascript:/i

export const SAFE_STYLE_PROPS = new Set([
  'display',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'gap',
  'padding',
  'margin',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'backgroundColor',
  'backgroundImage',
  'backgroundSize',
  'backgroundPosition',
  'color',
  'borderRadius',
  'borderColor',
  'borderWidth',
  'boxShadow',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'textAlign',
  'opacity',
  'gridTemplateColumns',
  'gridTemplateRows',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateTarget(target: unknown, path: string, errors: string[]) {
  if (typeof target !== 'string' || !TARGET_RE.test(target)) {
    errors.push(`${path}.target must be a stable data-sf-id`)
  }
}

function validateOperation(raw: unknown, index: number, errors: string[]): raw is Operation {
  const path = `operations[${index}]`
  if (!isRecord(raw)) {
    errors.push(`${path} must be an object`)
    return false
  }

  switch (raw.type) {
    case 'replaceText':
      validateTarget(raw.target, path, errors)
      if (typeof raw.text !== 'string' || raw.text.length > 2000) {
        errors.push(`${path}.text must be a string under 2000 characters`)
      }
      return errors.length === 0

    case 'setVariant':
      validateTarget(raw.target, path, errors)
      if (typeof raw.variant !== 'string' || !VARIANT_RE.test(raw.variant)) {
        errors.push(`${path}.variant must be a simple variant name`)
      }
      return errors.length === 0

    case 'updateStyle':
      validateTarget(raw.target, path, errors)
      if (!isRecord(raw.styles)) {
        errors.push(`${path}.styles must be an object`)
        return false
      }
      for (const [prop, value] of Object.entries(raw.styles)) {
        if (!SAFE_STYLE_PROPS.has(prop)) {
          errors.push(`${path}.styles.${prop} is not allowed`)
        }
        if (typeof value !== 'string' || value.length > 160) {
          errors.push(`${path}.styles.${prop} must be a string under 160 characters`)
        }
        if (typeof value === 'string' && /expression\(|url\s*\(\s*javascript:/i.test(value)) {
          errors.push(`${path}.styles.${prop} contains unsafe CSS`)
        }
      }
      return errors.length === 0

    case 'replaceClass':
      validateTarget(raw.target, path, errors)
      if (typeof raw.className !== 'string' || raw.className.length > 1000 || UNSAFE_CLASS_RE.test(raw.className)) {
        errors.push(`${path}.className must be a safe class string`)
      }
      return errors.length === 0

    default:
      errors.push(`${path}.type is not supported`)
      return false
  }
}

export function validateOperationResponse(raw: unknown): OperationValidationResult & { value?: OperationResponse } {
  const errors: string[] = []

  if (!isRecord(raw) || !Array.isArray(raw.operations)) {
    return { ok: false, errors: ['response must contain operations array'] }
  }

  if (raw.operations.length === 0 || raw.operations.length > MAX_OPERATIONS) {
    errors.push(`operations length must be between 1 and ${MAX_OPERATIONS}`)
  }

  const operations: Operation[] = []
  raw.operations.forEach((op, index) => {
    const before = errors.length
    if (validateOperation(op, index, errors) && errors.length === before) {
      operations.push(op)
    }
  })

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [], value: { operations } }
}
