import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { DERIVE_MESSAGE } from "../lib/evm.js";
import { KEY_DERIVATION_MESSAGE } from "../lib/evm.js";
import { useWindowWidth } from "../lib/hooks.js";

const s = {
  bar: {
    background: "#322313",
    borderBottom: "1px solid rgba(255,119,201,0.25)",
    padding: "0 24px", height: 56,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  } as React.CSSProperties,
  logo:     { fontWeight: 800, fontSize: 20, letterSpacing: -0.5 } as React.CSSProperties,
  right:    { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  btn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: 0,
    color: "#ffffff",
    fontSize: 13, padding: "7px 14px", cursor: "pointer",
  } as React.CSSProperties,
  btnEvm: {
    background: "#FF77C9", border: "none", borderRadius: 0,
    color: "#322313", fontWeight: 700,
    fontSize: 13, padding: "8px 16px", cursor: "pointer",
  } as React.CSSProperties,
  btnAptos: {
    background: "transparent",
    border: "1px solid #FD8565",
    borderRadius: 0,
    color: "#FD8565", fontWeight: 700,
    fontSize: 13, padding: "7px 14px", cursor: "pointer",
  } as React.CSSProperties,
  pillEvm: {
    background: "rgba(255,119,201,0.12)",
    border: "1px solid rgba(255,119,201,0.5)",
    borderRadius: 0,
    color: "#FF77C9", fontSize: 11, padding: "5px 10px", fontFamily: "monospace",
  } as React.CSSProperties,
  pillAptos: {
    background: "rgba(253,133,101,0.12)",
    border: "1px solid rgba(253,133,101,0.5)",
    borderRadius: 0,
    color: "#FD8565", fontSize: 11, padding: "5px 10px", fontFamily: "monospace",
  } as React.CSSProperties,
  divider: { width: 1, height: 20, background: "rgba(255,255,255,0.2)" } as React.CSSProperties,
};

interface Props {
  onAptosAddress?:  (addr: string | null) => void;
  onDecryptionKey?: (key: CryptoKey | null) => void;
  onPrivateKeyHex?: (key: string | null) => void;
  onHome?:          () => void;
}

