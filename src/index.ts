import { config } from "./config.js";
import { MockGeocodingClient } from "./geocoding/geocodingClient.js";
import { buildApp } from "./http/app.js";
import { MockPaymentClient } from "./payments/paymentClient.js";

const app = buildApp({
  geocoder: new MockGeocodingClient(),
  payments: new MockPaymentClient(),
});

await app.listen({ port: config.port, host: "0.0.0.0" });
