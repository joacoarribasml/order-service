# order-service

A backend service for placing e-commerce orders: pick a warehouse that can fill the order, reserve the stock, and charge a payment API. All of that happens in one transaction, safely under concurrency.

## What it does

A customer places an order with a shipping address and a list of products. The service finds a single warehouse that can fill every item in the order. If more than one can, it picks whichever is closest to the shipping address, using a mocked geocoding client. It then charges a mocked payment API for the order total.

Stock is reserved inside a database transaction with row-level locking, so two orders placed at the same time can't both claim the last few units of the same product. If the payment fails, the whole attempt rolls back and nothing is persisted. There's no order in a "pending" or "failed" state, only orders that were successfully fulfilled and paid.

Prices are copied onto the order at creation time, so a later change to a product's price doesn't rewrite the history of past orders.

## What it deliberately doesn't do

No authentication, and no APIs for managing customers, warehouses, or products. Those are seeded directly into the database. No background queues or extra services; the whole flow is one synchronous request. These are out of scope for the assignment, not oversights.

Parsing a free-text order (an email, a handwritten list) into a structured `{ productId, quantity }` line item is also out of scope here. This API assumes that matching has already happened and takes structured input directly.

## Stack

TypeScript, Node, Fastify, Drizzle ORM, Postgres, Docker Compose.

## Running it locally

```sh
cp .env.example .env
docker compose up -d --wait
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The server listens on the port set in `.env` (default `3000`). `GET /health` confirms it's up.

`npm install` prints moderate `npm audit` warnings from `drizzle-kit`'s toolchain (an old transitive `esbuild`, deprecated in favor of `tsx`). They're dev-only, not reachable at runtime, and there's no newer stable `drizzle-kit` release yet that drops them - `npm audit fix --force`'s suggested fix is actually a downgrade, not worth taking.

`POST /orders` creates an order. A few examples against the seeded data (customer `1`; product IDs and warehouse layout are in `src/db/seed.ts`):

Happy path - tape is stocked everywhere, so it ships from the nearest warehouse:

```sh
curl -sS -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{
    "customerId": 1,
    "shippingAddress": {
      "line1": "123 Main St",
      "city": "Los Angeles",
      "region": "CA",
      "postalCode": "90012",
      "country": "US"
    },
    "items": [{ "productId": 3, "quantity": 1 }],
    "payment": { "cardNumber": "4242424242424242" }
  }'
```

Closest eligible, not closest overall - conduit, elbow, and a breaker are only all in stock together in New York, so this ships from there even though the address is Los Angeles:

```sh
curl -sS -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{
    "customerId": 1,
    "shippingAddress": {
      "line1": "123 Main St",
      "city": "Los Angeles",
      "region": "CA",
      "postalCode": "90012",
      "country": "US"
    },
    "items": [
      { "productId": 1, "quantity": 1 },
      { "productId": 2, "quantity": 1 },
      { "productId": 4, "quantity": 1 }
    ],
    "payment": { "cardNumber": "4242424242424242" }
  }'
```

No warehouse can fill it (409) - each warehouse is missing at least one of these four items:

```sh
curl -sS -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{
    "customerId": 1,
    "shippingAddress": {
      "line1": "123 Main St",
      "city": "Los Angeles",
      "region": "CA",
      "postalCode": "90012",
      "country": "US"
    },
    "items": [
      { "productId": 5, "quantity": 1 },
      { "productId": 7, "quantity": 1 },
      { "productId": 2, "quantity": 1 },
      { "productId": 4, "quantity": 1 }
    ],
    "payment": { "cardNumber": "4242424242424242" }
  }'
```

Declined payment (402) - same as the happy path, using card `4000000000000002`:

```sh
curl -sS -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{
    "customerId": 1,
    "shippingAddress": {
      "line1": "123 Main St",
      "city": "Los Angeles",
      "region": "CA",
      "postalCode": "90012",
      "country": "US"
    },
    "items": [{ "productId": 3, "quantity": 1 }],
    "payment": { "cardNumber": "4000000000000002" }
  }'
```

`npm test` needs a migrated, seeded database for eligibility and create-order tests.

