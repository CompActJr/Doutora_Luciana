import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AccessError } from "../users/service.js";
export function encryptToken(value: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from("dra-google-calendar-v1"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptToken(value: string, key: string) {
  try {
    const [version, iv, tag, encrypted] = value.split(".");
    if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("format");
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from("dra-google-calendar-v1")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new AccessError(503, "Não foi possível acessar a credencial da agenda. Confira a chave de criptografia no servidor."); }
}
