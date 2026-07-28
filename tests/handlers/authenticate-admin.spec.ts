import { APIGatewayProxyEventV2 } from 'aws-lambda'
import jwt from 'jsonwebtoken'
import { execute } from '../../src/handlers/authenticate-admin'
import { AuthenticateAdminUseCase } from '../../src/application/use-cases/authenticate-admin.use-case'
import { JwtIssuer } from '../../src/application/services/jwt-issuer'

function eventWith(headers: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth/admin',
    rawPath: '/auth/admin',
    rawQueryString: '',
    headers,
    requestContext: {} as APIGatewayProxyEventV2['requestContext'],
    isBase64Encoded: false,
  }
}

const issuer = new JwtIssuer({ secret: 's', ttlSeconds: 120 })

describe('authenticate-admin handler', () => {
  it('returns 200 with a signed JWT when the api key matches (header is case-insensitive)', () => {
    const useCase = new AuthenticateAdminUseCase('the-key', issuer)

    const res = execute(eventWith({ 'X-Api-Key': 'the-key' }), useCase)

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body as string) as { token: string; expiresIn: number }
    expect(body.expiresIn).toBe(120)
    expect(jwt.verify(body.token, 's')).toMatchObject({ sub: 'admin', role: 'admin' })
  })

  it('accepts the header regardless of case', () => {
    const useCase = new AuthenticateAdminUseCase('the-key', issuer)
    expect(execute(eventWith({ 'x-api-key': 'the-key' }), useCase).statusCode).toBe(200)
  })

  it('returns 401 when the header is missing', () => {
    const useCase = new AuthenticateAdminUseCase('the-key', issuer)
    expect(execute(eventWith({}), useCase).statusCode).toBe(401)
  })

  it('returns 401 when the api key does not match', () => {
    const useCase = new AuthenticateAdminUseCase('the-key', issuer)
    expect(execute(eventWith({ 'X-Api-Key': 'wrong' }), useCase).statusCode).toBe(401)
  })
})
