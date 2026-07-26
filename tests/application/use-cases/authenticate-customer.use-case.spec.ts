import jwt from 'jsonwebtoken'
import { AuthenticateCustomerUseCase } from '../../../src/application/use-cases/authenticate-customer.use-case'
import { CustomerNotFoundError } from '../../../src/application/errors'
import { InvalidDocumentError } from '../../../src/domain/value-objects/document'
import { JwtIssuer } from '../../../src/application/services/jwt-issuer'
import {
  CustomerLookupGateway,
  CustomerLookupResult,
} from '../../../src/application/ports/customer-lookup.gateway'

class FakeGateway implements CustomerLookupGateway {
  constructor(private readonly result: CustomerLookupResult | null) {}
  findByDocument(): Promise<CustomerLookupResult | null> {
    return Promise.resolve(this.result)
  }
}

describe('AuthenticateCustomerUseCase', () => {
  const issuer = new JwtIssuer({ secret: 'test-secret', ttlSeconds: 60 })

  it('issues a customer JWT with the customer id as sub', async () => {
    const useCase = new AuthenticateCustomerUseCase(new FakeGateway({ id: 'c-1' }), issuer)

    const issued = await useCase.execute('39053344705')

    expect(issued.expiresIn).toBe(60)
    const payload = jwt.verify(issued.token, 'test-secret') as {
      sub: string
      role: string
      exp: number
    }
    expect(payload).toMatchObject({ sub: 'c-1', role: 'customer' })
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('rejects an invalid document', async () => {
    const useCase = new AuthenticateCustomerUseCase(new FakeGateway(null), issuer)
    await expect(useCase.execute('12345678900')).rejects.toThrow(InvalidDocumentError)
  })

  it('throws CustomerNotFoundError when lookup returns null', async () => {
    const useCase = new AuthenticateCustomerUseCase(new FakeGateway(null), issuer)
    await expect(useCase.execute('39053344705')).rejects.toThrow(CustomerNotFoundError)
  })
})
