/**
 * Smoke test: simulates a Hermes Agent session end-to-end.
 * Run after `npm run build` with a valid config in ~/.shelbtrace/config.json
 *
 *   npx tsx test/smoke.ts
 */
import { ActionBuffer } from "../src/buffer.js";
import { ShelbyWriter } from "../src/shelby-client.js";
import { loadConfig } from "../src/config.js";

const cfg = loadConfig();
console.log(`Network : ${cfg.network}`);
console.log(`Expiry  : ${cfg.expiryDays} days\n`);

const buffer = new ActionBuffer();
const shelby = new ShelbyWriter({
  privateKey: cfg.privateKey,
  network: cfg.network,
  expirationOffsetMs: cfg.expiryDays * 24 * 60 * 60 * 1000,
});

// 1. Start session
const sessionId = buffer.startSession("Smoke test: fetch GitHub PR list");
console.log(`Session : ${sessionId}`);

// 2. Record some fake actions
buffer.record(sessionId, {
  type: "llm_decision",
  output: "I will use the GitHub tool to list open PRs.",
});

buffer.record(sessionId, {
  type: "tool_call",
  tool: "github_list_prs",
  input: { repo: "NousResearch/hermes-agent", state: "open" },
  output: [{ number: 42, title: "Fix memory leak" }],
  durationMs: 312,
});

buffer.record(sessionId, {
  type: "tool_call",
  tool: "github_list_prs",
  input: { repo: "NousResearch/hermes-agent", state: "closed" },
  error: "Rate limit exceeded",
  durationMs: 88,
});

buffer.record(sessionId, {
  type: "llm_decision",
  output: "Task partially completed. Reporting findings.",
});

// 3. Flush → upload to Shelby
console.log("\nUploading to Shelby...");
const session = buffer.completeSession(sessionId);
const result = await shelby.flush(session);

console.log(`\n✓ Uploaded!`);
console.log(`  blob_ref     : ${result.blobRef}`);
console.log(`  action_count : ${result.actionCount}`);
console.log(`  uploaded_at  : ${new Date(result.uploadedAt).toISOString()}`);
