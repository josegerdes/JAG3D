import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as meshAssetsService from "@/server/modules/mesh-assets/service";
import { updateMeshAssetSchema } from "@/server/modules/mesh-assets/types";

export const PATCH = withApiHandler<{ params: { assetId: string } }>(async (request, { params, session }) => {
  const body = await request.json();
  const input = updateMeshAssetSchema.parse(body);
  const db = await connectDB();
  const asset = await meshAssetsService.updateMeshAsset(db, session, params.assetId, input);
  return NextResponse.json({ asset });
}, { permission: "tools.transform", requireLicense: true });

export const DELETE = withApiHandler<{ params: { assetId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  await meshAssetsService.deleteMeshAsset(db, session, params.assetId);
  return NextResponse.json({ ok: true });
}, { permission: "cases.view" });
