import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as meshAssetsService from "@/server/modules/mesh-assets/service";

/**
 * Trava dura de licenca (backstop real de comercializacao — ver SECURITY.md camada 4):
 * `requireLicense: true` recheca `LicenseDoc` fresco no servidor a cada chamada, independente do
 * capability token que o cliente tenha em cache. Uma licenca revogada bloqueia isso na proxima
 * tentativa, mesmo que o bundle client tenha sido adulterado pra pular a trava local.
 */
export const GET = withApiHandler<{ params: { assetId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const { asset, buffer } = await meshAssetsService.exportMeshAsset(db, session, params.assetId);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asset.name.replace(/["\\]/g, "")}.${asset.format}"`,
    },
  });
}, { permission: "meshes.export", requireLicense: true });
