import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "./client.js";
import { customers, products, warehouseStock, warehouses } from "./schema.js";

// Stock is arranged on purpose so a demo UI can show a few distinct scenarios:
//  - Electrical tape is everywhere -> nearest warehouse always wins.
//  - PVC conduit + PVC 90 elbow + a 2-pole breaker together: only the New
//    York warehouse carries all three, so the "closest" warehouse is often
//    disqualified and the order routes further away.
//  - RMC conduit + PVC TA body + PVC 90 elbow + a 2-pole breaker together:
//    no single warehouse carries all four (each is short at least one), so
//    this is a clean case for the "can't fulfill" response.
//  - Ordering a large quantity (e.g. 200) of anything fails everywhere even
//    though every warehouse "carries" it, since none holds that much stock.

export async function seedDatabase() {
  await db.execute(sql`
    TRUNCATE order_items, orders, warehouse_stock, products, warehouses, customers
    RESTART IDENTITY CASCADE
  `);

  await db.insert(customers).values([
    { name: "Torres Electrical Contractors" },
    { name: "Chen Electric LLC" },
    { name: "Gomez Construction" },
    { name: "Okafor Mechanical & Electrical" },
  ]);

  const insertedWarehouses = await db
    .insert(warehouses)
    .values([
      { name: "West - Los Angeles, CA", lat: "34.052200", lng: "-118.243700" },
      { name: "Central - Chicago, IL", lat: "41.878100", lng: "-87.629800" },
      { name: "East - New York, NY", lat: "40.712800", lng: "-74.006000" },
      { name: "South - Atlanta, GA", lat: "33.749000", lng: "-84.388000" },
    ])
    .returning();

  const insertedProducts = await db
    .insert(products)
    .values([
      { sku: "PVC-034-10", name: 'PVC Conduit 3/4" x 10ft', priceCents: 650 },
      { sku: "PVC-90-034", name: 'PVC 90° Elbow 3/4"', priceCents: 185 },
      { sku: "TAPE-ELEC", name: "Electrical Tape (roll)", priceCents: 425 },
      { sku: "BRK-2P-40A", name: "2-Pole 40A Circuit Breaker", priceCents: 3499 },
      { sku: "RMC-034-10", name: 'RMC Conduit 3/4" x 10ft', priceCents: 2850 },
      { sku: "LOCKNUT-112-WP", name: 'Rigid Lock Nut 1 1/2", Weatherproof', priceCents: 315 },
      { sku: "PVC-TA-034", name: 'PVC TA Conduit Body 3/4"', priceCents: 740 },
      { sku: "THHN-10-GRN-500", name: "THHN Wire #10 Stranded, Green (500ft reel)", priceCents: 14500 },
      { sku: "GRND-ROD-8-058", name: 'Ground Rod 8ft x 5/8"', priceCents: 1875 },
      { sku: "BUSH-PLST-034", name: 'Plastic Bushing 3/4" (box of 25)', priceCents: 2200 },
    ])
    .returning();

  const warehouseId = (prefix: string) =>
    insertedWarehouses.find((w) => w.name.startsWith(prefix))!.id;
  const productId = (sku: string) =>
    insertedProducts.find((p) => p.sku === sku)!.id;

  const west = warehouseId("West");
  const central = warehouseId("Central");
  const east = warehouseId("East");
  const south = warehouseId("South");

  const stock = [
    // PVC-034-10 (PVC Conduit 3/4") - everywhere except South
    { warehouseId: east, productId: productId("PVC-034-10"), quantity: 50 },
    { warehouseId: central, productId: productId("PVC-034-10"), quantity: 30 },
    { warehouseId: west, productId: productId("PVC-034-10"), quantity: 20 },

    // PVC-90-034 (PVC 90 Elbow 3/4") - everywhere except Central
    { warehouseId: east, productId: productId("PVC-90-034"), quantity: 20 },
    { warehouseId: south, productId: productId("PVC-90-034"), quantity: 15 },
    { warehouseId: west, productId: productId("PVC-90-034"), quantity: 10 },

    // TAPE-ELEC (Electrical Tape) - commodity, in stock everywhere
    { warehouseId: east, productId: productId("TAPE-ELEC"), quantity: 100 },
    { warehouseId: south, productId: productId("TAPE-ELEC"), quantity: 100 },
    { warehouseId: central, productId: productId("TAPE-ELEC"), quantity: 100 },
    { warehouseId: west, productId: productId("TAPE-ELEC"), quantity: 100 },

    // BRK-2P-40A (2-Pole 40A Breaker) - scarce, only East and Central
    { warehouseId: east, productId: productId("BRK-2P-40A"), quantity: 5 },
    { warehouseId: central, productId: productId("BRK-2P-40A"), quantity: 8 },

    // RMC-034-10 (RMC Conduit 3/4") - everywhere except East
    { warehouseId: south, productId: productId("RMC-034-10"), quantity: 25 },
    { warehouseId: central, productId: productId("RMC-034-10"), quantity: 25 },
    { warehouseId: west, productId: productId("RMC-034-10"), quantity: 25 },

    // LOCKNUT-112-WP (Rigid Lock Nut 1 1/2") - everywhere except Central
    { warehouseId: east, productId: productId("LOCKNUT-112-WP"), quantity: 40 },
    { warehouseId: south, productId: productId("LOCKNUT-112-WP"), quantity: 40 },
    { warehouseId: west, productId: productId("LOCKNUT-112-WP"), quantity: 40 },

    // PVC-TA-034 (PVC TA Conduit Body 3/4") - only East and West
    { warehouseId: east, productId: productId("PVC-TA-034"), quantity: 10 },
    { warehouseId: west, productId: productId("PVC-TA-034"), quantity: 10 },

    // THHN-10-GRN-500 (THHN Wire #10, 500ft reel) - everywhere except West
    { warehouseId: east, productId: productId("THHN-10-GRN-500"), quantity: 30 },
    { warehouseId: south, productId: productId("THHN-10-GRN-500"), quantity: 30 },
    { warehouseId: central, productId: productId("THHN-10-GRN-500"), quantity: 30 },

    // GRND-ROD-8-058 (Ground Rod 8ft) - only Central and West
    { warehouseId: central, productId: productId("GRND-ROD-8-058"), quantity: 15 },
    { warehouseId: west, productId: productId("GRND-ROD-8-058"), quantity: 15 },

    // BUSH-PLST-034 (Plastic Bushing 3/4") - everywhere except West
    { warehouseId: east, productId: productId("BUSH-PLST-034"), quantity: 60 },
    { warehouseId: south, productId: productId("BUSH-PLST-034"), quantity: 60 },
    { warehouseId: central, productId: productId("BUSH-PLST-034"), quantity: 60 },
  ];

  await db.insert(warehouseStock).values(stock);

  return {
    warehouses: insertedWarehouses.length,
    products: insertedProducts.length,
    stockRows: stock.length,
  };
}

async function main() {
  const result = await seedDatabase();
  await pool.end();
  console.log(
    `Seeded ${result.warehouses} warehouses, ${result.products} products, 4 customers, ${result.stockRows} stock rows.`,
  );
}

if (process.argv.some((arg) => arg.endsWith("seed.ts"))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
