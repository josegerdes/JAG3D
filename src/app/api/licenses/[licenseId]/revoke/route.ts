import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as licensesService from "@/server/modules/licenses/service";
import { revokeLicenseSchema } from "@/server/modules/licenses/types";

export const POST = withApiHandler<{ params: { licenseId: string } }>(async (request, { params }) => {
  const body = await request.json().catch(() => ({}));
  const input = revokeLicenseSchema.parse(body);
  const db = await connectDB();
  const license = await licensesService.revokeLicense(db, params.licenseId, input);
  return NextResponse.json({ license });
}, { permission: "license.manage" });
