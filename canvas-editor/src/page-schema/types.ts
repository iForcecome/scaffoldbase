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
    theme?: {
      brandColor?: string
      brandColorStrong?: string
      backgroundColor?: string
      surfaceColor?: string
      surfaceColorRaised?: string
      borderColor?: string
      textColor?: string
      textColorSecondary?: string
      mutedTextColor?: string
      fontFamily?: string
    }
    sections: ComponentNode[]
  }
}
