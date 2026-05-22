import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { edwardsToMontgomeryPub } from "@noble/curves/ed25519";
import type { ShelbyWriter } from "./shelby-client.js";
import type { MarketListing, ShelbyBlobPayload } from "./types.js";

const SHELBYUSD_METADATA =
  "0x1b18363a9f1fe5e6ebf247daba5cc1c18052bb232efdc4c50f556053922d98e1";

const NETWORK_MAP: Record<string, Network> = {
  testnet:   Network.TESTNET,
  shelbynet: Network.SHELBYNET,
  local:     Network.LOCAL,
};

const RPC: Record<string, string> = {
  testnet:   "https://api.testnet.shelby.xyz/shelby",
  shelbynet: "https://api.shelbynet.shelby.xyz/shelby",
  local:     "http://localhost:9090",
};

const INDEXER: Record<string, string> = {
  testnet:   "https://api.testnet.aptoslabs.com/nocode/v1/public/alias/shelby/testnet/v1/graphql",
  shelbynet: "https://api.shelbynet.aptoslabs.com/nocode/v1/public/alias/shelby/shelbynet/v1/graphql",
};

const POLL_MS     = 30_000;
const LOOK_BACK_S = 120; // look for payments in last 2 minutes

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace("0x", "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function fetchBlobJson<T>(owner: string, blobName: string, network: string): Promise<T> {
  const url = `${RPC[network] ?? RPC.shelbynet}/v1/blobs/${owner}/${blobName}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(await res.text()) as T;
}

async function queryIndexer<T>(
  network: string, query: string, variables: Record<string, unknown> = {}
): Promise<T> {
  const url = INDEXER[network] ?? INDEXER.shelbynet;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

// ─── Extract buyer X25519 pub key from Aptos transaction ─────────────────────

async function getBuyerX25519Pub(
  aptos: Aptos,
  txHash: string
): Promise<{ buyerAddress: string; x25519Pub: Uint8Array } | null> {
  try {
    const tx = await aptos.getTransactionByHash({ transactionHash: txHash });
    if (!tx || tx.type !== "user_transaction") return null;

    const userTx = tx as {
      sender: string;
      signature?: { public_key?: string; type?: string };
    };

    const ed25519PubHex = userTx.signature?.public_key;
    if (!ed25519PubHex || userTx.signature?.type !== "ed25519_signature") return null;

    const ed25519Bytes = hexToBytes(ed25519PubHex);
    const x25519Pub   = edwardsToMontgomeryPub(ed25519Bytes);

    return { buyerAddress: userTx.sender, x25519Pub };
  } catch {
    return null;
  }
}

// ─── Find recent ShelbyUSD payments to seller ────────────────────────────────

const RECENT_TXS_QUERY = `
  query RecentActivity($owner: String!, $since: timestamp!) {
    blob_activities(
      where: {
        owner: { _eq: $owner },
        event_type: { _eq: "blob_registered" },
        timestamp: { _gte: $since }
      }
      order_by: { timestamp: desc }
      limit: 50
    ) { transaction_hash timestamp owner blob_name }
  }
`;

// We poll Aptos directly for coin transfers using its REST API
async function getRecentShelbyUSDPayments(
  aptos: Aptos,
  sellerAddress: string
): Promise<{ txHash: string; sender: string; amount: number }[]> {
  // Aptos SDK: get account transactions for seller (fungible asset transfers)
  try {
    const txs = await aptos.getAccountTransactions({
      accountAddress: sellerAddress,
      options: { limit: 25 },
    });

    const payments: { txHash: string; sender: string; amount: number }[] = [];

    for (const tx of txs) {
      if (tx.type !== "user_transaction") continue;
      const userTx = tx as {
        hash: string;
        sender: string;
        success: boolean;
        payload: { function?: string; arguments?: unknown[] };
        timestamp: string;
      };

      if (!userTx.success) continue;

      const age = Date.now() - Math.floor(Number(userTx.timestamp) / 1000);
      if (age > LOOK_BACK_S * 1000 * 10) continue; // skip very old ones

      const fn   = userTx.payload.function ?? "";
      const args = userTx.payload.arguments ?? [];

      if (!fn.includes("primary_fungible_store::transfer")) continue;
      if (String(args[0]).toLowerCase() !== SHELBYUSD_METADATA.toLowerCase()) continue;
      if (String(args[1]).toLowerCase() !== sellerAddress.toLowerCase()) continue;

      payments.push({
        txHash: userTx.hash,
        sender: userTx.sender,
        amount: Number(args[2]),
      });
    }

    return payments;
  } catch {
    return [];
  }
}

// ─── Main watcher ─────────────────────────────────────────────────────────────

const processed = new Set<string>(); // txHash set

export async function startMarketWatcher(
  writer: ShelbyWriter,
  sellerAddress: string,
  network: string
): Promise<void> {
  const aptos = new Aptos(new AptosConfig({
    network: (NETWORK_MAP[network] ?? Network.SHELBYNET) as
      Network.TESTNET | Network.SHELBYNET | Network.LOCAL,
  }));

  process.stderr.write("[shelbtrace] Market watcher started\n");

  async function getListings(): Promise<MarketListing[]> {
    const data = await queryIndexer<{ blobs: { blob_name: string }[] }>(
      network,
      `query { blobs(where: {
        owner: { _eq: "${sellerAddress}" },
        blob_name: { _like: "market/listing/%" },
        is_deleted: { _eq: false }
      }) { blob_name } }`,
      {}
    );
    const listings: MarketListing[] = [];
    for (const b of data.blobs ?? []) {
      const id = b.blob_name.replace("market/listing/", "").replace(".json", "");
      try {
        const l = await fetchBlobJson<MarketListing>(
          sellerAddress, `market/listing/${id}.json`, network
        );
        listings.push(l);
      } catch {}
    }
    return listings;
  }

  async function alreadyGranted(listingId: string, buyerAddress: string): Promise<boolean> {
    try {
      await fetchBlobJson(
        sellerAddress, `market/access/${listingId}/${buyerAddress}.json`, network
      );
      return true;
    } catch {
      return false;
    }
  }

  async function poll() {
    const [payments, listings] = await Promise.all([
      getRecentShelbyUSDPayments(aptos, sellerAddress),
      getListings(),
    ]);

    for (const payment of payments) {
      if (processed.has(payment.txHash)) continue;

      // Match payment amount to a listing
      const listing = listings.find(l => l.priceUsd === payment.amount);
      if (!listing) continue;

      // Check if already granted
      if (await alreadyGranted(listing.listingId, payment.sender)) {
        processed.add(payment.txHash);
        continue;
      }

      processed.add(payment.txHash);

      process.stderr.write(
        `[watcher] Payment from ${payment.sender} for listing ${listing.listingId} ` +
        `(${payment.amount / 1e8} SUSD)\n`
      );

      // Get buyer's X25519 pub key from transaction signature
      const buyer = await getBuyerX25519Pub(aptos, payment.txHash);
      if (!buyer) {
        process.stderr.write(`[watcher] Could not extract buyer public key from ${payment.txHash}\n`);
        continue;
      }

      try {
        // Fetch original session blob
        const [owner, ...parts] = listing.blobRef.split("/");
        const sessionBlob = await fetchBlobJson<ShelbyBlobPayload>(
          owner, parts.join("/"), network
        );

        // Issue access grant
        await writer.grantAccess({
          listingId:          listing.listingId,
          blobRef:            listing.blobRef,
          buyerAddress:       buyer.buyerAddress,
          buyerX25519Pub:     buyer.x25519Pub,
          sessionBlobPayload: sessionBlob,
        });

        process.stderr.write(
          `[watcher] ✓ Access granted to ${buyer.buyerAddress} for ${listing.listingId}\n`
        );
      } catch (e) {
        process.stderr.write(`[watcher] Grant error: ${(e as Error).message}\n`);
      }
    }
  }

  // Start polling
  await poll().catch(e =>
    process.stderr.write(`[watcher] Initial poll error: ${e.message}\n`)
  );
  setInterval(() => poll().catch(e =>
    process.stderr.write(`[watcher] Poll error: ${e.message}\n`)
  ), POLL_MS);
}
