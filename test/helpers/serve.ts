import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

export interface ServedSite {
  url: string
  close(): Promise<void>
}

/** Serves a directory over http on an ephemeral port for integration tests. */
export async function serveDir(dir: string): Promise<ServedSite> {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      const rel = pathname === '/' ? '/index.html' : pathname
      const filePath = join(dir, normalize(rel).replace(/^[/\\]+/, ''))
      if (!filePath.startsWith(dir)) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }
      const body = await readFile(filePath)
      res.writeHead(200, { 'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}
