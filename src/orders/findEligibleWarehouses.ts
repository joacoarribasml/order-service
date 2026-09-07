import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export type OrderLine = { productId: number; quantity: number };

export type EligibleWarehouse = {
  id: number;
  name: string;
  lat: string;
  lng: string;
};

export function mergeLines(items: OrderLine[]): OrderLine[] {
  const byProduct = new Map<number, number>();
  for (const item of items) {
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  }
  return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function findEligibleWarehouses(
  items: OrderLine[],
): Promise<EligibleWarehouse[]> {
  if (items.length === 0) return [];

  const matches = sql.join(
    items.map(
      (line) =>
        sql`(s.product_id = ${line.productId} AND s.quantity >= ${line.quantity})`,
    ),
    sql` OR `,
  );

  const result = await db.execute<EligibleWarehouse>(sql`
    SELECT w.id, w.name, w.lat, w.lng
    FROM warehouse_stock s
    INNER JOIN warehouses w ON w.id = s.warehouse_id
    WHERE ${matches}
    GROUP BY w.id
    HAVING count(*) = ${items.length}
  `);

  return result.rows;
}
