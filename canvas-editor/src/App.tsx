import { useEffect } from 'react'
import { TopBar } from './components/TopBar/TopBar'
import { LeftPanel } from './components/LeftPanel/LeftPanel'
import { CanvasArea } from './components/Canvas/CanvasArea'
import { RightPanel } from './components/RightPanel/RightPanel'
import { useEditorStore } from './stores/editor-store'

export default function App() {
  const isPreview = useEditorStore(s => s.activeTool === 'preview')
  const setTool = useEditorStore(s => s.setTool)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const store = useEditorStore.getState()
      if (e.key === 'p' || e.key === 'P') {
        if (store.activeTool !== 'preview') {
          setTool('preview')
        }
      }
      if (e.key === 'Escape' && store.activeTool === 'preview') {
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTool])

  return (
    <div className="h-screen flex flex-col bg-canvas-bg font-sans text-ink-0 select-none">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {!isPreview && <LeftPanel />}
        <CanvasArea />
        {!isPreview && <RightPanel />}
      </div>
    </div>
  )
}
