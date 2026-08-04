import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { comparePassword } from "@/server/auth/password";
import { AUTH_COOKIE_NAME, signAuthToken } from "@/server/auth/jwt";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Informe email e senha validos" }, { status: 422 });
  }
  const { email, password } = parsed.data;

  const db = await connectDB();
  const user = await collections.users(db).findOne({ email: email.toLowerCase(), active: true });
  if (!user) {
    return NextResponse.json({ message: "Credenciais invalidas" }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { message: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutesLeft} min.` },
      { status: 429 }
    );
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    const failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    const locking = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;
    await collections.users(db).updateOne(
      { _id: user._id },
      {
        $set: {
          failedLoginAttempts: locking ? 0 : failedLoginAttempts,
          lockedUntil: locking ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      }
    );
    return NextResponse.json({ message: "Credenciais invalidas" }, { status: 401 });
  }

  if (user.failedLoginAttempts || user.lockedUntil) {
    await collections.users(db).updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  const token = signAuthToken({ userId: user._id.toHexString() });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttpsRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

/**
 * Um cookie `Secure` so e aceito pelo navegador em conexoes HTTPS. Basear
 * isso so em `NODE_ENV === "production"` quebra silenciosamente o login em
 * deploys atras de proxy sem HTTPS configurado ainda — detecta o protocolo
 * de verdade pelo header que o proxy reverso injeta.
 */
function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0]?.trim() === "https";
  return request.nextUrl.protocol === "https:";
}
