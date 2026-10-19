const DISMISS_KEY = 'cmf.pwa.mobilePromptDismissed'

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Phone-sized layout or coarse pointer (not a precise desktop mouse). */
export function isMobileLayout() {
  return window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1024px)').matches
}

export function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function mobilePromptDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY))
    if (!t) return false
    // Ask again after two weeks in case they skipped by mistake.
    return Date.now() - t < 14 * 864e5
  } catch {
    return false
  }
}

export function dismissMobilePrompt() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()))
}
