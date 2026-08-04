import { redirect } from "next/navigation";

import { getSession } from "@/server/auth/session";
import { connectDB } from "@/server/db/client";
import * as casesService from "@/server/modules/cases/service";
import { CasesDashboard } from "@/components/cases/cases-dashboard";

export default async function HomePage() {
  // O middleware (Edge) ja filtra token com assinatura invalida, mas o usuario pode ter sido
  // desativado ou o cookie pode ter expirado entre a verificacao de assinatura e esta chamada —
  // redireciona pro login em vez de renderizar em branco (bug real ja visto: pagina vazia presa).
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const db = await connectDB();
  const cases = await casesService.listMyCases(db, session);

  return (
    <CasesDashboard
      session={{
        name: session.name,
        email: session.email,
        isSuperAdmin: session.isSuperAdmin,
        hasActiveLicense: session.hasActiveLicense,
      }}
      initialCases={cases}
    />
  );
}
