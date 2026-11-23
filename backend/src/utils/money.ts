/**
 * Currency and monetary math utilities for CHOVIA.
 * All monetary amounts in database & internal contracts are integer minor units (kobo).
 * 100 kobo = 1 NGN.
 */

export const CURRENCY = "NGN";
export const MIN_ORDER_AMOUNT_MINOR = 10000; // 100 NGN
export const DEFAULT_PLATFORM_FEE_MINOR = 10000; // 100 NGN flat service fee
export const BASE_DELIVERY_FEE_MINOR = 50000; // 500 NGN base fee
export const PER_KM_DELIVERY_FEE_MINOR = 10000; // 100 NGN per km

export function formatCurrency(amountMinor: number, currency = CURRENCY): string {
  const major = (amountMinor / 100).toFixed(2);
  return `${currency} ${major}`;
}

export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 2) {
    return BASE_DELIVERY_FEE_MINOR;
  }
  const extraKm = Math.ceil(distanceKm - 2);
  return BASE_DELIVERY_FEE_MINOR + extraKm * PER_KM_DELIVERY_FEE_MINOR;
}

export function calculatePlatformFee(subtotalMinor: number): number {
  // 3% of subtotal or minimum flat fee of 100 NGN
  const percentageFee = Math.round(subtotalMinor * 0.03);
  return Math.max(DEFAULT_PLATFORM_FEE_MINOR, percentageFee);
}
