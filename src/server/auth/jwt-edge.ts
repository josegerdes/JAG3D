import { jwtVerify } from "jose";

import { AUTH_COOKIE_NAME } from "@/server/auth/constants";

export { AUTH_COOKIE_NAME };

/**
 * Verificacao do JWT de sessao NO EDGE RUNTIME (via `jose`, isomorfico — ao contrario do
 * `jsonwebtoken` usado em `jwt.ts`, que e Node-only e nao pode rodar em `middleware.ts`). So checa
 * assinatura/expiracao aqui, nao busca o usuario no Mongo (isso continua em `getSession()`,
 * Server Component/API route) — o objetivo e so decidir corretamente se um cookie presente e
 * realmente valido antes de redirecionar, evitando o loop de "cookie velho/invalido trava no
 * meio do caminho entre /login e /".
 */
export async function verifyAuthTokenEdge(token: string): Promise<{ userId: string } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
