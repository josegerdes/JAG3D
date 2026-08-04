import { importSPKI, jwtVerify } from "jose";

/**
 * Verificacao do capability token DENTRO DO NAVEGADOR — usa `jose` (isomorfico) contra a chave
 * publica, buscada em runtime via `/api/license/public-key` (cacheada em memoria apos a primeira
 * chamada) em vez de depender de `NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY` inlinada no bundle no
 * momento do build — essa dependencia de build ARG e uma classe de bug recorrente nesta linhagem
 * de projetos (facil esquecer/configurar errado no painel de deploy), eliminada buscando em
 * runtime. Isso e so a camada 2 de defesa (ver SECURITY.md) — deixa a engine travar `execute()` de
 * uma ferramenta sem round-trip de rede a cada clique, mas NUNCA substitui a checagem de licenca
 * feita no servidor em save/export (a trava dura de verdade). Um usuario determinado pode
 * inspecionar/patchear este arquivo — sabido e aceito, ver o modelo de ameaca em SECURITY.md.
 */
const ALG = "ES256";

let cachedKey: Awaited<ReturnType<typeof importSPKI>> | null = null;
let pendingFetch: Promise<Awaited<ReturnType<typeof importSPKI>>> | null = null;

async function getPublicKey() {
  if (cachedKey) return cachedKey;
  if (!pendingFetch) {
    pendingFetch = (async () => {
      const response = await fetch("/api/license/public-key");
      if (!response.ok) throw new Error("Falha ao buscar chave publica de licenca do servidor");
      const { publicKey } = (await response.json()) as { publicKey: string };
      cachedKey = await importSPKI(publicKey, ALG);
      return cachedKey;
    })();
  }
  return pendingFetch;
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
