// Cross-store coordination wired with zustand subscribe() so individual
// stores stay decoupled — the ESLint rule in eslint.config.js forbids the
// pure data stores (viewport/selection/tool/history) from importing each
// other. editor-store / chat-store / this file are the only places allowed
// to talk to multiple stores at once.

import { useToolStore } from './tool-store'
import { useSelectionStore } from './selection-store'

let installed = false

export function installStoreCoordinators(): void {
  if (installed) return
  installed = true

  let prevTool = useToolStore.getState().activeTool
  useToolStore.subscribe((state) => {
    const next = state.activeTool
    if (next === prevTool) return
    if (next === 'preview' && prevTool !== 'preview') {
      const selection = useSelectionStore.getState()
      selection.clearSelection()
      selection.hoverElement(null)
    }
    prevTool = next
  })
}
