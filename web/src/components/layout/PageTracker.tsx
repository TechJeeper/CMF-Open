import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPage } from '@/lib/analytics'
import { analyticsPath, applyDocumentMeta, seoForPath } from '@/lib/seo'

/** Updates title or meta for the current hash route and sends a GoatCounter page view. */
export function PageTracker() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    const seo = seoForPath(pathname)
    applyDocumentMeta(seo.title, seo.description)
    trackPage(analyticsPath(pathname, search), seo.title)
  }, [pathname, search])

  return null
}
