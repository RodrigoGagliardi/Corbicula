import type { FastifyReply } from "fastify/types/reply";
import type { FastifyRequest } from "fastify/types/request";
import jwt from "jsonwebtoken";
import { env } from "../env";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    await reply.status(401).send({ error: "Token não fornecido" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      email: string;
    };
    request.userId = payload.sub;
  } catch {
    await reply.status(401).send({ error: "Token inválido ou expirado" });
  }
}
