import { useState, useEffect, useRef } from "react";
import { fetchBlobList, fetchBlobContent, fetchMySales, fetchMyPurchases } from "../lib/shelby.js";
import type { BlobMeta } from "../lib/shelby.js";
import { SessionList } from "./SessionList.js";
import { BlobViewer } from "./BlobViewer.js";
import { CreateListing } from "./CreateListing.js";
import { useWindowWidth } from "../lib/hooks.js";

interface Props {
  address: string;
  network: string;
  privateKeyHex: string | null;
  x25519Priv?: Uint8Array | null;
}

const STORAGE_KEY = (addr: string) => `shelbtrace-profile-${addr}`;

interface ProfileData {
  displayName: string;
  bio: string;
  avatar?: string; // base64 data URL
}

interface ProfileStats {
  sessions: number;
  actions: number;
  topTools: string[];
}

function loadProfile(addr: string): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(addr));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { displayName: "", bio: "" };
}

function saveProfile(addr: string, data: ProfileData) {
  localStorage.setItem(STORAGE_KEY(addr), JSON.stringify(data));
}

type TabKey = "sessions" | "sales" | "purchases";

export function ProfilePage({ address, network, privateKeyHex, x25519Priv: _x25519Priv }: Props) {
  const width    = useWindowWidth();
  const isMobile = width <= 640;

  const [profile,  setProfile]  = useState<ProfileData>(() => loadProfile(address));
  const [editing,  setEditing]  = useState(false);
  const [editBuf,  setEditBuf]  = useState<ProfileData>(profile);
  const [stats,    setStats]    = useState<ProfileStats | null>(null);
  const [selected, setSelected] = useState<BlobMeta | null>(null);
  const [tab,      setTab]      = useState<TabKey>("sessions");
  const [sales,    setSales]    = useState<BlobMeta[]>([]);
  const [purchases,setPurchases]= useState<BlobMeta[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [listingFromSession, setListingFromSession] = useState<BlobMeta | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBlobList(address, network, 100)
      .then(async (blobs) => {
        let totalActions = 0;
        const toolCounts: Record<string, number> = {};

        await Promise.allSettled(
          blobs.map(async (b) => {
            try {
              const payload = await fetchBlobContent(b.owner, b.blob_name, network);
              totalActions += payload.public?.actionCount ?? 0;
              for (const tool of payload.public?.toolsUsed ?? []) {
                toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
              }
            } catch {}
          })
        );

        const topTools = Object.entries(toolCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([t]) => t);

        setStats({ sessions: blobs.length, actions: totalActions, topTools });
      })
      .catch(() => setStats({ sessions: 0, actions: 0, topTools: [] }));
  }, [address, network]);

  useEffect(() => {
    if (tab === "sales") {
      setHistLoading(true);
      fetchMySales(address, network)
        .then(setSales)
        .catch(() => setSales([]))
        .finally(() => setHistLoading(false));
    } else if (tab === "purchases") {
      setHistLoading(true);
      fetchMyPurchases(address, network)
        .then(setPurchases)
        .catch(() => setPurchases([]))
        .finally(() => setHistLoading(false));
    }
  }, [tab, address, network]);

  function handleSave() {
    saveProfile(address, editBuf);
    setProfile(editBuf);
    setEditing(false);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = { ...profile, avatar: dataUrl };
      setProfile(updated);
      setEditBuf(updated);
      saveProfile(address, updated);
    };
    reader.readAsDataURL(file);
  }

  const short = `${address.slice(0, 8)}...${address.slice(-6)}`;
  const initials = (profile.displayName || address.slice(2, 4)).toUpperCase().slice(0, 2);
  // Avatar color from first 6 chars of address (skip 0x)
  const avatarColor = "#" + address.replace(/^0x/, "").slice(0, 6);

  if (selected) {
    return (
      <div style={{ ...s.container, maxWidth: isMobile ? "100%" : 720 }}>
        <BlobViewer
          blob={selected}
          network={network}
          onBack={() => setSelected(null)}
          autoPrivateKeyHex={privateKeyHex}
          onList={(b) => { setSelected(null); setListingFromSession(b); setShowCreate(true); }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...s.container, maxWidth: isMobile ? "100%" : 720, padding: isMobile ? "20px 12px" : "32px 24px" }}>
      {showCreate && (
        <CreateListing
          onClose={() => { setShowCreate(false); setListingFromSession(null); }}
          onSubmit={(data) => {
            console.log("Listing data:", data, "fromSession:", listingFromSession?.blob_name);
            setShowCreate(false);
            setListingFromSession(null);
          }}
          totalActions={stats?.actions ?? 0}
        />
      )}

      {/* Profile header */}
      <div style={{ ...s.header, flexDirection: isMobile ? "column" : "row" }}>
        <div style={s.avatarWrap}>
          <div
            style={{
              ...s.avatar,
              background: profile.avatar
                ? `url(${profile.avatar}) center/cover no-repeat`
                : avatarColor,
              border: `3px solid #FF77C9`,
            }}
          >
            {!profile.avatar && initials}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
          <button
            style={s.changeAvatarBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            Change Avatar
          </button>
        </div>

        <div style={s.info}>
          {editing ? (
            <div style={s.editForm}>
              <input
                style={s.input}
                placeholder="Username"
                value={editBuf.displayName}
                onChange={(e) => setEditBuf({ ...editBuf, displayName: e.target.value })}
              />
              <textarea
                style={{ ...s.input, height: 64, resize: "vertical" as const }}
                placeholder="Bio (optional)"
                value={editBuf.bio}
                onChange={(e) => setEditBuf({ ...editBuf, bio: e.target.value })}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.saveBtn} onClick={handleSave}>Save</button>
                <button style={s.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={s.displayName}>
                {profile.displayName || "Unnamed Agent"}
                <button style={s.editBtn} onClick={() => { setEditBuf(profile); setEditing(true); }}>
                  Edit
                </button>
              </div>
              {profile.bio && <div style={s.bio}>{profile.bio}</div>}
              <div style={s.address}>{short}</div>
            </>
          )}
        </div>

        {stats && (
          <div style={{ ...s.stats, flexDirection: isMobile ? "row" : "column", flexWrap: "wrap" as const }}>
            <div style={s.stat}>
              <div style={s.statVal}>{stats.sessions}</div>
              <div style={s.statLabel}>Sessions</div>
            </div>
            <div style={s.stat}>
              <div style={s.statVal}>{stats.actions}</div>
              <div style={s.statLabel}>Actions</div>
            </div>
            {stats.topTools.length > 0 && (
              <div style={{ ...s.stat, minWidth: 80 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 4 }}>Top Tools</div>
                {stats.topTools.map(t => (
                  <div key={t} style={{ fontSize: 11, color: "#FD8565" }}>{t}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Listing button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={s.newListingBtn} onClick={() => setShowCreate(true)}>
          + New Listing
        </button>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(["sessions", "sales", "purchases"] as TabKey[]).map(t => (
          <button
            key={t}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={s.section}>
        {tab === "sessions" && (
          <SessionList
            address={address}
            network={network}
            onSelect={setSelected}
            onList={(b) => { setListingFromSession(b); setShowCreate(true); }}
          />
        )}

        {tab === "sales" && (
          <div>
            {histLoading && <p style={s.muted}>Loading sales...</p>}
            {!histLoading && sales.length === 0 && (
              <p style={s.muted}>No sales found. Access grants you have issued will appear here.</p>
            )}
            {!histLoading && sales.map(b => {
              const parts = b.blob_name.replace("market/access/", "").replace(".json", "").split("/");
              const listingId  = parts[0] ?? "?";
              const buyerAddr  = parts[1] ?? "?";
              return (
                <div key={b.blob_name} style={s.histRow}>
                  <div style={s.histTop}>
                    <span style={s.histLabel}>Listing</span>
                    <span style={s.histVal}>{listingId.slice(0, 12)}...</span>
                  </div>
                  <div style={s.histBot}>
                    <span style={s.histMuted}>Buyer: {buyerAddr.slice(0, 10)}...</span>
                    <span style={s.histDate}>{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "purchases" && (
          <div>
            {histLoading && <p style={s.muted}>Loading purchases...</p>}
            {!histLoading && purchases.length === 0 && (
              <p style={s.muted}>No purchases found. Sessions you have bought will appear here.</p>
            )}
            {!histLoading && purchases.map(b => {
              const parts = b.blob_name.replace("market/access/", "").replace(".json", "").split("/");
              const listingId   = parts[0] ?? "?";
              const sellerAddr  = b.owner;
              return (
                <div key={b.blob_name} style={s.histRow}>
                  <div style={s.histTop}>
                    <span style={s.histLabel}>Listing</span>
                    <span style={s.histVal}>{listingId.slice(0, 12)}...</span>
                  </div>
                  <div style={s.histBot}>
                    <span style={s.histMuted}>Seller: {sellerAddr.slice(0, 10)}...</span>
                    <span style={s.histDate}>{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 720, margin: "0 auto", padding: "32px 24px" },
  header: {
    display: "flex", gap: 20, alignItems: "flex-start",
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
    padding: 24, marginBottom: 24,
  },
  avatarWrap: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, fontWeight: 800, color: "#ffffff",
    overflow: "hidden",
  },
  changeAvatarBtn: {
    background: "transparent",
    border: "1px solid #FF77C9",
    borderRadius: 0,
    color: "#FF77C9",
    fontSize: 10, fontWeight: 700, padding: "4px 8px",
    cursor: "pointer",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  info:        { flex: 1 },
  displayName: { fontSize: 22, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, color: "#ffffff" },
  bio:         { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6, lineHeight: 1.5 },
  address:     { fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" },
  editBtn: {
    background: "transparent",
    border: "1px solid #FF77C9",
    borderRadius: 0,
    color: "#FF77C9",
    fontSize: 11, fontWeight: 700,
    padding: "4px 10px", cursor: "pointer",
    textTransform: "uppercase" as const,
  },
  editForm:   { display: "flex", flexDirection: "column" as const, gap: 8 },
  input: {
    background: "#322313",
    border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "10px 12px", outline: "none", width: "100%",
    boxSizing: "border-box" as const,
  },
  saveBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "9px 20px", cursor: "pointer",
    textTransform: "uppercase" as const,
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "9px 16px", cursor: "pointer",
  },
  stats:      { display: "flex", gap: 16, flexShrink: 0 },
  stat:       { textAlign: "center" as const },
  statVal:    { fontSize: 26, fontWeight: 800, color: "#FD8565" },
  statLabel:  { fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" as const, letterSpacing: "0.6px" },

  newListingBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "9px 18px", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },

  tabs: { display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid rgba(255,119,201,0.25)" },
  tabBtn: {
    background: "transparent", border: "none",
    borderBottom: "2px solid transparent",
    borderRadius: 0,
    color: "rgba(255,255,255,0.55)",
    fontSize: 13, fontWeight: 600, padding: "10px 18px", cursor: "pointer",
    marginBottom: -1,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  tabBtnActive: {
    color: "#FF77C9", borderBottom: "2px solid #FF77C9",
  },

  section:      {},
  muted:        { color: "rgba(255,255,255,0.5)", fontSize: 14, padding: "24px 0" },

  histRow: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
    padding: "12px 16px", marginBottom: 8,
  },
  histTop:  { display: "flex", gap: 10, marginBottom: 4, alignItems: "center" },
  histBot:  { display: "flex", justifyContent: "space-between" },
  histLabel:{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "0.5px" },
  histVal:  { fontFamily: "monospace", fontSize: 13, color: "#FD8565" },
  histMuted:{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" },
  histDate: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
};
