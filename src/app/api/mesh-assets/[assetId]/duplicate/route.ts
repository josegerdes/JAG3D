import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as meshAssetsService from "@/server/modules/mesh-assets/service";

export const POST = withApiHandler<{ params: { assetId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const asset = await meshAssetsService.duplicateMeshAsset(db, session, params.assetId);
  return NextResponse.json({ asset }, { status: 201 });
}, { permission: "tools.duplicate", requireLicense: true });
