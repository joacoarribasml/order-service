import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { products } from "../db/schema.js";
import { findEligibleWarehouses } from "./findEligibleWarehouses.js";

after(async () => {
  await pool.end();
});

async function productId(sku: string): Promise<number> {
  const [row] = await db.select().from(products).where(eq(products.sku, sku));
  assert.ok(row, `seed is missing sku ${sku}`);
  return row.id;
}

function names(warehouses: { name: string }[]): string[] {
  return warehouses.map((w) => w.name).sort();
}

test("tape is in stock at every warehouse", async () => {
  const tape = await productId("TAPE-ELEC");
  const warehouses = await findEligibleWarehouses([{ productId: tape, quantity: 1 }]);
  assert.deepEqual(names(warehouses), [
    "Central - Chicago, IL",
    "East - New York, NY",
    "South - Atlanta, GA",
    "West - Los Angeles, CA",
  ]);
});

test("conduit + elbow + breaker can only be filled from New York", async () => {
  const conduit = await productId("PVC-034-10");
  const elbow = await productId("PVC-90-034");
  const breaker = await productId("BRK-2P-40A");
  const warehouses = await findEligibleWarehouses([
    { productId: conduit, quantity: 1 },
    { productId: elbow, quantity: 1 },
    { productId: breaker, quantity: 1 },
  ]);
  assert.deepEqual(names(warehouses), ["East - New York, NY"]);
});

test("RMC + TA + elbow + breaker cannot be filled from one warehouse", async () => {
  const rmc = await productId("RMC-034-10");
  const ta = await productId("PVC-TA-034");
  const elbow = await productId("PVC-90-034");
  const breaker = await productId("BRK-2P-40A");
  const warehouses = await findEligibleWarehouses([
    { productId: rmc, quantity: 1 },
    { productId: ta, quantity: 1 },
    { productId: elbow, quantity: 1 },
    { productId: breaker, quantity: 1 },
  ]);
  assert.deepEqual(warehouses, []);
});

test("quantity 200 of tape exceeds stock everywhere", async () => {
  const tape = await productId("TAPE-ELEC");
  const warehouses = await findEligibleWarehouses([{ productId: tape, quantity: 200 }]);
  assert.deepEqual(warehouses, []);
});

test("duplicate tape lines are summed before checking stock", async () => {
  const tape = await productId("TAPE-ELEC");
  const fits = await findEligibleWarehouses([
    { productId: tape, quantity: 40 },
    { productId: tape, quantity: 40 },
  ]);
  assert.deepEqual(names(fits), [
    "Central - Chicago, IL",
    "East - New York, NY",
    "South - Atlanta, GA",
    "West - Los Angeles, CA",
  ]);

  const exceeds = await findEligibleWarehouses([
    { productId: tape, quantity: 60 },
    { productId: tape, quantity: 50 },
  ]);
  assert.deepEqual(exceeds, []);
});
