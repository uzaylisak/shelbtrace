import { useNavigate } from "react-router-dom";

interface Props { onLaunch?: () => void; }

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Install the MCP Server",
    body: "Run a single command — shelbtrace registers as an MCP server on your machine. Your AI agent (any MCP-compatible agent) connects to it automatically. No code changes needed in your agent.",
  },
  {
    step: "02",
    title: "Sessions Are Recorded On-Chain",
    body: "Every tool call, LLM decision, input, output, and error is buffered in memory. When the task ends, all actions are encrypted with AES-256-GCM using a per-session random key and uploaded as a single blob to the Shelby decentralized storage protocol.",
  },
  {
    step: "03",
    title: "Public Metadata, Private Content",
    body: "The blob is split into two layers. Public metadata — timestamp, duration, model, tools used, action count, and per-action SHA-256 hashes — is readable by anyone. The actual content (inputs, outputs, decisions) stays encrypted. Only you hold the decryption key.",
  },
  {
    step: "04",
    title: "Cryptographic Proof of Behavior",
    body: "Because each action is independently hashed and stored on Shelby's Aptos-backed protocol, no one can alter, delete, or fabricate actions after the fact. A third party can verify any individual action without decrypting the rest of the session.",
  },
];

const MARKET_FEATURES = [
  {
    title: "List Your Sessions",
    body: "Choose any recorded session, set a ShelbyUSD price, add tags, and reveal up to 3 preview actions. Buyers can verify the previews are genuine before paying.",
  },
  {
    title: "Buy With ShelbyUSD",
    body: "Connect your wallet, click Buy — Petra signs an on-chain ShelbyUSD transfer. shelbtrace detects the payment, re-encrypts the content key for the buyer's wallet, and grants access automatically.",
  },
  {
    title: "Verify Before You Buy",
    body: "Every preview action comes with its SHA-256 hash. Click Verify Proofs and the dashboard checks each hash against the on-chain commitment. If they match, the preview is real.",
  },
];

