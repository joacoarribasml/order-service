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

The server listens on the port set in `.env` (default `3000`). `GET /health` confirms it's up. `npm test` covers eligibility (needs a migrated, seeded database) plus geocoding and closest-warehouse.
