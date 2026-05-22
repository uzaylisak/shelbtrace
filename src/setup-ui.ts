export interface SetupPageData {
  hermes: {
    installed: boolean;
    configPath: string | null;
    alreadyIntegrated: boolean;
    integrated: boolean;
    error: string | null;
  };
  address: string | null;
  currentConfig: { network?: string; expiryDays?: number };
  saveError?: string;
  saveSuccess?: boolean;
}

const FAUCET_URL = "https://docs.shelby.xyz/apis/faucet/shelbyusd";

export function renderSetupPage(data: SetupPageData): string {
  const { hermes, address, currentConfig, saveError, saveSuccess } = data;
  const network    = currentConfig.network    ?? "shelbynet";
  const expiryDays = currentConfig.expiryDays ?? 30;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>shelbtrace — Setup</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      min-height: 100vh;
      background: #322313;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    body {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 48px 16px 64px;
    }

    .page { width: 100%; max-width: 520px; }

    /* Logo */
    .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; margin-bottom: 6px; }
    .logo .s { color: #FD8565; }
    .logo .t { color: #FF77C9; }
    .tagline { font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 36px; }

    /* Sections */
    .section {
      background: #4F1A2A;
      border: 1px solid rgba(255,119,201,0.2);
      padding: 24px;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #FD8565;
      margin-bottom: 16px;
    }

    /* Address */
    .address-box {
      background: #322313;
      border: 1px solid rgba(255,119,201,0.3);
      padding: 12px 14px;
      font-family: monospace;
      font-size: 12px;
      color: #FF77C9;
      word-break: break-all;
      margin-bottom: 10px;
    }

    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }

    .btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.25);
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      padding: 7px 14px;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s;
    }
    .btn:hover { border-color: #FF77C9; color: #FF77C9; }

    .btn-faucet {
      background: rgba(255,119,201,0.1);
      border-color: rgba(255,119,201,0.5);
      color: #FF77C9;
    }
    .btn-faucet:hover { background: rgba(255,119,201,0.2); }

    .btn-danger { border-color: rgba(253,133,101,0.4); color: #FD8565; }
    .btn-danger:hover { background: rgba(253,133,101,0.1); border-color: #FD8565; }

    /* Key reveal */
    .key-box {
      background: rgba(253,133,101,0.08);
      border: 1px solid rgba(253,133,101,0.3);
      padding: 14px;
      margin-bottom: 8px;
    }
    .key-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #FD8565;
      margin-bottom: 8px;
    }
    .key-value {
      font-family: monospace;
      font-size: 12px;
      color: rgba(253,133,101,0.85);
      word-break: break-all;
    }

    /* Hermes status */
    .status-row { display: flex; align-items: center; gap: 10px; font-size: 14px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot-ok   { background: #FF77C9; }
    .dot-warn { background: #FD8565; }
    .dot-err  { background: rgba(255,255,255,0.4); }
    .status-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      margin-left: 18px;
      margin-top: 6px;
    }
    .status-sub a { color: #FF77C9; text-decoration: none; }
    .status-sub a:hover { text-decoration: underline; }
    code {
      background: rgba(255,255,255,0.08);
      padding: 1px 5px;
      font-size: 11px;
      font-family: monospace;
    }

    /* Form */
    label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: rgba(255,255,255,0.45);
      margin-bottom: 6px;
      margin-top: 16px;
    }
    label:first-of-type { margin-top: 0; }

    select {
      width: 100%;
      background: #322313;
      border: 1px solid rgba(255,119,201,0.3);
      color: #ffffff;
      font-size: 14px;
      padding: 10px 14px;
      outline: none;
      font-family: inherit;
      appearance: none;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    select:focus { border-color: #FF77C9; }
    select option { background: #322313; }

    .submit-btn {
      width: 100%;
      background: #FF77C9;
      border: none;
      color: #322313;
      font-size: 14px;
      font-weight: 800;
      padding: 13px;
      cursor: pointer;
      margin-top: 20px;
      font-family: inherit;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      transition: background 0.15s;
    }
    .submit-btn:hover { background: #ff5dbf; }

    /* Alerts */
    .alert { font-size: 13px; padding: 12px 16px; margin-bottom: 12px; }
    .alert-error   { background: rgba(253,133,101,0.1); border: 1px solid rgba(253,133,101,0.4); color: #FD8565; }
    .alert-success { background: rgba(255,119,201,0.08); border: 1px solid rgba(255,119,201,0.3); color: #FF77C9; }

    .info { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="logo"><span class="s">shelb</span><span class="t">trace</span></div>
    <p class="tagline">AI agent session recorder — MCP server setup</p>

    ${saveError   ? `<div class="alert alert-error">${escapeHtml(saveError)}</div>` : ""}
    ${saveSuccess ? `<div class="alert alert-success">Setup complete. shelbtrace is ready.</div>` : ""}

    <!-- Step 1: Signing Address -->
    <div class="section">
      <div class="section-title">Step 1 — Signing Address</div>
      <div class="address-box" id="aptos-addr">${escapeHtml(address ?? "Generating...")}</div>
      <div class="btn-row">
        <button class="btn" onclick="copyAddr()">Copy address</button>
        <a class="btn btn-faucet" href="${FAUCET_URL}" target="_blank">Get ShelbyUSD</a>
        <button class="btn btn-danger" onclick="toggleKey()">Show Private Key</button>
      </div>

      <div id="key-box" style="display:none;">
        <div class="key-box">
          <div class="key-label">Private Key — keep this secret</div>
          <div class="key-value" id="pk-value">Loading...</div>
        </div>
        <div class="btn-row" style="margin-bottom:0;">
          <button class="btn" onclick="copyKey()">Copy key</button>
          <button class="btn btn-danger" onclick="toggleKey()">Hide</button>
        </div>
      </div>

      <p class="info">
        A keypair was auto-generated and saved to <code>~/.shelbtrace/config.json</code>.
        Fund this address with ShelbyUSD to enable blob uploads.
      </p>
    </div>

    <!-- Step 2: Agent Integration -->
    <div class="section">
      <div class="section-title">Step 2 — Agent Integration</div>
      ${renderHermesStatus(hermes)}
    </div>

    <!-- Step 3: Settings -->
    <div class="section">
      <div class="section-title">Step 3 — Settings</div>
      <form method="POST" action="/save">
        <label for="network">Network</label>
        <select id="network" name="network">
          <option value="shelbynet" ${network === "shelbynet" ? "selected" : ""}>Shelbynet</option>
          <option value="testnet"   ${network === "testnet"   ? "selected" : ""}>Testnet</option>
          <option value="local"     ${network === "local"     ? "selected" : ""}>Local</option>
        </select>

        <label for="expiryDays">Blob Expiry</label>
        <select id="expiryDays" name="expiryDays">
          ${[7, 14, 30, 90, 180, 365].map(d =>
            `<option value="${d}" ${expiryDays === d ? "selected" : ""}>${d} days</option>`
          ).join("")}
        </select>

        <button type="submit" class="submit-btn">Save Settings</button>
      </form>
    </div>
  </div>

  <script>
    function copyAddr() {
      const el = document.getElementById("aptos-addr");
      if (el) navigator.clipboard.writeText(el.textContent.trim());
    }

    let keyLoaded = false;
    async function toggleKey() {
      const box = document.getElementById("key-box");
      if (!box) return;
      if (box.style.display !== "none") { box.style.display = "none"; return; }
      box.style.display = "block";
      if (!keyLoaded) {
        try {
          const res  = await fetch("/private-key");
          const json = await res.json();
          const el   = document.getElementById("pk-value");
          if (el) el.textContent = json.privateKey ?? json.error;
          keyLoaded = true;
        } catch {
          const el = document.getElementById("pk-value");
          if (el) el.textContent = "Failed to load key.";
        }
      }
    }

    function copyKey() {
      const el = document.getElementById("pk-value");
      if (el) navigator.clipboard.writeText(el.textContent.trim());
    }
  </script>
</body>
</html>`;
}

function renderHermesStatus(h: SetupPageData["hermes"]): string {
  if (!h.installed) {
    return `
      <div class="status-row">
        <div class="dot dot-warn"></div>
        <span>No compatible agent detected</span>
      </div>
      <p class="status-sub">
        Install a MCP-compatible agent (e.g.
        <a href="https://github.com/NousResearch/hermes-agent" target="_blank">Hermes Agent</a>),
        then re-run <code>npm run setup</code>.
      </p>`;
  }
  if (h.error) {
    return `
      <div class="status-row">
        <div class="dot dot-err"></div>
        <span>Integration failed</span>
      </div>
      <p class="status-sub">${escapeHtml(h.error)}</p>`;
  }
  const label = h.alreadyIntegrated
    ? "Already integrated"
    : "Integrated successfully";
  return `
    <div class="status-row">
      <div class="dot dot-ok"></div>
      <span>${label}</span>
    </div>
    <p class="status-sub">${escapeHtml(h.configPath ?? "")}</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
