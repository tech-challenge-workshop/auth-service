export enum DocumentType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

const CPF_LENGTH = 11
const CNPJ_LENGTH = 14

const CPF_WEIGHTS = [
  [10, 9, 8, 7, 6, 5, 4, 3, 2],
  [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
]

const CNPJ_WEIGHTS = [
  [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
]

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

function hasValidCheckDigits(digits: string, weightTable: number[][]): boolean {
  const [firstWeights, secondWeights] = weightTable
  const base = digits.slice(0, digits.length - 2)
  const firstDigit = checkDigit(base, firstWeights)
  const secondDigit = checkDigit(`${base}${firstDigit}`, secondWeights)
  return `${firstDigit}${secondDigit}` === digits.slice(-2)
}

function isSameDigitSequence(digits: string): boolean {
  return /^(\d)\1+$/.test(digits)
}

export class InvalidDocumentError extends Error {
  constructor(raw: string) {
    super(`Invalid CPF/CNPJ document: ${raw}`)
    this.name = 'InvalidDocumentError'
  }
}

export class Document {
  private constructor(
    readonly value: string,
    readonly type: DocumentType,
  ) {}

  static create(raw: string): Document {
    const digits = raw.replace(/[.\-/\s]/g, '')

    if (!/^\d+$/.test(digits) || isSameDigitSequence(digits)) {
      throw new InvalidDocumentError(raw)
    }

    if (digits.length === CPF_LENGTH && hasValidCheckDigits(digits, CPF_WEIGHTS)) {
      return new Document(digits, DocumentType.CPF)
    }

    if (digits.length === CNPJ_LENGTH && hasValidCheckDigits(digits, CNPJ_WEIGHTS)) {
      return new Document(digits, DocumentType.CNPJ)
    }

    throw new InvalidDocumentError(raw)
  }
}
