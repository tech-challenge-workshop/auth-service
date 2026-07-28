# auth-service

Stateless authentication service for the Tech Challenge (Phase 4). Issues HS256 JWTs that are validated by `work-order-service`, `execution-service` and `billing-service`. It never stores users or passwords.

One of four independent services:

| Service | Responsibility |
|---|---|
| [work-order-service](https://github.com/tech-challenge-workshop/work-order-service) | Work order lifecycle, master data, saga orchestration |
| [billing-service](https://github.com/tech-challenge-workshop/billing-service) | Quotes and payments (Mercado Pago) |
| [execution-service](https://github.com/tech-challenge-workshop/execution-service) | Parts inventory, stock control, repair execution |
| **auth-service** (this repo) | Issues the JWTs the three services above validate |
| [tech-platform](https://github.com/tech-challenge-workshop/tech-platform) | Kong gateway, Datadog agent, Kubernetes manifests, OpenTofu |

## Endpoints

### `POST /auth`
Customer login by CPF or CNPJ.

Request:
```json
{ "document": "39053344705" }
```

Flow:
1. Validate the document (CPF/CNPJ check digits) via the shared `Document` value object.
2. Call `GET ${CUSTOMER_LOOKUP_URL}?document=<doc>` on `work-order-service`.
3. On 200 → sign JWT `{ sub: <customerId>, role: "customer" }` with `JWT_TTL_SECONDS` expiration.

Responses: `200 { token, expiresIn }` · `400 { error: "Invalid document" }` · `404 { error: "Customer not found" }` · `502 { error: "Customer lookup failed" }`.

### `POST /auth/admin`
Administrative login via fixed API key (header).

```
POST /auth/admin
X-Api-Key: <ADMIN_API_KEY>
```

Compares the header against `ADMIN_API_KEY` using a constant-time comparison, checking length first so the comparison itself never leaks the key's size. On match → JWT `{ sub: "admin", role: "admin" }`.

Responses: `200 { token, expiresIn }` · `401 { error: "Invalid credentials" }`.

### `GET /health`
Liveness and readiness probe. Returns `{ status: "ok", service: "auth-service" }`.

## Token shape

```json
{ "iss": "auth-service", "sub": "<customerId|admin>", "role": "customer|admin", "exp": 1234567890 }
```

Signed HS256 with `JWT_SECRET`, shared verbatim with the three consuming services.

The **`iss` claim is required**, not decorative: Kong's `jwt` plugin uses it to look up the matching `KongConsumer` credential. A token without `iss: "auth-service"` is rejected at the edge with `Bad token`, even if the signature is valid.

## Environment

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Same value used by the three services (HS256 shared secret). |
| `JWT_TTL_SECONDS` | Token lifetime in seconds; defaults to `86400` (24h). |
| `ADMIN_API_KEY` | Fixed key that authorizes `POST /auth/admin`. |
| `CUSTOMER_LOOKUP_URL` | Full URL of the `work-order-service` customer lookup endpoint, e.g. `http://localhost:3000/customers/lookup`. |
| `PORT` | HTTP port; defaults to `3003`. |

## Local development

```bash
pnpm install
cp .env.example .env       # then edit
pnpm start:dev             # http://localhost:3003
```

Test the endpoints:

```bash
curl -s http://localhost:3003/health

curl -s -X POST http://localhost:3003/auth \
  -H 'content-type: application/json' \
  -d '{"document":"39053344705"}'

curl -s -X POST http://localhost:3003/auth/admin \
  -H 'X-Api-Key: change-me'
```

## Why this runs as a container, not `serverless offline`

The service was built Lambda-first and the handlers are still plain `APIGatewayProxyEventV2` functions. But `serverless@3.39` + `serverless-offline@13.9` throws `Cannot redefine property: _serverlessExternalPluginName` on boot under Node 22, and neither pinning `serverless-esbuild`, downgrading `serverless-offline`, nor dropping the esbuild plugin fixed it.

Rather than block on an upstream bug, `src/local-server.ts` wraps the same two handlers in a ~100-line Node `http` server: it converts an `IncomingMessage` into an `APIGatewayProxyEventV2`, calls the handler, and writes the structured result back. The handlers are untouched and stay deployable to Lambda.

That wrapper is also what the `Dockerfile` builds, which is why the service ships as a normal container alongside the other three — one deployment model, one set of Kubernetes manifests, no `aws-lambda` Kong plugin needed. `serverless.yml` and `pnpm package` are kept so a real Lambda deploy remains one command away.

`src/local-server.ts` is excluded from coverage: it is an I/O adapter with no business logic, and the handlers it calls are fully tested.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm start:dev` | HTTP server on port 3003 via `tsx` (watch-free, restarts are instant). |
| `pnpm build` | esbuild bundle of the HTTP server into `dist/local-server.js` (~262 KB). |
| `pnpm start` | Run the built bundle — what the container image executes. |
| `pnpm test` / `pnpm test:cov` / `pnpm test:ci` | Jest unit tests; `test:ci` enforces the 80% coverage gate. |
| `pnpm lint:check` / `pnpm lint` | ESLint (check / fix). |
| `pnpm format:check` / `pnpm format` | Prettier (check / write). |
| `pnpm package` | `serverless package` — produces the deployable Lambda zip. |
| `pnpm start:serverless` | `serverless offline` (currently broken upstream, see above). |

## Architecture

Same Clean Architecture layering as the other services:

- `domain/` — pure business rules (`Document` value object, CPF and CNPJ check digits).
- `application/` — use cases + ports; no framework code.
- `infra/` — port implementations (HTTP customer lookup gateway).
- `handlers/` — thin Lambda adapters that wire dependencies and translate HTTP.
- `local-server.ts` — Node `http` adapter over the same handlers.
- `shared/` — env parsing, HTTP helpers.

30 tests, 94.7% statements / 92.1% branches.

## Deployment

Kubernetes manifests (`Deployment`, `Service`, `ConfigMap`, `HPA`) live in [`tech-platform/k8s/auth-service`](https://github.com/tech-challenge-workshop/tech-platform/tree/main/k8s/auth-service). Because the service is stateless and holds no database, it runs with the smallest resource footprint of the four.

CI builds and pushes the image to `ghcr.io/tech-challenge-workshop/auth-service` on every push to `main`.

```bash
docker build -t auth-service .
docker run --env-file .env -p 3003:3003 auth-service
```

## Contributing

`main` is protected: changes land through pull requests with code owner review. All code, comments and commit messages are written in English. Tests live in `tests/`, mirroring the `src/` structure.
