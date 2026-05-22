import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { BlobPrivateContent, SealedKey } from "./types.js";

const BOX_SALT = new TextEncoder().encode("shelbtrace-box-v1");

// ─── X25519 key derivation from Ed25519 ──────────────────────────────────────

export function getX25519Keys(ed25519PrivHex: string): {
  x25519Priv: Uint8Array;
  x25519Pub:  Uint8Array;
} {
  const privBytes  = hexToBytes(ed25519PrivHex.replace("0x", ""));
  const x25519Priv = ed25519.utils.toMontgomerySecret(privBytes);
  const x25519Pub  = x25519.getPublicKey(x25519Priv);
  return { x25519Priv, x25519Pub };
}

export function ed25519PubToX25519Pub(ed25519PubHex: string): Uint8Array {
  return ed25519.utils.toMontgomery(hexToBytes(ed25519PubHex.replace("0x", "")));
}

// ─── ECDH AES key (using @noble/hashes HKDF) ─────────────────────────────────

async function ecdhAesKey(myPriv: Uint8Array, theirPub: Uint8Array): Promise<CryptoKey> {
  const shared  = x25519.getSharedSecret(myPriv, theirPub);
  const derived = hkdf(sha256, shared, BOX_SALT, new Uint8Array(), 32);
  return crypto.subtle.importKey("raw", derived, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// ─── Seal / unseal ────────────────────────────────────────────────────────────

export async function sealKey(contentKey: Uint8Array, recipientX25519Pub: Uint8Array): Promise<SealedKey> {
  const ephPriv   = x25519.utils.randomPrivateKey();
  const ephPub    = x25519.getPublicKey(ephPriv);
  const aesKey    = await ecdhAesKey(ephPriv, recipientX25519Pub);
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, contentKey);
  return {
    ephemeralPub: bytesToHex(ephPub),
    iv:           bytesToBase64(iv),
    ciphertext:   bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function unsealKey(sealed: SealedKey, recipientX25519Priv: Uint8Array): Promise<Uint8Array> {
  const ephPub = hexToBytes(sealed.ephemeralPub);
  const aesKey = await ecdhAesKey(recipientX25519Priv, ephPub);
  const plain  = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(sealed.iv) },
    aesKey,
    base64ToBytes(sealed.ciphertext)
  );
  return new Uint8Array(plain);
}

// ─── Content decrypt ──────────────────────────────────────────────────────────

export async function decryptContent(
  encryptedContent: { iv: string; ciphertext: string },
  contentKey: Uint8Array
): Promise<BlobPrivateContent> {
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain  = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(encryptedContent.iv) },
    aesKey,
    base64ToBytes(encryptedContent.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plain)) as BlobPrivateContent;
}

export async function decryptWithPrivKey(
  encryptedContent: { iv: string; ciphertext: string },
  sealedKey: SealedKey,
  privateKeyHex: string
): Promise<BlobPrivateContent> {
  const { x25519Priv } = getX25519Keys(privateKeyHex);
  const contentKey     = await unsealKey(sealedKey, x25519Priv);
  return decryptContent(encryptedContent, contentKey);
}

// ─── Action hash verification ─────────────────────────────────────────────────

export function verifyActionHash(action: unknown, expectedHash: string): boolean {
  const bytes = new TextEncoder().encode(JSON.stringify(action));
  const hash  = sha256(bytes);
  return bytesToHex(hash) === expectedHash.toLowerCase();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i));
}

// Legacy: derive AES decryption key from private key (for old blobs)
export async function deriveAesKeyFromPrivateKey(_privateKeyHex: string): Promise<CryptoKey> {
  // Placeholder for backward compat — new blobs use X25519 directly
  throw new Error("Old schema not supported. Use decryptWithPrivKey instead.");
}
