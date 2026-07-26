import { HttpCustomerLookupGateway } from '../../src/infra/http-customer-lookup.gateway'
import { CustomerLookupUnavailableError } from '../../src/application/errors'

describe('HttpCustomerLookupGateway', () => {
  const url = 'http://work-order.test/customers/lookup'

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns the customer id on 200', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'c-1' }),
    } as Response)

    const gateway = new HttpCustomerLookupGateway(url)

    await expect(gateway.findByDocument('39053344705')).resolves.toEqual({ id: 'c-1' })
  })

  it('encodes the document into the query string', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'c-1' }),
    } as Response)

    await new HttpCustomerLookupGateway(url).findByDocument('390.533.447-05')

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://work-order.test/customers/lookup?document=390.533.447-05',
    )
  })

  it('returns null on 404', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(new HttpCustomerLookupGateway(url).findByDocument('x')).resolves.toBeNull()
  })

  it('throws CustomerLookupUnavailableError on other non-ok statuses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(new HttpCustomerLookupGateway(url).findByDocument('x')).rejects.toThrow(
      CustomerLookupUnavailableError,
    )
  })

  it('throws CustomerLookupUnavailableError when fetch itself fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(new HttpCustomerLookupGateway(url).findByDocument('x')).rejects.toThrow(
      /ECONNREFUSED/,
    )
  })

  it('throws when the upstream response is missing the id field', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)
    await expect(new HttpCustomerLookupGateway(url).findByDocument('x')).rejects.toThrow(
      /missing id/,
    )
  })
})
