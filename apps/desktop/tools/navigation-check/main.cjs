// Isolated F6 check: real guard module (guard.cjs), temp userData, local pages, stubbed shell.openExternal.
// No host.start(), no updater, no login, no service install.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { guardWindowNavigation } = require('./guard.cjs')

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'codync-f6-')))

const results = []
const unhandled = []
process.on('unhandledRejection', (reason) => unhandled.push(String(reason)))

const opened = []
let failNextOpen = false
const fakeShell = {
  openExternal(url) {
    opened.push(url)
    return failNextOpen ? Promise.reject(new Error('stubbed openExternal failure')) : Promise.resolve()
  },
}

const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const base = pathToFileURL(path.join(__dirname, 'page.html')).href
const pageURL = `${base}?window=chat`

function finish(code) {
  console.log(JSON.stringify({ results, opened, unhandled }, null, 2))
  app.exit(code)
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => finish(2), 60000)
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
  const wc = win.webContents
  guardWindowNavigation(wc, pageURL, fakeShell)
  const click = (id) => wc.executeJavaScript(`document.getElementById('${id}').click()`, true)
  const here = () => wc.getURL()
  const onPage = () => here().startsWith(base) && !here().includes('other.html') && !here().includes('codync.dev')

  await win.loadURL(pageURL)
  check('page loads with its title', (await wc.executeJavaScript('document.title')) === 'f6-test')
  check('initial URL is the chat page', here() === pageURL, here())

  wc.reload()
  await new Promise((r) => wc.once('did-finish-load', r))
  check('reload keeps the chat page', onPage() && here().endsWith('window=chat'), here())
  check('reload opens nothing', opened.length === 0, JSON.stringify(opened))

  await click('same')
  await wait(400)
  check('same page with a new query stays in the window', here().includes('x=1') && onPage(), here())

  await click('hash')
  await wait(200)
  check('in-page hash change stays in the window', here().endsWith('#sec') && onPage(), here())
  check('query and hash changes open nothing', opened.length === 0, JSON.stringify(opened))

  await click('ext')
  await wait(400)
  check('allowlisted link opens once outside', opened.length === 1 && opened[0] === 'https://codync.dev/docs', JSON.stringify(opened))
  check('allowlisted link does not navigate the window', onPage(), here())

  await click('ms')
  await wait(400)
  check('custom scheme is blocked, not opened', opened.length === 1 && onPage(), `${JSON.stringify(opened)} ${here()}`)

  await wc.executeJavaScript(`location.href = new URL('other.html', location.href).href`, true)
  await wait(400)
  check('other local file navigation is blocked', onPage(), here())
  check('blocked local navigation opens nothing', opened.length === 1, JSON.stringify(opened))

  await wc.executeJavaScript(`window.open('https://codync.dev/win')`, true)
  await wait(400)
  check('window.open allowlisted URL opens once', opened.length === 2 && opened[1] === 'https://codync.dev/win', JSON.stringify(opened))

  await wc.executeJavaScript(`window.open('file:///C:/Windows/win.ini')`, true)
  await wait(400)
  check('window.open file URL is denied and not opened', opened.length === 2, JSON.stringify(opened))

  failNextOpen = true
  await click('ext')
  await wait(400)
  check('failed openExternal is attempted', opened.length === 3, JSON.stringify(opened))
  check('failed openExternal leaves no unhandled rejection', unhandled.length === 0, JSON.stringify(unhandled))
  check('failed openExternal keeps the window on the page', onPage(), here())

  clearTimeout(timer)
  finish(results.every((r) => r.ok) && unhandled.length === 0 ? 0 : 1)
})
