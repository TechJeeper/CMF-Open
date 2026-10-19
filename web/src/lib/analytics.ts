/** GoatCounter page views and custom events (https://cmf.goatcounter.com). */

declare global {
  interface Window {
    goatcounter?: { count: (args: { path?: string; event?: boolean; title?: string }) => void }
  }
}

export function trackPage(path: string, title?: string) {
  window.goatcounter?.count({ path, title: title ?? document.title })
}

/** Named actions (shown as events in GoatCounter, not page views). */
export function trackEvent(name: string) {
  const path = name.startsWith('event/') ? name : `event/${name}`
  window.goatcounter?.count({ path, event: true })
}
