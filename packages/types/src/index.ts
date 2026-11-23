/**
 * Shared, framework-agnostic TypeScript primitives.
 *
 * API request/response DTOs remain owned by the backend contract layer.
 * Prisma-generated types must never be exported from this package.
 */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
