export interface RiderEligibilityInput {
  id?: string;
  status: string;
  isOnline: boolean;
  isAvailable: boolean;
  lastLatitude: number | null | unknown;
  lastLongitude: number | null | unknown;
  lastLocationUpdatedAt: Date | null;
  activeDeliveryCount?: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export const LOCATION_FRESHNESS_MINUTES = 30;

export function validateRiderEligibility(
  rider: RiderEligibilityInput,
  options?: {
    maxAgeMinutes?: number;
    requireAvailable?: boolean;
  }
): EligibilityResult {
  const maxAge = options?.maxAgeMinutes ?? LOCATION_FRESHNESS_MINUTES;
  const requireAvail = options?.requireAvailable ?? true;

  if (rider.status !== "ACTIVE") {
    return { eligible: false, reason: `Rider status is ${rider.status}, expected ACTIVE` };
  }

  if (!rider.isOnline) {
    return { eligible: false, reason: "Rider is offline" };
  }

  if (requireAvail && !rider.isAvailable) {
    return { eligible: false, reason: "Rider is not marked available" };
  }

  if (rider.activeDeliveryCount !== undefined && rider.activeDeliveryCount > 0) {
    return { eligible: false, reason: `Rider has ${rider.activeDeliveryCount} active deliveries` };
  }

  if (
    rider.lastLatitude === null ||
    rider.lastLongitude === null ||
    rider.lastLatitude === undefined ||
    rider.lastLongitude === undefined
  ) {
    return { eligible: false, reason: "Rider coordinates are missing" };
  }

  const lat = Number(rider.lastLatitude);
  const lng = Number(rider.lastLongitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { eligible: false, reason: "Rider coordinates are not finite numbers" };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { eligible: false, reason: `Rider coordinates out of bounds: lat=${lat}, lng=${lng}` };
  }

  if (!rider.lastLocationUpdatedAt) {
    return { eligible: false, reason: "Rider location update timestamp is missing" };
  }

  const now = Date.now();
  const updatedAtMs = new Date(rider.lastLocationUpdatedAt).getTime();

  if (updatedAtMs > now + 60 * 1000) {
    return { eligible: false, reason: "Rider location update timestamp is in the future" };
  }

  const cutoffMs = now - maxAge * 60 * 1000;
  if (updatedAtMs < cutoffMs) {
    return { eligible: false, reason: `Rider location is stale (> ${maxAge} minutes old)` };
  }

  return { eligible: true };
}
