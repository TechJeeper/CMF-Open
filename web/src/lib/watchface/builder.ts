/**
 * Structured dial builder for CMF Watch Pro.
 * Creates .bin watchfaces with firmware-animated hands and data bindings.
 */
import { compress } from './lz4'
import { toRgb565, type Rgba } from './photo'

const CF_RGB565 = 4
const CF_RGB565_A8 = 5

// Widget tags
const TAG_SCENE = 0x20
const TAG_MAIN_SCREEN = 0x21
const TAG_STATIC_IMAGE = 0x30
const TAG_HAND = 0x70
const TAG_STRUCT = 0x01
const TAG_PIVOT = 0x05

// Data source IDs for rotation bindings
export const SOURCE_HOUR_ANGLE = 0x0e
export const SOURCE_MINUTE_ANGLE = 0x0a
export const SOURCE_SECOND_ANGLE = 0x12

function writeU16LE(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >> 8) & 0xff)
}

function writeU32LE(value: number): Uint8Array {
  const out = new Uint8Array(4)
  const v = new DataView(out.buffer)
  v.setUint32(0, value >>> 0, true)
  return out
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

function tlv(tag: number, value: Uint8Array): Uint8Array {
  return concat(Uint8Array.of(tag), writeU16LE(value.length), value)
}

function containerTlv(tag: number, children: Uint8Array[]): Uint8Array {
  const content = concat(...children)
  return tlv(tag, content)
}

function structWidget(x: number, y: number, width: number, height: number, sourceId = 0, imageIndex = 0): Uint8Array {
  const data = new Uint8Array(16)
  const v = new DataView(data.buffer)
  v.setInt16(0, x, true)
  v.setInt16(2, y, true)
  v.setUint16(4, width, true)
  v.setUint16(6, height, true)
  data[8] = imageIndex & 0xff
  data[9] = (imageIndex >> 8) & 0xff
  data[10] = 0
  data[11] = 0
  data[12] = 0
  data[13] = sourceId
  data[14] = 0
  data[15] = 0
  return tlv(TAG_STRUCT, data)
}

function pivotWidget(x: number, y: number): Uint8Array {
  const data = new Uint8Array(5)
  data[0] = 0
  data[1] = x & 0xff
  data[2] = (x >> 8) & 0xff
  data[3] = y & 0xff
  data[4] = (y >> 8) & 0xff
  return tlv(TAG_PIVOT, data)
}

function staticImage(x: number, y: number, width: number, height: number, imageIndex: number): Uint8Array {
  return containerTlv(TAG_STATIC_IMAGE, [
    structWidget(x, y, width, height, 0, imageIndex),
  ])
}

function hand(x: number, y: number, width: number, height: number, pivotX: number, pivotY: number, sourceId: number, imageIndex: number): Uint8Array {
  return containerTlv(TAG_HAND, [
    structWidget(x, y, width, height, sourceId, imageIndex),
    pivotWidget(pivotX, pivotY),
  ])
}

function dimsWord(width: number, height: number, cf: number): number {
  return ((cf & 0x1f) | ((width & 0x7ff) << 10) | ((height & 0x7ff) << 21)) >>> 0
}

function buildResource(img: Rgba, hasAlpha = false): Uint8Array {
  const cf = hasAlpha ? CF_RGB565_A8 : CF_RGB565
  let packed: Uint8Array
  
  if (hasAlpha) {
    const rgb565 = toRgb565(img, false)
    const alpha = new Uint8Array(img.width * img.height)
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = img.data[i * 4 + 3]
    }
    packed = compress(concat(rgb565, alpha))
  } else {
    packed = compress(toRgb565(img, false))
  }
  
  return concat(writeU32LE(dimsWord(img.width, img.height, cf)), writeU32LE(packed.length), packed)
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface HandConfig {
  image: Rgba
  pivotX: number
  pivotY: number
  sourceId: number
}

export interface StructuredDialConfig {
  name: string
  dialId: number
  background: Rgba
  hands?: HandConfig[]
}

export function buildStructuredDial(config: StructuredDialConfig): Uint8Array {
  const { name, dialId, background, hands = [] } = config
  
  const screenSize = 466
  const resources: Uint8Array[] = []
  const widgets: Uint8Array[] = []
  
  // Background image (resource 0)
  resources.push(buildResource(background, false))
  widgets.push(staticImage(0, 0, screenSize, screenSize, 0))
  
  // Hand images and widgets
  hands.forEach((hand_config, i) => {
    const resourceIndex = i + 1
    resources.push(buildResource(hand_config.image, true))
    
    const cx = screenSize / 2
    const cy = screenSize / 2
    const hw = hand_config.image.width
    const hh = hand_config.image.height
    
    widgets.push(hand(
      cx - hand_config.pivotX,
      cy - hand_config.pivotY,
      hw,
      hh,
      hand_config.pivotX,
      hand_config.pivotY,
      hand_config.sourceId,
      resourceIndex,
    ))
  })
  
  // Build tree
  const mainScreen = containerTlv(TAG_MAIN_SCREEN, widgets)
  const scene = containerTlv(TAG_SCENE, [mainScreen])
  
  // Build resources section
  const resourcesBlob = concat(...resources)
  
  // Build header
  const treeSize = scene.length
  const totalSize = treeSize + resourcesBlob.length
  const treeCrc = crc32(scene)
  
  const header = new Uint8Array(36)
  const hv = new DataView(header.buffer)
  hv.setUint32(0x00, treeCrc, true)
  hv.setUint32(0x04, 0x00000001, true) // version
  
  const nameBytes = new TextEncoder().encode(name.slice(0, 15))
  header.set(nameBytes, 0x08)
  
  hv.setUint32(0x18, totalSize, true)
  hv.setUint32(0x1c, resourcesBlob.length, true)
  hv.setUint32(0x20, dialId, true)
  
  return concat(header, scene, resourcesBlob)
}

export function createAnalogHandImage(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  tipRadius = 4,
): Rgba {
  ctx.canvas.width = width
  ctx.canvas.height = height
  ctx.clearRect(0, 0, width, height)
  
  const pivotX = width / 2
  const pivotY = height - 20
  const handWidth = Math.max(4, width / 4)
  
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pivotX - handWidth / 2, pivotY)
  ctx.lineTo(pivotX - tipRadius, tipRadius)
  ctx.arc(pivotX, tipRadius, tipRadius, Math.PI, 0)
  ctx.lineTo(pivotX + handWidth / 2, pivotY)
  ctx.closePath()
  ctx.fill()
  
  // Center circle
  ctx.beginPath()
  ctx.arc(pivotX, pivotY, handWidth / 2 + 2, 0, Math.PI * 2)
  ctx.fill()
  
  const imageData = ctx.getImageData(0, 0, width, height)
  return {
    width,
    height,
    data: imageData.data,
  }
}
