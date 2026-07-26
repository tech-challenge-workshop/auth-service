import { timingSafeEqual } from 'node:crypto'
import { InvalidAdminCredentialsError } from '../errors'
import { IssuedToken, JwtIssuer } from '../services/jwt-issuer'

export class AuthenticateAdminUseCase {
  constructor(
    private readonly expectedApiKey: string,
    private readonly jwtIssuer: JwtIssuer,
  ) {}

  execute(providedApiKey: string | undefined): IssuedToken {
    if (!providedApiKey || !this.matches(providedApiKey)) {
      throw new InvalidAdminCredentialsError()
    }
    return this.jwtIssuer.issue('admin', 'admin')
  }

  private matches(provided: string): boolean {
    const expected = Buffer.from(this.expectedApiKey)
    const providedBuffer = Buffer.from(provided)
    if (expected.length !== providedBuffer.length) {
      return false
    }
    return timingSafeEqual(expected, providedBuffer)
  }
}
