/**
 * Sunrise/sunset calculations using the NOAA algorithm.
 * Simplified version for reasonable accuracy (±2 minutes).
 */

export interface SunTimes {
  sunrise: Date
  sunset: Date
  dayLength: number
  solarNoon: Date
}

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

function julianCentury(jd: number): number {
  return (jd - 2451545) / 36525
}

function sunMeanLongitude(t: number): number {
  return (280.46646 + t * (36000.76983 + 0.0003032 * t)) % 360
}

function sunMeanAnomaly(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t)
}

function eccentricity(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
}

function sunEqOfCenter(t: number): number {
  const m = sunMeanAnomaly(t) * DEG
  return Math.sin(m) * (1.9146 - t * (0.004817 + 0.000014 * t)) +
         Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
         Math.sin(3 * m) * 0.00029
}

function sunTrueLongitude(t: number): number {
  return sunMeanLongitude(t) + sunEqOfCenter(t)
}

function sunApparentLongitude(t: number): number {
  const o = sunTrueLongitude(t)
  const omega = 125.04 - 1934.136 * t
  return o - 0.00569 - 0.00478 * Math.sin(omega * DEG)
}

function meanObliquity(t: number): number {
  return 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
}

function obliquityCorrection(t: number): number {
  const e0 = meanObliquity(t)
  const omega = 125.04 - 1934.136 * t
  return e0 + 0.00256 * Math.cos(omega * DEG)
}

function sunDeclination(t: number): number {
  const e = obliquityCorrection(t) * DEG
  const lambda = sunApparentLongitude(t) * DEG
  return Math.asin(Math.sin(e) * Math.sin(lambda)) * RAD
}

function equationOfTime(t: number): number {
  const e = eccentricity(t)
  const m = sunMeanAnomaly(t) * DEG
  const l0 = sunMeanLongitude(t) * DEG
  const y = Math.tan((obliquityCorrection(t) / 2) * DEG) ** 2

  return 4 * RAD * (
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m)
  )
}

function hourAngle(lat: number, decl: number, zenith = 90.833): number {
  const latRad = lat * DEG
  const declRad = decl * DEG
  const cos_ha = (Math.cos(zenith * DEG) / (Math.cos(latRad) * Math.cos(declRad))) -
                 Math.tan(latRad) * Math.tan(declRad)
  if (cos_ha > 1) return NaN
  if (cos_ha < -1) return NaN
  return Math.acos(cos_ha) * RAD
}

export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
  const jd = julianDay(date)
  const t = julianCentury(jd)
  const eqTime = equationOfTime(t)
  const decl = sunDeclination(t)
  const ha = hourAngle(lat, decl)

  const solarNoonMinutes = 720 - 4 * lon - eqTime
  const sunriseMinutes = solarNoonMinutes - ha * 4
  const sunsetMinutes = solarNoonMinutes + ha * 4

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)

  const tzOffset = date.getTimezoneOffset()

  return {
    sunrise: new Date(dayStart.getTime() + (sunriseMinutes + tzOffset) * 60000),
    sunset: new Date(dayStart.getTime() + (sunsetMinutes + tzOffset) * 60000),
    solarNoon: new Date(dayStart.getTime() + (solarNoonMinutes + tzOffset) * 60000),
    dayLength: (sunsetMinutes - sunriseMinutes) / 60,
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
