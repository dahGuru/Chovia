import { env } from "../../config/env.js";
import { calculateHaversineDistanceKm } from "../../utils/geo.js";
import { BadRequestError } from "../../common/errors/api-error.js";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface RouteMatrixResult {
  distanceKm: number;
  durationMinutes: number;
  distanceSource: "GOOGLE_ROUTES_API" | "HAVERSINE_APPROXIMATION";
}

function validateCoordinates(coords: Coordinates, label: string): void {
  if (
    typeof coords.latitude !== "number" ||
    isNaN(coords.latitude) ||
    coords.latitude < -90 ||
    coords.latitude > 90
  ) {
    throw new BadRequestError(`Invalid latitude for ${label}: ${coords.latitude}`);
  }
  if (
    typeof coords.longitude !== "number" ||
    isNaN(coords.longitude) ||
    coords.longitude < -180 ||
    coords.longitude > 180
  ) {
    throw new BadRequestError(`Invalid longitude for ${label}: ${coords.longitude}`);
  }
}

export class GoogleMapsService {
  private apiKey: string;
  private isMock: boolean;

  constructor() {
    this.apiKey = env.GOOGLE_MAPS_API_KEY || "";
    this.isMock =
      env.MOCK_INTEGRATIONS ||
      !this.apiKey ||
      this.apiKey.startsWith("mock_") ||
      this.apiKey.includes("Placeholder");
  }

  async geocode(address: string): Promise<GeocodeResult> {
    if (!address || address.trim().length === 0) {
      throw new BadRequestError("Address cannot be empty for geocoding");
    }

    if (this.isMock) {
      // Deterministic mock coordinate in Lagos, Nigeria
      return {
        latitude: 6.5244,
        longitude: 3.3792,
        formattedAddress: address.trim(),
      };
    }

    try {
      const encoded = encodeURIComponent(address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${this.apiKey}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        status: string;
        results: Array<{
          geometry: { location: { lat: number; lng: number } };
          formatted_address: string;
        }>;
      };

      if (data.status !== "OK" || !data.results[0]) {
        throw new Error(`Geocoding status ${data.status} for address: ${address}`);
      }

      return {
        latitude: data.results[0].geometry.location.lat,
        longitude: data.results[0].geometry.location.lng,
        formattedAddress: data.results[0].formatted_address,
      };
    } catch (error) {
      if (env.NODE_ENV !== "production") {
        // Fallback to mock coordinate in non-production on network failure
        return {
          latitude: 6.5244,
          longitude: 3.3792,
          formattedAddress: address.trim(),
        };
      }
      const message = error instanceof Error ? error.message : "Geocoding failed";
      throw new BadRequestError(`Geocoding failed: ${message}`);
    }
  }

  async calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteMatrixResult> {
    validateCoordinates(origin, "origin");
    validateCoordinates(destination, "destination");

    if (this.isMock) {
      if (env.NODE_ENV === "production") {
        throw new Error("Mock routing service is strictly forbidden in production.");
      }
      const distanceKm = calculateHaversineDistanceKm(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );
      const durationMinutes = Math.max(5, Math.round(distanceKm * 2.4 + 5));
      return {
        distanceKm,
        durationMinutes,
        distanceSource: "HAVERSINE_APPROXIMATION",
      };
    }

    if (env.GOOGLE_MAPS_USE_ROUTES_API) {
      try {
        const response = await fetch(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": this.apiKey,
              "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
            },
            body: JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude: origin.latitude,
                    longitude: origin.longitude,
                  },
                },
              },
              destination: {
                location: {
                  latLng: {
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                  },
                },
              },
              travelMode: "TWO_WHEELER",
            }),
            signal: AbortSignal.timeout(5000),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as {
            routes?: Array<{ distanceMeters?: number; duration?: string }>;
          };

          if (data.routes && data.routes.length > 0 && data.routes[0]?.distanceMeters !== undefined) {
            const distanceMeters = data.routes[0].distanceMeters;
            const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
            const durationSec = data.routes[0].duration
              ? Number.parseInt(data.routes[0].duration.replace("s", ""), 10)
              : Math.round(distanceKm * 144);
            const durationMinutes = Math.max(5, Math.round(durationSec / 60));

            return {
              distanceKm,
              durationMinutes,
              distanceSource: "GOOGLE_ROUTES_API",
            };
          }
        } else {
          const errorText = await response.text().catch(() => "");
          if (env.NODE_ENV === "production") {
            throw new Error(`Google Routes API error (${response.status}): ${errorText || "Request failed"}`);
          }
        }
      } catch (error) {
        if (env.NODE_ENV === "production") {
          const message = error instanceof Error ? error.message : "Routing API failure";
          throw new Error(`Production route calculation failed: ${message}. Silent fallback is forbidden.`, {
            cause: error,
          });
        }
      }
    } else if (env.NODE_ENV === "production") {
      throw new Error("GOOGLE_MAPS_USE_ROUTES_API must be enabled in production.");
    }

    // Controlled fallback to Haversine approximation permitted only in non-production
    const distanceKm = calculateHaversineDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );

    // Urban motorcycle delivery estimate: 25 km/h -> 2.4 min/km + 5 min base
    const durationMinutes = Math.max(5, Math.round(distanceKm * 2.4 + 5));

    return {
      distanceKm,
      durationMinutes,
      distanceSource: "HAVERSINE_APPROXIMATION",
    };
  }
}

export const googleMapsService = new GoogleMapsService();
