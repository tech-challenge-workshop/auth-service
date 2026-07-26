import { Document } from '../../domain/value-objects/document'
import { CustomerNotFoundError } from '../errors'
import { CustomerLookupGateway } from '../ports/customer-lookup.gateway'
import { IssuedToken, JwtIssuer } from '../services/jwt-issuer'

export class AuthenticateCustomerUseCase {
  constructor(
    private readonly customerLookup: CustomerLookupGateway,
    private readonly jwtIssuer: JwtIssuer,
  ) {}

  async execute(rawDocument: string): Promise<IssuedToken> {
    const document = Document.create(rawDocument)
    const customer = await this.customerLookup.findByDocument(document.value)
    if (!customer) {
      throw new CustomerNotFoundError(document.value)
    }
    return this.jwtIssuer.issue(customer.id, 'customer')
  }
}
