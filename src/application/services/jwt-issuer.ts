import jwt from 'jsonwebtoken'

export type UserRole = 'admin' | 'customer'

export interface JwtIssuerOptions {
  secret: string
  ttlSeconds: number
  issuer?: string
}

export interface IssuedToken {
  token: string
  expiresIn: number
}

export const DEFAULT_ISSUER = 'auth-service'

export class JwtIssuer {
  constructor(private readonly options: JwtIssuerOptions) {}

  issue(sub: string, role: UserRole): IssuedToken {
    const token = jwt.sign({ sub, role }, this.options.secret, {
      algorithm: 'HS256',
      expiresIn: this.options.ttlSeconds,
      issuer: this.options.issuer ?? DEFAULT_ISSUER,
    })
    return { token, expiresIn: this.options.ttlSeconds }
  }
}
