import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as operationsService from "@/server/modules/operations/service";
import { integrityCheckSchema } from "@/server/modules/operations/types";

export const POST = withApiHandler<{ params: { caseId: string } }>(async (request, { params, session }) => {
  const body = await request.json();
  const input = integrityCheckSchema.parse(body);
  const db = await connectDB();
  const report = await operationsService.checkIntegrity(db, session, params.caseId, input.syncVersions);
  return NextResponse.json(report);
}, { permission: "cases.view" });
