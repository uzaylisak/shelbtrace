import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { DERIVE_MESSAGE, KEY_DERIVATION_MESSAGE } from "../lib/evm.js";
import { useWindowWidth } from "../lib/hooks.js";

type Page = "verify" | "market" | "profile";

interface Props {
  onAptosAddress:  (addr: string | null) => void;
  onPrivateKeyHex: (key: string | null) => void;
  onDecryptionKey: (key: CryptoKey | null) => void;
  onHome:          () => void;
  aptosAddress:    string | null;
}

export function Header({
  onAptosAddress, onPrivateKeyHex, onDecryptionKey, onHome, aptosAddress,
}: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const width     = useWindowWidth();
  const isMobile  = width <= 768;

  // EVM
  const { address: ethAddress, isConnected: evmConnected } = useAccount();
  const { connectAsync }              = useConnect();
  const { disconnect: evmDisconnect } = useDisconnect();
  const { signMessageAsync }          = useSignMessage();
  const [evmBusy,  setEvmBusy]  = useState(false);
  const [derivedAptos, setDerivedAptos] = useState<string | null>(null);

  // Aptos
  const {
    connect: aptosConnect, disconnect: aptosDisconnect,
    account: aptosAccount, connected: aptosConnected,
    wallets: aptosWallets, signMessage: aptosSign,
  } = useWallet();
  const aptosAddr = aptosAccount?.address?.toString() ?? null;
  const [aptosBusy, setAptosBusy] = useState(false);

  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  // Close wallet dropdown on outside click
  useEffect(() => {
    if (!walletMenuOpen) return;
    const handler = () => setWalletMenuOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [walletMenuOpen]);

  // Sync address to parent
  useEffect(() => {
    if (aptosConnected && aptosAddr) {
      onAptosAddress(aptosAddr);
    } else if (evmConnected && derivedAptos) {
      onAptosAddress(derivedAptos);
    } else {
      onAptosAddress(null);
    }
  }, [aptosConnected, aptosAddr, evmConnected, derivedAptos]);

  // Derive AES key after Aptos connect
  useEffect(() => {
    if (!aptosConnected || !aptosSign) return;
    let cancelled = false;
    (async () => {
      try {
        await aptosSign({ message: KEY_DERIVATION_MESSAGE, nonce: "shelbtrace" });
        if (!cancelled) onDecryptionKey(null);
      } catch {}
      if (!cancelled) setAptosBusy(false);
    })();
    return () => { cancelled = true; };
  }, [aptosConnected]);

  // ── EVM connect ────────────────────────────────────────────────────────────
  async function handleEvmConnect() {
    setEvmBusy(true);
    try {
      const result  = await connectAsync({ connector: metaMask() });
      const ethAddr = result.accounts[0];
      const sig  = await signMessageAsync({ message: DERIVE_MESSAGE });
      const enc  = new TextEncoder();
      const km   = await crypto.subtle.importKey("raw", enc.encode(sig), { name: "HKDF" }, false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: enc.encode("shelbtrace-v1"), info: enc.encode(ethAddr.toLowerCase()) },
        km, 256
      );
      const pkHex = "0x" + Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
      const acct  = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(pkHex) });
      setDerivedAptos(acct.accountAddress.toString());
      onPrivateKeyHex(pkHex);
      onDecryptionKey(null);
    } catch {}
    finally { setEvmBusy(false); }
  }

  function handleEvmDisconnect() {
    evmDisconnect(); setDerivedAptos(null);
    onPrivateKeyHex(null); onDecryptionKey(null);
  }

  async function handleAptosConnect() {
    const first = aptosWallets?.[0]; if (!first) return;
    setAptosBusy(true);
    try { await aptosConnect(first.name); } catch { setAptosBusy(false); }
  }

  function handleAptosDisconnect() {
    aptosDisconnect(); onDecryptionKey(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const page: Page = location.pathname === "/verify" ? "verify"
    : location.pathname === "/profile" ? "profile"
    : "market";

  const navItems: { label: string; page: Page; path: string }[] = [
    { label: "VERIFY",  page: "verify",  path: "/verify"  },
    { label: "MARKET",  page: "market",  path: "/market"  },
    { label: "PROFILE", page: "profile", path: "/profile" },
  ];

  const connected = aptosConnected || evmConnected;
  const shortAddr = aptosAddress ? `${aptosAddress.slice(0, 6)}...${aptosAddress.slice(-4)}` : null;
  const busy      = evmBusy || aptosBusy;

  return (
    <>
      <header style={s.bar}>
        {/* Logo */}
        <div style={s.logo} onClick={onHome}>
          <span style={{ color: "#322313" }}>shelb</span>
          <span style={{
            color: "#FD8565",
            textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
          }}>trace</span>
        </div>

        {!isMobile && (
          <>
            {/* Nav links */}
            <nav style={s.nav}>
              {navItems.map(item => (
                <button
                  key={item.page}
                  style={{
                    ...s.navItem,
                    color: page === item.page ? "#322313" : "rgba(50,35,19,0.55)",
                    borderBottom: page === item.page ? "2px solid #322313" : "2px solid transparent",
                  }}
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Wallet area */}
            <div style={s.walletArea}>
              {connected && shortAddr ? (
                <>
                  <span style={s.addrPill}>{shortAddr}</span>
                  <button
                    style={s.disconnectBtn}
                    onClick={aptosConnected ? handleAptosDisconnect : handleEvmDisconnect}
                  >
                    DISCONNECT
                  </button>
                </>
              ) : (
                <div style={{ position: "relative" }}>
                  <button
                    style={s.ctaBtn}
                    onClick={() => setWalletMenuOpen(o => !o)}
                    disabled={busy}
                  >
                    {busy ? "CONNECTING..." : "CONNECT WALLET"}<span style={s.arrow}> ↗</span>
                  </button>

                  {walletMenuOpen && (
                    <div style={s.walletDropdown}>
                      <button
                        style={s.walletOption}
                        onClick={() => { setWalletMenuOpen(false); handleEvmConnect(); }}
                      >
                        <div>
                          <div style={s.walletOptionTitle}>EVM</div>
                          <div style={s.walletOptionSub}>MetaMask</div>
                        </div>
                      </button>
                      <button
                        style={{ ...s.walletOption, borderBottom: "none" }}
                        onClick={() => { setWalletMenuOpen(false); handleAptosConnect(); }}
                      >
                        <div>
                          <div style={s.walletOptionTitle}>Aptos</div>
                          <div style={s.walletOptionSub}>Petra, Nightly</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <button style={s.hamburger} onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? "CLOSE" : "MENU"}
          </button>
        )}
      </header>

      {/* Mobile dropdown */}
      {isMobile && mobileOpen && (
        <div style={s.mobileMenu}>
          {navItems.map(item => (
            <button
              key={item.page}
              style={{
                ...s.mobileNavItem,
                color: page === item.page ? "#322313" : "rgba(50,35,19,0.55)",
              }}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
            >
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,119,201,0.2)", paddingTop: 14, marginTop: 4 }}>
            {connected && shortAddr ? (
              <>
                <div style={{ fontSize: 12, color: "#322313", fontFamily: "monospace", marginBottom: 10 }}>{shortAddr}</div>
                <button style={s.mobileBtn} onClick={aptosConnected ? handleAptosDisconnect : handleEvmDisconnect}>
                  DISCONNECT
                </button>
              </>
            ) : (
              <>
                <button style={{ ...s.mobileBtn, ...s.mobileBtnPink }} onClick={handleEvmConnect} disabled={busy}>
                  {busy ? "CONNECTING..." : "CONNECT METAMASK"}
                </button>
                <button style={s.mobileBtn} onClick={handleAptosConnect} disabled={busy}>
                  APTOS WALLET
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  // Outer wrapper — provides the top padding so bar floats
  bar: {
    position:     "relative",
    zIndex:       100,
    display:      "flex",
    alignItems:   "center",
    height:       50,
    padding:      "0 22px",
    margin:       "14px 44px 0",
    background:   "#FF77C9",
    borderRadius: 12,
  },
  logo: {
    fontSize:      20,
    fontWeight:    800,
    letterSpacing: -0.5,
    cursor:        "pointer",
    flexShrink:    0,
    userSelect:    "none",
  },
  nav: {
    display:     "flex",
    alignItems:  "center",
    marginLeft:  "auto",
    marginRight: 20,
  },
  navItem: {
    background:    "transparent",
    border:        "none",
    borderBottom:  "2px solid transparent",
    color:         "rgba(50,35,19,0.6)",
    fontSize:      12,
    fontWeight:    800,
    letterSpacing: 2,
    padding:       "0 16px",
    height:        50,
    cursor:        "pointer",
    fontFamily:    "inherit",
    transition:    "color 0.15s",
    whiteSpace:    "nowrap",
  },
  walletArea: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    flexShrink: 0,
  },
  addrPill: {
    fontSize:   11,
    fontFamily: "monospace",
    color:      "#322313",
    background: "rgba(50,35,19,0.15)",
    border:     "1px solid rgba(50,35,19,0.3)",
    padding:    "5px 12px",
  },
  ctaBtn: {
    background:    "#322313",
    border:        "none",
    color:         "#FF77C9",
    fontSize:      12,
    fontWeight:    800,
    letterSpacing: 1.5,
    padding:       "10px 22px",
    cursor:        "pointer",
    fontFamily:    "inherit",
    whiteSpace:    "nowrap",
  },
  ctaBtnOutline: {
    background:    "transparent",
    border:        "1px solid rgba(50,35,19,0.4)",
    color:         "#322313",
    fontSize:      12,
    fontWeight:    800,
    letterSpacing: 1.5,
    padding:       "9px 18px",
    cursor:        "pointer",
    fontFamily:    "inherit",
    whiteSpace:    "nowrap",
  },
  disconnectBtn: {
    background:    "transparent",
    border:        "1px solid rgba(50,35,19,0.3)",
    color:         "rgba(50,35,19,0.6)",
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: 1.5,
    padding:       "8px 16px",
    cursor:        "pointer",
    fontFamily:    "inherit",
  },
  arrow: { fontSize: 14 },
  walletDropdown: {
    position:   "absolute",
    top:        "calc(100% + 8px)",
    right:      0,
    background: "#4F1A2A",
    border:     "1px solid rgba(255,119,201,0.3)",
    borderRadius: 10,
    overflow:   "hidden",
    minWidth:   200,
    zIndex:     200,
    boxShadow:  "0 8px 32px rgba(0,0,0,0.4)",
  },
  walletOption: {
    width:      "100%",
    background: "transparent",
    border:     "none",
    borderBottom: "1px solid rgba(255,119,201,0.12)",
    color:      "#ffffff",
    fontSize:   13,
    padding:    "14px 16px",
    cursor:     "pointer",
    fontFamily: "inherit",
    display:    "flex",
    alignItems: "center",
    gap:        12,
    textAlign:  "left",
    transition: "background 0.12s",
  },
  walletOptionIcon: {
    background:   "#FF77C9",
    color:        "#322313",
    fontWeight:   800,
    fontSize:     11,
    width:        32,
    height:       32,
    borderRadius: 6,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    flexShrink:   0,
  },
  walletOptionTitle: { fontWeight: 700, fontSize: 13, marginBottom: 2 },
  walletOptionSub:   { fontSize: 11, color: "rgba(255,255,255,0.45)" },
  hamburger: {
    marginLeft:    "auto",
    background:    "transparent",
    border:        "1px solid rgba(50,35,19,0.4)",
    color:         "#322313",
    fontSize:      11,
    fontWeight:    700,
    letterSpacing: 1.5,
    padding:       "7px 14px",
    cursor:        "pointer",
    fontFamily:    "inherit",
  },
  mobileMenu: {
    position:     "relative",
    zIndex:       99,
    background:   "#FF77C9",
    margin:       "4px 28px 0",
    borderRadius: "0 0 12px 12px",
    padding:      "12px 24px 20px",
    display:      "flex",
    flexDirection:"column",
    gap:          4,
  },
  mobileNavItem: {
    background:    "transparent",
    border:        "none",
    fontSize:      13,
    fontWeight:    800,
    letterSpacing: 2,
    padding:       "11px 0",
    cursor:        "pointer",
    fontFamily:    "inherit",
    textAlign:     "left",
    borderBottom:  "1px solid rgba(50,35,19,0.1)",
  },
  mobileBtn: {
    width:         "100%",
    background:    "transparent",
    border:        "1px solid rgba(50,35,19,0.3)",
    color:         "rgba(50,35,19,0.7)",
    fontSize:      12,
    fontWeight:    700,
    letterSpacing: 1.5,
    padding:       "10px",
    cursor:        "pointer",
    fontFamily:    "inherit",
    marginBottom:  8,
    textAlign:     "center",
  },
  mobileBtnPink: {
    background: "#322313",
    border:     "none",
    color:      "#FF77C9",
  },
};
