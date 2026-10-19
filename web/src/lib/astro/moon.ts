/**
 * Moon phase calculations using astronomical algorithms.
 * Based on the synodic month (29.53059 days).
 */

export interface MoonPhase {
  phase: number
  illumination: number
  age: number
  name: string
  emoji: string
}

const SYNODIC_MONTH = 29.53059
const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime()

const PHASE_NAMES = [
  { name: 'New Moon', emoji: '🌑', max: 0.0625 },
  { name: 'Waxing Crescent', emoji: '🌒', max: 0.1875 },
  { name: 'First Quarter', emoji: '🌓', max: 0.3125 },
  { name: 'Waxing Gibbous', emoji: '🌔', max: 0.4375 },
  { name: 'Full Moon', emoji: '🌕', max: 0.5625 },
  { name: 'Waning Gibbous', emoji: '🌖', max: 0.6875 },
  { name: 'Last Quarter', emoji: '🌗', max: 0.8125 },
  { name: 'Waning Crescent', emoji: '🌘', max: 0.9375 },
  { name: 'New Moon', emoji: '🌑', max: 1.0 },
] as const

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const daysSinceKnown = (date.getTime() - KNOWN_NEW_MOON) / (24 * 60 * 60 * 1000)
  const age = daysSinceKnown % SYNODIC_MONTH
  const phase = age / SYNODIC_MONTH

  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100)

  const { name, emoji } = PHASE_NAMES.find((p) => phase < p.max) ?? PHASE_NAMES[0]

  return {
    phase,
    illumination,
    age: Math.round(age * 10) / 10,
    name,
    emoji,
  }
}

export function getMoonPhaseForDate(year: number, month: number, day: number): MoonPhase {
  return getMoonPhase(new Date(year, month - 1, day, 12, 0, 0))
}

export function getNextFullMoon(from: Date = new Date()): Date {
  const current = getMoonPhase(from)
  const daysUntilFull = current.phase < 0.5
    ? (0.5 - current.phase) * SYNODIC_MONTH
    : (1.5 - current.phase) * SYNODIC_MONTH
  return new Date(from.getTime() + daysUntilFull * 24 * 60 * 60 * 1000)
}

export function getNextNewMoon(from: Date = new Date()): Date {
  const current = getMoonPhase(from)
  const daysUntilNew = (1 - current.phase) * SYNODIC_MONTH
  return new Date(from.getTime() + daysUntilNew * 24 * 60 * 60 * 1000)
}
