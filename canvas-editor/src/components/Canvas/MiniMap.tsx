export function MiniMap() {
  return (
    <div className="absolute top-4 right-4 z-20 w-32 h-20 bg-white/90 backdrop-blur-sm rounded-lg border border-surface-3 shadow-sm overflow-hidden">
      <div className="w-full h-full p-1.5">
        <div className="w-full h-full bg-surface-1 rounded relative">
          <div className="absolute inset-x-1 top-0.5 h-1 bg-surface-3 rounded-sm" />
          <div className="absolute inset-x-1 top-2 h-0.5 bg-surface-3 rounded-sm" />
          <div className="absolute inset-x-1 top-3.5 bottom-1 bg-surface-3/50 rounded-sm" />
          <div className="absolute inset-1 border-2 border-brand-500 rounded-sm opacity-60" />
        </div>
      </div>
    </div>
  )
}
