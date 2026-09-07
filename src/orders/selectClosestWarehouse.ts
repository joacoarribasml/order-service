import { haversineDistanceKm } from "../geocoding/distance.js";
import type { GeocodingClient, ShippingAddress } from "../geocoding/geocodingClient.js";
import type { EligibleWarehouse } from "./findEligibleWarehouses.js";

function toCoordinates(warehouse: EligibleWarehouse) {
  return { lat: parseFloat(warehouse.lat), lng: parseFloat(warehouse.lng) };
}

export async function selectClosestWarehouse(
  eligible: EligibleWarehouse[],
  shippingAddress: ShippingAddress,
  geocoder: GeocodingClient,
): Promise<EligibleWarehouse | null> {
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  const destination = await geocoder.geocode(shippingAddress);

  let closest = eligible[0];
  let closestDistanceKm = haversineDistanceKm(destination, toCoordinates(closest));

  for (const candidate of eligible.slice(1)) {
    const distanceKm = haversineDistanceKm(destination, toCoordinates(candidate));
    if (distanceKm < closestDistanceKm) {
      closest = candidate;
      closestDistanceKm = distanceKm;
    }
  }

  return closest;
}
