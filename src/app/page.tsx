import { getSession } from "@/server/auth/session";
import { connectDB } from "@/server/db/client";
import * as casesService from "@/server/modules/cases/service";
import { CasesDashboard } from "@/components/cases/cases-dashboard";

export default async function HomePage() {
  // O middleware (Edge) so garante que existe cookie — a sessao de verdade (JWT valido + usuario
  // ativo) e resolvida aqui, em Server Component com acesso ao Mongo. `session` nunca deveria ser
  // null nesta rota (middleware ja redireciona pra /login sem cookie), mas o TS exige o checkout.
  const session = await getSession();
  if (!session) {
    return null;
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
