import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY não configurada. " +
        "Gere uma chave com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
        "e adicione INTEGRATION_ENCRYPTION_KEY=<valor> ao .env.local."
    );
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY inválida: esperados 32 bytes (64 chars hex), recebidos ${buf.length} bytes.`
    );
  }
  return buf;
}

export interface EncryptedToken {
  ciphertext: string; // base64 — ciphertext AES-256-GCM
  iv: string;         // hex 24 chars (12 bytes)
  tag: string;        // hex 32 chars (16 bytes) — GCM auth tag
}

export function encryptToken(plaintext: string): EncryptedToken {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

export function decryptToken(enc: EncryptedToken): string {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(enc.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(enc.tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
