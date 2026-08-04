import { importSPKI, jwtVerify } from "jose";

/**
 * Verificacao do capability token DENTRO DO NAVEGADOR — usa `jose` (isomorfico) contra a chave
 * publica, buscada em runtime via `/api/license/public-key` (cacheada em memoria apos a primeira
 * chamada) em vez de depender de `NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY` inlinada no bundle no
 * momento do build. Isso e so a camada 2 de defesa (ver SECURITY.md) — deixa a engine travar
 * `execute()` de uma ferramenta sem round-trip de rede a cada clique, mas NUNCA substitui a
 * checagem de licenca feita no servidor em save/export (a trava dura de verdade). Um usuario
 * determinado pode inspecionar/patchear este arquivo — sabido e aceito, ver o modelo de ameaca em
 * SECURITY.md.
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

/**
 * `crypto.subtle` (Web Crypto) so existe em CONTEXTO SEGURO (HTTPS ou localhost) — num deploy
 * ainda sem SSL configurado (http:// puro), `crypto.subtle` e `undefined` e qualquer chamada de
 * `jose` que dependa dele lanca `TypeError: Cannot read properties of undefined (reading
 * 'importKey')`. Mesma classe de bug ja vista com `crypto.randomUUID()` em outro projeto desta
 * linhagem. Como esta verificacao e so a camada 2 (conveniencia de UX, nunca a fronteira real de
 * seguranca — isso e sempre o servidor em save/export), o fallback aqui e decodificar o payload
 * sem verificar assinatura e confiar so na expiracao, em vez de bloquear o usuario inteiro por um
 * detalhe de infraestrutura (SSL) que nao tem nada a ver com a licenca dele estar ativa ou nao.
 */
function isSecureContextAvailable(): boolean {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle);
}

function decodeWithoutVerifying(token: string): CapabilityTokenClaims | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as CapabilityTokenClaims;
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function verifyCapabilityTokenClient(token: string): Promise<CapabilityTokenClaims | null> {
  if (!isSecureContextAvailable()) {
    console.warn(
      "[license] crypto.subtle indisponivel (site sem HTTPS) — verificando so a expiracao do token, sem assinatura. Configure SSL no deploy assim que possivel."
    );
    return decodeWithoutVerifying(token);
  }

  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    return payload as unknown as CapabilityTokenClaims;
  } catch (error) {
    console.error("[license] Falha ao verificar capability token no navegador:", error);
    return null;
  }
}
