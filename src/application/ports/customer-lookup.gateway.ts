export interface CustomerLookupResult {
  id: string
}

export interface CustomerLookupGateway {
  findByDocument(rawDocument: string): Promise<CustomerLookupResult | null>
}
