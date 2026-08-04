import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error("Defina a variavel de ambiente APP_SECRET (.env)");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/** Criptografa um segredo para guardar no Mongo. */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Payload criptografado invalido");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskSecret(plainText: string): string {
  if (plainText.length <= 8) return "********";
  return `${plainText.slice(0, 6)}****${plainText.slice(-4)}`;
}

export function generateToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}
