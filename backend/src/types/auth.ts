import type { FastifyRequest, FastifyReply } from "fastify";

export interface AuthUserPayload {
  id: string;
  email: string;
  role: "CUSTOMER" | "RESTAURANT_STAFF" | "RIDER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}
