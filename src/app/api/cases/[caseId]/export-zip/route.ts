import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import { exportCaseArchive } from "@/server/modules/cases/archive";

/**
 * Backup portatil do caso inteiro (metadados + TODOS os bytes de malha reais) num .zip — o
 * usuario pode baixar isso a qualquer momento e restaurar via /api/cases/import-zip, sem depender
 * so do armazenamento do servidor continuar intacto pra sempre (ver ARCHITECTURE.md).
 */
export const GET = withApiHandler<{ params: { caseId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const { buffer, filename } = await exportCaseArchive(db, session, params.caseId);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}, { permission: "meshes.export", requireLicense: true });
