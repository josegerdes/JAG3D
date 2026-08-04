import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as operationsService from "@/server/modules/operations/service";

export const POST = withApiHandler<{ params: { caseId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const result = await operationsService.undoLastOperation(db, session, params.caseId);
  return NextResponse.json(result);
}, { permission: "tools.transform", requireLicense: true });
