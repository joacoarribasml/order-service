export type Coordinates = { lat: number; lng: number };

export type ShippingAddress = {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export interface GeocodingClient {
  geocode(address: ShippingAddress): Promise<Coordinates>;
}

// Real coordinates for the warehouse cities this demo uses. An address
// outside this list fails rather than resolving to a made-up point - a
// wrong warehouse pick from fake geography is worse than an explicit error.
const KNOWN_CITIES: Record<string, Coordinates> = {
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  "new york": { lat: 40.7128, lng: -74.006 },
  atlanta: { lat: 33.749, lng: -84.388 },
};

export class MockGeocodingClient implements GeocodingClient {
  async geocode(address: ShippingAddress): Promise<Coordinates> {
    const known = KNOWN_CITIES[address.city.trim().toLowerCase()];
    if (!known) {
      throw new Error(`Unable to geocode address: unrecognized city "${address.city}"`);
    }
    return known;
  }
}
