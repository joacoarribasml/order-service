import "dotenv/config";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const orderServiceUrl = `http://localhost:${process.env.PORT ?? 3000}`;
const demoPort = process.env.DEMO_PORT ?? 3001;

const STATIC_FILES = {
  "/": { file: "index.html", type: "text/html" },
  "/app.js": { file: "app.js", type: "text/javascript" },
  "/style.css": { file: "style.css", type: "text/css" },
};

async function getState() {
  const [warehouses, products, stock, customers, orders] = await Promise.all([
    pool.query('SELECT id, name FROM warehouses ORDER BY id'),
    pool.query('SELECT id, sku, name, price_cents AS "priceCents" FROM products ORDER BY id'),
    pool.query(
      'SELECT warehouse_id AS "warehouseId", product_id AS "productId", quantity FROM warehouse_stock',
    ),
    pool.query('SELECT id, name FROM customers ORDER BY id'),
    pool.query(`
      SELECT o.id, o.customer_id AS "customerId", c.name AS "customerName",
             o.warehouse_id AS "warehouseId", w.name AS "warehouseName",
             o.total_cents AS "totalCents", o.payment_id AS "paymentId", o.created_at AS "createdAt",
             (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS "itemCount"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN warehouses w ON w.id = o.warehouse_id
      ORDER BY o.id DESC
      LIMIT 10
    `),
  ]);
  return {
    warehouses: warehouses.rows,
    products: products.rows,
    stock: stock.rows,
    customers: customers.rows,
    orders: orders.rows,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/state") {
    const state = await getState();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(state));
    return true;
  }

  if (req.method === "POST" && req.url === "/api/orders") {
    const body = await readBody(req);
    try {
      const upstream = await fetch(`${orderServiceUrl}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { "content-type": "application/json" });
      res.end(text);
    } catch {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: `order-service isn't reachable at ${orderServiceUrl} - is it running (npm run dev)?`,
        }),
      );
    }
    return true;
  }

  return false;
}

async function handleStatic(req, res) {
  const entry = STATIC_FILES[req.url];
  if (!entry) return false;
  const content = await readFile(path.join(__dirname, entry.file));
  res.writeHead(200, { "content-type": entry.type });
  res.end(content);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    if (await handleStatic(req, res)) return;
    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Demo server error" }));
  }
});

server.listen(demoPort, () => {
  console.log(`Demo UI at http://localhost:${demoPort} (orders forwarded to ${orderServiceUrl})`);
});
