export type PageLayout = 'dashboard' | 'marketing' | 'form-flow' | 'detail' | 'settings'

export interface ComponentNode {
  id: string
  component: string
  role?: string
  label?: string
  variant?: string
  props: Record<string, unknown>
  children?: ComponentNode[]
}

export interface PageSchema {
  page: {
    id: string
    title: string
    layout: PageLayout
    sections: ComponentNode[]
  }
}

