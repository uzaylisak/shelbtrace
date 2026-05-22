import { createServer } from "node:http";
import { renderSetupPage } from "./setup-ui.js";
import {
  saveConfig,
  loadPartialConfig,
  PartialConfigSchema,
  configExists,
} from "./config.js";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import type { HermesStatus } from "./hermes.js";

const PORT = 7432;

function deriveAptosAddress(privateKeyHex: string): string {
  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKeyHex),
  });
  return account.accountAddress.toString();
}

export async function runSetupServer(hermesStatus: HermesStatus): Promise<void> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

      // ── GET / ── show setup page ──────────────────────────────────────────
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/setup")) {
        const cfg     = loadPartialConfig();
        const address = cfg.privateKey ? deriveAptosAddress(cfg.privateKey) : null;

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderSetupPage({
          hermes: hermesStatus,
          address,
          currentConfig: { network: cfg.network, expiryDays: cfg.expiryDays },
        }));
        return;
      }

      // ── GET /private-key ── return stored private key (localhost only) ──────
      if (req.method === "GET" && url.pathname === "/private-key") {
        const cfg = loadPartialConfig();
        if (!cfg.privateKey) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No key configured yet" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ privateKey: cfg.privateKey }));
        return;
      }

      // ── POST /save ── settings form ───────────────────────────────────────
      if (req.method === "POST" && url.pathname === "/save") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const params = new URLSearchParams(body);
          const raw = {
            network:    params.get("network") ?? "shelbynet",
            expiryDays: Number(params.get("expiryDays") ?? "30"),
          };

          const parsed = PartialConfigSchema.omit({ privateKey: true }).safeParse(raw);
          const cfg    = loadPartialConfig();
          const address = cfg.privateKey ? deriveAptosAddress(cfg.privateKey) : null;

          if (!parsed.success) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(renderSetupPage({
              hermes: hermesStatus, address,
              currentConfig: { network: cfg.network, expiryDays: cfg.expiryDays },
              saveError: parsed.error.errors.map((e) => e.message).join(", "),
            }));
            return;
          }

          try {
            saveConfig(parsed.data);
          } catch (err) {
            res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
            res.end(renderSetupPage({
              hermes: hermesStatus, address,
              currentConfig: { network: cfg.network, expiryDays: cfg.expiryDays },
              saveError: err instanceof Error ? err.message : "Failed to save",
            }));
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(renderSetupPage({
            hermes: hermesStatus, address,
            currentConfig: parsed.data,
            saveSuccess: true,
          }));

          // Shut down after success only if key is already set
          if (configExists()) {
            setTimeout(() => { server.close(); resolve(); }, 1500);
          }
        });
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    server.listen(PORT, "127.0.0.1", () => {
      process.stderr.write(`[shelbtrace] Setup UI → http://localhost:${PORT}\n`);
    });
  });
}
