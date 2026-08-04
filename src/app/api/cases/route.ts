import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as casesService from "@/server/modules/cases/service";
import { createCaseSchema } from "@/server/modules/cases/types";

export const GET = withApiHandler(async (_request, { session }) => {
  const db = await connectDB();
  const cases = await casesService.listMyCases(db, session);
  return NextResponse.json({ cases });
}, { permission: "cases.view" });

export const POST = withApiHandler(async (request, { session }) => {
  const body = await request.json();
  const input = createCaseSchema.parse(body);
  const db = await connectDB();
  const caseDoc = await casesService.createCase(db, session, input);
  return NextResponse.json({ case: caseDoc }, { status: 201 });
}, { permission: "cases.view", requireLicense: true });
