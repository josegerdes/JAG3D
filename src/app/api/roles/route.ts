import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as rolesService from "@/server/modules/roles/service";
import { createRoleSchema } from "@/server/modules/roles/types";

export const GET = withApiHandler(async () => {
  const db = await connectDB();
  const roles = await rolesService.listRoles(db);
  return NextResponse.json({ roles });
}, { permission: "roles.manage" });

export const POST = withApiHandler(async (request) => {
  const body = await request.json();
  const input = createRoleSchema.parse(body);
  const db = await connectDB();
  const role = await rolesService.createRole(db, input);
  return NextResponse.json({ role }, { status: 201 });
}, { permission: "roles.manage" });
