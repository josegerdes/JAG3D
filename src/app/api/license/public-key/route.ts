import { NextResponse } from "next/server";

import { withApiHandler } from "@/server/http/with-api-handler";
import { normalizePemEnv } from "@/lib/pem";

/**
 * Serve a chave PUBLICA do capability token em runtime, em vez de depender de
 * `NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY` inlinada no bundle no momento do build. Essa mudanca
 * elimina de vez a classe de bug recorrente nesta linhagem de projetos (Facebook Pixel ID, chave
 * publica do Mercado Pago): toda variavel `NEXT_PUBLIC_*` precisa ser passada como Docker build ARG
 * (nao so runtime env var), e e facil esquecer/configurar errado no painel de deploy — o servidor
 * ja sabe a chave publica e servir ela em runtime nao vaza nada sensivel (e uma chave publica, por
 * definicao segura de expor).
 */
export const GET = withApiHandler(async () => {
  const raw = process.env.LICENSE_TOKEN_PUBLIC_KEY;
  if (!raw) {
    return NextResponse.json({ message: "LICENSE_TOKEN_PUBLIC_KEY nao configurada no servidor" }, { status: 500 });
  }
  return NextResponse.json({ publicKey: normalizePemEnv(raw) });
});
