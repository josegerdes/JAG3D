import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { MeshFormat } from "@/server/db/schema";
import { ApiError } from "@/server/auth/guards";

/**
 * Arquivos de malha vivem num volume Docker (`mesh-data:/data/meshes` em producao,
 * `./storage/meshes` em dev), nao no Mongo — GridFS infla o working set a toa pra
 * arquivos de dezenas/centenas de MB. Layout endereçado por conteudo: nunca colide,
 * nunca sobrescreve, e permite dedup implicito se dois uploads tiverem bytes identicos.
 */
function storageRoot(): string {
  return process.env.MESH_STORAGE_DIR ?? "./storage/meshes";
}

export function checksumOf(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function storageKeyFor(checksum: string, format: MeshFormat): string {
  return path.posix.join(checksum.slice(0, 2), `${checksum}.${format}`);
}

/**
 * Grava e depois LE DE VOLTA imediatamente pra confirmar que o arquivo realmente persistiu antes
 * do upload ser considerado sucesso. Sem isso, um problema de volume/permissao no deploy (write
 * "silenciosamente" incompleto, ou volume montado como read-only em algum ponto do caminho, ou —
 * mais sutil ainda — multiplas replicas do container sem volume COMPARTILHADO, onde o proprio
 * write funciona normal na replica que recebeu o upload mas nenhuma leitura futura bate
 * necessariamente na mesma replica) so seria descoberto muito depois, na hora de visualizar a
 * malha — tarde demais pra dar um erro acionavel pro usuario no momento certo (o upload).
 */
export async function saveMeshFile(storageKey: string, buffer: Buffer): Promise<void> {
  const fullPath = path.join(storageRoot(), storageKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  const verify = await fs.readFile(fullPath).catch(() => null);
  if (!verify || !verify.equals(buffer)) {
    throw new ApiError(
      500,
      "Falha ao confirmar a gravacao do arquivo de malha no armazenamento (verifique se o volume de dados esta montado e com permissao de escrita)"
    );
  }
}

/**
 * Se o arquivo nao existir no disco (ENOENT), converte pra um 404 claro em vez de deixar o 500
 * generico do `withApiHandler`. Causa mais comum disso na pratica: `MESH_STORAGE_DIR` nao esta
 * num volume Docker PERSISTENTE de verdade — cada redeploy recria o filesystem do container do
 * zero, apagando arquivos ja enviados enquanto o registro no Mongo continua existindo (base
 * separada, persistente) — ver ARCHITECTURE.md/docker-compose.yml (`mesh-data:/data/meshes`).
 */
export async function readMeshFile(storageKey: string): Promise<Buffer> {
  try {
    return await fs.readFile(path.join(storageRoot(), storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ApiError(
        404,
        "Arquivo de malha nao encontrado no armazenamento (provavelmente perdido num redeploy sem volume persistente — reenvie a malha)"
      );
    }
    throw error;
  }
}

export async function deleteMeshFile(storageKey: string): Promise<void> {
  await fs.rm(path.join(storageRoot(), storageKey), { force: true });
}
