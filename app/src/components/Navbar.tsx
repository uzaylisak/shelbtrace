export type Page = "verify" | "profile" | "market";

interface Props {
  page: Page;
  onPage: (p: Page) => void;
  isConnected: boolean;
  onConnectWallet: () => void;
}

export function Navbar({ page, onPage, isConnected, onConnectWallet }: Props) {
  function handleProfile() {
    if (isConnected) {
      onPage("profile");
    } else {
      onConnectWallet();
    }
  }

  return (
    <div style={s.tabs}>
      <button
        style={{ ...s.tab, ...(page === "verify" ? s.active : {}) }}
        onClick={() => onPage("verify")}
      >
        Verify
      </button>
      <button
        style={{ ...s.tab, ...(page === "market" ? s.active : {}) }}
        onClick={() => onPage("market")}
      >
        Market
      </button>
      <button
        style={{ ...s.tab, ...(page === "profile" ? s.active : {}) }}
        onClick={handleProfile}
      >
        Profile
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tabs: {
    display: "flex", gap: 0,
    borderBottom: "1px solid rgba(255,119,201,0.25)",
    padding: "0 24px",
    background: "#322313",
  },
  tab: {
    background: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    borderRadius: 0,
    color: "rgba(255,255,255,0.55)",
    fontSize: 14, fontWeight: 600,
    padding: "16px 22px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 8,
    transition: "color 0.15s",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  active: {
    color: "#FF77C9",
    borderBottom: "3px solid #FF77C9",
  },
};
