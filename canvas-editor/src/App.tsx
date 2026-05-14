import { TopBar } from './components/TopBar/TopBar'
import { LeftPanel } from './components/LeftPanel/LeftPanel'
import { CanvasArea } from './components/Canvas/CanvasArea'
import { RightPanel } from './components/RightPanel/RightPanel'

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-canvas-bg font-sans text-ink-0 select-none">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <CanvasArea />
        <RightPanel />
      </div>
    </div>
  )
}
