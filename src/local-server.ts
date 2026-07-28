/**
 * Minimal Node HTTP wrapper that exposes the two Lambda handlers as regular
 * HTTP endpoints. Used both for local development (replaces the broken
 * serverless-offline boot on Node 22+) and inside the container image
 * deployed to Kubernetes.
 */

import { createServer, IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { handler as authenticateAdmin } from './handlers/authenticate-admin.handler'
import { handler as authenticateCustomer } from './handlers/authenticate-customer.handler'
import { loadEnv } from './shared/env'

type LambdaHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2> | APIGatewayProxyStructuredResultV2

const routes: Record<string, LambdaHandler> = {
  'POST /auth': authenticateCustomer,
  'POST /auth/admin': authenticateAdmin,
}

function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') out[k] = v
    else if (Array.isArray(v)) out[k] = v.join(', ')
  }
  return out
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

function toEvent(req: IncomingMessage, body: string): APIGatewayProxyEventV2 {
  const url = new URL(req.url ?? '/', 'http://localhost')
  return {
    version: '2.0',
    routeKey: `${req.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: normalizeHeaders(req.headers),
    requestContext: {} as APIGatewayProxyEventV2['requestContext'],
    body: body.length > 0 ? body : undefined,
    isBase64Encoded: false,
  }
}

function send(res: ServerResponse, result: APIGatewayProxyStructuredResultV2): void {
  const status = result.statusCode ?? 200
  const headers = result.headers ?? { 'content-type': 'application/json' }
  res.writeHead(status, headers as Record<string, string>)
  res.end(result.body ?? '')
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'auth-service' }))
    return
  }

  const handler = routes[`${req.method ?? ''} ${url.pathname}`]
  if (!handler) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const body = await readBody(req)
  const event = toEvent(req, body)
  try {
    const result = await handler(event)
    send(res, result)
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal error', message: (err as Error).message }))
  }
}

loadEnv()

const port = Number(process.env.PORT ?? 3003)
const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('unhandled error', err)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end()
    }
  })
})

server.listen(port, () => {
  console.log(`auth-service listening on :${port}`)
})
