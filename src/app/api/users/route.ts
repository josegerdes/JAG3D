import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as usersService from "@/server/modules/users/service";
import { createUserSchema } from "@/server/modules/users/types";

export const GET = withApiHandler(async () => {
  const db = await connectDB();
  const users = await usersService.listUsers(db);
  return NextResponse.json({ users });
}, { permission: "users.manage" });

export const POST = withApiHandler(async (request) => {
  const body = await request.json();
  const input = createUserSchema.parse(body);
  const db = await connectDB();
  const user = await usersService.createUser(db, input);
  return NextResponse.json({ user }, { status: 201 });
}, { permission: "users.manage" });
