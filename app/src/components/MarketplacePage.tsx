import { useState, useEffect, useMemo } from "react";
import { fetchAllListings, fetchListing } from "../lib/shelby.js";
import type { BlobMeta } from "../lib/shelby.js";
import type { MarketListing } from "../lib/types.js";
import { ListingDetail } from "./ListingDetail.js";
import { CreateListing } from "./CreateListing.js";
import { useWindowWidth } from "../lib/hooks.js";

const PAGE_SIZE = 10;
const ALL_TAGS = ["debugging", "research", "coding", "automation", "data"];
type SortKey = "newest" | "price_asc" | "price_desc" | "most_actions";

interface Props {
  network:    string;
  myAddress:  string | null;
  x25519Priv: Uint8Array | null;
  x25519Pub:  Uint8Array | null;
}

export function MarketplacePage({ network, myAddress, x25519Priv, x25519Pub }: Props) {
  const width = useWindowWidth();
  const isMobile = width <= 640;

  const [metas,    setMetas]    = useState<BlobMeta[]>([]);
  const [listings, setListings] = useState<Map<string, MarketListing>>(new Map());
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<{ meta: BlobMeta; listing: MarketListing } | null>(null);
  const [offset,   setOffset]   = useState(0);
  const [hasMore,  setHasMore]  = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [search,    setSearch]    = useState("");
  const [minPrice,  setMinPrice]  = useState("");
  const [maxPrice,  setMaxPrice]  = useState("");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [sortKey,   setSortKey]   = useState<SortKey>("newest");

  useEffect(() => {
    setLoading(true);
    setMetas([]);
    setListings(new Map());
    setOffset(0);
    fetchAllListings(network, PAGE_SIZE + 1, 0)
      .then(async (ms) => {
        const page = ms.slice(0, PAGE_SIZE);
        setHasMore(ms.length > PAGE_SIZE);
        setMetas(page);
        setOffset(PAGE_SIZE);
        const pairs = await Promise.allSettled(
          page.map(async (m) => {
            const id = m.blob_name.replace("market/listing/", "").replace(".json", "");
            const l  = await fetchListing(m.owner, id, network);
            return [m.blob_name, l] as const;
          })
        );
        const map = new Map<string, MarketListing>();
        pairs.forEach(r => { if (r.status === "fulfilled") map.set(r.value[0], r.value[1]); });
        setListings(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [network]);

  async function handleLoadMore() {
    setLoadMore(true);
    try {
      const ms = await fetchAllListings(network, PAGE_SIZE + 1, offset);
      const page = ms.slice(0, PAGE_SIZE);
      setHasMore(ms.length > PAGE_SIZE);
      setMetas(prev => [...prev, ...page]);
      setOffset(prev => prev + PAGE_SIZE);
      const pairs = await Promise.allSettled(
        page.map(async (m) => {
          const id = m.blob_name.replace("market/listing/", "").replace(".json", "");
          const l  = await fetchListing(m.owner, id, network);
          return [m.blob_name, l] as const;
        })
      );
      setListings(prev => {
        const map = new Map(prev);
        pairs.forEach(r => { if (r.status === "fulfilled") map.set(r.value[0], r.value[1]); });
        return map;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadMore(false);
    }
  }

  const filtered = useMemo(() => {
    const minOctas = minPrice ? parseFloat(minPrice) * 1e8 : null;
    const maxOctas = maxPrice ? parseFloat(maxPrice) * 1e8 : null;
    const q = search.toLowerCase();

    let items = metas
      .map(m => ({ meta: m, listing: listings.get(m.blob_name) }))
      .filter((x): x is { meta: BlobMeta; listing: MarketListing } => !!x.listing);

    if (q) {
      items = items.filter(x =>
        x.listing.title.toLowerCase().includes(q) ||
        x.listing.description.toLowerCase().includes(q)
      );
    }
    if (minOctas !== null) {
      items = items.filter(x => x.listing.priceUsd >= minOctas);
    }
    if (maxOctas !== null) {
      items = items.filter(x => x.listing.priceUsd <= maxOctas);
    }
    if (activeTag !== "all") {
      items = items.filter(x => x.listing.tags?.includes(activeTag));
    }

    switch (sortKey) {
      case "price_asc":
        items.sort((a, b) => a.listing.priceUsd - b.listing.priceUsd);
        break;
      case "price_desc":
        items.sort((a, b) => b.listing.priceUsd - a.listing.priceUsd);
        break;
      case "most_actions":
        items.sort((a, b) => b.listing.sessionMeta.actionCount - a.listing.sessionMeta.actionCount);
        break;
      default:
        break;
    }
    return items;
  }, [metas, listings, search, minPrice, maxPrice, activeTag, sortKey]);

  function handleListClick() {
    if (!myAddress) {
      alert("Connect a wallet to list a session on the marketplace.");
      return;
    }
    setShowCreate(true);
  }

  if (selected) {
    return (
      <div style={{ ...s.container, maxWidth: isMobile ? "100%" : 960 }}>
        <ListingDetail
          meta={selected.meta}
          listing={selected.listing}
          network={network}
          myAddress={myAddress}
          x25519Priv={x25519Priv}
          x25519Pub={x25519Pub}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ ...s.container, padding: isMobile ? "24px 12px" : "32px 24px" }}>
      {showCreate && (
        <CreateListing
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => {
            console.log("Listing data:", data);
            setShowCreate(false);
          }}
          totalActions={0}
        />
      )}

      <div style={s.topRow}>
        <div>
          <h1 style={s.heading}>Marketplace</h1>
          <p style={s.sub}>Buy and sell verified AI Agent sessions. All content is cryptographically proven.</p>
        </div>
        <button style={s.listBtn} onClick={handleListClick}>
          + List on Marketplace
        </button>
      </div>

      <div style={{ ...s.filterBar, flexDirection: isMobile ? "column" : "row" }}>
        <input
          style={{ ...s.searchInput, width: isMobile ? "100%" : undefined }}
          placeholder="Search listings..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={s.priceRow}>
          <input
            style={s.priceInput}
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
          />
          <span style={s.priceSep}>-</span>
          <input
            style={s.priceInput}
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
          />
        </div>
        <select
          style={s.sortSelect}
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="most_actions">Most Actions</option>
        </select>
      </div>

      <div style={s.tagFilters}>
        {["all", ...ALL_TAGS].map(tag => (
          <button
            key={tag}
            style={{
              ...s.tagBtn,
              ...(activeTag === tag ? s.tagBtnActive : {}),
            }}
            onClick={() => setActiveTag(tag)}
          >
            {tag === "all" ? "All" : tag}
          </button>
        ))}
      </div>

      {loading && <p style={s.muted}>Loading listings...</p>}

      {!loading && filtered.length === 0 && (
        <div style={s.empty}>
          <p style={s.emptyTitle}>No listings found</p>
          <p style={s.emptySub}>
            {search || activeTag !== "all" || minPrice || maxPrice
              ? "Try adjusting your filters."
              : "Be the first to list an agent session."}
          </p>
        </div>
      )}

      <div style={{
        ...s.grid,
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
      }}>
        {filtered.map(({ meta: m, listing }) => (
          <ListingCard
            key={m.blob_name}
            listing={listing}
            hasWallet={!!myAddress}
            onClick={() => setSelected({ meta: m, listing })}
          />
        ))}
      </div>

      {hasMore && (
        <button style={s.loadMore} onClick={handleLoadMore} disabled={loadMore}>
          {loadMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}

function ListingCard({ listing, hasWallet, onClick }: { listing: MarketListing; hasWallet: boolean; onClick: () => void }) {
  const dur = (listing.sessionMeta.durationMs / 1000).toFixed(0);
  const priceDisplay = (listing.priceUsd / 1e8).toFixed(2);

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.cardTop}>
        <div style={s.cardTitle}>{listing.title}</div>
        <div style={s.price}>${priceDisplay} <span style={s.priceCcy}>SUSD</span></div>
      </div>
      <p style={s.cardDesc}>{listing.description.slice(0, 120)}{listing.description.length > 120 ? "..." : ""}</p>

      {listing.tags && listing.tags.length > 0 && (
        <div style={s.tagList}>
          {listing.tags.map(tag => (
            <span key={tag} style={s.tagChip}>{tag}</span>
          ))}
        </div>
      )}

      <div style={s.cardMeta}>
        <span>{listing.sessionMeta.actionCount} actions</span>
        <span>{dur}s</span>
        {listing.sessionMeta.model && <span style={s.model}>{listing.sessionMeta.model}</span>}
        <span style={{ color: listing.sessionMeta.status === "completed" ? "#FF77C9" : "#FD8565" }}>
          {listing.sessionMeta.status}
        </span>
      </div>
      <div style={s.toolList}>
        {listing.sessionMeta.toolsUsed.slice(0, 4).map(t => (
          <span key={t} style={s.toolChip}>{t}</span>
        ))}
        {listing.sessionMeta.toolsUsed.length > 4 && (
          <span style={s.toolChip}>+{listing.sessionMeta.toolsUsed.length - 4}</span>
        )}
      </div>
      <div style={s.cardFoot}>
        <span style={s.previewCount}>
          {listing.previewActions.length} preview action{listing.previewActions.length !== 1 ? "s" : ""}
        </span>
        <span style={s.viewBtn}>
          {hasWallet ? "View →" : "Connect wallet to buy"}
        </span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 960, margin: "0 auto", padding: "32px 24px" },
  topRow:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" as const, marginBottom: 24 },
  heading:   { fontSize: 32, fontWeight: 800, letterSpacing: "-1px", marginBottom: 8, color: "#ffffff" },
  sub:       { fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: 560 },
  listBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700,
    padding: "10px 18px", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
    whiteSpace: "nowrap" as const,
  },
  muted:     { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  empty:     { textAlign: "center" as const, padding: "64px 0" },
  emptyTitle:{ fontSize: 16, color: "#FF77C9", marginBottom: 8, fontWeight: 700 },
  emptySub:  { fontSize: 13, color: "rgba(255,255,255,0.5)" },

  filterBar: {
    display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const, alignItems: "center",
  },
  searchInput: {
    flex: 1, minWidth: 160,
    background: "#322313", border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "10px 14px", outline: "none",
  },
  priceRow: { display: "flex", alignItems: "center", gap: 4 },
  priceInput: {
    width: 90,
    background: "#322313", border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "10px", outline: "none",
  },
  priceSep:  { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  sortSelect: {
    background: "#322313", border: "1px solid rgba(255,119,201,0.4)", borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "10px 14px", outline: "none", cursor: "pointer",
  },

  tagFilters: { display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 20 },
  tagBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 0,
    color: "rgba(255,255,255,0.6)",
    fontSize: 12, fontWeight: 600,
    padding: "6px 14px", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },
  tagBtnActive: {
    background: "#FF77C9",
    border: "1px solid #FF77C9",
    color: "#322313",
  },
  tagList: { display: "flex", gap: 4, flexWrap: "wrap" as const },
  tagChip: {
    background: "transparent",
    border: "1px solid rgba(253,133,101,0.5)",
    borderRadius: 0,
    color: "#FD8565",
    fontSize: 10, fontWeight: 700,
    padding: "2px 8px",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#4F1A2A",
    border: "1px solid rgba(255,119,201,0.2)",
    borderRadius: 0,
    padding: 20, cursor: "pointer", transition: "border-color 0.15s",
    display: "flex", flexDirection: "column" as const, gap: 10,
  },
  cardTop:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: 700, flex: 1, color: "#ffffff" },
  price:     { fontSize: 18, fontWeight: 800, color: "#FD8565", whiteSpace: "nowrap" as const },
  priceCcy:  { fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 },
  cardDesc:  { fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, margin: 0 },
  cardMeta: {
    display: "flex", gap: 10, fontSize: 12, color: "rgba(255,255,255,0.6)",
    flexWrap: "wrap" as const,
  },
  model:     { color: "#FD8565" },
  toolList:  { display: "flex", gap: 6, flexWrap: "wrap" as const },
  toolChip: {
    background: "transparent",
    border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#FF77C9", fontSize: 10, fontWeight: 600, padding: "2px 8px",
  },
  cardFoot:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  previewCount: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  viewBtn:      { fontSize: 12, color: "#FD8565", fontWeight: 700 },
  loadMore: {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#FF77C9", fontSize: 13, fontWeight: 700,
    padding: "12px 0", cursor: "pointer", marginTop: 16,
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },
};
