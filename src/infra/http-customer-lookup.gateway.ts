import { CustomerLookupUnavailableError } from '../application/errors'
import {
  CustomerLookupGateway,
  CustomerLookupResult,
} from '../application/ports/customer-lookup.gateway'

export class HttpCustomerLookupGateway implements CustomerLookupGateway {
  constructor(private readonly baseUrl: string) {}

  async findByDocument(rawDocument: string): Promise<CustomerLookupResult | null> {
    const url = `${this.baseUrl}?document=${encodeURIComponent(rawDocument)}`
    let response: Response
    try {
      response = await fetch(url)
    } catch (error) {
      throw new CustomerLookupUnavailableError((error as Error).message)
    }

    if (response.status === 404) {
      return null
    }
    if (!response.ok) {
      throw new CustomerLookupUnavailableError(`upstream responded with ${response.status}`)
    }

    const body = (await response.json()) as { id?: unknown }
    if (typeof body.id !== 'string') {
      throw new CustomerLookupUnavailableError('upstream response missing id')
    }
    return { id: body.id }
  }
}
