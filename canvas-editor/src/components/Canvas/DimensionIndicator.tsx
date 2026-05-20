import { useViewportStore } from '../../stores/viewport-store'

export function DimensionIndicator() {
  const getDeviceWidth = useViewportStore(s => s.getDeviceWidth)
  const deviceWidth = getDeviceWidth()

  return (
    <div
      className="absolute z-20 flex flex-col items-center gap-0.5"
      style={{
        top: 68,
        right: `calc(50% - ${deviceWidth / 2}px - 50px)`,
      }}
    >
      <div className="w-px h-4 bg-brand-400" />
      <span className="text-[10px] text-brand-600 font-mono font-medium bg-white/80 px-1.5 rounded">
        {deviceWidth}px
      </span>
    </div>
  )
}
