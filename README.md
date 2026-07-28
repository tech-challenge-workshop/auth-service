# auth-service

[![ci](https://github.com/tech-challenge-workshop/auth-service/actions/workflows/ci.yml/badge.svg)](https://github.com/tech-challenge-workshop/auth-service/actions/workflows/ci.yml)

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

## Deployment model

The service runs as a **Lambda** behind API Gateway. Kong keeps `/auth` as the
public path and proxies to it, so the gateway remains the single entry point.

`src/local-server.ts` is for local development only: it wraps the same two
handlers in a Node `http` server, converting an `IncomingMessage` into an
`APIGatewayProxyEventV2`. It is what `pnpm start:dev` runs, and what the
Dockerfile builds for anyone who wants the service in a container.

Handlers are `async`, because the Lambda Node runtime reads a handler that
returns a Promise or one that calls the callback.

`src/local-server.ts` is excluded from coverage: it is an I/O adapter with no
business logic, and the handlers it calls are fully tested.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm start:dev` | HTTP server on port 3003 via `tsx` (watch-free, restarts are instant). |
| `pnpm build` | esbuild bundle of the local HTTP server into `dist/local-server.js`. |
| `pnpm start` | Run the built bundle — local and container use only. |
| `pnpm test` / `pnpm test:cov` / `pnpm test:ci` | Jest unit tests; `test:ci` enforces the 80% coverage gate. |
| `pnpm lint:check` / `pnpm lint` | ESLint (check / fix). |
| `pnpm format:check` / `pnpm format` | Prettier (check / write). |
| `pnpm package` | `serverless package` — produces the deployable Lambda zip. |
| `pnpm exec serverless deploy --stage dev` | Deploy the function. CI does this on every push to `main`. |

## Architecture

Same Clean Architecture layering as the other services:

- `domain/` — pure business rules (`Document` value object, CPF and CNPJ check digits).
- `application/` — use cases + ports; no framework code.
- `infra/` — port implementations (HTTP customer lookup gateway).
- `handlers/` — thin Lambda adapters that wire dependencies and translate HTTP.
- `local-server.ts` — Node `http` adapter over the same handlers, for local runs only.
- `shared/` — env parsing, HTTP helpers.

30 tests, 94.7% statements / 92.1% branches.

## Test coverage

`pnpm test:ci` **fails the build below 80%** on statements, branches, functions
and lines — the threshold lives in [`tests/jest-cov.json`](tests/jest-cov.json).
Current run: **30 tests, 94.7% statements / 92.1% branches**.

```bash
pnpm test:ci
```

There is no SonarCloud project for this repository on purpose. The requirements
scope code-quality analysis to the *microservices*, and the challenge classifies
the serverless authentication function as an edge component rather than one of
the three. The 80% gate still applies here.

`src/local-server.ts` is excluded from coverage: it is an I/O adapter that
translates HTTP into the Lambda event shape, and the handlers it calls are fully
covered.

## Deployment

Deployed by CI on every push to `main`: the workflow assumes an AWS role through
OIDC — no stored access key — and runs `serverless deploy`.

There is no Kubernetes Deployment for this service. What lives in
[`tech-platform/k8s/auth-service`](https://github.com/tech-challenge-workshop/tech-platform/tree/main/k8s/auth-service)
is a single `ExternalName` service pointing at the API Gateway endpoint, which
is how Kong keeps `/auth` on the same gateway as everything else.

That route has `konghq.com/preserve-host: "false"`. API Gateway rejects any Host
that is not its own `execute-api` domain, so forwarding the load balancer's
hostname returns 403 from AWS before the function is ever invoked.

### Configuration the pipeline needs

| Name | Kind | Purpose |
| --- | --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | secret | role assumed through OIDC |
| `JWT_SECRET` | secret | must match the three validating services |
| `ADMIN_API_KEY` | secret | authorizes `POST /auth/admin` |
| `CUSTOMER_LOOKUP_URL` | variable | gateway address of `/customers/lookup` |
| `AWS_REGION` | variable | defaults to `us-east-1` |

The deploy step skips itself when the role or the signing key is missing, which
keeps `main` green while no environment exists.

> **`CUSTOMER_LOOKUP_URL` is tied to the gateway address.** The function calls
> back through Kong to check that a customer exists, so a recreated cluster
> means a new hostname and a redeploy. `tech-platform`'s
> `scripts/bootstrap-cluster.sh` handles it.
