import type { shell, WebContents } from 'electron'
import { isOpenableExternalURL, navigationAction } from '../shared/external-url'

type Opener = Pick<typeof shell, 'openExternal'>

/** Scheme and host only: the path and query can carry data that must not reach the log. */
function describeURL(url: string): string {
  try {
    const { protocol, host } = new URL(url)
    return host ? `${protocol}//${host}` : protocol
  } catch {
    return 'unparseable URL'
  }
}

/** Opens a link in the OS browser; a failure is logged, never surfaced as an unhandled rejection. */
export function openLink(opener: Opener, url: string) {
  opener.openExternal(url).catch((e: unknown) => {
    console.error(`link ${describeURL(url)} couldn't open: ${e instanceof Error ? e.message : String(e)}`)
  })
}

/** Keeps a window on `page`: allowlisted links open outside the app, every other navigation is refused. */
export function guardWindowNavigation(webContents: WebContents, page: string, opener: Opener) {
  webContents.setWindowOpenHandler(({ url }) => {
    if (isOpenableExternalURL(url)) openLink(opener, url)
    return { action: 'deny' }
  })
  webContents.on('will-navigate', (e, url) => {
    const action = navigationAction(url, page)
    if (action === 'allow') return
    e.preventDefault()
    if (action === 'open') openLink(opener, url)
  })
}
