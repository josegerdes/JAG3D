import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as groupsService from "@/server/modules/mesh-groups/service";

export const GET = withApiHandler<{ params: { caseId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const groups = await groupsService.listGroupsForCase(db, session, params.caseId);
  return NextResponse.json({ groups });
}, { permission: "cases.view" });
