export type Operation =
  | ReplaceTextOperation
  | SetVariantOperation
  | UpdateStyleOperation
  | ReplaceClassOperation

export interface ReplaceTextOperation {
  type: 'replaceText'
  target: string
  text: string
}

export interface SetVariantOperation {
  type: 'setVariant'
  target: string
  variant: string
}

export interface UpdateStyleOperation {
  type: 'updateStyle'
  target: string
  styles: Record<string, string>
}

export interface ReplaceClassOperation {
  type: 'replaceClass'
  target: string
  className: string
}

export interface OperationResponse {
  operations: Operation[]
}

export interface OperationValidationResult {
  ok: boolean
  errors: string[]
}
