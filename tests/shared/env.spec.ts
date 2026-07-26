import { loadEnv, resetEnvCache } from '../../src/shared/env'

describe('loadEnv', () => {
  beforeEach(() => resetEnvCache())

  it('parses a valid environment', () => {
    const env = loadEnv({
      JWT_SECRET: 'secret',
      ADMIN_API_KEY: 'key',
      CUSTOMER_LOOKUP_URL: 'http://localhost:3000/customers/lookup',
    } as NodeJS.ProcessEnv)

    expect(env.JWT_TTL_SECONDS).toBe(86400)
    expect(env.CUSTOMER_LOOKUP_URL).toBe('http://localhost:3000/customers/lookup')
  })

  it('caches the parsed env between calls', () => {
    const first = loadEnv({
      JWT_SECRET: 'a',
      ADMIN_API_KEY: 'b',
      CUSTOMER_LOOKUP_URL: 'http://x/lookup',
    } as NodeJS.ProcessEnv)
    const second = loadEnv({
      JWT_SECRET: 'other',
      ADMIN_API_KEY: 'other',
      CUSTOMER_LOOKUP_URL: 'http://other/lookup',
    } as NodeJS.ProcessEnv)
    expect(second).toBe(first)
  })

  it('throws when required variables are missing', () => {
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow(/Invalid environment/)
  })
})
