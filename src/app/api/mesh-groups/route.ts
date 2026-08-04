import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as groupsService from "@/server/modules/mesh-groups/service";
import { createGroupSchema } from "@/server/modules/mesh-groups/types";

export const POST = withApiHandler(async (request, { session }) => {
  const body = await request.json();
  const input = createGroupSchema.parse(body);
  const db = await connectDB();
  const group = await groupsService.groupMeshes(db, session, input);
  return NextResponse.json({ group }, { status: 201 });
}, { permission: "tools.group", requireLicense: true });
