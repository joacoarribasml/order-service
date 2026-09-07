import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { seedDatabase } from "../db/seed.js";
import { products, warehouseStock, warehouses } from "../db/schema.js";
import { MockGeocodingClient } from "../geocoding/geocodingClient.js";
import { DECLINED_CARD, MockPaymentClient, PaymentDeclinedError } from "../payments/paymentClient.js";
import { createOrder } from "./createOrder.js";

const geocoder = new MockGeocodingClient();
const payments = new MockPaymentClient();

const shipping = (city: string) => ({
  line1: "123 Main St",
  city,
  region: "NA",
  postalCode: "00000",
  country: "US",
});

beforeEach(async () => {
  await seedDatabase();
});

after(async () => {
  await seedDatabase();
});

async function productId(sku: string): Promise<number> {
  const [row] = await db.select().from(products).where(eq(products.sku, sku));
  assert.ok(row, `seed is missing sku ${sku}`);
  return row.id;
}

async function tapeStockInWest(): Promise<number> {
  const [west] = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.name, "West - Los Angeles, CA"));
  const tape = await productId("TAPE-ELEC");
  const [row] = await db
    .select()
    .from(warehouseStock)
    .where(
      and(eq(warehouseStock.warehouseId, west.id), eq(warehouseStock.productId, tape)),
    );
  return row.quantity;
}

test("tape shipped to Los Angeles is filled from the West warehouse", async () => {
  const tape = await productId("TAPE-ELEC");
  const order = await createOrder(
    {
      customerId: 1,
      shippingAddress: shipping("Los Angeles"),
      items: [{ productId: tape, quantity: 1 }],
      cardNumber: "4242424242424242",
    },
    { geocoder, payments },
  );

  assert.equal(order.warehouseName, "West - Los Angeles, CA");
  assert.equal(order.totalCents, 425);
  assert.equal(order.items[0]?.unitPriceCents, 425);
  assert.equal(await tapeStockInWest(), 99);
});

test("conduit + elbow + breaker ships from New York even when the address is Los Angeles", async () => {
  const order = await createOrder(
    {
      customerId: 1,
      shippingAddress: shipping("Los Angeles"),
      items: [
        { productId: await productId("PVC-034-10"), quantity: 1 },
        { productId: await productId("PVC-90-034"), quantity: 1 },
        { productId: await productId("BRK-2P-40A"), quantity: 1 },
      ],
      cardNumber: "4242424242424242",
    },
    { geocoder, payments },
  );

  assert.equal(order.warehouseName, "East - New York, NY");
});

test("a declined payment leaves stock unchanged", async () => {
  const tape = await productId("TAPE-ELEC");
  await assert.rejects(
    () =>
      createOrder(
        {
          customerId: 1,
          shippingAddress: shipping("Los Angeles"),
          items: [{ productId: tape, quantity: 1 }],
          cardNumber: DECLINED_CARD,
        },
        { geocoder, payments },
      ),
    PaymentDeclinedError,
  );
  assert.equal(await tapeStockInWest(), 100);
});
