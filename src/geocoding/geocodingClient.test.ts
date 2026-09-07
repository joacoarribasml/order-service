import assert from "node:assert/strict";
import { test } from "node:test";
import { MockGeocodingClient, UnrecognizedCityError } from "./geocodingClient.js";

const address = (city: string) => ({
  line1: "123 Main St",
  city,
  region: "NA",
  postalCode: "00000",
  country: "US",
});

test("unrecognized city fails instead of inventing coordinates", async () => {
  const geocoder = new MockGeocodingClient();
  await assert.rejects(
    () => geocoder.geocode(address("Nowheresville")),
    UnrecognizedCityError,
  );
});
