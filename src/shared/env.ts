import { z } from 'zod'

const schema = z.object({
  JWT_SECRET: z.string().min(1),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  ADMIN_API_KEY: z.string().min(1),
  CUSTOMER_LOOKUP_URL: z.string().url(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) {
    return cached
  }
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${JSON.stringify(parsed.error.format())}`)
  }
  cached = parsed.data
  return cached
}

export function resetEnvCache(): void {
  cached = null
}
