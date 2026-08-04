import { NextResponse } from "next/server";

import { connectDB } from "@/server/db/client";
import { withApiHandler } from "@/server/http/with-api-handler";
import { ApiError } from "@/server/auth/guards";
import { importCaseArchive } from "@/server/modules/cases/archive";
import { toPublicCase } from "@/server/modules/cases/service";

/** Recria um caso completo (com todas as malhas) a partir de um .zip gerado por /export-zip —
 *  sempre cria um caso NOVO (nunca sobrescreve um existente), pra nunca perder dados por engano. */
export const POST = withApiHandler(async (request, { session }) => {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "Envie o arquivo .zip no campo 'file'");

  const buffer = Buffer.from(await file.arrayBuffer());
  const db = await connectDB();
  const caseDoc = await importCaseArchive(db, session, buffer);
  return NextResponse.json({ case: toPublicCase(caseDoc) }, { status: 201 });
}, { permission: "cases.view", requireLicense: true });
