import { APIGatewayProxyEventV2 } from 'aws-lambda'
import jwt from 'jsonwebtoken'
import { execute } from '../../src/handlers/authenticate-customer'
import { AuthenticateCustomerUseCase } from '../../src/application/use-cases/authenticate-customer.use-case'
import { JwtIssuer } from '../../src/application/services/jwt-issuer'
import {
  CustomerLookupGateway,
  CustomerLookupResult,
} from '../../src/application/ports/customer-lookup.gateway'

function eventWith(body: string | undefined): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth',
    rawPath: '/auth',
    rawQueryString: '',
    headers: {},
    requestContext: {} as APIGatewayProxyEventV2['requestContext'],
    body,
    isBase64Encoded: false,
  }
}

class Gateway implements CustomerLookupGateway {
  constructor(private readonly result: CustomerLookupResult | null | Error) {}
  findByDocument(): Promise<CustomerLookupResult | null> {
    if (this.result instanceof Error) return Promise.reject(this.result)
    return Promise.resolve(this.result)
  }
}

function useCaseWith(gateway: CustomerLookupGateway): AuthenticateCustomerUseCase {
  return new AuthenticateCustomerUseCase(gateway, new JwtIssuer({ secret: 's', ttlSeconds: 60 }))
}

describe('authenticate-customer handler', () => {
  it('returns 200 with a signed JWT on success', async () => {
    const res = await execute(
      eventWith(JSON.stringify({ document: '39053344705' })),
      useCaseWith(new Gateway({ id: 'c-1' })),
    )

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body as string) as { token: string; expiresIn: number }
    expect(body.expiresIn).toBe(60)
    expect(jwt.verify(body.token, 's')).toMatchObject({ sub: 'c-1', role: 'customer' })
  })

  it('returns 400 when the body is missing document', async () => {
    const res = await execute(eventWith(JSON.stringify({})), useCaseWith(new Gateway(null)))
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const res = await execute(eventWith('not-json'), useCaseWith(new Gateway(null)))
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for an invalid document', async () => {
    const res = await execute(
      eventWith(JSON.stringify({ document: '12345678900' })),
      useCaseWith(new Gateway(null)),
    )
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when the customer is not found', async () => {
    const res = await execute(
      eventWith(JSON.stringify({ document: '39053344705' })),
      useCaseWith(new Gateway(null)),
    )
    expect(res.statusCode).toBe(404)
  })

  it('returns 502 when the customer lookup is unavailable', async () => {
    const { CustomerLookupUnavailableError } = await import('../../src/application/errors')
    const res = await execute(
      eventWith(JSON.stringify({ document: '39053344705' })),
      useCaseWith(new Gateway(new CustomerLookupUnavailableError('down'))),
    )
    expect(res.statusCode).toBe(502)
  })
})
