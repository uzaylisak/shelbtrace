/**
 * Fund the shelbtrace account with ShelbyUSD on testnet.
 * Run once before smoke.ts:  npx tsx test/fund.ts
 */
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { loadConfig } from "../src/config.js";

const cfg = loadConfig();

const account = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(cfg.privateKey),
});

const client = new ShelbyNodeClient({ network: Network.TESTNET });

console.log("Address :", account.accountAddress.toString());
console.log("Funding with ShelbyUSD...");

const hash = await client.fundAccountWithShelbyUSD({
  address: account.accountAddress,
  amount: 100_000_000, // 1 ShelbyUSD (8 decimals)
});

console.log("✓ Funded! tx:", hash);
console.log("\nNow run:  npx tsx test/smoke.ts");
