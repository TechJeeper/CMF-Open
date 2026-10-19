import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

export const DEFAULT_TITLE = `${SITE_NAME} — apps & watchfaces for CMF Watch`

/** Hash-route paths from react-router (no leading #). */
export const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  '/': {
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
  },
  '/library': {
    title: `My apps · ${SITE_NAME}`,
    description: 'Apps you installed on this device for your CMF Watch.',
  },
  '/sideload': {
    title: `Sideload an app · ${SITE_NAME}`,
    description: 'Install a custom app from a URL or paste JavaScript for your CMF Watch.',
  },
  '/watchfaces': {
    title: `Watchfaces · ${SITE_NAME}`,
    description: 'Generative and live watchfaces, or upload your own photo for your CMF Watch.',
  },
  '/develop': {
    title: `Develop · ${SITE_NAME}`,
    description: 'Write and test CMF Watch apps in the browser playground.',
  },
}

export function seoForPath(pathname: string) {
  if (ROUTE_SEO[pathname]) return ROUTE_SEO[pathname]
  const app = pathname.match(/^\/app\/([^/]+)/)
  if (app) {
    return {
      title: `${decodeURIComponent(app[1])} · ${SITE_NAME}`,
      description: SITE_DESCRIPTION,
    }
  }
  return ROUTE_SEO['/']
}

export function analyticsPath(pathname: string, search: string) {
  const base = pathname || '/'
  const q = search ? search.replace(/^\?/, '') : ''
  return q ? `${base}?${q}` : base
}

export function applyDocumentMeta(title: string, description: string) {
  document.title = title
  const set = (sel: string, attr: 'content' | 'href', val: string) => {
    const el = document.querySelector(sel)
    if (el) el.setAttribute(attr, val)
  }
  set('meta[name="description"]', 'content', description)
  set('meta[property="og:title"]', 'content', title)
  set('meta[property="og:description"]', 'content', description)
  set('meta[name="twitter:title"]', 'content', title)
  set('meta[name="twitter:description"]', 'content', description)
}
