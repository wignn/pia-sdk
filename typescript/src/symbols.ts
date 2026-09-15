import { PiaValidationError } from './errors'

export type MarketAssetClass = 'crypto' | 'forex' | 'metal' | 'index' | 'stock' | 'futures'

export interface MarketCapabilities {
  quote: boolean
  candles: boolean
  trades: boolean
  orderBook: boolean
  options: boolean
  gex: boolean
}

export interface MarketSymbol {
  symbol: string
  assetClass: MarketAssetClass
  exchange?: string
  providerSymbol?: string
  capabilities: MarketCapabilities
}

export function normalizeSymbol(symbol: unknown): string {
  if (typeof symbol !== 'string') {
    throw new PiaValidationError('Symbol must be a non-empty string.', 'symbol')
  }
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    throw new PiaValidationError('Symbol must be a non-empty string.', 'symbol')
  }
  return normalized
}
