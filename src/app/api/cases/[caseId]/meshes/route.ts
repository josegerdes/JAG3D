import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import { ApiError } from "@/server/auth/guards";
import * as meshAssetsService from "@/server/modules/mesh-assets/service";

export const GET = withApiHandler<{ params: { caseId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const assets = await meshAssetsService.listAssetsForCase(db, session, params.caseId);
  return NextResponse.json({ assets });
}, { permission: "cases.view" });

export const POST = withApiHandler<{ params: { caseId: string } }>(async (request, { params, session }) => {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "Envie o arquivo no campo 'file'");

  const name = (formData.get("name") as string | null) ?? file.name;
  const buffer = Buffer.from(await file.arrayBuffer());

  const db = await connectDB();
  const asset = await meshAssetsService.uploadMeshAsset(db, session, params.caseId, name, buffer);
  return NextResponse.json({ asset }, { status: 201 });
}, { permission: "meshes.upload", requireLicense: true });