export function WalletBar({ onAptosAddress, onDecryptionKey, onPrivateKeyHex, onHome }: Props) {
  const width    = useWindowWidth();
  const isMobile = width <= 640;

  // EVM
  const { address: ethAddress, isConnected: evmConnected } = useAccount();
  const { connectAsync }              = useConnect();
  const { disconnect: evmDisconnect } = useDisconnect();
  const { signMessageAsync }          = useSignMessage();
  const [derivedAptos, setDerivedAptos] = useState<string | null>(null);
  const [evmBusy, setEvmBusy]           = useState(false);
  const [evmError, setEvmError]         = useState<string | null>(null);

  // Aptos
  const {
    connect: aptosConnect,
    disconnect: aptosDisconnect,
    account: aptosAccount,
    connected: aptosConnected,
    wallets: aptosWallets,
    signMessage: aptosSign,
  } = useWallet();

  const aptosAddress = aptosAccount?.address?.toString() ?? null;
  const [aptosBusy,  setAptosBusy]  = useState(false);
  const [aptosError, setAptosError] = useState<string | null>(null);

  useEffect(() => {
    if (aptosConnected && aptosAddress) onAptosAddress?.(aptosAddress);
    else if (evmConnected && derivedAptos) onAptosAddress?.(derivedAptos);
    else onAptosAddress?.(null);
  }, [aptosConnected, aptosAddress, evmConnected, derivedAptos]);

  async function handleEvmConnect() {
    setEvmError(null);
    setEvmBusy(true);
    try {
      const result  = await connectAsync({ connector: metaMask() });
      const ethAddr = result.accounts[0];

      const ethSig  = await signMessageAsync({ message: DERIVE_MESSAGE });
      const enc     = new TextEncoder();
      const km      = await crypto.subtle.importKey("raw", enc.encode(ethSig), { name: "HKDF" }, false, ["deriveBits"]);
      const bits    = await crypto.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt: enc.encode("shelbtrace-v1"), info: enc.encode(ethAddr.toLowerCase()) },
        km, 256
      );
      const pkHex   = "0x" + Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const acct    = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(pkHex) });
      setDerivedAptos(acct.accountAddress.toString());
      onPrivateKeyHex?.(pkHex);

      onDecryptionKey?.(null);
    } catch (e) {
      setEvmError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setEvmBusy(false);
    }
  }

  function handleEvmDisconnect() {
    evmDisconnect();
    setDerivedAptos(null);
    onPrivateKeyHex?.(null);
    onDecryptionKey?.(null);
  }

  async function handleAptosConnect() {
    const first = aptosWallets?.[0];
    if (!first) return;
    setAptosError(null);
    setAptosBusy(true);
    try {
      await aptosConnect(first.name);
    } catch (e) {
      setAptosError(e instanceof Error ? e.message : "Connection failed");
      setAptosBusy(false);
    }
  }

  useEffect(() => {
    if (!aptosConnected || !aptosSign) return;
    let cancelled = false;
    (async () => {
      try {
        await aptosSign({ message: KEY_DERIVATION_MESSAGE, nonce: "shelbtrace" });
        if (cancelled) return;
        onDecryptionKey?.(null);
      } catch {
        if (!cancelled) setAptosError("Could not derive decryption key from wallet.");
      } finally {
        if (!cancelled) setAptosBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [aptosConnected]);

  function handleAptosDisconnect() {
    aptosDisconnect();
    onDecryptionKey?.(null);
  }

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const busy  = evmBusy || aptosBusy;

  return (
    <div style={{ ...s.bar, height: isMobile ? "auto" : 56, flexDirection: isMobile ? "column" : "row", padding: isMobile ? "10px 16px" : "0 24px", gap: isMobile ? 8 : 0 }}>
      <div
        style={{ ...s.logo, cursor: onHome ? "pointer" : "default" }}
        onClick={onHome}
      >
        <span style={{ color: "#FD8565" }}>shelb</span>
        <span style={{ color: "#FF77C9" }}>trace</span>
      </div>

      <div style={{ ...s.right, flexWrap: "wrap" as const }}>
        {evmError   && <span style={{ color: "#FD8565", fontSize: 11 }}>{evmError}</span>}
        {aptosError && <span style={{ color: "#FD8565", fontSize: 11 }}>{aptosError}</span>}
        {busy       && <span style={{ color: "#FF77C9", fontSize: 11 }}>Connecting...</span>}

        {evmConnected && derivedAptos && !isMobile && (
          <>
            <span style={s.pillEvm} title={`ETH: ${ethAddress}\nAptos: ${derivedAptos}`}>
              MM {short(derivedAptos)}
            </span>
            <button style={s.btn} onClick={handleEvmDisconnect}>Disconnect</button>
            <div style={s.divider} />
          </>
        )}
        {evmConnected && derivedAptos && isMobile && (
          <button style={s.btn} onClick={handleEvmDisconnect}>MM Disconnect</button>
        )}

        {aptosConnected && aptosAddress && !isMobile && (
          <>
            <span style={s.pillAptos} title={aptosAddress}>
              Aptos {short(aptosAddress)}
            </span>
            <button style={s.btn} onClick={handleAptosDisconnect}>Disconnect</button>
            <div style={s.divider} />
          </>
        )}
        {aptosConnected && aptosAddress && isMobile && (
          <button style={s.btn} onClick={handleAptosDisconnect}>Aptos Disconnect</button>
        )}

        {!evmConnected && (
          <button style={s.btnEvm} onClick={handleEvmConnect} disabled={busy}>
            Connect MetaMask
          </button>
        )}
        {!aptosConnected && (
          <button style={s.btnAptos} onClick={handleAptosConnect} disabled={busy}>
            Aptos Wallet
          </button>
        )}
      </div>
    </div>
  );
}
