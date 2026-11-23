# CHOVIA — OpenAPI Specification Layer

> **Location:** `api/openapi/`  
> **Source of Truth:** Generated directly from Fastify route definitions and Zod schemas via `@fastify/type-provider-zod` and `@fastify/swagger`.

## Files
- [openapi.json](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/api/openapi/openapi.json): Standard OpenAPI 3.1.0 specification in JSON format.
- [openapi.yaml](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/api/openapi/openapi.yaml): OpenAPI 3.1.0 specification in YAML format.

## Schema Components & Reusability
The specification defines reusable component schemas under `components.schemas`:
- `ErrorResponse`: Standard API error response with `statusCode`, `code`, `message`, `details`, and ISO timestamp.
- `ValidationError`: Zod validation failure envelope with structured parameter and body error details.
- `PaginationMeta`: Standard pagination metadata (`total`, `page`, `limit`, `totalPages`, `hasNext`, `hasPrev`).
- `HealthStatusResponse`: Service and dependency health status contract (`live`, `ready`, and infrastructure checks).

## Stage 3.2.2 Endpoints Included
- `POST /api/v1/payments/refund`: Administrative refund endpoint with amount validation and Paystack refund invocation.
- `POST /api/v1/users/verify-upload`: Post-upload validation endpoint inspecting Cloudinary response metadata and file category limits.

## Regeneration Command
To regenerate the OpenAPI specifications from the backend application:
```bash
pnpm --filter @chovia/backend openapi:generate
```

## Status
- **Implementation Status:** Implemented; automated tests pass (7 OpenAPI validation tests in `src/tests/openapi.test.ts`).
- **Validation:** Both JSON and YAML specifications on disk match the runtime Fastify Swagger configuration exactly.

## Runtime Endpoints
When the backend server is running:
- **Interactive Swagger UI:** `http://localhost:4000/api/docs`
- **Raw OpenAPI JSON:** `http://localhost:4000/api/docs/json`
