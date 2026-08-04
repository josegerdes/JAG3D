import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as rolesService from "@/server/modules/roles/service";
import { updateRoleSchema } from "@/server/modules/roles/types";

export const PATCH = withApiHandler<{ params: { roleId: string } }>(async (request, { params }) => {
  const body = await request.json();
  const input = updateRoleSchema.parse(body);
  const db = await connectDB();
  const role = await rolesService.updateRole(db, params.roleId, input);
  return NextResponse.json({ role });
}, { permission: "roles.manage" });

export const DELETE = withApiHandler<{ params: { roleId: string } }>(async (_request, { params }) => {
  const db = await connectDB();
  await rolesService.deleteRole(db, params.roleId);
  return NextResponse.json({ ok: true });
}, { permission: "roles.manage" });
