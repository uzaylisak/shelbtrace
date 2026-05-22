import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { ActionBuffer } from "./buffer.js";
import { ShelbyWriter } from "./shelby-client.js";
import { registerTools } from "./tools.js";
import { loadConfig } from "./config.js";
import { startMarketWatcher } from "./market-watcher.js";

const config = loadConfig();

const shelby = new ShelbyWriter({
  privateKey: config.privateKey,
  network: config.network,
  expirationOffsetMs: config.expiryDays * 24 * 60 * 60 * 1000,
});

const sellerAddress = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(config.privateKey),
}).accountAddress.toString();

const buffer = new ActionBuffer();

const server = new Server(
  { name: "shelbtrace", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

registerTools(server, buffer, shelby);

// Start marketplace payment watcher in background
startMarketWatcher(shelby, sellerAddress, config.network).catch((e) =>
  process.stderr.write(`[shelbtrace] Watcher failed to start: ${e.message}\n`)
);

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write("[shelbtrace] MCP server ready\n");
