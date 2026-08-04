import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as operationsService from "@/server/modules/operations/service";
import { commitOperationSchema } from "@/server/modules/operations/types";

export const POST = withApiHandler(async (request, { session }) => {
  const body = await request.json();
  const input = commitOperationSchema.parse(body);
  const db = await connectDB();
  const result = await operationsService.commitOperation(db, session, input);
  return NextResponse.json(result);
}, { permission: "tools.transform", requireLicense: true });
