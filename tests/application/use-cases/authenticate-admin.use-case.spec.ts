import jwt from 'jsonwebtoken'
import { AuthenticateAdminUseCase } from '../../../src/application/use-cases/authenticate-admin.use-case'
import { InvalidAdminCredentialsError } from '../../../src/application/errors'
import { JwtIssuer } from '../../../src/application/services/jwt-issuer'

describe('AuthenticateAdminUseCase', () => {
  const issuer = new JwtIssuer({ secret: 'test-secret', ttlSeconds: 120 })

  it('issues an admin JWT when the api key matches', () => {
    const useCase = new AuthenticateAdminUseCase('super-secret-key', issuer)

    const issued = useCase.execute('super-secret-key')

    const payload = jwt.verify(issued.token, 'test-secret') as { sub: string; role: string }
    expect(payload).toMatchObject({ sub: 'admin', role: 'admin' })
    expect(issued.expiresIn).toBe(120)
  })

  it('rejects when the api key is missing', () => {
    const useCase = new AuthenticateAdminUseCase('super-secret-key', issuer)
    expect(() => useCase.execute(undefined)).toThrow(InvalidAdminCredentialsError)
  })

  it('rejects when the api key does not match, even if the length differs', () => {
    const useCase = new AuthenticateAdminUseCase('super-secret-key', issuer)
    expect(() => useCase.execute('wrong')).toThrow(InvalidAdminCredentialsError)
    expect(() => useCase.execute('super-secret-KEY')).toThrow(InvalidAdminCredentialsError)
  })
})
