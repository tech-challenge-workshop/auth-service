import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { z } from 'zod'
import { AuthenticateCustomerUseCase } from '../application/use-cases/authenticate-customer.use-case'
import { CustomerLookupUnavailableError, CustomerNotFoundError } from '../application/errors'
import { InvalidDocumentError } from '../domain/value-objects/document'
import { JwtIssuer } from '../application/services/jwt-issuer'
import { HttpCustomerLookupGateway } from '../infra/http-customer-lookup.gateway'
import { loadEnv } from '../shared/env'
import { json } from '../shared/http-response'

const bodySchema = z.object({ document: z.string().min(1) })

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const env = loadEnv()
  const useCase = new AuthenticateCustomerUseCase(
    new HttpCustomerLookupGateway(env.CUSTOMER_LOOKUP_URL),
    new JwtIssuer({ secret: env.JWT_SECRET, ttlSeconds: env.JWT_TTL_SECONDS }),
  )
  return execute(event, useCase)
}

export async function execute(
  event: APIGatewayProxyEventV2,
  useCase: AuthenticateCustomerUseCase,
): Promise<APIGatewayProxyStructuredResultV2> {
  const parsed = parseBody(event.body)
  if (!parsed.success) {
    return json(400, { error: 'Invalid body', details: parsed.error.format() })
  }

  try {
    const issued = await useCase.execute(parsed.data.document)
    return json(200, issued)
  } catch (error) {
    if (error instanceof InvalidDocumentError) {
      return json(400, { error: 'Invalid document' })
    }
    if (error instanceof CustomerNotFoundError) {
      return json(404, { error: 'Customer not found' })
    }
    if (error instanceof CustomerLookupUnavailableError) {
      return json(502, { error: 'Customer lookup failed' })
    }
    throw error
  }
}

function parseBody(raw: string | undefined) {
  try {
    return bodySchema.safeParse(JSON.parse(raw ?? '{}'))
  } catch {
    return {
      success: false,
      error: { format: () => ({ _errors: ['body is not valid JSON'] }) },
    } as const
  }
}
