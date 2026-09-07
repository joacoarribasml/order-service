import assert from "node:assert/strict";
import { test } from "node:test";
import { MockGeocodingClient } from "../geocoding/geocodingClient.js";
import { selectClosestWarehouse } from "./selectClosestWarehouse.js";

const geocoder = new MockGeocodingClient();

const address = (city: string) => ({
  line1: "123 Main St",
  city,
  region: "NA",
  postalCode: "00000",
  country: "US",
});

const nyc = { id: 1, name: "East - New York, NY", lat: "40.7128", lng: "-74.006" };
const la = { id: 2, name: "West - Los Angeles, CA", lat: "34.0522", lng: "-118.2437" };
const chicago = { id: 3, name: "Central - Chicago, IL", lat: "41.8781", lng: "-87.6298" };

test("returns null when nothing is eligible", async () => {
  const result = await selectClosestWarehouse([], address("New York"), geocoder);
  assert.equal(result, null);
});

test("returns the only candidate without geocoding", async () => {
  const result = await selectClosestWarehouse([nyc], address("Nowheresville"), geocoder);
  assert.equal(result, nyc);
});

test("picks the eligible warehouse closest to the shipping address", async () => {
  const shippingToLA = await selectClosestWarehouse([nyc, la, chicago], address("Los Angeles"), geocoder);
  assert.equal(shippingToLA, la);

  const shippingToNYC = await selectClosestWarehouse([nyc, la, chicago], address("New York"), geocoder);
  assert.equal(shippingToNYC, nyc);
});
