import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as comparisonsService from "@/server/modules/mesh-comparisons/service";
import { setAlignmentSchema } from "@/server/modules/mesh-comparisons/types";

export const PATCH = withApiHandler<{ params: { comparisonId: string } }>(async (request, { params, session }) => {
  const body = await request.json();
  const input = setAlignmentSchema.parse(body);
  const db = await connectDB();
  const comparison = await comparisonsService.setAlignment(db, session, params.comparisonId, input);
  return NextResponse.json({ comparison });
}, { permission: "tools.compare", requireLicense: true });

export const DELETE = withApiHandler<{ params: { comparisonId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  await comparisonsService.deleteComparison(db, session, params.comparisonId);
  return NextResponse.json({ ok: true });
}, { permission: "tools.compare" });
