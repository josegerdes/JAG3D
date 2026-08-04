import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import * as usersService from "@/server/modules/users/service";
import { changePasswordSchema } from "@/server/modules/users/types";

export const POST = withApiHandler<{ params: { userId: string } }>(async (request, { params, session }) => {
  const body = await request.json();
  const input = changePasswordSchema.parse(body);
  // Um usuario sempre pode trocar a propria senha; trocar a de outro exige users.manage.
  if (params.userId !== session.userId && !session.permissions.has("users.manage")) {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }
  const db = await connectDB();
  const user = await usersService.changePassword(db, params.userId, input);
  return NextResponse.json({ user });
});
