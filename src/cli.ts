#!/usr/bin/env node
import { integrateHermes } from "./hermes.js";
import { runSetupServer } from "./setup-server.js";
import { isConfigComplete } from "./config.js";

const args = process.argv.slice(2);
const isSetup = args.includes("--setup") || args.includes("setup");

if (isSetup) {
  process.stderr.write("[shelbtrace] Checking Hermes Agent...\n");

  // Resolve the absolute path to the shelbtrace binary for the Hermes config
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const selfDir = dirname(fileURLToPath(import.meta.url));
  const shelbtraceBin = join(selfDir, "cli.js");

  const hermesStatus = integrateHermes(shelbtraceBin);

  if (!hermesStatus.installed) {
    process.stderr.write("[shelbtrace] Hermes not found — you can install it later.\n");
  } else if (hermesStatus.error) {
    process.stderr.write(`[shelbtrace] Hermes integration error: ${hermesStatus.error}\n`);
  } else if (hermesStatus.alreadyIntegrated) {
    process.stderr.write("[shelbtrace] Hermes already integrated.\n");
  } else {
    process.stderr.write(`[shelbtrace] Hermes integrated → ${hermesStatus.configPath}\n`);
  }

  process.stderr.write("[shelbtrace] Opening setup UI...\n");

  let open: (url: string) => Promise<unknown>;
  try {
    ({ default: open } = await import("open"));
  } catch {
    open = async () => undefined;
  }

  const serverReady = runSetupServer(hermesStatus);
  await new Promise((r) => setTimeout(r, 150));
  await open("http://localhost:7432");
  await serverReady;

  process.stderr.write("[shelbtrace] Setup complete.\n");
  process.exit(0);
} else {
  // MCP server mode
  if (!isConfigComplete()) {
    process.stderr.write(
      "[shelbtrace] Not configured or missing private key. Run: npm run setup\n"
    );
    process.exit(1);
  }
  await import("./index.js");
}
