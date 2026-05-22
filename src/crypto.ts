import {
  createCipheriv, createDecipheriv,
  randomBytes, createHash, hkdfSync,
} from "node:crypto";
import { x25519, edwardsToMontgomeryPriv } from "@noble/curves/ed25519";
import { Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import type { SealedKey, HermesAction } from "./types.js";

const BOX_SALT = Buffer.from("shelbtrace-box-v1");
const BOX_INFO = Buffer.alloc(0);

// ─── X25519 keys from Ed25519 private key ─────────────────────────────────────

export function getX25519Keys(ed25519PrivHex: string): {
  x25519Priv: Uint8Array;
  x25519Pub:  Uint8Array;
} {
  const privBytes  = new Ed25519PrivateKey(ed25519PrivHex).toUint8Array();
  const x25519Priv = edwardsToMontgomeryPriv(privBytes);
  const x25519Pub  = x25519.getPublicKey(x25519Priv);
  return { x25519Priv, x25519Pub };
}

// ─── ECDH AES key derivation ──────────────────────────────────────────────────

function ecdhAesKey(myPriv: Uint8Array, theirPub: Uint8Array): Buffer {
  const shared = x25519.getSharedSecret(myPriv, theirPub);
  return Buffer.from(hkdfSync("sha256", Buffer.from(shared), BOX_SALT, BOX_INFO, 32));
}

// ─── Seal / unseal content key ────────────────────────────────────────────────

/** Encrypt 32-byte contentKey for a recipient's X25519 public key */
export function sealKey(contentKey: Uint8Array, recipientX25519Pub: Uint8Array): SealedKey {
  const ephPriv = x25519.utils.randomPrivateKey();
  const ephPub  = x25519.getPublicKey(ephPriv);
  const aesKey  = ecdhAesKey(ephPriv, recipientX25519Pub);

  const iv     = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const enc    = Buffer.concat([cipher.update(contentKey), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return {
    ephemeralPub: Buffer.from(ephPub).toString("hex"),
    iv:           iv.toString("base64"),
    ciphertext:   Buffer.concat([enc, tag]).toString("base64"),
  };
}

/** Decrypt a SealedKey using the recipient's X25519 private key */
export function unsealKey(sealed: SealedKey, recipientX25519Priv: Uint8Array): Uint8Array {
  const ephPub = new Uint8Array(Buffer.from(sealed.ephemeralPub, "hex"));
  const aesKey = ecdhAesKey(recipientX25519Priv, ephPub);

  const iv         = Buffer.from(sealed.iv, "base64");
  const full       = Buffer.from(sealed.ciphertext, "base64");
  const ciphertext = full.subarray(0, -16);
  const authTag    = full.subarray(-16);

  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ─── Content encryption ───────────────────────────────────────────────────────

export function encryptContent(plaintext: string): {
  contentKey:       Uint8Array;
  encryptedContent: { iv: string; ciphertext: string };
} {
  const contentKey = randomBytes(32);
  const iv         = randomBytes(12);
  const cipher     = createCipheriv("aes-256-gcm", contentKey, iv);
  const enc        = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag        = cipher.getAuthTag();
  return {
    contentKey,
    encryptedContent: {
      iv:         iv.toString("base64"),
      ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    },
  };
}

export function decryptContent(
  encryptedContent: { iv: string; ciphertext: string },
  contentKey: Uint8Array
): string {
  const iv         = Buffer.from(encryptedContent.iv, "base64");
  const full       = Buffer.from(encryptedContent.ciphertext, "base64");
  const ciphertext = full.subarray(0, -16);
  const authTag    = full.subarray(-16);
  const decipher   = createDecipheriv("aes-256-gcm", Buffer.from(contentKey), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

// ─── Action hashing ───────────────────────────────────────────────────────────

export function hashAction(action: HermesAction): string {
  return createHash("sha256").update(JSON.stringify(action)).digest("hex");
}

export function hashActions(actions: HermesAction[]): string[] {
  return actions.map(hashAction);
}
