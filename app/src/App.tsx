import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { DERIVE_MESSAGE } from "./lib/evm.js";
// Note: wagmi/wallet hooks kept for ConnectPrompt component below
import { Header } from "./components/Header.js";
import { ProfilePage } from "./components/ProfilePage.js";
import { VerifyPage } from "./components/VerifyPage.js";
import { MarketplacePage } from "./components/MarketplacePage.js";
import { Bubbles } from "./components/Bubbles.js";
import { LandingPage } from "./components/LandingPage.js";
import { getX25519Keys } from "./lib/crypto.js";

const NETWORK = import.meta.env["VITE_SHELBY_NETWORK"] ?? "shelbynet";

// ── Shell ─────────────────────────────────────────────────────────────────────
function Shell() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [aptosAddress,  setAptosAddress]  = useState<string | null>(null);
  const [privateKeyHex, setPrivateKeyHex] = useState<string | null>(null);

  const x25519Keys = privateKeyHex ? (() => {
    try { return getX25519Keys(privateKeyHex); } catch { return null; }
  })() : null;

  const urlAddress = new URLSearchParams(location.search).get("address");

  function handleAptosAddress(addr: string | null) {
    setAptosAddress(addr);
    if (addr) {
      const url = new URL(window.location.href);
      url.searchParams.set("address", addr);
      window.history.replaceState({}, "", url.toString());
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "transparent", color: "#ffffff", position: "relative", zIndex: 1 }}>
      <Header
        aptosAddress={aptosAddress}
        onAptosAddress={handleAptosAddress}
        onDecryptionKey={() => {}}
        onPrivateKeyHex={setPrivateKeyHex}
        onHome={() => navigate("/")}
      />

      <Routes>
        <Route path="/verify"  element={
          <VerifyPage network={NETWORK} initialAddress={urlAddress ?? undefined} />
        } />
        <Route path="/market"  element={
          <MarketplacePage
            network={NETWORK}
            myAddress={aptosAddress}
            x25519Priv={x25519Keys?.x25519Priv ?? null}
            x25519Pub={x25519Keys?.x25519Pub ?? null}
          />
        } />
        <Route path="/profile" element={
          aptosAddress
            ? <ProfilePage
                address={aptosAddress}
                network={NETWORK}
                privateKeyHex={privateKeyHex}
                x25519Priv={x25519Keys?.x25519Priv ?? null}
              />
            : <ConnectPrompt onConnected={(addr, pk) => {
                handleAptosAddress(addr);
                if (pk) setPrivateKeyHex(pk);
                navigate("/profile");
              }} />
        } />
        {/* Default fallback inside shell */}
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
    </div>
  );
}

// ── Root router ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <Bubbles />
      <Routes>
        <Route path="/" element={<LandingPage onLaunch={() => {}} />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </>
  );
}

// ── Connect prompt (profile page without wallet) ──────────────────────────────
interface ConnectPromptProps {
  onConnected: (address: string, pkHex: string | null) => void;
}

function ConnectPrompt({ onConnected }: ConnectPromptProps) {
  const { connectAsync }     = useConnect();
  const { signMessageAsync } = useSignMessage();
  const {
    connect: aptosConnect,
    wallets: aptosWallets,
    connected: aptosConnected,
    account: aptosAccount,
  } = useWallet();

  const [busy,  setBusy]  = useState<"evm" | "aptos" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (aptosConnected && aptosAccount?.address) {
      onConnected(aptosAccount.address.toString(), null);
    }
  }, [aptosConnected, aptosAccount]);

  async function handleEVM() {
    setError(null); setBusy("evm");
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
      onConnected(acct.accountAddress.toString(), pkHex);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally { setBusy(null); }
  }

  async function handleAptos() {
    setError(null); setBusy("aptos");
    try {
      const first = aptosWallets?.[0];
      if (!first) throw new Error("No Aptos wallet found. Install Petra.");
      await aptosConnect(first.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <div style={{ background: "#4F1A2A", border: "1px solid rgba(255,119,201,0.35)", padding: "48px 40px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>
          <span style={{ color: "#FD8565" }}>shelb</span>
          <span style={{ color: "#FF77C9" }}>trace</span>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 32 }}>
          Connect your wallet to access your profile. View your recorded AI Agent sessions,
          decrypt and inspect action details, list sessions on the marketplace,
          and manage your listings — all in one place.
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          <button onClick={handleEVM} disabled={!!busy} style={{
            background: "#FF77C9", border: "none", borderRadius: 0,
            color: "#322313", fontWeight: 700, fontSize: 14,
            padding: "14px 0", cursor: busy ? "not-allowed" : "pointer",
            opacity: busy && busy !== "evm" ? 0.5 : 1,
          }}>
            {busy === "evm" ? "Connecting..." : "Connect MetaMask (EVM)"}
          </button>
          <button onClick={handleAptos} disabled={!!busy} style={{
            background: "transparent", border: "1px solid #FD8565", borderRadius: 0,
            color: "#FD8565", fontWeight: 700, fontSize: 14,
            padding: "13px 0", cursor: busy ? "not-allowed" : "pointer",
            opacity: busy && busy !== "aptos" ? 0.5 : 1,
          }}>
            {busy === "aptos" ? "Connecting..." : "Connect Aptos Wallet (Petra)"}
          </button>
        </div>
        {error && <div style={{ marginTop: 16, fontSize: 12, color: "#FD8565" }}>{error}</div>}
      </div>
    </div>
  );
}
