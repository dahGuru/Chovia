# CHOVIA — OpenAPI Specification Layer

> **Location:** `api/openapi/`  
> **Source of Truth:** Generated directly from Fastify route definitions and Zod schemas via `@fastify/type-provider-zod` and `@fastify/swagger`.

## Files
- [openapi.json](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/api/openapi/openapi.json): Standard OpenAPI 3.0.3 specification in JSON format.
- [openapi.yaml](file:///C:/Users/HP/Videos/WEB DEV 1.0/Food Delivery/Chovia/api/openapi/openapi.yaml): OpenAPI 3.0.3 specification in YAML format.

## Regeneration Command
To regenerate the OpenAPI specifications from the backend application:
```bash
pnpm --filter @chovia/backend openapi:generate
```

## Runtime Endpoints
When the backend server is running:
- **Interactive Swagger UI:** `http://localhost:4000/api/docs`
- **Raw OpenAPI JSON:** `http://localhost:4000/api/docs/json`
