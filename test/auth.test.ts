import { describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ensureSession, isLoggedOut, toCookieParams } from '../src/auth.js'
import { RenderDragonError } from '../src/errors.js'
import type { CheckBrowser } from '../src/browser/checkBrowser.js'
import type { Cookie, ResolvedTarget } from '../src/types.js'

describe('isLoggedOut', () => {
  it('returns false when the target and final URLs are identical', () => {
    expect(isLoggedOut('https://example.com/app', 'https://example.com/app')).toBe(false)
  })

  it('returns false when the final URL differs but is not a login route', () => {
    expect(isLoggedOut('https://example.com/app', 'https://example.com/dashboard')).toBe(false)
  })

  it('returns false for a trailing-slash difference only', () => {
    expect(isLoggedOut('https://example.com', 'https://example.com/')).toBe(false)
  })

  it('detects a login path redirect', () => {
    expect(isLoggedOut('https://example.com/app', 'https://example.com/login')).toBe(true)
  })

  it('detects a signin path with query params', () => {
    expect(isLoggedOut('https://example.com/app', 'https://example.com/sign-in?next=%2Fapp')).toBe(true)
  })

  it('detects an identity host redirect', () => {
    expect(isLoggedOut('https://example.com/app', 'https://login.example.com/')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isLoggedOut('https://example.com/app', 'https://example.com/LOGIN')).toBe(true)
  })

  it('returns false for malformed URLs', () => {
    expect(isLoggedOut('not a url', 'also not a url')).toBe(false)
  })

  it('does not treat a path merely containing "auth" as a logout', () => {
    expect(isLoggedOut('https://example.com/app', 'https://example.com/author/book')).toBe(false)
  })
})

describe('toCookieParams', () => {
  it('maps the required fields', () => {
    const cookies: Cookie[] = [{ name: 'sid', value: 'abc', domain: '.example.com' }]
    expect(toCookieParams(cookies)).toEqual([{ name: 'sid', value: 'abc', domain: '.example.com' }])
  })

  it('passes through optional fields when present', () => {
    const cookies: Cookie[] = [
      {
        name: 'sid',
        value: 'abc',
        domain: '.example.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]
    expect(toCookieParams(cookies)).toEqual([
      {
        name: 'sid',
        value: 'abc',
        domain: '.example.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ])
  })

  it('omits optional fields that are absent', () => {
    const cookies: Cookie[] = [{ name: 'bare', value: '1', domain: 'example.com' }]
    const [param] = toCookieParams(cookies)
    expect(param).toEqual({ name: 'bare', value: '1', domain: 'example.com' })
    expect('path' in param!).toBe(false)
    expect('secure' in param!).toBe(false)
  })

  it('returns an empty array for no cookies', () => {
    expect(toCookieParams([])).toEqual([])
  })
})

// ---- Browser-dependent tests, skipped unless a Chrome binary is provided. ----

const CHROME_PATH = process.env.RENDERDRAGON_CHROME_PATH

function makeTarget(overrides: Partial<ResolvedTarget> = {}): ResolvedTarget {
  return {
    url: 'about:blank',
    runs: 1,
    throttle: 'desktop',
    viewport: { width: 1280, height: 800 },
    headers: {},
    cookies: [],
    checks: [],
    outputDir: 'ignored',
    detailRows: 20,
    ...overrides,
  }
}

async function startServer(
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  }
}

describe.skipIf(!CHROME_PATH)('ensureSession (browser)', () => {
  async function newBrowser() {
    const { launch } = await import('puppeteer-core')
    const browser = await launch({ executablePath: CHROME_PATH, headless: true, args: ['--no-sandbox'] })
    const page = await browser.newPage()
    const checkBrowser: CheckBrowser = { page, close: () => browser.close() }
    return { browser, checkBrowser }
  }

  it('applies headers, cookies, and viewport, and returns the loaded page', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(`header=${req.headers['x-renderdragon-test'] ?? ''} cookie=${req.headers.cookie ?? ''}`)
    })
    const { browser, checkBrowser } = await newBrowser()
    try {
      const loaded = await ensureSession(
        checkBrowser,
        makeTarget({
          url: `${server.url}/app`,
          headers: { 'X-RenderDragon-Test': '1' },
          cookies: [{ name: 'sid', value: 'abc', domain: '127.0.0.1', path: '/' }],
        }),
      )
      const body = await loaded.evaluate(() => document.body.innerText)
      expect(body).toContain('header=1')
      expect(body).toContain('sid=abc')
    } finally {
      await browser.close()
      await server.close()
    }
  })

  it('throws AUTH_EXPIRED when logged out and no refreshAuth is supplied', async () => {
    const server = await startServer((req, res) => {
      if (req.url === '/login') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body>login</body></html>')
      } else {
        res.writeHead(302, { Location: '/login' })
        res.end()
      }
    })
    const { browser, checkBrowser } = await newBrowser()
    try {
      await expect(ensureSession(checkBrowser, makeTarget({ url: `${server.url}/app` }))).rejects.toMatchObject({
        code: 'AUTH_EXPIRED',
        name: 'RenderDragonError',
      })
    } finally {
      await browser.close()
      await server.close()
    }
  })

  it('refreshes once and succeeds when the refreshed cookie unlocks the app', async () => {
    const server = await startServer((req, res) => {
      if (req.url === '/login') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body>login</body></html>')
      } else if ((req.headers.cookie ?? '').includes('sid=good')) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body>app</body></html>')
      } else {
        res.writeHead(302, { Location: '/login' })
        res.end()
      }
    })
    const { browser, checkBrowser } = await newBrowser()
    let refreshCalls = 0
    try {
      const loaded = await ensureSession(
        checkBrowser,
        makeTarget({
          url: `${server.url}/app`,
          refreshAuth: async () => {
            refreshCalls += 1
            return { cookies: [{ name: 'sid', value: 'good', domain: '127.0.0.1', path: '/' }] }
          },
        }),
      )
      expect(refreshCalls).toBe(1)
      expect(await loaded.evaluate(() => document.body.innerText)).toBe('app')
    } finally {
      await browser.close()
      await server.close()
    }
  })

  it('throws AUTH_EXPIRED after one failed refresh', async () => {
    const server = await startServer((req, res) => {
      if (req.url === '/login') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body>login</body></html>')
      } else {
        res.writeHead(302, { Location: '/login' })
        res.end()
      }
    })
    const { browser, checkBrowser } = await newBrowser()
    let refreshCalls = 0
    try {
      await expect(
        ensureSession(
          checkBrowser,
          makeTarget({
            url: `${server.url}/app`,
            refreshAuth: async () => {
              refreshCalls += 1
              return { cookies: [{ name: 'sid', value: 'still-bad', domain: '127.0.0.1', path: '/' }] }
            },
          }),
        ),
      ).rejects.toBeInstanceOf(RenderDragonError)
      expect(refreshCalls).toBe(1)
    } finally {
      await browser.close()
      await server.close()
    }
  })
})
