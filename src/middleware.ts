import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/server/auth/constants";
import { verifyAuthTokenEdge } from "@/server/auth/jwt-edge";

const PUBLIC_PATHS = ["/login"];

/**
 * Redirect em edge runtime — verifica a ASSINATURA do JWT via `jose` (isomorfico, ao contrario do
 * `jsonwebtoken` Node-only usado no resto do app), mas nao busca o usuario no Mongo (isso continua
 * em `getSession()`, Server Component/rota). Um cookie presente porem invalido/expirado (secret
 * trocado, token velho) e tratado como "sem sessao" e LIMPO aqui — sem isso, um cookie invalido
 * causava loop: middleware achava que tinha sessao (so checava presenca) e bloqueava /login, mas a
 * pagina via a sessao como null e nao redirecionava de volta, travando o usuario numa pagina em branco.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const session = token ? await verifyAuthTokenEdge(token) : null;

  if (!session && !isPublicPath) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return response;
  }

  if (session && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
