import * as Location from "expo-location";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export class LocationAccessError extends Error {
  public readonly code: "PERMISSION_DENIED" | "SERVICES_DISABLED" | "UNAVAILABLE";

  constructor(code: "PERMISSION_DENIED" | "SERVICES_DISABLED" | "UNAVAILABLE", message: string) {
    super(message);
    this.name = "LocationAccessError";
    this.code = code;
  }
}

export const locationService = {
  async requestForegroundPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  },

  async getCurrentCoordinates(): Promise<GeoCoordinates> {
    const granted = await locationService.requestForegroundPermission();
    if (!granted) {
      throw new LocationAccessError(
        "PERMISSION_DENIED",
        "Location permission is required to go online and receive nearby deliveries. Please enable location access in your device settings."
      );
    }

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new LocationAccessError(
          "SERVICES_DISABLED",
          "Device location services (GPS) are turned off. Please enable GPS to go online."
        );
      }
    } catch (err) {
      if (err instanceof LocationAccessError) {
        throw err;
      }
      // On web or environments where hasServicesEnabledAsync is unsupported, proceed to getCurrentPositionAsync
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new LocationAccessError(
          "UNAVAILABLE",
          "Unable to acquire valid GPS coordinates. Please try again in an open area."
        );
      }

      return { latitude, longitude };
    } catch (err) {
      if (err instanceof LocationAccessError) {
        throw err;
      }
      throw new LocationAccessError(
        "UNAVAILABLE",
        err instanceof Error
          ? err.message
          : "Unable to determine your current GPS position. Please try again."
      );
    }
  },
};
