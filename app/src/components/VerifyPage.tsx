import { useState } from "react";
import { fetchBlobContent } from "../lib/shelby.js";
import type { BlobMeta } from "../lib/shelby.js";
import type { ShelbyBlobPayload } from "../lib/types.js";
import { SessionList } from "./SessionList.js";

interface Props {
  network: string;
  initialAddress?: string;
}

type VerifyResult =
  | { status: "valid"; payload: ShelbyBlobPayload; blob: BlobMeta }
  | { status: "invalid"; reason: string }
  | { status: "loading" }
  | null;

export function VerifyPage({ network, initialAddress }: Props) {
  const [query,        setQuery]        = useState(initialAddress ?? "");
  const [searchAddr,   setSearchAddr]   = useState<string | null>(initialAddress ?? null);
  const [selectedBlob, setSelectedBlob] = useState<BlobMeta | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setVerifyResult(null);
    setSelectedBlob(null);
    setSearchAddr(q);
  }

  async function handleVerifyBlob(blob: BlobMeta) {
    setVerifyResult({ status: "loading" });
    setSelectedBlob(blob);
    try {
      const payload = await fetchBlobContent(blob.owner, blob.blob_name, network);
      const pub = payload.public;
      const valid =
        pub?.schemaVersion === "2.0" &&
        typeof pub.sessionId === "string" &&
        typeof pub.startedAt === "number" &&
        typeof pub.actionCount === "number";
      if (valid) {
        setVerifyResult({ status: "valid", payload, blob });
      } else {
        setVerifyResult({ status: "invalid", reason: "Schema mismatch — blob may be tampered." });
      }
    } catch (e) {
      setVerifyResult({ status: "invalid", reason: e instanceof Error ? e.message : "Fetch failed" });
    }
  }

  return (
    <div style={s.container}>
      <h1 style={s.heading}>Public Verify</h1>
      <p style={s.sub}>
        Verify any AI Agent session stored on Shelby. Enter an Aptos address to list sessions,
        then click a session to verify its on-chain integrity.
      </p>

      <form style={s.form} onSubmit={handleSearch}>
        <input
          style={s.input}
          placeholder="Paste Aptos address (0x...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button style={s.searchBtn} type="submit">Search</button>
      </form>

      {verifyResult && selectedBlob && (
        <div style={s.resultBox}>
          {verifyResult.status === "loading" && (
            <div style={s.loading}>Verifying blob...</div>
          )}
          {verifyResult.status === "valid" && (
            <>
              <div style={s.resultOk}>Blob verified on Shelby</div>
              <div style={s.resultGrid}>
                <Cell label="Session ID"  value={verifyResult.payload.public.sessionId} mono />
                <Cell label="Blob Name"   value={selectedBlob.blob_name} mono />
                <Cell label="Owner"       value={selectedBlob.owner} mono />
                <Cell label="Recorded"    value={new Date(verifyResult.payload.public.startedAt).toLocaleString()} />
                <Cell label="Duration"    value={((verifyResult.payload.public.durationMs ?? 0) / 1000).toFixed(1) + "s"} />
                <Cell label="Actions"     value={String(verifyResult.payload.public.actionCount)} />
                {verifyResult.payload.public.model && (
                  <Cell label="Model" value={verifyResult.payload.public.model} />
                )}
                <Cell label="Status"      value={verifyResult.payload.public.status} />
                <Cell label="Schema"      value={verifyResult.payload.public.schemaVersion} />
                <Cell label="Encrypted"   value="AES-256-GCM" />
              </div>
              <div style={s.lockNote}>
                Action content is encrypted — only the key owner can decrypt.
              </div>
            </>
          )}
          {verifyResult.status === "invalid" && (
            <div style={s.resultErr}>{verifyResult.reason}</div>
          )}
        </div>
      )}

      {searchAddr && (
        <>
          <div style={s.addrBar}>
            <span style={s.addrLabel}>Sessions for</span>
            <span style={s.addrVal}>{searchAddr}</span>
            <button style={s.clearBtn} onClick={() => { setSearchAddr(null); setVerifyResult(null); }}>Clear</button>
          </div>
          <SessionList
            address={searchAddr}
            network={network}
            onSelect={(blob) => handleVerifyBlob(blob)}
            verifyMode
          />
        </>
      )}

      {!searchAddr && (
        <div style={s.empty}>
          <p style={s.emptyTitle}>Enter an address to get started</p>
          <p style={s.emptySub}>All AI Agent sessions are publicly verifiable on Shelby.</p>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={cs.cell}>
      <div style={cs.cellLabel}>{label}</div>
      <div style={{ ...cs.cellValue, ...(mono ? { fontFamily: "monospace", fontSize: 11 } : {}) }}>
        {value}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 720, margin: "0 auto", padding: "32px 24px" },
  heading:   { fontSize: 32, fontWeight: 800, letterSpacing: "-1px", marginBottom: 8, color: "#ffffff" },
  sub:       { fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 28, lineHeight: 1.6 },
  form:      { display: "flex", gap: 8, marginBottom: 20 },
  input: {
    flex: 1,
    background: "#322313", border: "1px solid rgba(255,119,201,0.4)", borderRadius: 0,
    color: "#ffffff", fontSize: 14, padding: "12px 14px", outline: "none",
    fontFamily: "monospace",
  },
  searchBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "12px 24px", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },
  resultBox: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.25)",
    borderRadius: 0,
    padding: 20, marginBottom: 20,
  },
  loading:   { color: "#FD8565", fontSize: 13 },
  resultOk:  { color: "#FD8565", fontSize: 15, fontWeight: 700, marginBottom: 16, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  resultErr: { color: "#FD8565", fontSize: 14, fontWeight: 600 },
  resultGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12,
  },
  lockNote: {
    fontSize: 12, color: "rgba(255,255,255,0.5)",
    borderTop: "1px solid rgba(255,119,201,0.2)", paddingTop: 12, marginTop: 4,
  },
  addrBar: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
    padding: "10px 14px",
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
  },
  addrLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.6px" },
  addrVal:   { fontFamily: "monospace", fontSize: 12, color: "#FD8565", flex: 1, wordBreak: "break-all" as const },
  clearBtn:  {
    background: "transparent", border: "1px solid #FF77C9", color: "#FF77C9",
    cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 10px",
    borderRadius: 0, textTransform: "uppercase" as const,
  },
  empty:     { textAlign: "center" as const, padding: "64px 0" },
  emptyTitle: { fontSize: 16, color: "#FF77C9", marginBottom: 8, fontWeight: 700 },
  emptySub:   { fontSize: 13, color: "rgba(255,255,255,0.55)" },
};

const cs: Record<string, React.CSSProperties> = {
  cell: {
    background: "#322313",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
    padding: "10px 14px",
  },
  cellLabel:  { fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 4 },
  cellValue:  { fontSize: 13, color: "#ffffff", wordBreak: "break-all" as const },
};
