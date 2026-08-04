import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getSession, Session } from "@/server/auth/session";
import {
  ApiError,
  requireActiveLicense,
  requireAuth,
  requirePermission,
  requireSuperAdmin,
} from "@/server/auth/guards";

type Handler<Ctx> = (request: NextRequest, ctx: { session: Session } & Ctx) => Promise<Response>;

interface Options {
  permission?: string;
  /** Exige a role padrao "Administrador". */
  requireSuperAdmin?: boolean;
  /** Exige `LicenseDoc` ativa e nao expirada — camada 1 do esquema de licenciamento (ver SECURITY.md).
   *  Usar em toda rota que muta dado de caso/malha (o backstop real fica no save/export, que sempre
   *  passa por aqui tambem). */
  requireLicense?: boolean;
}

/**
 * Padroniza autenticacao/autorizacao/licenca e o formato de erro das rotas de API.
 */
export function withApiHandler<Ctx = Record<string, never>>(
  handler: Handler<Ctx>,
  options: Options = {}
) {
  return async (request: NextRequest, routeCtx: Ctx): Promise<Response> => {
    try {
      const session = requireAuth(await getSession());
      if (options.requireSuperAdmin) {
        requireSuperAdmin(session);
      }
      if (options.permission) {
        requirePermission(session, options.permission);
      }
      if (options.requireLicense) {
        requireActiveLicense(session);
      }
      return await handler(request, { session, ...routeCtx });
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { message: "Dados invalidos", issues: error.issues },
          { status: 422 }
        );
      }
      console.error(error);
      return NextResponse.json({ message: "Erro interno" }, { status: 500 });
    }
  };
}
