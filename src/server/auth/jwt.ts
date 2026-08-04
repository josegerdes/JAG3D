import jwt from "jsonwebtoken";

export { AUTH_COOKIE_NAME } from "@/server/auth/constants";

export interface AuthTokenPayload {
  userId: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Defina a variavel de ambiente JWT_SECRET (.env)");
  }
  return secret;
}

export const AUTH_TOKEN_TTL = "7d";

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: AUTH_TOKEN_TTL, algorithm: "HS256" });
}

/** `algorithms: ["HS256"]` fixado explicitamente — sem isso, `jwt.verify` aceita
 *  qualquer algoritmo presente no header do token (ataque de confusao de algoritmo). */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as AuthTokenPayload;
  } catch {
    return null;
  }
}
