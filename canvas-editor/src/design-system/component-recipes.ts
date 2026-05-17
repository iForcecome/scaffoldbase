export type CssRules = Record<string, string>

export interface ComponentRecipe {
  className: string
  base: CssRules
  variants: Record<string, CssRules>
}

export const componentRecipes: Record<string, ComponentRecipe> = {
  PageHeader: {
    className: 'sf-page-header',
    base: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--sf-space-4)',
      padding: 'var(--sf-space-6)',
      borderBottom: '1px solid var(--sf-color-surface-3)',
    },
    variants: {
      default: {},
      compact: {
        padding: 'var(--sf-space-4)',
        gap: 'var(--sf-space-3)',
      },
      spacious: {
        padding: '32px',
        gap: 'var(--sf-space-6)',
      },
    },
  },
  FilterBar: {
    className: 'sf-filter-bar',
    base: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 'var(--sf-space-3)',
      padding: 'var(--sf-space-4)',
      background: 'var(--sf-color-surface-0)',
      border: '1px solid var(--sf-color-surface-3)',
      borderRadius: 'var(--sf-radius-md)',
    },
    variants: {
      default: {},
      compact: {
        gap: 'var(--sf-space-2)',
        padding: 'var(--sf-space-3)',
      },
      spacious: {
        gap: 'var(--sf-space-4)',
        padding: 'var(--sf-space-6)',
      },
    },
  },
  DataTable: {
    className: 'sf-data-table',
    base: {
      width: '100%',
      border: '1px solid var(--sf-color-surface-3)',
      borderRadius: 'var(--sf-radius-lg)',
      overflow: 'hidden',
      background: 'var(--sf-color-surface-0)',
      fontSize: '14px',
    },
    variants: {
      default: {},
      compact: {
        fontSize: '13px',
      },
      spacious: {
        fontSize: '15px',
      },
    },
  },
  Button: {
    className: 'sf-button',
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--sf-space-2)',
      height: '36px',
      padding: '0 var(--sf-space-4)',
      borderRadius: 'var(--sf-radius-md)',
      border: '1px solid transparent',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
    },
    variants: {
      default: {
        background: 'var(--sf-color-surface-1)',
        color: 'var(--sf-color-ink-1)',
        borderColor: 'var(--sf-color-surface-3)',
      },
      primary: {
        background: 'var(--sf-color-brand-600)',
        color: '#ffffff',
      },
      compact: {
        height: '32px',
        padding: '0 var(--sf-space-3)',
        fontSize: '12px',
      },
    },
  },
  FormSection: {
    className: 'sf-form-section',
    base: {
      display: 'grid',
      gap: 'var(--sf-space-4)',
      padding: 'var(--sf-space-5)',
      border: '1px solid var(--sf-color-surface-3)',
      borderRadius: 'var(--sf-radius-lg)',
      background: 'var(--sf-color-surface-0)',
    },
    variants: {
      default: {},
      compact: {
        gap: 'var(--sf-space-3)',
        padding: 'var(--sf-space-4)',
      },
    },
  },
  Modal: {
    className: 'sf-modal',
    base: {
      maxWidth: '520px',
      padding: 'var(--sf-space-6)',
      borderRadius: 'var(--sf-radius-lg)',
      background: 'var(--sf-color-surface-0)',
      boxShadow: '0 24px 80px rgba(15, 23, 42, 0.18)',
    },
    variants: {
      default: {},
      compact: {
        maxWidth: '420px',
        padding: 'var(--sf-space-4)',
      },
    },
  },
  EmptyState: {
    className: 'sf-empty-state',
    base: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--sf-space-3)',
      padding: '48px var(--sf-space-6)',
      color: 'var(--sf-color-ink-2)',
      textAlign: 'center',
    },
    variants: {
      default: {},
      compact: {
        padding: '32px var(--sf-space-4)',
      },
    },
  },
  Section: {
    className: 'sf-section',
    base: {
      display: 'grid',
      gap: 'var(--sf-space-3)',
      padding: 'var(--sf-space-5)',
      border: '1px solid var(--sf-color-surface-3)',
      borderRadius: 'var(--sf-radius-lg)',
      background: 'var(--sf-color-surface-0)',
    },
    variants: {
      default: {},
      compact: {
        gap: 'var(--sf-space-2)',
        padding: 'var(--sf-space-4)',
      },
      spacious: {
        gap: 'var(--sf-space-4)',
        padding: 'var(--sf-space-6)',
      },
    },
  },
}
