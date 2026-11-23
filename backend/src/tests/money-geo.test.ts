import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  calculatePlatformFee,
  calculateDeliveryFee,
  BASE_DELIVERY_FEE_MINOR,
} from "../utils/money.js";
import { calculateHaversineDistanceKm } from "../utils/geo.js";

describe("Monetary & Currency Utilities", () => {
  it("should format minor currency units into human-readable NGN string", () => {
    expect(formatCurrency(10000)).toBe("NGN 100.00");
    expect(formatCurrency(250050)).toBe("NGN 2500.50");
    expect(formatCurrency(0)).toBe("NGN 0.00");
  });

  it("should calculate platform fees with minimum threshold", () => {
    // 3% of 1000 NGN (100000 kobo) = 30 NGN (3000 kobo).
    // Minimum fee is 10000 kobo (100 NGN).
    expect(calculatePlatformFee(100000)).toBe(10000);

    // 3% of 10,000 NGN (1,000,000 kobo) = 300 NGN (30,000 kobo).
    expect(calculatePlatformFee(1000000)).toBe(30000);
  });

  it("should calculate delivery fees based on distance", () => {
    // Distance <= 2km = base delivery fee (500 NGN = 50000 kobo)
    expect(calculateDeliveryFee(1.5)).toBe(BASE_DELIVERY_FEE_MINOR);
    expect(calculateDeliveryFee(2.0)).toBe(BASE_DELIVERY_FEE_MINOR);

    // Distance 4.5km = base fee + 3 extra km * 100 NGN = 500 + 300 = 800 NGN (80000 kobo)
    expect(calculateDeliveryFee(4.5)).toBe(80000);
  });
});

describe("Geospatial Haversine Distance Calculations", () => {
  it("should calculate distance between two coordinates", () => {
    // Coordinates in Lagos: Ikeja (6.6018, 3.3515) to Victoria Island (6.4281, 3.4219)
    const distanceKm = calculateHaversineDistanceKm(6.6018, 3.3515, 6.4281, 3.4219);
    expect(distanceKm).toBeGreaterThan(15);
    expect(distanceKm).toBeLessThan(25);
  });

  it("should return 0 distance for identical coordinates", () => {
    const distanceKm = calculateHaversineDistanceKm(6.5244, 3.3792, 6.5244, 3.3792);
    expect(distanceKm).toBe(0);
  });
});
