import { NextResponse } from "next/server";

import { getSession } from "@/server/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null }, { status: 401 });

  return NextResponse.json({
    session: {
      userId: session.userId,
      name: session.name,
      email: session.email,
      color: session.color,
      isSuperAdmin: session.isSuperAdmin,
      hasActiveLicense: session.hasActiveLicense,
      permissions: Array.from(session.permissions),
    },
  });
}
