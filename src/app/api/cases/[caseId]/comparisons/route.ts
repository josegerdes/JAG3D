import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as comparisonsService from "@/server/modules/mesh-comparisons/service";

export const GET = withApiHandler<{ params: { caseId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const comparisons = await comparisonsService.listComparisonsForCase(db, session, params.caseId);
  return NextResponse.json({ comparisons });
}, { permission: "cases.view" });
