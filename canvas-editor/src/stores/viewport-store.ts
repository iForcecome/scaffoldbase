import { create } from 'zustand'

export type Device = 'desktop' | 'tablet' | 'mobile'

const DEVICE_WIDTHS: Record<Device, number> = {
  desktop: 1080,
  tablet: 768,
  mobile: 375,
}

interface Viewport { x: number; y: number; zoom: number }
type Rect = { x: number; y: number; width: number; height: number }

interface ViewportState {
  viewport: Viewport
  device: Device
  customWidth: number | null
  iframeHeight: number
}

interface ViewportActions {
  setViewport: (v: Partial<Viewport>) => void
  zoomTo: (zoom: number) => void
  setDevice: (d: Device) => void
  setCustomWidth: (w: number) => void
  setIframeHeight: (h: number) => void
  resetViewport: () => void
  getDeviceWidth: () => number
  panToElement: (rect: Rect) => void
}

const initialViewport: ViewportState = {
  viewport: { x: 0, y: 0, zoom: 1 },
  device: 'desktop',
  customWidth: null,
  iframeHeight: 800,
}

export const useViewportStore = create<ViewportState & ViewportActions>()((set, get) => ({
  ...initialViewport,

  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),
  zoomTo: (zoom) => set((s) => ({ viewport: { ...s.viewport, zoom: Math.max(0.1, Math.min(3, zoom)) } })),
  setDevice: (d) => set({ device: d, customWidth: null, viewport: { x: 0, y: 0, zoom: 1 } }),
  setCustomWidth: (w) => set((s) => ({
    customWidth: Math.max(320, Math.min(2560, w)),
    viewport: { x: 0, y: 0, zoom: s.viewport.zoom },
  })),
  setIframeHeight: (h) => set({ iframeHeight: Math.max(768, h) }),
  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

  getDeviceWidth: () => get().customWidth ?? DEVICE_WIDTHS[get().device],

  panToElement: (rect) => {
    const s = get()
    const zoom = s.viewport.zoom
    const canvasEl = document.querySelector('[data-canvas-bg]') as HTMLElement | null
    if (!canvasEl) return
    const canvasBounds = canvasEl.getBoundingClientRect()

    const iframeEl = canvasEl.querySelector('iframe')
    if (!iframeEl) return
    const iframeRect = iframeEl.getBoundingClientRect()

    const elLeft = iframeRect.left + rect.x * zoom
    const elTop = iframeRect.top + rect.y * zoom
    const elRight = elLeft + rect.width * zoom
    const elBottom = elTop + rect.height * zoom

    const PAD = 50
    const vLeft = canvasBounds.left + PAD
    const vTop = canvasBounds.top + PAD
    const vRight = canvasBounds.right - PAD
    const vBottom = canvasBounds.bottom - PAD

    if (elLeft >= vLeft && elTop >= vTop && elRight <= vRight && elBottom <= vBottom) {
      return
    }

    const isCompletelyOutside =
      elRight < vLeft || elLeft > vRight || elBottom < vTop || elTop > vBottom

    if (isCompletelyOutside || (elRight - elLeft) > (vRight - vLeft) || (elBottom - elTop) > (vBottom - vTop)) {
      const dx = (vLeft + vRight) / 2 - (elLeft + elRight) / 2
      const dy = vTop - elTop
      set((cur) => ({ viewport: { ...cur.viewport, x: cur.viewport.x + dx, y: cur.viewport.y + dy } }))
      return
    }

    let dx = 0, dy = 0
    if (elLeft < vLeft) dx = vLeft - elLeft
    else if (elRight > vRight) dx = vRight - elRight
    if (elTop < vTop) dy = vTop - elTop
    else if (elBottom > vBottom) dy = vBottom - elBottom

    set((cur) => ({ viewport: { ...cur.viewport, x: cur.viewport.x + dx, y: cur.viewport.y + dy } }))
  },
}))
