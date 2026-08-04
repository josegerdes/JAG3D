import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import { ApiError } from "@/server/auth/guards";
import * as meshAssetsService from "@/server/modules/mesh-assets/service";

/** Segundo passo do fluxo corte/alivio: sobe o resultado computado client-side ANTES de chamar
 *  /api/operations/commit com o geometryReplacement retornado aqui. */
export const POST = withApiHandler<{ params: { assetId: string } }>(async (request, { params, session }) => {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "Envie o arquivo no campo 'file'");

  const buffer = Buffer.from(await file.arrayBuffer());
  const db = await connectDB();
  const staged = await meshAssetsService.stageGeometryBlob(db, session, params.assetId, buffer);
  return NextResponse.json(staged);
}, { permission: "tools.transform", requireLicense: true });
