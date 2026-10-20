import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isOpenableExternalURL, isSamePage, navigationAction } from './external-url.ts'

const page = 'file:///D:/codync/out/renderer/index.html?window=chat'

test('allows web, mail and System Settings links', () => {
  assert.equal(isOpenableExternalURL('https://codync.dev/docs'), true)
  assert.equal(isOpenableExternalURL('http://localhost:3000/'), true)
  assert.equal(isOpenableExternalURL('mailto:someone@example.com'), true)
  assert.equal(isOpenableExternalURL('x-apple.systempreferences:com.apple.preference.security'), true)
})

test('refuses local, script and custom schemes', () => {
  assert.equal(isOpenableExternalURL('file:///C:/Windows/System32/calc.exe'), false)
  assert.equal(isOpenableExternalURL('javascript:alert(1)'), false)
  assert.equal(isOpenableExternalURL('ms-msdt:/id PCWDiagnostic'), false)
})

test('refuses case and surrounding whitespace variants', () => {
  assert.equal(isOpenableExternalURL('HTTPS://codync.dev'), false)
  assert.equal(isOpenableExternalURL('MailTo:someone@example.com'), false)
  assert.equal(isOpenableExternalURL(' https://codync.dev'), false)
  assert.equal(isOpenableExternalURL('https://codync.dev '), false)
  assert.equal(isOpenableExternalURL('\thttps://codync.dev\n'), false)
})

test('refuses empty and non-URL input', () => {
  assert.equal(isOpenableExternalURL(''), false)
  assert.equal(isOpenableExternalURL('codync.dev'), false)
})

test('the chat page itself, including a reload with the same query, stays in the window', () => {
  assert.equal(navigationAction(page, page), 'allow')
  assert.equal(navigationAction('file:///D:/codync/out/renderer/index.html?window=chat', page), 'allow')
  assert.equal(isSamePage('file:///D:/codync/out/renderer/index.html#x', page), true)
})

test('another local file is blocked, never opened outside the app', () => {
  assert.equal(navigationAction('file:///D:/codync/out/renderer/other.html', page), 'block')
  assert.equal(navigationAction('file:///C:/Windows/System32/calc.exe', page), 'block')
})

test('an allowlisted link leaves the app; anything else is blocked', () => {
  assert.equal(navigationAction('https://codync.dev/docs', page), 'open')
  assert.equal(navigationAction('javascript:alert(1)', page), 'block')
  assert.equal(navigationAction('not a url', page), 'block')
  assert.equal(navigationAction('https://codync.dev ', page), 'block')
})

test('the dev server page is matched by origin and path', () => {
  const dev = 'http://localhost:5173/?window=chat'
  assert.equal(navigationAction('http://localhost:5173/?window=chat', dev), 'allow')
  assert.equal(navigationAction('http://localhost:5174/?window=chat', dev), 'open')
})
