import type { shell, WebContents } from 'electron'
import { isOpenableExternalURL, navigationAction } from '../shared/external-url'

type Opener = Pick<typeof shell, 'openExternal'>

/** Opens a link in the OS browser; a failure must not surface as an unhandled rejection. */
export function openLink(opener: Opener, url: string) {
  opener.openExternal(url).catch(() => {})
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
