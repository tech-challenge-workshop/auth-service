import {
  Document,
  DocumentType,
  InvalidDocumentError,
} from '../../src/domain/value-objects/document'

describe('Document', () => {
  it('accepts a valid CPF, masked or unmasked', () => {
    expect(Document.create('39053344705').type).toBe(DocumentType.CPF)
    expect(Document.create('390.533.447-05').value).toBe('39053344705')
  })

  it('accepts a valid CNPJ, masked or unmasked', () => {
    expect(Document.create('11222333000181').type).toBe(DocumentType.CNPJ)
    expect(Document.create('11.222.333/0001-81').value).toBe('11222333000181')
  })

  it('rejects documents with wrong check digits', () => {
    expect(() => Document.create('12345678900')).toThrow(InvalidDocumentError)
    expect(() => Document.create('11222333000100')).toThrow(InvalidDocumentError)
  })

  it('rejects same-digit sequences', () => {
    expect(() => Document.create('00000000000')).toThrow(InvalidDocumentError)
    expect(() => Document.create('11111111111111')).toThrow(InvalidDocumentError)
  })

  it('rejects non-numeric input and wrong-length strings', () => {
    expect(() => Document.create('abc')).toThrow(InvalidDocumentError)
    expect(() => Document.create('1234')).toThrow(InvalidDocumentError)
  })
})
