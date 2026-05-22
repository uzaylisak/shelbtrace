# shelbtrace

**Every AI agent action — recorded, encrypted, and verifiable on-chain.**

shelbtrace is an MCP (Model Context Protocol) server that automatically records every action taken by AI agents and stores them as cryptographically verifiable blobs on the [Shelby Protocol](https://shelby.xyz) — a decentralized storage network built on Aptos.

Sessions are encrypted with AES-256-GCM. Public metadata (timestamp, tools used, action count) is readable by anyone. Private content (inputs, outputs, decisions) is only accessible to the key holder. Anyone can independently verify that a session is real and unmodified.

---

## Why It Matters

| Use Case | Description |
|---|---|
| **Audit** | Prove exactly what your agent did, when, and why |
| **Debug** | Reproduce failures with full input/output traces |
| **Sell** | Publish verified agent workflows on the marketplace |
| **Compliance** | Immutable, timestamped logs of AI behavior |
| **Research** | Collect and monetize high-quality agent traces |

---

## How It Works

```
Your AI Agent  →  shelbtrace MCP Server  →  Shelby Protocol (Aptos)
     ↓                    ↓                        ↓
Tool calls          Buffer actions            Encrypted blob
LLM decisions       Encrypt content           On-chain commitment
Errors              Upload on flush           Public metadata
```

1. shelbtrace registers as an MCP server — your agent connects automatically
2. Every tool call, decision, input and output is buffered in memory
3. When the task ends, everything is encrypted and uploaded as a single blob
4. The blob commitment is registered on Aptos — tamper-proof forever

---

## Requirements

- **Node.js** v20 or higher — [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)
- **Git**
- An MCP-compatible AI agent (e.g. [Hermes Agent](https://github.com/NousResearch/hermes-agent))
- A **ShelbyUSD** balance for blob storage fees

---

## Quick Install

### Linux / macOS

```bash
git clone https://github.com/uzaylisak/shelbtrace.git
cd shelbtrace
npm run setup
```

### Windows (PowerShell)

```powershell
git clone https://github.com/uzaylisak/shelbtrace.git
cd shelbtrace
npm run setup
```

`npm run setup` does everything in one shot:
1. Installs dependencies
2. Builds the TypeScript source
3. Detects your AI agent and injects shelbtrace as an MCP server
4. Opens the setup UI at `http://localhost:7432`
5. Auto-generates your Aptos signing keypair

---

## Setup UI

After running `npm run setup`, your browser opens at `http://localhost:7432`:

1. **Copy your Shelby address** — shown at the top of the setup page
2. **Fund it** with ShelbyUSD (see faucet links below)
3. **Save settings** — choose network and blob expiry
4. Done — shelbtrace is ready

---

## Faucets & Funding

You need **two tokens** on Shelbynet before shelbtrace can upload blobs. Both are free on the test network.

### 1. APT — Aptos gas fees (required first)

Every on-chain transaction requires a small amount of APT for gas. Without APT, blob registrations will fail even if you have ShelbyUSD.

**Faucet:** [docs.shelby.xyz/tools/wallets/petra-setup#apt-faucet](https://docs.shelby.xyz/tools/wallets/petra-setup#apt-faucet)

### 2. ShelbyUSD — blob storage fees (required)

ShelbyUSD is the token used to pay for storing blobs on the Shelby network.

**Faucet:** [docs.shelby.xyz/tools/wallets/petra-setup#shelbyusd-faucet](https://docs.shelby.xyz/tools/wallets/petra-setup#shelbyusd-faucet)

> **Important:** You need both APT **and** ShelbyUSD. APT covers the Aptos transaction fee, ShelbyUSD covers the Shelby storage fee. Fund APT first, then ShelbyUSD — both use the same Shelby address shown in the setup UI.

---

## Usage

Once setup is complete, shelbtrace runs as an MCP server. Your agent calls these tools automatically:

| Tool | Description |
|---|---|
| `session_start` | Begin recording a new task |
| `action_record` | Record a single action (tool call, decision, etc.) |
| `session_flush` | Encrypt and upload to Shelby on task completion |
| `session_fail` | Same as flush but marks session as failed |
| `session_list` | List active sessions |

### Start the MCP server manually

```bash
node dist/cli.js
```

Or add to your agent's MCP config:

```json
{
  "mcpServers": {
    "shelbtrace": {
      "command": "node",
      "args": ["/path/to/shelbtrace/dist/cli.js"]
    }
  }
}
```

---

## Marketplace

The dashboard at `app/` lets you:

- Browse all published sessions (no wallet required)
- Verify sessions on-chain — public metadata + action hash proofs
- Connect MetaMask or Petra to buy sessions with ShelbyUSD
- List your own sessions and set a price
- Manage sales and purchase history

### Run the dashboard locally

```bash
cd app
npm install
npm run dev
# → http://localhost:5173
```

---

## Project Structure

```
shelbtrace/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── cli.ts            # CLI (setup + server mode)
│   ├── buffer.ts         # In-memory action buffer
│   ├── shelby-client.ts  # Shelby blob upload
│   ├── crypto.ts         # AES-256-GCM + X25519 encryption
│   ├── config.ts         # ~/.shelbtrace/config.json
│   ├── hermes.ts         # Agent auto-integration
│   ├── market-watcher.ts # Payment watcher + access grants
│   ├── setup-server.ts   # localhost:7432 setup UI server
│   └── types.ts          # Shared types
├── app/                  # React dashboard (Vite)
├── test/                 # Smoke tests
├── package.json
└── tsconfig.json
```

---

## Configuration

Config is stored at `~/.shelbtrace/config.json`:

```json
{
  "privateKey": "0x...",
  "network": "shelbynet",
  "expiryDays": 30
}
```

| Field | Values | Default |
|---|---|---|
| `network` | `shelbynet`, `testnet`, `local` | `shelbynet` |
| `expiryDays` | 1–365 | `30` |

---

## Networks

| Network | Purpose |
|---|---|
| `shelbynet` | Production — use this |
| `testnet` | Aptos testnet |
| `local` | Local development |

---

## Tech Stack

| Layer | Technology |
|---|---|
| MCP server | TypeScript, Node.js, `@modelcontextprotocol/sdk` |
| Storage | `@shelby-protocol/sdk` (Shelby decentralized storage) |
| Blockchain | Aptos (`@aptos-labs/ts-sdk`), ShelbyUSD |
| Dashboard | React 18, Vite, wagmi, `@aptos-labs/wallet-adapter-react` |
| Encryption | `@noble/curves` X25519, AES-256-GCM, HKDF-SHA256 |

---

## License

MIT
