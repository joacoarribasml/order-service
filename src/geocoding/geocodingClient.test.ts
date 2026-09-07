import assert from "node:assert/strict";
import { test } from "node:test";
import { haversineDistanceKm } from "./distance.js";
import { MockGeocodingClient } from "./geocodingClient.js";

const address = (city: string) => ({
  line1: "123 Main St",
  city,
  region: "NA",
  postalCode: "00000",
  country: "US",
});

test("known cities resolve to their real coordinates", async () => {
  const geocoder = new MockGeocodingClient();
  const nyc = await geocoder.geocode(address("New York"));
  assert.equal(nyc.lat, 40.7128);
  assert.equal(nyc.lng, -74.006);
});

test("haversine distance is zero for the same point", () => {
  const point = { lat: 40.7128, lng: -74.006 };
  assert.equal(haversineDistanceKm(point, point), 0);
});

test("haversine distance between New York and Los Angeles is roughly correct", () => {
  const nyc = { lat: 40.7128, lng: -74.006 };
  const la = { lat: 34.0522, lng: -118.2437 };
  const distanceKm = haversineDistanceKm(nyc, la);
  // Real-world distance is ~3936 km; a wide tolerance keeps this test about
  // catching a broken formula, not about matching a geodesic to the meter.
  assert.ok(
    Math.abs(distanceKm - 3936) < 50,
    `expected ~3936km, got ${distanceKm}`,
  );
});
