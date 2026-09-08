# order-service

Place an order: pick one warehouse that can fill every line, charge a (mocked) card, reserve stock. If several warehouses can fill it, use the closest to the ship-to. Two concurrent orders cannot both take the last units; a declined payment rolls the whole attempt back. Prices are copied onto the order so later catalog changes don't rewrite history.

TypeScript, Node, Fastify, Drizzle, Postgres, Docker Compose.

## Out of scope

No auth, and no APIs for customers, warehouses, or products; those are seeded. No queues. Parsing a free-text order into `{ productId, quantity }` lines is out of scope; this API takes structured items.

## Run

```sh
cp .env.example .env
npm install
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

API at `http://localhost:3000` (`GET /health`). `npm test` needs that migrated, seeded database. `npm install` may print drizzle-kit/esbuild audit warnings; they're from a kit toolchain dep, not this app. Don't `npm audit fix --force` (it downgrades drizzle-kit).

Optional UI (stock grid + the same `POST /orders`), a sidecar, not part of the service: `npm run dev:all` after copy-env and `npm install`, then open `http://localhost:3001`. See `demo/README.md`.

## POST /orders

After seed, customer `1` and electrical tape is product `3`. Layout and the other IDs are in `src/db/seed.ts`.

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

Same address, other baskets:

- products `1, 2, 4` (conduit + elbow + breaker) → filled from New York, even though LA is closer; only NY has all three
- products `5, 7, 2, 4` → 409, no single warehouse can fill it
- tape (`3`) with card `4000000000000002` → 402, stock unchanged
