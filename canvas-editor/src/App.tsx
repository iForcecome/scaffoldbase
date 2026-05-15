import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const ProjectList = lazy(() => import('./pages/ProjectList'))
const EditorPage = lazy(() => import('./pages/EditorPage'))

function Loading() {
  return (
    <div className="h-screen flex items-center justify-center bg-canvas-bg">
      <div className="w-8 h-8 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/editor/:projectId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
