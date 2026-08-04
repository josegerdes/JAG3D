import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as licensesService from "@/server/modules/licenses/service";
import { issueLicenseSchema } from "@/server/modules/licenses/types";

export const GET = withApiHandler(async () => {
  const db = await connectDB();
  const licenses = await licensesService.listLicenses(db);
  return NextResponse.json({ licenses });
}, { permission: "license.manage" });

export const POST = withApiHandler(async (request, { session }) => {
  const body = await request.json();
  const input = issueLicenseSchema.parse(body);
  const db = await connectDB();
  const license = await licensesService.issueLicense(db, session.userId, input);
  return NextResponse.json({ license }, { status: 201 });
}, { permission: "license.manage" });
