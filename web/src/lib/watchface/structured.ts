/**
 * Structured dial parser for CMF Watch Pro.
 * Parses the TLV scene format used by store/custom watchfaces with live data bindings.
 */

export interface StructuredDialHeader {
  treeCrc: number
  version: number
  name: string
  totalSize: number
  resourceSize: number
  dialId: number
}

export interface Widget {
  tag: number
  tagName: string
  offset: number
  length: number
  x?: number
  y?: number
  width?: number
  height?: number
  sourceId?: number
  sourceName?: string
  images?: number[]
  children?: Widget[]
  pivot?: { x: number; y: number }
  arc?: ArcParams
  raw: Uint8Array
}

export interface ArcParams {
  min: number
  max: number
  startAngle: number
  endAngle: number
  width: number
  radius?: number
}

export interface Resource {
  index: number
  offset: number
  width: number
  height: number
  format: number
  formatName: string
  compressedSize: number
  data: Uint8Array
}

export interface StructuredDial {
  header: StructuredDialHeader
  tree: Widget
  resources: Resource[]
  raw: Uint8Array
}

const TAG_NAMES: Record<number, string> = {
  0x20: 'scene',
  0x21: 'main_screen',
  0x22: 'aod_screen',
  0x30: 'static_image',
  0x60: 'number',
  0x68: 'group',
  0x70: 'hand',
  0x80: 'arc',
  0x81: 'progress_ring',
  0x82: 'sunrise_arc',
  0x85: 'configurable_slot',
  0x86: 'name',
  0x01: 'struct',
  0x02: 'binding',
  0x05: 'pivot',
  0x08: 'preview_ref',
  0x40: 'digit_format',
  0x48: 'group_frame',
  0x5a: 'arc_params',
  0x5b: 'ring_params',
}

const SOURCE_NAMES: Record<number, string> = {
  0x01: 'hour_digits',
  0x07: 'hour_24',
  0x08: 'hour_tens',
  0x09: 'hour_ones',
  0x0a: 'minute_hand_angle',
  0x0b: 'minute_digits',
  0x0c: 'minute_tens',
  0x0d: 'minute_ones',
  0x0e: 'hour_hand_angle',
  0x0f: 'second_digits',
  0x12: 'second_hand_angle',
  0x13: 'am_pm',
  0x16: 'month',
  0x17: 'day_of_month',
  0x18: 'weekday',
  0x19: 'steps',
  0x1a: 'heart_rate',
  0x1b: 'battery',
  0x1e: 'calories',
  0x24: 'temperature',
  0x25: 'steps_goal_pct',
  0x26: 'distance_goal_pct',
  0x27: 'calories_goal_pct',
  0x30: 'battery_pct',
  0x36: 'steps_alt',
  0x48: 'calories_alt',
  0x5f: 'temperature_alt',
  0x70: 'hour_angle',
  0x71: 'minute_angle',
  0x72: 'second_angle',
}

const FORMAT_NAMES: Record<number, string> = {
  4: 'RGB565',
  5: 'RGB565_A8',
  13: 'ALPHA_4BIT',
  24: 'BGRA8888',
}

function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8)
}

function readU32LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)
}

function readI16LE(data: Uint8Array, offset: number): number {
  const u = readU16LE(data, offset)
  return u > 0x7fff ? u - 0x10000 : u
}

function readI32LE(data: Uint8Array, offset: number): number {
  const u = readU32LE(data, offset)
  return u > 0x7fffffff ? u - 0x100000000 : u
}

export function parseHeader(data: Uint8Array): StructuredDialHeader {
  if (data.length < 36) throw new Error('File too small for header')

  const treeCrc = readU32LE(data, 0x00)
  const version = readU32LE(data, 0x04)

  let nameEnd = 0x08
  while (nameEnd < 0x18 && data[nameEnd] !== 0) nameEnd++
  const name = new TextDecoder().decode(data.slice(0x08, nameEnd))

  const totalSize = readU32LE(data, 0x18)
  const resourceSize = readU32LE(data, 0x1c)
  const dialId = readU32LE(data, 0x20)

  return { treeCrc, version, name, totalSize, resourceSize, dialId }
}

function isContainer(tag: number): boolean {
  return tag === 0x20 || tag === 0x21 || tag === 0x22 || tag === 0x68
}

function parseWidgetStruct(value: Uint8Array): Partial<Widget> {
  if (value.length < 4) return {}
  const x = readI16LE(value, 0)
  const y = readI16LE(value, 2)
  let width: number | undefined
  let height: number | undefined
  let sourceId: number | undefined

  if (value.length >= 8) {
    width = readU16LE(value, 4)
    height = readU16LE(value, 6)
    if (width === 0x8000) width = undefined
  }

  if (value.length >= 14) {
    sourceId = value[13]
  }

  return {
    x,
    y,
    width,
    height,
    sourceId,
    sourceName: sourceId !== undefined ? SOURCE_NAMES[sourceId] : undefined,
  }
}

function parsePivot(value: Uint8Array): { x: number; y: number } | undefined {
  if (value.length < 5) return undefined
  return { x: readU16LE(value, 1), y: readU16LE(value, 3) }
}

function parseArcParams(value: Uint8Array, hasRadius: boolean): ArcParams | undefined {
  if (value.length < (hasRadius ? 14 : 12)) return undefined
  const min = readI32LE(value, 0)
  const max = readI32LE(value, 4)
  const startAngle = readI16LE(value, 8) / 10
  const endAngle = readI16LE(value, 10) / 10
  const width = readU16LE(value, 12)
  const radius = hasRadius && value.length >= 16 ? readU16LE(value, 14) : undefined
  return { min, max, startAngle, endAngle, width, radius }
}

