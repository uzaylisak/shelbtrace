import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import yaml from "js-yaml";

const HERMES_CONFIG_PATHS = [
  join(homedir(), ".hermes", "config.yaml"),
  join(homedir(), ".hermes", "config.yml"),
  join(process.env["LOCALAPPDATA"] ?? "", "hermes", "config.yaml"),
];

export interface HermesStatus {
  installed: boolean;
  configPath: string | null;
  alreadyIntegrated: boolean;
  integrated: boolean;
  error: string | null;
}

export function detectHermes(): { installed: boolean; configPath: string | null } {
  let installed = false;
  try {
    execSync("hermes --version", { stdio: "pipe" });
    installed = true;
  } catch {
    // not in PATH — still check config files
  }

  const configPath = HERMES_CONFIG_PATHS.find((p) => p && existsSync(p)) ?? null;
  return { installed: installed || configPath !== null, configPath };
}

export function integrateHermes(shelbtraceBin: string): HermesStatus {
  const { installed, configPath } = detectHermes();

  if (!installed || !configPath) {
    return { installed, configPath, alreadyIntegrated: false, integrated: false, error: null };
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const config = (yaml.load(raw) ?? {}) as Record<string, unknown>;

    const servers = (config["mcp_servers"] ?? {}) as Record<string, unknown>;

    if ("shelbtrace" in servers) {
      // Check if existing config has wrong format (command is the js file, not "node")
      const existing = servers["shelbtrace"] as Record<string, unknown>;
      const cmd = existing["command"] as string ?? "";
      if (cmd.endsWith(".js") || cmd.endsWith("cli.js")) {
        // Fix: update to correct node + args format
        servers["shelbtrace"] = {
          enabled: true,
          command: "node",
          args: [shelbtraceBin],
        };
        config["mcp_servers"] = servers;
        writeFileSync(configPath, yaml.dump(config, { lineWidth: 120 }), "utf-8");
      }
      return { installed, configPath, alreadyIntegrated: true, integrated: true, error: null };
    }

    servers["shelbtrace"] = {
      enabled: true,
      command: "node",
      args: [shelbtraceBin],
    };
    config["mcp_servers"] = servers;

    // Inject shelbtrace instructions into Hermes system prompt / instructions field
    const shelbtracePreamble =
      "You have access to shelbtrace MCP tools. At the start of each task call session_start. " +
      "After each tool call record it with action_record. When done call session_flush.";

    for (const field of ["system_prompt", "instructions", "system"]) {
      if (typeof config[field] === "string") {
        if (!(config[field] as string).includes("shelbtrace")) {
          config[field] = (config[field] as string).trimEnd() + "\n\n" + shelbtracePreamble;
        }
        break;
      }
    }
    // If no existing system prompt field, add one
    if (!["system_prompt", "instructions", "system"].some(f => typeof config[f] === "string")) {
      config["system_prompt"] = shelbtracePreamble;
    }

    writeFileSync(configPath, yaml.dump(config, { lineWidth: 120 }), "utf-8");
    return { installed, configPath, alreadyIntegrated: false, integrated: true, error: null };
  } catch (err) {
    return {
      installed,
      configPath,
      alreadyIntegrated: false,
      integrated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
