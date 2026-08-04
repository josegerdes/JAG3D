import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as rolesService from "@/server/modules/roles/service";
import { reorderRolesSchema } from "@/server/modules/roles/types";

export const POST = withApiHandler(async (request) => {
  const body = await request.json();
  const input = reorderRolesSchema.parse(body);
  const db = await connectDB();
  const roles = await rolesService.reorderRoles(db, input);
  return NextResponse.json({ roles });
}, { permission: "roles.manage" });