function parseFrameTable(value: Uint8Array): number[] {
  if (value.length < 3) return []
  const count = readU16LE(value, 0)
  const images: number[] = []
  let offset = 6
  for (let i = 0; i < count && offset + 2 <= value.length; i++) {
    images.push(readU16LE(value, offset))
    offset += 2
  }
  return images
}

function parseTLV(data: Uint8Array, start: number, end: number): Widget[] {
  const widgets: Widget[] = []
  let offset = start

  while (offset + 3 <= end) {
    const tag = data[offset]
    const length = readU16LE(data, offset + 1)

    if (offset + 3 + length > end) break

    const value = data.slice(offset + 3, offset + 3 + length)
    const widget: Widget = {
      tag,
      tagName: TAG_NAMES[tag] ?? `unknown_${tag.toString(16)}`,
      offset,
      length,
      raw: value,
    }

    if (isContainer(tag)) {
      widget.children = parseTLV(data, offset + 3, offset + 3 + length)
    } else if (tag === 0x01) {
      Object.assign(widget, parseWidgetStruct(value))
    } else if (tag === 0x05) {
      widget.pivot = parsePivot(value)
    } else if (tag === 0x5a) {
      widget.arc = parseArcParams(value, true)
    } else if (tag === 0x5b) {
      widget.arc = parseArcParams(value, false)
    } else if (tag === 0x61 || (value.length >= 3 && value[0] === 0x61)) {
      const tableStart = value[0] === 0x61 ? 1 : 0
      widget.images = parseFrameTable(value.slice(tableStart))
    }

    if (isContainer(tag) && widget.children) {
      for (const child of widget.children) {
        if (child.tag === 0x01) {
          widget.x = child.x
          widget.y = child.y
          widget.width = child.width
          widget.height = child.height
          widget.sourceId = child.sourceId
          widget.sourceName = child.sourceName
        } else if (child.tag === 0x05) {
          widget.pivot = child.pivot
        } else if (child.tag === 0x5a || child.tag === 0x5b) {
          widget.arc = child.arc
        }
      }
    }

    widgets.push(widget)
    offset += 3 + length
  }

  return widgets
}

function parseResources(data: Uint8Array, resourceStart: number, resourceSize: number): Resource[] {
  const resources: Resource[] = []
  let offset = resourceStart
  let index = 0

  while (offset + 8 <= resourceStart + resourceSize) {
    const header = readU32LE(data, offset)
    const cf = header & 0x1f
    const width = (header >> 10) & 0x7ff
    const height = (header >> 21) & 0x7ff

    if (width === 0 || height === 0) break

    const compressedSize = readU32LE(data, offset + 4)
    if (offset + 8 + compressedSize > data.length) break

    resources.push({
      index,
      offset,
      width,
      height,
      format: cf,
      formatName: FORMAT_NAMES[cf] ?? `cf${cf}`,
      compressedSize,
      data: data.slice(offset + 8, offset + 8 + compressedSize),
    })

    offset += 8 + compressedSize
    index++
  }

  return resources
}

export function parseStructuredDial(data: Uint8Array): StructuredDial {
  const header = parseHeader(data)

  const treeStart = 0x24
  const treeEnd = treeStart + (header.totalSize - header.resourceSize)
  const resourceStart = treeEnd

  const widgets = parseTLV(data, treeStart, treeEnd)
  const tree: Widget = {
    tag: 0x20,
    tagName: 'root',
    offset: 0,
    length: data.length,
    children: widgets,
    raw: new Uint8Array(0),
  }

  const resources = parseResources(data, resourceStart, header.resourceSize)

  return { header, tree, resources, raw: data }
}

export function isStructuredDial(data: Uint8Array): boolean {
  if (data.length < 36) return false
  const version = readU32LE(data, 0x04)
  return version === 0x00000001
}

export function getDataSources(dial: StructuredDial): Array<{ id: number; name: string; widget: Widget }> {
  const sources: Array<{ id: number; name: string; widget: Widget }> = []

  function walk(widgets: Widget[]) {
    for (const w of widgets) {
      if (w.sourceId !== undefined && w.sourceId !== 0) {
        sources.push({
          id: w.sourceId,
          name: w.sourceName ?? `source_${w.sourceId.toString(16)}`,
          widget: w,
        })
      }
      if (w.children) walk(w.children)
    }
  }

  if (dial.tree.children) walk(dial.tree.children)
  return sources
}

export function getWidgetsByTag(dial: StructuredDial, tag: number): Widget[] {
  const result: Widget[] = []

  function walk(widgets: Widget[]) {
    for (const w of widgets) {
      if (w.tag === tag) result.push(w)
      if (w.children) walk(w.children)
    }
  }

  if (dial.tree.children) walk(dial.tree.children)
  return result
}

export function getHands(dial: StructuredDial): Widget[] {
  return getWidgetsByTag(dial, 0x70)
}

export function getProgressArcs(dial: StructuredDial): Widget[] {
  return [...getWidgetsByTag(dial, 0x80), ...getWidgetsByTag(dial, 0x81)]
}

export function summarizeDial(dial: StructuredDial): string {
  const sources = getDataSources(dial)
  const hands = getHands(dial)
  const arcs = getProgressArcs(dial)

  const features: string[] = []

  if (hands.length > 0) features.push(`${hands.length} analog hand${hands.length > 1 ? 's' : ''}`)

  const liveData = sources.filter((s) => ['heart_rate', 'steps', 'battery', 'calories', 'temperature'].includes(s.name))
  if (liveData.length > 0) features.push(`live ${liveData.map((s) => s.name.replace('_', ' ')).join(', ')}`)

  if (arcs.length > 0) features.push(`${arcs.length} progress arc${arcs.length > 1 ? 's' : ''}`)

  return features.length > 0 ? features.join('; ') : 'static watchface'
}
