export function isValidAssetQuantity(quantity: unknown): quantity is number {
  return typeof quantity === 'number'
    && Number.isFinite(quantity)
    && Number.isInteger(quantity)
    && quantity >= 1
}
