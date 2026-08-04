/**
 * Normaliza uma chave PEM vinda de variavel de ambiente, tolerando os jeitos mais comuns de um
 * painel de deploy (Dockploy e afins) estragar um valor multi-linha ao salvar:
 *
 * 1. Aceita a chave como BASE64 DE UMA LINHA SO do arquivo PEM inteiro (recomendado — mais robusto
 *    pra colar num campo de env var, ja que nao depende de quebras de linha sobreviverem).
 * 2. Aceita PEM com `\n` literal (duas letras) em vez de quebra de linha real.
 * 3. Aceita PEM com os marcadores BEGIN/END mas sem NENHUMA quebra de linha interna (colado tudo
 *    espremido numa linha) — reinsere as quebras ao redor dos marcadores.
 */
export function normalizePemEnv(raw: string): string {
  let value = raw.trim();

  if (!value.includes("-----BEGIN")) {
    value = base64Decode(value).trim();
  }

  value = value.replace(/\\n/g, "\n");

  if (!value.includes("\n")) {
    value = value
      .replace(/-----BEGIN ([A-Z ]+)-----/, "-----BEGIN $1-----\n")
      .replace(/-----END ([A-Z ]+)-----/, "\n-----END $1-----");
  }

  return value;
}

function base64Decode(value: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }
  return atob(value);
}
