# auth-service

Stateless authentication Lambda for the Tech Challenge (Phase 4). Issues HS256 JWTs that are validated by `work-order-service`, `execution-service` and `billing-service`. It never stores users or passwords.

## Endpoints

### `POST /auth`
Customer login by CPF or CNPJ.

Request:
```json
{ "document": "39053344705" }
```

Flow:
1. Validate the document (CPF/CNPJ digits) via the shared `Document` value object.
2. Call `GET ${CUSTOMER_LOOKUP_URL}?document=<doc>` on `work-order-service`.
3. On 200 → sign JWT `{ sub: <customerId>, role: "customer" }` with `JWT_TTL_SECONDS` expiration.

Responses: `200 { token, expiresIn }` · `400 { error: "Invalid document" }` · `404 { error: "Customer not found" }` · `502 { error: "Customer lookup failed" }`.

### `POST /auth/admin`
Administrative login via fixed API key (header).

Request:
```
POST /auth/admin
X-Api-Key: <ADMIN_API_KEY>
```

Compares the header against `ADMIN_API_KEY` using a constant-time comparison. On match → JWT `{ sub: "admin", role: "admin" }`.

Responses: `200 { token, expiresIn }` · `401 { error: "Invalid credentials" }`.

## Environment

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Same value used by the three services (HS256 shared secret). |
| `JWT_TTL_SECONDS` | Token lifetime in seconds; defaults to `86400` (24h). |
| `ADMIN_API_KEY` | Fixed key that authorizes `POST /auth/admin`. |
| `CUSTOMER_LOOKUP_URL` | Full URL of the `work-order-service` customer lookup endpoint, e.g. `http://localhost:3000/customers/lookup`. |

## Local development

```bash
pnpm install
cp .env.example .env       # then edit
pnpm start:dev             # serverless-offline on :3003
```

Test the endpoints:

```bash
curl -s -X POST http://localhost:3003/auth \
  -H 'content-type: application/json' \
  -d '{"document":"39053344705"}'

curl -s -X POST http://localhost:3003/auth/admin \
  -H 'X-Api-Key: change-me'
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm start:dev` | Serverless-offline on port 3003. |
| `pnpm test` / `pnpm test:cov` / `pnpm test:ci` | Jest unit tests; `test:ci` enforces the 80% coverage gate. |
| `pnpm lint:check` / `pnpm lint` | ESLint (check / fix). |
| `pnpm format:check` / `pnpm format` | Prettier (check / write). |
| `pnpm package` | `serverless package` (produces the deployable zip). |

## Architecture

Same Clean Architecture layering as the other services:

- `domain/` — pure business rules (`Document` VO).
- `application/` — use cases + ports; no framework code.
- `infra/` — port implementations (HTTP customer lookup gateway).
- `handlers/` — thin Lambda adapters that wire dependencies and translate HTTP.
- `shared/` — env parsing, HTTP helpers.

## Deployment target

Serverless Framework v3 with the `serverless-esbuild` plugin (`nodejs22.x` runtime). Production runs behind Kong (Kong Ingress Controller on EKS uses the `aws-lambda` plugin to route `/auth` and `/auth/admin` to this function).
