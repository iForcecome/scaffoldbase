import { componentRecipes, type CssRules } from './component-recipes'
import { defaultTokens } from './tokens'

function kebab(prop: string): string {
  return prop.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}

function renderRule(selector: string, rules: CssRules): string {
  const body = Object.entries(rules)
    .map(([prop, value]) => `  ${kebab(prop)}: ${value};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}

export function renderTokenCss(): string {
  return `:root {
  --sf-color-brand-50: ${defaultTokens.color.brand[50]};
  --sf-color-brand-100: ${defaultTokens.color.brand[100]};
  --sf-color-brand-600: ${defaultTokens.color.brand[600]};
  --sf-color-brand-700: ${defaultTokens.color.brand[700]};
  --sf-color-surface-0: ${defaultTokens.color.surface[0]};
  --sf-color-surface-1: ${defaultTokens.color.surface[1]};
  --sf-color-surface-2: ${defaultTokens.color.surface[2]};
  --sf-color-surface-3: ${defaultTokens.color.surface[3]};
  --sf-color-ink-0: ${defaultTokens.color.ink[0]};
  --sf-color-ink-1: ${defaultTokens.color.ink[1]};
  --sf-color-ink-2: ${defaultTokens.color.ink[2]};
  --sf-color-ink-3: ${defaultTokens.color.ink[3]};
  --sf-space-1: ${defaultTokens.space[1]};
  --sf-space-2: ${defaultTokens.space[2]};
  --sf-space-3: ${defaultTokens.space[3]};
  --sf-space-4: ${defaultTokens.space[4]};
  --sf-space-5: ${defaultTokens.space[5]};
  --sf-space-6: ${defaultTokens.space[6]};
  --sf-radius-sm: ${defaultTokens.radius.sm};
  --sf-radius-md: ${defaultTokens.radius.md};
  --sf-radius-lg: ${defaultTokens.radius.lg};
  --sf-font-sans: ${defaultTokens.font.sans};
}`
}

export function renderComponentCss(): string {
  return Object.values(componentRecipes)
    .flatMap(recipe => [
      renderRule(`.${recipe.className}`, recipe.base),
      ...Object.entries(recipe.variants).map(([variant, rules]) =>
        renderRule(`.${recipe.className}--${variant}`, rules),
      ),
    ])
    .join('\n\n')
}

export function renderDesignSystemCss(): string {
  return `${renderTokenCss()}

html, body {
  font-family: var(--sf-font-sans);
}

${renderComponentCss()}`
}
