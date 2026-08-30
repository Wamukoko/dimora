export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-KE')
}