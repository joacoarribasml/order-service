import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  customers,
  orderItems,
  orders,
  products,
  warehouseStock,
} from "../db/schema.js";
import type { GeocodingClient, ShippingAddress } from "../geocoding/geocodingClient.js";
import type { PaymentClient } from "../payments/paymentClient.js";
import { findEligibleWarehouses, mergeLines, type OrderLine } from "./findEligibleWarehouses.js";
import { selectClosestWarehouse } from "./selectClosestWarehouse.js";

export class UnknownCustomerError extends Error {
  constructor(customerId: number) {
    super(`Unknown customer: ${customerId}`);
    this.name = "UnknownCustomerError";
  }
}

export class UnknownProductError extends Error {
  constructor(productId: number) {
    super(`Unknown product: ${productId}`);
    this.name = "UnknownProductError";
  }
}

export class CannotFulfillError extends Error {
  constructor() {
    super("No warehouse can fill this order");
    this.name = "CannotFulfillError";
  }
}

export type CreateOrderInput = {
  customerId: number;
  shippingAddress: ShippingAddress;
  items: OrderLine[];
  cardNumber: string;
};

export type CreateOrderDeps = {
  geocoder: GeocodingClient;
  payments: PaymentClient;
};

export async function createOrder(input: CreateOrderInput, deps: CreateOrderDeps) {
  const lines = mergeLines(input.items);

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, input.customerId));
  if (!customer) throw new UnknownCustomerError(input.customerId);

  const productIds = lines.map((line) => line.productId);
  const catalog = await db.select().from(products).where(inArray(products.id, productIds));
  const productById = new Map(catalog.map((product) => [product.id, product]));
  for (const line of lines) {
    if (!productById.has(line.productId)) throw new UnknownProductError(line.productId);
  }

  const eligible = await findEligibleWarehouses(lines);
  const warehouse = await selectClosestWarehouse(
    eligible,
    input.shippingAddress,
    deps.geocoder,
  );
  if (!warehouse) throw new CannotFulfillError();

  const priced = lines.map((line) => ({
    ...line,
    unitPriceCents: productById.get(line.productId)!.priceCents,
  }));
  const totalCents = priced.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );

  return db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.warehouseId, warehouse.id),
          inArray(warehouseStock.productId, productIds),
        ),
      )
      .orderBy(warehouseStock.productId)
      .for("update");

    for (const line of lines) {
      const row = locked.find((stock) => stock.productId === line.productId);
      if (!row || row.quantity < line.quantity) throw new CannotFulfillError();
    }

    const { paymentId } = await deps.payments.charge({
      cardNumber: input.cardNumber,
      amountCents: totalCents,
      description: `Order for customer ${input.customerId}`,
    });

    const [order] = await tx
      .insert(orders)
      .values({
        customerId: input.customerId,
        shippingLine1: input.shippingAddress.line1,
        shippingCity: input.shippingAddress.city,
        shippingRegion: input.shippingAddress.region,
        shippingPostalCode: input.shippingAddress.postalCode,
        shippingCountry: input.shippingAddress.country,
        warehouseId: warehouse.id,
        paymentId,
        totalCents,
      })
      .returning();

    const items = priced.map((line) => ({
      orderId: order.id,
      productId: line.productId,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    }));
    await tx.insert(orderItems).values(items);

    for (const line of lines) {
      await tx
        .update(warehouseStock)
        .set({ quantity: sql`${warehouseStock.quantity} - ${line.quantity}` })
        .where(
          and(
            eq(warehouseStock.warehouseId, warehouse.id),
            eq(warehouseStock.productId, line.productId),
          ),
        );
    }

    return {
      id: order.id,
      customerId: order.customerId,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      paymentId: order.paymentId,
      totalCents: order.totalCents,
      items,
    };
  });
}
