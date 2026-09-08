# Demo UI

A small dev-only page for placing real orders against the running API and watching the effect on the database. Not part of the service - no framework, no build step, no new dependency (it reuses `pg`, already installed).

## Run it

Easiest: from the project root, `npm run dev:all` starts Postgres, the API, and this demo together in one terminal.

To run it on its own instead - with `order-service` already running (`npm run dev`) and the database migrated and seeded, in a second terminal from the project root:

```sh
node demo/server.mjs
```

Open `http://localhost:3001`.

It reads warehouse/product/stock/order state directly from Postgres for display, and forwards order submissions to the real `POST /orders` on `order-service` (default `http://localhost:3000`) - so what you see is the actual API's behavior, not a simulation of it.
