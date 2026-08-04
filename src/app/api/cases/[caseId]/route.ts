import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as casesService from "@/server/modules/cases/service";
import { updateCaseSchema } from "@/server/modules/cases/types";

export const GET = withApiHandler<{ params: { caseId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  const caseDoc = await casesService.getCaseForSession(db, session, params.caseId);
  return NextResponse.json({ case: casesService.toPublicCase(caseDoc) });
}, { permission: "cases.view" });

export const PATCH = withApiHandler<{ params: { caseId: string } }>(async (request, { params, session }) => {
  const body = await request.json();
  const input = updateCaseSchema.parse(body);
  const db = await connectDB();
  const caseDoc = await casesService.updateCase(db, session, params.caseId, input);
  return NextResponse.json({ case: caseDoc });
}, { permission: "cases.view", requireLicense: true });

export const DELETE = withApiHandler<{ params: { caseId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  await casesService.deleteCase(db, session, params.caseId);
  return NextResponse.json({ ok: true });
}, { permission: "cases.view" });
