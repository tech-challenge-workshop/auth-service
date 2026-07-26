import jwt from 'jsonwebtoken'

export type UserRole = 'admin' | 'customer'

export interface JwtIssuerOptions {
  secret: string
  ttlSeconds: number
}

export interface IssuedToken {
  token: string
  expiresIn: number
}

export class JwtIssuer {
  constructor(private readonly options: JwtIssuerOptions) {}

  issue(sub: string, role: UserRole): IssuedToken {
    const token = jwt.sign({ sub, role }, this.options.secret, {
      algorithm: 'HS256',
      expiresIn: this.options.ttlSeconds,
    })
    return { token, expiresIn: this.options.ttlSeconds }
  }
}
