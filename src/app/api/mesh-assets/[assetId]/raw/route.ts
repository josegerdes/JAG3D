import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as meshAssetsService from "@/server/modules/mesh-assets/service";

/**
 * Bytes crus da malha para CARREGAR NO VIEWPORT (nao para o usuario baixar/levar embora — isso e
 * `/export`, que tem `Content-Disposition: attachment`). Ainda assim exige licenca ativa: usar o
 * editor (mesmo so pra visualizar) e a funcionalidade paga do produto.
 */
export const GET = withApiHandler<{ params: { assetId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const { asset, buffer } = await meshAssetsService.exportMeshAsset(db, session, params.assetId);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/octet-stream", "X-Mesh-Format": asset.format },
  });
}, { permission: "cases.view", requireLicense: true });
