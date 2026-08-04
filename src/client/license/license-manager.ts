import { api } from "@/client/api/client";
import { verifyCapabilityTokenClient } from "@/client/license/verify-capability-token";

/**
 * Gerencia o capability token no navegador: pede um novo no heartbeat periodico e verifica
 * localmente (via `jose`, camada 2 do esquema de licenciamento — ver SECURITY.md) antes de deixar
 * a engine executar uma ferramenta. NUNCA e a fonte de verdade — save/export sempre rechecam no
 * servidor (camada 4). Se o heartbeat parar de devolver token (licenca revogada/expirada), o token
 * em cache so expira sozinho (~15min) e as ferramentas travam.
 */
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;

export class LicenseManager {
  private token: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(licensed: boolean) => void>();

  async start(): Promise<boolean> {
    const licensed = await this.heartbeat();
    if (!this.intervalId) {
      this.intervalId = setInterval(() => void this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    }
    return licensed;
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  onChange(listener: (licensed: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async heartbeat(): Promise<boolean> {
    try {
      const result = await api.post<{ licensed: boolean; capabilityToken: string | null }>("/api/license/heartbeat");
      this.token = result.capabilityToken;
      this.notify(result.licensed);
      return result.licensed;
    } catch {
      this.token = null;
      this.notify(false);
      return false;
    }
  }

  private notify(licensed: boolean): void {
    for (const listener of this.listeners) listener(licensed);
  }

  /** Gate local — cada ferramenta chama isso antes de `execute()`. Verificacao criptografica real
   *  (nao so "token existe"), mas so a camada 2: o backstop de verdade e o servidor em save/export. */
  async hasValidToken(): Promise<boolean> {
    if (!this.token) return false;
    const claims = await verifyCapabilityTokenClient(this.token);
    return claims !== null;
  }
}

export const licenseManager = new LicenseManager();
