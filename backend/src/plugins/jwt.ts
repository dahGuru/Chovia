import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";
import type { AuthUserPayload } from "../types/auth.js";

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
  });

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const decoded = await request.jwtVerify<AuthUserPayload>();
        request.user = decoded;
      } catch {
        return reply.status(401).send({
          statusCode: 401,
          code: "UNAUTHORIZED",
          message: "Invalid or expired access token",
        });
      }
    }
  );
};

export default fp(jwtPlugin, {
  name: "jwt-auth",
});
