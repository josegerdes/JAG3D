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
    pendingFetch = fetchAndImportPublicKey().catch((error) => {
      // Sem isso, uma falha transitoria (rede instavel, servidor reiniciando) na PRIMEIRA busca
      // deixava `pendingFetch` travado numa promise rejeitada pra sempre — nenhuma chamada seguinte
      // tentava de novo, mesmo depois do servidor voltar. Reseta pra permitir retry na proxima vez.
      pendingFetch = null;
      throw error;
    });
  }
  return pendingFetch;
}

async function fetchAndImportPublicKey() {
  const response = await fetch("/api/license/public-key");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Falha ao buscar chave publica de licenca (HTTP ${response.status}): ${body.message ?? "sem detalhe"}`);
  }
  const { publicKey } = (await response.json()) as { publicKey: string };
  cachedKey = await importSPKI(publicKey, ALG);
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
  } catch (error) {
    // Log (nao silencioso) — sem isso e impossivel diferenciar "chave publica mal configurada no
    // servidor" de "token realmente expirado" de dentro do navegador, o que ja causou pelo menos
    // duas rodadas de debug remoto sem visibilidade real do erro.
    console.error("[license] Falha ao verificar capability token no navegador:", error);
    return null;
  }
}
