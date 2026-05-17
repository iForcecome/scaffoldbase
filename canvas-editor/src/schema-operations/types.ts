import type { ComponentNode } from '../page-schema/types'

export type SchemaOperation =
  | SchemaReplaceTextOperation
  | SchemaSetVariantOperation
  | SchemaUpdatePropsOperation
  | SchemaInsertComponentOperation
  | SchemaRemoveNodeOperation
  | SchemaMoveNodeOperation

export interface SchemaReplaceTextOperation {
  type: 'replaceText'
  target: string
  text: string
}

export interface SchemaSetVariantOperation {
  type: 'setVariant'
  target: string
  variant: string
}

export interface SchemaUpdatePropsOperation {
  type: 'updateProps'
  target: string
  props: Record<string, unknown>
}

export interface SchemaInsertComponentOperation {
  type: 'insertComponent'
  target: string
  position: 'before' | 'after' | 'inside:start' | 'inside:end'
  node: ComponentNode
}

export interface SchemaRemoveNodeOperation {
  type: 'removeNode'
  target: string
}

export interface SchemaMoveNodeOperation {
  type: 'moveNode'
  target: string
  reference: string
  position: 'before' | 'after' | 'inside:start' | 'inside:end'
}

export interface SchemaOperationResponse {
  operations: SchemaOperation[]
}

export interface SchemaOperationValidationResult {
  ok: boolean
  errors: string[]
  value?: SchemaOperationResponse
}
