import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as rolesService from "@/server/modules/roles/service";

export const POST = withApiHandler<{ params: { roleId: string } }>(async (_request, { params }) => {
  const db = await connectDB();
  const role = await rolesService.duplicateRole(db, params.roleId);
  return NextResponse.json({ role }, { status: 201 });
}, { permission: "roles.manage" });
