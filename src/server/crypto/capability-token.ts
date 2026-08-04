import { SignJWT, importPKCS8, importSPKI, jwtVerify } from "jose";

import { normalizePemEnv } from "@/lib/pem";

/**
 * Token de capacidade de licenca — deliberadamente SEPARADO do JWT de sessao
 * (que usa HS256 com um segredo simetrico so verificavel no servidor). Este
 * usa um par de chaves assimetrico ES256: a chave privada nunca sai do
 * servidor, mas a chave publica pode ser embutida no bundle client
 * (`NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY`) para a engine 3D verificar a
 * autenticidade/validade do token no navegador, sem round-trip de rede por
 * clique de ferramenta. TTL curto (~15min) — ver SECURITY.md, camada 2.
 */
const ALG = "ES256";
export const CAPABILITY_TOKEN_TTL_SECONDS = 15 * 60;

export interface CapabilityTokenPayload {
  licenseId: string;
  userId: string;
}

async function getPrivateKey() {
  const pem = process.env.LICENSE_TOKEN_PRIVATE_KEY;
  if (!pem) throw new Error("Defina a variavel de ambiente LICENSE_TOKEN_PRIVATE_KEY (.env)");
  return importPKCS8(normalizePemEnv(pem), ALG);
}

async function getPublicKey() {
  const pem = process.env.LICENSE_TOKEN_PUBLIC_KEY;
  if (!pem) throw new Error("Defina a variavel de ambiente LICENSE_TOKEN_PUBLIC_KEY (.env)");
  return importSPKI(normalizePemEnv(pem), ALG);
}

export async function signCapabilityToken(payload: CapabilityTokenPayload): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${CAPABILITY_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

/** Verificacao server-side (ex: numa rota que quer aceitar o token como atalho, alem da sessao). */
export async function verifyCapabilityToken(token: string): Promise<CapabilityTokenPayload | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    return payload as unknown as CapabilityTokenPayload;
  } catch {
    return null;
  }
}
