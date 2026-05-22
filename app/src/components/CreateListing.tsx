import { useState } from "react";
import type { MarketListing } from "../lib/types.js";

const ALL_TAGS = ["debugging", "research", "coding", "automation", "data"];

interface ListingFormData {
  title: string;
  description: string;
  priceUsd: number;
  priceOctas: number;
  tags: string[];
  previewActionIndices: number[];
}

interface Props {
  onSubmit: (data: ListingFormData) => void;
  onClose: () => void;
  existingListing?: Partial<MarketListing>;
  maxPreviewActions?: number;
  totalActions?: number;
}

export function CreateListing({ onSubmit, onClose, maxPreviewActions = 3, totalActions = 0 }: Props) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [priceStr,    setPriceStr]    = useState("");
  const [tags,        setTags]        = useState<string[]>([]);
  const [previewIdxs, setPreviewIdxs] = useState<number[]>([]);
  const [submitted,   setSubmitted]   = useState(false);

  function computeOctas(priceUsd: number): number {
    const base = Math.floor(priceUsd * 1e8);
    const suffix = Math.floor(Math.random() * 9999) + 1;
    return base + suffix;
  }

  const priceUsd   = parseFloat(priceStr) || 0;
  const priceOctas = priceUsd > 0 ? computeOctas(priceUsd) : 0;
  const [frozenOctas, setFrozenOctas] = useState<number | null>(null);

  function handlePriceBlur() {
    if (priceUsd > 0) {
      setFrozenOctas(computeOctas(priceUsd));
    } else {
      setFrozenOctas(null);
    }
  }

  function toggleTag(tag: string) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function togglePreviewIdx(idx: number) {
    setPreviewIdxs(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx);
      if (prev.length >= maxPreviewActions) return prev;
      return [...prev, idx];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || priceUsd <= 0) return;
    const octas = frozenOctas ?? computeOctas(priceUsd);
    setSubmitted(true);
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priceUsd,
      priceOctas: octas,
      tags,
      previewActionIndices: previewIdxs,
    });
  }

  const displayOctas = frozenOctas ?? (priceUsd > 0 ? priceOctas : null);

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <div style={s.modalTitle}>New Listing</div>
          <button style={s.closeBtn} onClick={onClose}>X</button>
        </div>

        <div style={s.note}>
          Listing will be published via your shelbtrace server
        </div>

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Title</label>
            <input
              style={s.input}
              placeholder="e.g. Python debugging session with error resolution"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Description</label>
            <textarea
              style={{ ...s.input, height: 80, resize: "vertical" as const }}
              placeholder="Describe what this session contains and what the buyer will learn..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Price (SUSD)</label>
            <input
              style={s.input}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 5.00"
              value={priceStr}
              onChange={e => { setPriceStr(e.target.value); setFrozenOctas(null); }}
              onBlur={handlePriceBlur}
              required
            />
            {displayOctas !== null && (
              <div style={s.octasNote}>
                Exact price: {displayOctas.toLocaleString()} octas (approx ${priceUsd.toFixed(2)})
              </div>
            )}
          </div>

          <div style={s.field}>
            <label style={s.label}>Tags</label>
            <div style={s.tagRow}>
              {ALL_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  style={{
                    ...s.tagBtn,
                    ...(tags.includes(tag) ? s.tagBtnActive : {}),
                  }}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {totalActions > 0 && (
            <div style={s.field}>
              <label style={s.label}>
                Preview Actions <span style={s.labelSub}>(select up to {maxPreviewActions})</span>
              </label>
              <div style={s.checkList}>
                {Array.from({ length: totalActions }, (_, i) => (
                  <label key={i} style={s.checkRow}>
                    <input
                      type="checkbox"
                      checked={previewIdxs.includes(i)}
                      onChange={() => togglePreviewIdx(i)}
                      disabled={!previewIdxs.includes(i) && previewIdxs.length >= maxPreviewActions}
                    />
                    <span style={s.checkLabel}>Action #{i + 1}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              type="submit"
              style={s.submitBtn}
              disabled={submitted || !title.trim() || !description.trim() || priceUsd <= 0}
            >
              {submitted ? "Submitted" : "Create Listing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(50, 35, 19, 0.9)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: "#4F1A2A",
    border: "1px solid #FF77C9",
    borderRadius: 0,
    padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 800, color: "#FF77C9", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  closeBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, fontWeight: 700,
    padding: "4px 10px",
    cursor: "pointer", lineHeight: 1,
  },
  note: {
    background: "#322313",
    border: "1px solid rgba(253,133,101,0.5)",
    borderRadius: 0,
    color: "#FD8565", fontSize: 12, padding: "10px 14px", marginBottom: 20,
  },
  field:     { marginBottom: 16 },
  label:     { display: "block", fontSize: 11, fontWeight: 700, color: "#FF77C9", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.5px" },
  labelSub:  { color: "rgba(255,255,255,0.55)", fontWeight: 400, textTransform: "none" as const },
  input: {
    width: "100%",
    background: "#322313",
    border: "1px solid rgba(255,119,201,0.4)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "10px 12px", outline: "none",
    boxSizing: "border-box" as const,
  },
  octasNote: {
    fontSize: 11, color: "#FD8565", marginTop: 4, fontFamily: "monospace",
  },
  tagRow:    { display: "flex", flexWrap: "wrap" as const, gap: 6 },
  tagBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 0,
    color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },
  tagBtnActive: {
    background: "#FF77C9", border: "1px solid #FF77C9", color: "#322313",
  },
  checkList: { display: "flex", flexDirection: "column" as const, gap: 6, maxHeight: 180, overflowY: "auto" as const },
  checkRow:  { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  checkLabel:{ fontSize: 13, color: "rgba(255,255,255,0.8)" },
  actions:   { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 },
  cancelBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 0,
    color: "#ffffff", fontSize: 13, padding: "10px 20px", cursor: "pointer",
  },
  submitBtn: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontSize: 13, fontWeight: 700, padding: "10px 24px", cursor: "pointer",
    textTransform: "uppercase" as const, letterSpacing: 0.3,
  },
};