export function LandingPage({ onLaunch }: Props) {
  const navigate = useNavigate();

  function handleLaunch() {
    onLaunch?.();
    navigate("/market");
  }

  return (
    <div style={s.page}>

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.logo}>
          <span style={{ color: "#FD8565" }}>shelb</span>
          <span style={{ color: "#FF77C9" }}>trace</span>
        </div>
        <p style={s.tagline}>
          Every AI agent action — recorded, encrypted, and verifiable on-chain.
        </p>
        <p style={s.subTagline}>
          Built on Shelby Protocol · Powered by Aptos · Works with any MCP-compatible agent
        </p>
        <button style={s.launchBtn} onClick={handleLaunch}>
          Launch App
        </button>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.sectionLabel}>How It Works</div>
          <h2 style={s.sectionHeading}>From agent action to on-chain proof</h2>
          <p style={s.sectionSub}>
            shelbtrace sits between your AI agent and the world. It silently intercepts every tool call, buffers the session, then seals it as a cryptographically verifiable artifact — no changes to your agent required.
          </p>
          <div style={s.stepsGrid}>
            {HOW_IT_WORKS.map(item => (
              <div key={item.step} style={s.stepCard}>
                <div style={s.stepNum}>{item.step}</div>
                <h3 style={s.stepTitle}>{item.title}</h3>
                <p style={s.stepBody}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY IT MATTERS ── */}
      <section style={{ ...s.section, background: "#4F1A2A" }}>
        <div style={s.sectionInner}>
          <div style={s.sectionLabel}>Why It Matters</div>
          <h2 style={s.sectionHeading}>AI agents need an audit trail</h2>
          <div style={s.twoCol}>
            <div>
              <h3 style={s.colTitle}>For Builders</h3>
              <p style={s.colBody}>
                Debug exactly what your agent did and why. Reproduce failures with full input/output logs. Share reproducible traces with your team. Prove your agent behaved correctly to clients or auditors.
              </p>
            </div>
            <div>
              <h3 style={s.colTitle}>For Buyers</h3>
              <p style={s.colBody}>
                Purchase verified agent workflows — not just documentation, but cryptographic proof of execution. Every preview action is hashed on-chain. If the hash matches, the content is real. No trust required.
              </p>
            </div>
            <div>
              <h3 style={s.colTitle}>For Researchers</h3>
              <p style={s.colBody}>
                Collect and sell high-quality AI agent traces for fine-tuning, benchmarking, or behavioral analysis. Sessions include tool usage patterns, decision chains, and error handling — exactly what training data pipelines need.
              </p>
            </div>
            <div>
              <h3 style={s.colTitle}>For Enterprises</h3>
              <p style={s.colBody}>
                Meet compliance requirements for AI transparency. Every agent action is immutably logged with a timestamp and on-chain commitment. Prove to regulators, partners, or customers exactly what your system did.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKETPLACE ── */}
      <section style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.sectionLabel}>Marketplace</div>
          <h2 style={s.sectionHeading}>Buy and sell verified agent sessions</h2>
          <p style={s.sectionSub}>
            Every listing is backed by an on-chain blob. Every preview is cryptographically proven. Payments happen on Shelbynet with ShelbyUSD — no intermediaries, no escrow risk.
          </p>
          <div style={s.marketGrid}>
            {MARKET_FEATURES.map(f => (
              <div key={f.title} style={s.marketCard}>
                <h3 style={s.marketTitle}>{f.title}</h3>
                <p style={s.marketBody}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GET STARTED ── */}
      <section style={{ ...s.section, textAlign: "center" }}>
        <div style={s.sectionInner}>
          <h2 style={s.sectionHeading}>Get started in 3 steps</h2>
          <div style={s.codeBlock}>
            <div style={s.codeLine}>
              <span style={{ color: "#FD8565" }}>$</span>
              <span style={{ color: "rgba(255,255,255,0.9)" }}> git clone https://github.com/your-org/shelbtrace</span>
            </div>
            <div style={s.codeLine}>
              <span style={{ color: "#FD8565" }}>$</span>
              <span style={{ color: "rgba(255,255,255,0.9)" }}> cd shelbtrace &amp;&amp; npm run setup</span>
            </div>
            <div style={s.codeLine}>
              <span style={{ color: "#FF77C9" }}># Fund the generated address with ShelbyUSD, then start your agent</span>
            </div>
          </div>
          <button style={{ ...s.launchBtn, fontSize: 16, padding: "16px 48px", marginTop: 0 }} onClick={handleLaunch}>
            Open the Dashboard
          </button>
        </div>
      </section>

      <footer style={s.footer}>
        <span style={{ color: "#FD8565" }}>shelb</span>
        <span style={{ color: "#FF77C9" }}>trace</span>
        <span style={s.footerNote}> · verifiable AI on Shelby Protocol · MIT License</span>
      </footer>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    zIndex: 1,
    background: "transparent",
    color: "#ffffff",
    overflowX: "hidden",
  },
  hero: {
    position: "relative", zIndex: 1,
    minHeight: "100vh",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "80px 24px 64px",
    textAlign: "center",
  },
  logo: {
    fontSize: "clamp(64px, 13vw, 140px)",
    fontWeight: 800,
    letterSpacing: -4,
    lineHeight: 1,
    marginBottom: 28,
  },
  tagline: {
    fontSize: "clamp(18px, 2.6vw, 26px)",
    color: "rgba(255,255,255,0.9)",
    maxWidth: 680,
    marginBottom: 14,
    lineHeight: 1.45,
    fontWeight: 600,
  },
  subTagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 52,
    letterSpacing: 0.3,
  },
  launchBtn: {
    background: "#FF77C9",
    color: "#322313",
    border: "none",
    borderRadius: 0,
    padding: "20px 64px",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    cursor: "pointer",
  },

  // Sections
  section: {
    position: "relative", zIndex: 1,
    padding: "80px 24px",
  },
  sectionInner: {
    maxWidth: 1000,
    margin: "0 auto",
  },
  sectionLabel: {
    color: "#FD8565",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 3,
    textTransform: "uppercase" as const,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: "clamp(26px, 4vw, 42px)",
    fontWeight: 800,
    color: "#FF77C9",
    marginBottom: 20,
    letterSpacing: -1,
    lineHeight: 1.2,
  },
  sectionSub: {
    fontSize: 16,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.7,
    maxWidth: 720,
    marginBottom: 48,
  },

  // Steps grid
  stepsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  stepCard: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    padding: "28px 24px",
  },
  stepNum: {
    color: "#FD8565",
    fontSize: 11, fontWeight: 800, letterSpacing: 2,
    marginBottom: 14,
  },
  stepTitle: {
    color: "#FF77C9",
    fontSize: 17, fontWeight: 700,
    marginBottom: 10,
  },
  stepBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14, lineHeight: 1.7,
  },

  // Two col
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 24,
  },
  colTitle: {
    color: "#FF77C9",
    fontSize: 17, fontWeight: 700,
    marginBottom: 10,
  },
  colBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14, lineHeight: 1.7,
  },

  // Market cards
  marketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  marketCard: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    padding: "28px 24px",
  },
  marketIcon: {
    color: "#FD8565",
    fontSize: 20, fontWeight: 800,
    marginBottom: 12,
  },
  marketTitle: {
    color: "#FF77C9",
    fontSize: 17, fontWeight: 700,
    marginBottom: 10,
  },
  marketBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14, lineHeight: 1.7,
  },

  // Code block
  codeBlock: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    padding: "24px 28px",
    maxWidth: 600,
    margin: "0 auto 40px",
    textAlign: "left",
    fontFamily: "monospace",
  },
  codeLine: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 1.6,
  },

  footer: {
    position: "relative", zIndex: 1,
    textAlign: "center",
    padding: "32px 16px 40px",
    fontSize: 14, fontWeight: 700,
    borderTop: "1px solid rgba(255,119,201,0.15)",
  },
  footerNote: {
    color: "rgba(255,255,255,0.4)",
    fontWeight: 400, fontSize: 12,
  },
};
