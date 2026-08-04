import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { MeshFormat } from "@/server/db/schema";

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

export async function saveMeshFile(storageKey: string, buffer: Buffer): Promise<void> {
  const fullPath = path.join(storageRoot(), storageKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

export async function readMeshFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(path.join(storageRoot(), storageKey));
}

export async function deleteMeshFile(storageKey: string): Promise<void> {
  await fs.rm(path.join(storageRoot(), storageKey), { force: true });
}
