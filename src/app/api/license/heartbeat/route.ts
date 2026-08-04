import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import { issueCapabilityTokenIfLicensed } from "@/server/modules/licenses/service";

/**
 * Chamado periodicamente pela engine (~10min, menor que o TTL de 15min do
 * capability token — ver SECURITY.md). Se a licenca foi revogada/expirou no
 * servidor, simplesmente para de devolver token novo — sem push de
 * revogacao especial, o token antigo so expira sozinho.
 */
export const POST = withApiHandler(async (_request, { session }) => {
  const db = await connectDB();
  const capabilityToken = await issueCapabilityTokenIfLicensed(db, session.userId);
  if (!capabilityToken) {
    return NextResponse.json({ licensed: false, capabilityToken: null }, { status: 402 });
  }
  return NextResponse.json({ licensed: true, capabilityToken });
});
