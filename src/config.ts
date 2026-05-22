import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

export const CONFIG_DIR = join(homedir(), ".shelbtrace");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const ConfigSchema = z.object({
  privateKey: z.string().min(1),
  network: z.enum(["testnet", "shelbynet", "local"]).default("shelbynet"),
  expiryDays: z.number().int().min(1).max(365).default(30),
});

export const PartialConfigSchema = ConfigSchema.partial();
export type Config = z.infer<typeof ConfigSchema>;
export type PartialConfig = z.infer<typeof PartialConfigSchema>;

export function configExists(): boolean {
  return existsSync(CONFIG_FILE);
}

export function isConfigComplete(): boolean {
  if (!configExists()) return false;
  try {
    return ConfigSchema.safeParse(JSON.parse(readFileSync(CONFIG_FILE, "utf-8"))).success;
  } catch {
    return false;
  }
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error("shelbtrace is not configured. Run: npm run setup");
  }
  return ConfigSchema.parse(JSON.parse(readFileSync(CONFIG_FILE, "utf-8")));
}

export function loadPartialConfig(): PartialConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return PartialConfigSchema.parse(JSON.parse(readFileSync(CONFIG_FILE, "utf-8")));
  } catch {
    return {};
  }
}

export function saveConfig(config: PartialConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = loadPartialConfig();
  writeFileSync(CONFIG_FILE, JSON.stringify({ ...existing, ...config }, null, 2), "utf-8");
}

/** Auto-generate a new Ed25519 keypair, save private key, return address. */
export function generateAndSaveKeypair(): string {
  const account = Account.generate();
  saveConfig({ privateKey: account.privateKey.toString() });
  return account.accountAddress.toString();
}

/** Derive the Aptos address from the stored private key. */
export function getAddress(): string {
  const cfg = loadPartialConfig();
  if (!cfg.privateKey) return generateAndSaveKeypair();
  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(cfg.privateKey) });
  return account.accountAddress.toString();
}
