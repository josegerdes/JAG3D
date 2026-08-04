import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as comparisonsService from "@/server/modules/mesh-comparisons/service";
import { createComparisonSchema } from "@/server/modules/mesh-comparisons/types";

export const POST = withApiHandler(async (request, { session }) => {
  const body = await request.json();
  const input = createComparisonSchema.parse(body);
  const db = await connectDB();
  const comparison = await comparisonsService.createComparison(db, session, input);
  return NextResponse.json({ comparison }, { status: 201 });
}, { permission: "tools.compare", requireLicense: true });
