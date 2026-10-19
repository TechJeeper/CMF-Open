import type { Rgba } from './photo'

export interface Crop {
  /** 1 = the image's short side fills the panel. */
  zoom: number
  /** Pan in panel fractions, -0.5..0.5. */
  x: number
  y: number
}

/** Draw `img` square-cropped into a size x size canvas, the way the watch will show it. */
export function renderCrop(img: CanvasImageSource & { width: number; height: number }, size: number, crop: Crop): Rgba {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, size, size)
  const scale = (size / Math.min(img.width, img.height)) * crop.zoom
  const w = img.width * scale
  const h = img.height * scale
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, (size - w) / 2 + crop.x * size, (size - h) / 2 + crop.y * size, w, h)
  return g.getImageData(0, 0, size, size)
}

export function hexTo565(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  return (((n >> 19) & 0x1f) << 11) | (((n >> 10) & 0x3f) << 5) | ((n >> 3) & 0x1f)
}
