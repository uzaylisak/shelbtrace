import { useEffect, useState } from "react";
import type { BlobMeta } from "../lib/shelby.js";
import { fetchBlobList } from "../lib/shelby.js";

const PAGE_SIZE = 10;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface Props {
  address: string;
  network: string;
  onSelect: (blob: BlobMeta) => void;
  onList?:  (blob: BlobMeta) => void;
  verifyMode?: boolean;
}

function ExpiryBadge({ expiresAt, isWritten }: { expiresAt: string; isWritten: boolean }) {
  const now = Date.now();
  const expireMs = new Date(expiresAt).getTime();

  if (!isWritten || expireMs < now) {
    return (
      <span style={{
        background: "transparent",
        border: "1px solid #FD8565",
        borderRadius: 0,
        color: "#FD8565", fontSize: 10, padding: "2px 6px", fontWeight: 700,
        textTransform: "uppercase",
      }}>
        Expired
      </span>
    );
  }
  if (expireMs - now < SEVEN_DAYS_MS) {
    return (
      <span style={{
        background: "transparent",
        border: "1px solid #FD8565",
        borderRadius: 0,
        color: "#FD8565", fontSize: 10, padding: "2px 6px", fontWeight: 700,
        textTransform: "uppercase",
      }}>
        Expires soon
      </span>
    );
  }
  return null;
}

export function SessionList({ address, network, onSelect, onList, verifyMode }: Props) {
  const [blobs,    setBlobs]    = useState<BlobMeta[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [offset,   setOffset]   = useState(0);
  const [hasMore,  setHasMore]  = useState(false);
  const [loadMore, setLoadMore] = useState(false);

  useEffect(() => {
    setBlobs([]);
    setOffset(0);
    setHasMore(false);
    setLoading(true);
    fetchBlobList(address, network, PAGE_SIZE + 1, 0)
      .then((result) => {
        if (result.length > PAGE_SIZE) {
          setHasMore(true);
          setBlobs(result.slice(0, PAGE_SIZE));
        } else {
          setHasMore(false);
          setBlobs(result);
        }
        setOffset(PAGE_SIZE);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address, network]);

  function handleLoadMore() {
    setLoadMore(true);
    fetchBlobList(address, network, PAGE_SIZE + 1, offset)
      .then((result) => {
        if (result.length > PAGE_SIZE) {
          setHasMore(true);
          setBlobs(prev => [...prev, ...result.slice(0, PAGE_SIZE)]);
        } else {
          setHasMore(false);
          setBlobs(prev => [...prev, ...result]);
        }
        setOffset(prev => prev + PAGE_SIZE);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadMore(false));
  }

  if (loading) return <p style={s.muted}>Loading sessions...</p>;
  if (error)   return <p style={s.err}>Error: {error}</p>;
  if (!blobs.length) return <p style={s.muted}>No sessions found for this address.</p>;

  return (
    <div>
      {blobs.map((b) => {
        const sessionId = b.blob_name.replace("hermes/", "").replace(".json", "");
        const date      = new Date(b.created_at).toLocaleString();
        return (
          <div key={b.blob_name} style={s.row}>
            <div style={s.rowTop} onClick={() => onSelect(b)}>
              <span style={s.sessionId}>{sessionId.slice(0, 8)}...</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ExpiryBadge expiresAt={b.expires_at} isWritten={b.is_written} />
                <span style={s.date}>{date}</span>
              </div>
            </div>
            <div style={s.rowBot}>
              <span style={s.size}>{(b.size / 1024).toFixed(1)} KB</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {onList && (
                  <button
                    style={s.listBtn}
                    onClick={(e) => { e.stopPropagation(); onList(b); }}
                  >
                    List on Marketplace
                  </button>
                )}
                <span style={s.action} onClick={() => onSelect(b)}>
                  {verifyMode ? "Verify →" : "View →"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button style={s.loadMore} onClick={handleLoadMore} disabled={loadMore}>
          {loadMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  muted: { color: "rgba(255,255,255,0.5)", fontSize: 14, padding: "24px 0" },
  err:   { color: "#FD8565", fontSize: 14, padding: "24px 0" },
  row: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
    padding: "14px 18px", marginBottom: 10, cursor: "pointer",
    transition: "border-color 0.15s",
  },
  rowTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap" as const, gap: 4 },
  rowBot: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sessionId: { fontFamily: "monospace", fontSize: 13, color: "#FD8565", fontWeight: 600 },
  date:      { fontSize: 12, color: "rgba(255,255,255,0.55)" },
  size:      { fontSize: 12, color: "rgba(255,255,255,0.6)" },
  action:    { fontSize: 12, color: "#FD8565", cursor: "pointer", fontWeight: 600 },
  listBtn: {
    background: "transparent",
    border: "1px solid #FF77C9",
    borderRadius: 0,
    color: "#FF77C9",
    fontSize: 11, fontWeight: 700,
    padding: "6px 12px",
    cursor: "pointer",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  loadMore: {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#FF77C9", fontSize: 13, padding: "10px 0",
    cursor: "pointer", marginTop: 4,
  },
};
