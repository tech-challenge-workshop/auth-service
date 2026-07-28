import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { AuthenticateAdminUseCase } from '../application/use-cases/authenticate-admin.use-case'
import { InvalidAdminCredentialsError } from '../application/errors'
import { JwtIssuer } from '../application/services/jwt-issuer'
import { loadEnv } from '../shared/env'
import { json } from '../shared/http-response'

// Async on purpose, even though nothing here awaits. The Lambda Node runtime
// only supports handlers that return a Promise or call the callback: a
// synchronous handler returning a value is never read, and the invocation
// resolves to null with no error at all.
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const env = loadEnv()
  const useCase = new AuthenticateAdminUseCase(
    env.ADMIN_API_KEY,
    new JwtIssuer({ secret: env.JWT_SECRET, ttlSeconds: env.JWT_TTL_SECONDS }),
  )
  return execute(event, useCase)
}

export function execute(
  event: APIGatewayProxyEventV2,
  useCase: AuthenticateAdminUseCase,
): APIGatewayProxyStructuredResultV2 {
  const apiKey = extractApiKey(event.headers)
  try {
    const issued = useCase.execute(apiKey)
    return json(200, issued)
  } catch (error) {
    if (error instanceof InvalidAdminCredentialsError) {
      return json(401, { error: 'Invalid credentials' })
    }
    throw error
  }
}

function extractApiKey(headers: APIGatewayProxyEventV2['headers']): string | undefined {
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (name.toLowerCase() === 'x-api-key' && typeof value === 'string') {
      return value
    }
  }
  return undefined
}
