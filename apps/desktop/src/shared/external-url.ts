const OPENABLE_EXTERNAL_URL = /^(https?|mailto|x-apple\.systempreferences):/

export type NavigationAction = 'allow' | 'open' | 'block'

/** Only these schemes may leave the app for the OS; file:, javascript:, custom schemes and any casing or padding variant are refused. */
export function isOpenableExternalURL(url: string): boolean {
  return url === url.trim() && OPENABLE_EXTERNAL_URL.test(url)
}

/** Whether `url` loads the renderer `page` again (a reload or a query change), not some other page. */
export function isSamePage(url: string, page: string): boolean {
  try {
    const target = new URL(url)
    const own = new URL(page)
    if (own.protocol === 'file:') return target.protocol === 'file:' && target.pathname === own.pathname
    return target.origin === own.origin && target.pathname === own.pathname
  } catch {
    return false
  }
}

/** What the chat window does with a navigation: stay, open the link outside the app, or refuse it. */
export function navigationAction(url: string, page: string): NavigationAction {
  if (isSamePage(url, page)) return 'allow'
  return isOpenableExternalURL(url) ? 'open' : 'block'
}
