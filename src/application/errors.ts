export class CustomerNotFoundError extends Error {
  constructor(document: string) {
    super(`No active customer found for document ${document}`)
    this.name = 'CustomerNotFoundError'
  }
}

export class CustomerLookupUnavailableError extends Error {
  constructor(reason: string) {
    super(`Customer lookup failed: ${reason}`)
    this.name = 'CustomerLookupUnavailableError'
  }
}

export class InvalidAdminCredentialsError extends Error {
  constructor() {
    super('Invalid admin credentials')
    this.name = 'InvalidAdminCredentialsError'
  }
}
