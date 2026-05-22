import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import type { BlobMeta } from "../lib/shelby.js";
import { fetchBlobContent, fetchAccessGrant } from "../lib/shelby.js";
import { unsealKey, decryptContent, verifyActionHash } from "../lib/crypto.js";
import { buildShelbyUSDTransfer } from "../lib/shelbyusd.js";
import type { MarketListing, BlobPrivateContent } from "../lib/types.js";
import { useWindowWidth } from "../lib/hooks.js";

interface Props {
  meta:        BlobMeta;
  listing:     MarketListing;
  network:     string;
  myAddress:   string | null;
  x25519Priv:  Uint8Array | null;
  x25519Pub:   Uint8Array | null;
  onBack:      () => void;
}

export function ListingDetail({ meta: _meta, listing, network, myAddress, x25519Priv, x25519Pub, onBack }: Props) {
  const width    = useWindowWidth();
  const isMobile = width <= 640;
  const { signAndSubmitTransaction, connected: aptosConnected } = useWallet();
  const [verifying,    setVerifying]    = useState(false);
  const [proofResults, setProofResults] = useState<Map<number, boolean> | null>(null);
  const [buying,       setBuying]       = useState(false);
  const [buyStatus,    setBuyStatus]    = useState<string | null>(null);
  const [decrypted,    setDecrypted]    = useState<BlobPrivateContent | null>(null);
  const [decrypting,   setDecrypting]   = useState(false);

  const dur          = (listing.sessionMeta.durationMs / 1000).toFixed(1);
  const priceDisplay = (listing.priceUsd / 1e8).toFixed(2);
  const isSeller     = myAddress?.toLowerCase() === listing.sellerAddress.toLowerCase();
  const hasWallet    = !!myAddress;

  async function handleVerifyPreviews() {
    setVerifying(true);
    const results = new Map<number, boolean>();
    for (const p of listing.previewActions) {
      results.set(p.index, verifyActionHash(p.action, p.hash));
    }
    setProofResults(results);
    setVerifying(false);
  }

  async function handleBuy() {
    if (!hasWallet || !x25519Pub) {
      setBuyStatus("Connect wallet to buy.");
      return;
    }
    if (!aptosConnected) {
      setBuyStatus("Connect Aptos wallet (Petra) to sign the transaction.");
      return;
    }
    setBuying(true);
    setBuyStatus("Waiting for wallet approval...");
    try {
      const payload = buildShelbyUSDTransfer(listing.sellerAddress, listing.priceUsd);
      const result  = await signAndSubmitTransaction(payload);
      const txHash  = typeof result === "object" && "hash" in result
        ? (result as { hash: string }).hash
        : String(result);

      setBuyStatus(`Payment sent (${txHash.slice(0, 16)}...)\nWaiting for access grant...`);

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000));
        const grant = await fetchAccessGrant(
          listing.sellerAddress, listing.listingId, myAddress!, network
        );
        if (grant && x25519Priv) {
          const contentKey = await unsealKey(grant.sealedKey, x25519Priv);
          const [grantOwner, ...nameParts] = grant.blobRef.split("/");
          const blob = await fetchBlobContent(grantOwner, nameParts.join("/"), network);
          const content = await decryptContent(blob.encryptedContent, contentKey);
          setDecrypted(content);
          setBuyStatus("Access granted — content decrypted.");
          setBuying(false);
          return;
        }
      }
      setBuyStatus(
        `Payment confirmed. Access grant pending — seller will process shortly.\n` +
        `Come back and click "Already bought?" to check again.`
      );
    } catch (e) {
      setBuyStatus(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  }

  async function tryDecrypt() {
    if (!myAddress || !x25519Priv) return;
    setDecrypting(true);
    try {
      const grant = await fetchAccessGrant(listing.sellerAddress, listing.listingId, myAddress, network);
      if (!grant) { setDecrypting(false); return; }
      const contentKey = await unsealKey(grant.sealedKey, x25519Priv);
      const blob = await fetchBlobContent(
        grant.blobRef.split("/")[0],
        grant.blobRef.split("/").slice(1).join("/"),
        network
      );
      const content = await decryptContent(blob.encryptedContent, contentKey);
      setDecrypted(content);
    } catch {}
    setDecrypting(false);
  }

  return (
    <div>
      <button style={s.back} onClick={onBack}>&larr; Marketplace</button>

      <div style={{ ...s.header, flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ flex: 1 }}>
          <h2 style={s.title}>{listing.title}</h2>
          <p style={s.desc}>{listing.description}</p>
          <div style={s.metaRow}>
            <span>{listing.sessionMeta.actionCount} actions</span>
            <span>{dur}s</span>
            {listing.sessionMeta.model && <span style={s.model}>{listing.sessionMeta.model}</span>}
            <span style={{ color: listing.sessionMeta.status === "completed" ? "#FF77C9" : "#FD8565" }}>
              {listing.sessionMeta.status}
            </span>
          </div>
          <div style={s.toolList}>
            {listing.sessionMeta.toolsUsed.map(t => (
              <span key={t} style={s.toolChip}>{t}</span>
            ))}
          </div>
        </div>
        <div style={s.priceBox}>
          <div style={s.price}>${priceDisplay}</div>
          <div style={s.priceCcy}>ShelbyUSD</div>
          {!decrypted && !isSeller && (
            <>
              <button
                style={s.buyBtn}
                onClick={handleBuy}
                disabled={buying}
                title={!hasWallet ? "Connect wallet to buy" : undefined}
              >
                {!hasWallet ? "Connect wallet to buy" : buying ? "Processing..." : "Buy Access"}
              </button>
              <button style={s.checkBtn} onClick={tryDecrypt} disabled={decrypting || !hasWallet}>
                {decrypting ? "Checking..." : "Already bought?"}
              </button>
            </>
          )}
          {decrypted && <div style={s.accessBadge}>Access granted</div>}
        </div>
      </div>

      {buyStatus && (
        <div style={s.statusBox}>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13 }}>{buyStatus}</pre>
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionHeader}>
          <div style={s.sectionTitle}>
            Preview Actions
            <span style={s.sectionSub}> — seller-revealed, cryptographically verifiable</span>
          </div>
          <button style={s.verifyBtn} onClick={handleVerifyPreviews} disabled={verifying}>
            {verifying ? "Verifying..." : "Verify Proofs"}
          </button>
        </div>

        {listing.previewActions.map((p) => {
          const result = proofResults?.get(p.index);
          return (
            <div key={p.index} style={s.previewRow}>
              <div style={s.previewTop}>
                <span style={s.previewIdx}>Action #{p.index + 1}</span>
                {p.action.tool && <span style={s.toolBadge}>{p.action.tool}</span>}
                <span style={s.previewType}>{p.action.type}</span>
                {result !== undefined && (
                  <span style={result ? s.proofOk : s.proofFail}>
                    {result ? "Hash verified" : "Hash mismatch"}
                  </span>
                )}
              </div>
              {p.action.output !== undefined && (
                <pre style={s.previewContent}>{JSON.stringify(p.action.output, null, 2)}</pre>
              )}
              <div style={s.hashRow}>
                <span style={s.hashLabel}>SHA-256:</span>
                <span style={s.hashVal}>{p.hash}</span>
              </div>
            </div>
          );
        })}
      </div>

      {decrypted && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Full Content — Decrypted</div>
          <div style={s.taskDesc}>{decrypted.taskDescription}</div>
          {decrypted.actions.map((a, i) => (
            <div key={a.id} style={s.actionRow}>
              <div style={s.actionTop}>
                <span style={s.idx}>#{i + 1}</span>
                <span style={s.type}>{a.type}</span>
                {a.tool && <span style={s.toolBadge}>{a.tool}</span>}
                {a.error && <span style={s.errBadge}>error</span>}
              </div>
              {(a.input !== undefined || a.output !== undefined || a.error) && (
                <div style={s.detail}>
                  {a.input  !== undefined && <pre style={s.pre}><b>Input:</b>{"\n"}{JSON.stringify(a.input, null, 2)}</pre>}
                  {a.output !== undefined && <pre style={s.pre}><b>Output:</b>{"\n"}{JSON.stringify(a.output, null, 2)}</pre>}
                  {a.error  && <pre style={{ ...s.pre, color: "#FD8565" }}><b>Error:</b> {a.error}</pre>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  back: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "8px 14px", cursor: "pointer", marginBottom: 24,
  },
  header: {
    display: "flex", gap: 24,
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
    padding: 24, marginBottom: 16,
  },
  title:   { fontSize: 24, fontWeight: 800, marginBottom: 8, color: "#ffffff" },
  desc:    { fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, marginBottom: 12 },
  metaRow: { display: "flex", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 10, flexWrap: "wrap" as const },
  model:   { color: "#FD8565" },
  toolList:{ display: "flex", gap: 6, flexWrap: "wrap" as const },
  toolChip:{
    background: "transparent",
    border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#FF77C9", fontSize: 11, fontWeight: 600, padding: "2px 8px",
  },
  priceBox:{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, flexShrink: 0, minWidth: 160 },
  price:   { fontSize: 32, fontWeight: 800, color: "#FF77C9" },
  priceCcy:{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 },
  buyBtn: {
    width: "100%",
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 14, fontWeight: 700, padding: "12px 0", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },
  checkBtn:{
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 0,
    color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "8px 0", cursor: "pointer",
  },
  accessBadge: { color: "#FF77C9", fontSize: 13, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.3 },
  statusBox: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.25)",
    borderRadius: 0,
    padding: "12px 16px", marginBottom: 16, color: "#ffffff",
  },
  section:      { marginBottom: 24 },
  sectionHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" as const },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#FF77C9", textTransform: "uppercase" as const, letterSpacing: "0.6px" },
  sectionSub:   { color: "rgba(255,255,255,0.55)", fontWeight: 400, textTransform: "none" as const },
  verifyBtn: {
    background: "transparent",
    border: "1px solid #FF77C9",
    borderRadius: 0,
    color: "#FF77C9", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer",
    textTransform: "uppercase" as const,
  },
  previewRow:    { background: "#4F1A2A", border: "1px solid rgba(255,119,201,0.15)", borderRadius: 0, padding: 14, marginBottom: 8 },
  previewTop:    { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" as const },
  previewIdx:    { fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.55)" },
  previewType:   { fontSize: 12, color: "rgba(255,255,255,0.65)" },
  toolBadge:     { background: "rgba(255,119,201,0.15)", border: "1px solid rgba(255,119,201,0.4)", borderRadius: 0, color: "#FF77C9", fontSize: 11, padding: "2px 8px" },
  proofOk:       { fontSize: 11, color: "#FF77C9", marginLeft: "auto", fontWeight: 700 },
  proofFail:     { fontSize: 11, color: "#FD8565", marginLeft: "auto", fontWeight: 700 },
  previewContent:{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, margin: "0 0 8px" },
  hashRow:       { display: "flex", gap: 8, alignItems: "baseline" },
  hashLabel:     { fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.6px", flexShrink: 0 },
  hashVal:       { fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.55)", wordBreak: "break-all" as const },
  taskDesc:      { fontSize: 15, fontWeight: 700, marginBottom: 12, padding: "10px 14px", background: "#322313", borderRadius: 0, color: "#ffffff", border: "1px solid rgba(255,119,201,0.2)" },
  actionRow:     { background: "#4F1A2A", border: "1px solid rgba(255,119,201,0.15)", borderRadius: 0, marginBottom: 6 },
  actionTop:     { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" },
  idx:           { fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", minWidth: 28 },
  type:          { fontSize: 13, fontWeight: 600, color: "#ffffff" },
  errBadge:      { fontSize: 11, background: "rgba(253,133,101,0.15)", border: "1px solid #FD8565", color: "#FD8565", borderRadius: 0, padding: "2px 6px" },
  detail:        { borderTop: "1px solid rgba(255,119,201,0.2)", padding: "12px 14px" },
  pre:           { fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, margin: 0 },
};
