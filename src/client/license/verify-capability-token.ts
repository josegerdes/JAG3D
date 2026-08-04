import { importSPKI, jwtVerify } from "jose";

import { normalizePemEnv } from "@/lib/pem";

/**
 * Verificacao do capability token DENTRO DO NAVEGADOR — usa `jose` (isomorfico)
 * contra a chave publica embutida no bundle (`NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY`).
 * Isso e so a camada 2 de defesa (ver SECURITY.md) — deixa a engine travar
 * `execute()` de uma ferramenta sem round-trip de rede a cada clique, mas
 * NUNCA substitui a checagem de licenca feita no servidor em save/export
 * (a trava dura de verdade). Um usuario determinado pode inspecionar/patchear
 * este arquivo — sabido e aceito, ver o modelo de ameaca em SECURITY.md.
 */
const ALG = "ES256";

let cachedKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

async function getPublicKey() {
  if (cachedKey) return cachedKey;
  const pem = process.env.NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY;
  if (!pem) throw new Error("NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY nao configurada no build");
  cachedKey = await importSPKI(normalizePemEnv(pem), ALG);
  return cachedKey;
}

export interface CapabilityTokenClaims {
  licenseId: string;
  userId: string;
  exp: number;
}

export async function verifyCapabilityTokenClient(token: string): Promise<CapabilityTokenClaims | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    return payload as unknown as CapabilityTokenClaims;
  } catch {
    return null;
  }
}
