import { Mesh } from "three";

import { MeshFormat } from "@/server/db/schema";
import { TransformDelta } from "@/server/lib/rigid-transform";
import { api } from "@/client/api/client";
import { exportMeshToBuffer } from "@/client/engine/loaders";

interface StagedGeometry {
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
  triangleCount: number;
  format: MeshFormat;
}

/** Sobe o resultado de um corte/alivio computado client-side ANTES de commitar (ver stage/route.ts). */
export async function stageGeometryResult(assetId: string, format: MeshFormat, mesh: Mesh): Promise<StagedGeometry> {
  const buffer = exportMeshToBuffer(format, mesh);
  const form = new FormData();
  form.append("file", new Blob([buffer]), `result.${format}`);
  return api.postForm<StagedGeometry>(`/api/mesh-assets/${assetId}/stage`, form);
}

export interface CommitTarget {
  assetId: string;
  expectedSyncVersion: number;
  transformDelta?: TransformDelta;
  geometryReplacement?: Omit<StagedGeometry, "format">;
}

export interface CommitResult {
  sequence: number;
  syncVersions: Record<string, number>;
}

export function commitOperation(caseId: string, type: string, targets: CommitTarget[]) {
  return api.post<CommitResult>("/api/operations/commit", { caseId, type, targets });
}

export function undoLastOperation(caseId: string) {
  return api.post<{ undoneOperationId: string; type: string }>(`/api/cases/${caseId}/undo`);
}

export function checkIntegrity(caseId: string, syncVersions: Record<string, number>) {
  return api.post<{ inSync: boolean; serverSyncVersions: Record<string, number>; mismatchedAssetIds: string[] }>(
    `/api/cases/${caseId}/integrity`,
    { syncVersions }
  );
}
