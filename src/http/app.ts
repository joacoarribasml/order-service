import Fastify from "fastify";
import { ZodError, z } from "zod";
import { UnrecognizedCityError } from "../geocoding/geocodingClient.js";
import type { GeocodingClient } from "../geocoding/geocodingClient.js";
import { PaymentDeclinedError } from "../payments/paymentClient.js";
import type { PaymentClient } from "../payments/paymentClient.js";
import {
  CannotFulfillError,
  createOrder,
  UnknownCustomerError,
  UnknownProductError,
} from "../orders/createOrder.js";

const createOrderBodySchema = z.object({
  customerId: z.number().int().positive(),
  shippingAddress: z.object({
    line1: z.string().min(1),
    city: z.string().min(1),
    region: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  payment: z.object({
    cardNumber: z.string().min(1),
  }),
});

export type AppDeps = {
  geocoder: GeocodingClient;
  payments: PaymentClient;
};

export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  app.post("/orders", async (request, reply) => {
    try {
      const body = createOrderBodySchema.parse(request.body);
      const order = await createOrder(
        {
          customerId: body.customerId,
          shippingAddress: body.shippingAddress,
          items: body.items,
          cardNumber: body.payment.cardNumber,
        },
        deps,
      );
      return reply.code(201).send(order);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.code(400).send({ error: "Invalid request" });
      }
      if (
        err instanceof UnknownCustomerError ||
        err instanceof UnknownProductError ||
        err instanceof UnrecognizedCityError
      ) {
        return reply.code(400).send({ error: err.message });
      }
      if (err instanceof CannotFulfillError) {
        return reply.code(409).send({ error: err.message });
      }
      if (err instanceof PaymentDeclinedError) {
        return reply.code(402).send({ error: err.message });
      }
      throw err;
    }
  });

  return app;
}
