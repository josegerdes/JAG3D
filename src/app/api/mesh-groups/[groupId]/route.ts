import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as groupsService from "@/server/modules/mesh-groups/service";
import { updateGroupSchema } from "@/server/modules/mesh-groups/types";

export const PATCH = withApiHandler<{ params: { groupId: string } }>(async (request, { params, session }) => {
  const body = await request.json();
  const input = updateGroupSchema.parse(body);
  const db = await connectDB();
  const group = await groupsService.updateGroup(db, session, params.groupId, input);
  return NextResponse.json({ group });
}, { permission: "tools.group", requireLicense: true });

export const DELETE = withApiHandler<{ params: { groupId: string } }>(async (_request, { params, session }) => {
  const db = await connectDB();
  await groupsService.ungroup(db, session, params.groupId);
  return NextResponse.json({ ok: true });
}, { permission: "tools.group", requireLicense: true });
