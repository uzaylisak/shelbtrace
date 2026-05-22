import { useEffect, useState } from "react";
import type { BlobMeta } from "../lib/shelby.js";
import { fetchBlobContent } from "../lib/shelby.js";
import { decryptWithPrivKey } from "../lib/crypto.js";
import type { ShelbyBlobPayload, BlobPrivateContent, HermesAction } from "../lib/types.js";

interface Props {
  blob: BlobMeta;
  network: string;
  onBack: () => void;
  autoPrivateKeyHex?: string | null;
  onList?: (blob: BlobMeta) => void;
}

export function BlobViewer({ blob, network, onBack, autoPrivateKeyHex, onList }: Props) {
  const [payload,  setPayload]  = useState<ShelbyBlobPayload | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  const [privateKey,  setPrivateKey]  = useState("");
  const [decrypting,  setDecrypting]  = useState(false);
  const [decryptErr,  setDecryptErr]  = useState<string | null>(null);
  const [privateData, setPrivateData] = useState<BlobPrivateContent | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setPayload(null);
    setPrivateData(null);
    setVerified(null);
    setLoading(true);
    fetchBlobContent(blob.owner, blob.blob_name, network)
      .then(async (p) => {
        setPayload(p);
        if (autoPrivateKeyHex && p.sealedKey) {
          try {
            const data = await decryptWithPrivKey(p.encryptedContent, p.sealedKey, autoPrivateKeyHex);
            setPrivateData(data);
          } catch {
            // key doesn't match — show lock box for manual entry
          }
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [blob, network, autoPrivateKeyHex]);

  const pub = payload?.public;

  function verify() {
    if (!pub) return;
    const valid = pub.schemaVersion === "2.0" && typeof pub.sessionId === "string";
    setVerified(valid);
  }

  async function handleDecrypt() {
    if (!payload || !privateKey.trim()) return;
    setDecrypting(true);
    setDecryptErr(null);
    try {
      const data = await decryptWithPrivKey(payload.encryptedContent, payload.sealedKey, privateKey.trim());
      setPrivateData(data);
      setShowKeyInput(false);
    } catch {
      setDecryptErr("Wrong key or corrupted blob.");
    } finally {
      setDecrypting(false);
    }
  }

  const dur = pub ? ((pub.completedAt - pub.startedAt) / 1000).toFixed(1) + "s" : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, gap: 8, flexWrap: "wrap" }}>
        <button style={s.back} onClick={onBack}>&larr; Back</button>
        {onList && (
          <button style={s.listBtn} onClick={() => onList(blob)}>
            List on Marketplace
          </button>
        )}
      </div>

      {loading && <p style={s.muted}>Loading blob...</p>}
      {error   && <p style={s.err}>Error: {error}</p>}

      {pub && (
        <>
          <div style={s.header}>
            <div style={{ flex: 1 }}>
              <div style={s.meta}>
                {new Date(pub.startedAt).toLocaleString()}
                &nbsp;·&nbsp;{dur}
                &nbsp;·&nbsp;{pub.actionCount} actions
                {pub.model && <>&nbsp;·&nbsp;<span style={s.model}>{pub.model}</span></>}
                &nbsp;·&nbsp;
                <span style={{ color: pub.status === "completed" ? "#FF77C9" : "#FD8565" }}>
                  {pub.status}
                </span>
              </div>
              <div style={s.sessionId}>{pub.sessionId}</div>

              {privateData && (
                <div style={s.task}>{privateData.taskDescription}</div>
              )}
            </div>
            <button style={s.verifyBtn} onClick={verify}>Verify</button>
          </div>

          {verified !== null && (
            <div style={{ ...s.alert, ...(verified ? s.alertOk : s.alertErr) }}>
              {verified
                ? "Blob is valid on Shelby — schema and session ID verified."
                : "Verification failed — blob may be malformed or tampered."}
            </div>
          )}

          {!privateData ? (
            <div style={s.lockBox}>
              <div style={s.lockTitle}>Content is encrypted</div>
              <div style={s.lockSub}>
                Only the owner can view action details. Enter your private key to decrypt.
              </div>

              {showKeyInput ? (
                <div style={s.keyForm}>
                  <input
                    style={s.keyInput}
                    type="password"
                    placeholder="0x..."
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDecrypt()}
                    autoFocus
                  />
                  <button style={s.decryptBtn} onClick={handleDecrypt} disabled={decrypting}>
                    {decrypting ? "Decrypting..." : "Decrypt"}
                  </button>
                  <button style={s.cancelBtn} onClick={() => setShowKeyInput(false)}>Cancel</button>
                  {decryptErr && <div style={s.decryptErr}>{decryptErr}</div>}
                </div>
              ) : (
                <button style={s.unlockBtn} onClick={() => setShowKeyInput(true)}>
                  Enter Private Key
                </button>
              )}
            </div>
          ) : (
            <div>
              {privateData.actions.map((action, i) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  index={i}
                  expanded={expanded === action.id}
                  onToggle={() => setExpanded(expanded === action.id ? null : action.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActionRow({ action, index, expanded, onToggle }: {
  action: HermesAction; index: number; expanded: boolean; onToggle: () => void;
}) {
  const hasDetail = action.input !== undefined || action.output !== undefined || action.error;
  return (
    <div style={s.actionRow}>
      <div style={s.actionTop} onClick={hasDetail ? onToggle : undefined}>
        <span style={s.idx}>#{index + 1}</span>
        <span style={s.type}>{action.type}</span>
        {action.tool && <span style={s.toolBadge}>{action.tool}</span>}
        {action.error && <span style={s.errBadge}>error</span>}
        {action.durationMs !== undefined && <span style={s.dur}>{action.durationMs}ms</span>}
        {hasDetail && <span style={s.toggle}>{expanded ? "▲" : "▼"}</span>}
      </div>
      {expanded && (
        <div style={s.detail}>
          {action.input !== undefined && (
            <pre style={s.pre}><b>Input:</b>{"\n"}{JSON.stringify(action.input, null, 2)}</pre>
          )}
          {action.output !== undefined && (
            <pre style={s.pre}><b>Output:</b>{"\n"}{JSON.stringify(action.output, null, 2)}</pre>
          )}
          {action.error && (
            <pre style={{ ...s.pre, color: "#FD8565" }}><b>Error:</b> {action.error}</pre>
          )}
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
    color: "#ffffff", fontSize: 13, padding: "8px 14px", cursor: "pointer",
  },
  listBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "8px 16px", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },
  muted: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  err:   { color: "#FD8565", fontSize: 14 },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
    padding: "20px 24px", marginBottom: 16,
  },
  task:      { fontSize: 16, fontWeight: 700, marginTop: 8, color: "#ffffff" },
  meta:      { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6 },
  model:     { color: "#FD8565" },
  sessionId: { fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" },
  verifyBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "8px 18px",
    cursor: "pointer", flexShrink: 0,
    textTransform: "uppercase" as const,
  },
  alert:    { borderRadius: 0, fontSize: 13, padding: "12px 16px", marginBottom: 16 },
  alertOk:  { background: "rgba(255,119,201,0.1)", border: "1px solid #FF77C9", color: "#FF77C9" },
  alertErr: { background: "rgba(253,133,101,0.1)", border: "1px solid #FD8565", color: "#FD8565" },
  lockBox: {
    textAlign: "center", padding: "48px 24px",
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0, marginBottom: 16,
  },
  lockTitle: { fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#FF77C9" },
  lockSub:   { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 20 },
  unlockBtn: {
    background: "#FF77C9",
    border: "none",
    borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "10px 22px", cursor: "pointer",
    textTransform: "uppercase" as const,
  },
  keyForm:     { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  keyInput: {
    width: "100%", maxWidth: 420,
    background: "#322313", border: "1px solid rgba(255,119,201,0.4)", borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "10px 14px", outline: "none",
    fontFamily: "monospace",
  },
  decryptBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "10px 24px", cursor: "pointer",
    textTransform: "uppercase" as const,
  },
  cancelBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 0, color: "#ffffff", fontSize: 13, padding: "10px 16px", cursor: "pointer",
  },
  decryptErr: { color: "#FD8565", fontSize: 12 },
  actionRow: { background: "#4F1A2A", border: "1px solid rgba(255,119,201,0.15)", borderRadius: 0, marginBottom: 6 },
  actionTop: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" },
  idx:       { fontFamily: "monospace", fontSize: 11, color: "#FD8565", minWidth: 28 },
  type:      { fontSize: 13, fontWeight: 600, color: "#ffffff" },
  toolBadge: { fontSize: 11, background: "rgba(253,133,101,0.15)", color: "#FD8565", borderRadius: 0, padding: "2px 8px", border: "1px solid rgba(253,133,101,0.4)" },
  errBadge:  { fontSize: 11, background: "rgba(253,133,101,0.15)", color: "#FD8565", borderRadius: 0, padding: "2px 6px", border: "1px solid #FD8565" },
  dur:       { fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: "auto" },
  toggle:    { fontSize: 10, color: "#FF77C9" },
  detail:    { borderTop: "1px solid rgba(255,119,201,0.2)", padding: "12px 14px" },
  pre: {
    fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.85)",
    whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
  },
};
