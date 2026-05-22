import type { ShelbyBlobPayload, MarketListing, AccessGrant } from "./types.js";

const INDEXER: Record<string, string> = {
  testnet:   "https://api.testnet.aptoslabs.com/nocode/v1/public/alias/shelby/testnet/v1/graphql",
  shelbynet: "https://api.shelbynet.aptoslabs.com/nocode/v1/public/alias/shelby/shelbynet/v1/graphql",
  local:     "http://localhost:8091/v1/graphql",
};
const RPC: Record<string, string> = {
  testnet:   "https://api.testnet.shelby.xyz/shelby",
  shelbynet: "https://api.shelbynet.shelby.xyz/shelby",
  local:     "http://localhost:9090",
};

function gqlUrl(network: string) { return INDEXER[network] ?? INDEXER["shelbynet"]; }
function rpcUrl(network: string) { return RPC[network] ?? RPC["shelbynet"]; }

async function gql<T>(network: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res  = await fetch(gqlUrl(network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

async function fetchBlob<T>(owner: string, blobName: string, network: string): Promise<T> {
  const url = `${rpcUrl(network)}/v1/blobs/${owner}/${blobName}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blob fetch HTTP ${res.status}`);
  return JSON.parse(await res.text()) as T;
}

// ─── Session blobs ────────────────────────────────────────────────────────────

const BLOBS_BY_OWNER = `
  query BlobsByOwner($owner: String!, $limit: Int!, $offset: Int!) {
    blobs(
      where: { owner: { _eq: $owner }, is_deleted: { _eq: false } }
      order_by: { created_at: desc }
      limit: $limit offset: $offset
    ) { blob_name owner created_at expires_at size blob_commitment is_written }
  }`;

export interface BlobMeta {
  blob_name: string; owner: string; created_at: string;
  expires_at: string; size: number; blob_commitment: string; is_written: boolean;
}

export async function fetchBlobList(owner: string, network: string, limit = 20, offset = 0): Promise<BlobMeta[]> {
  const data = await gql<{ blobs: BlobMeta[] }>(network, BLOBS_BY_OWNER, { owner, limit, offset });
  // Only return session blobs (not listing/access blobs)
  return (data.blobs ?? []).filter(b => b.blob_name.startsWith("hermes/"));
}

export async function fetchBlobContent(owner: string, blobName: string, network: string): Promise<ShelbyBlobPayload> {
  return fetchBlob<ShelbyBlobPayload>(owner, blobName, network);
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

const LISTINGS_BY_OWNER = `
  query ListingsByOwner($owner: String!, $limit: Int!, $offset: Int!) {
    blobs(
      where: {
        owner: { _eq: $owner },
        blob_name: { _like: "market/listing/%" },
        is_deleted: { _eq: false }
      }
      order_by: { created_at: desc }
      limit: $limit offset: $offset
    ) { blob_name owner created_at size }
  }`;

const ALL_LISTINGS = `
  query AllListings($limit: Int!, $offset: Int!) {
    blobs(
      where: {
        blob_name: { _like: "market/listing/%" },
        is_deleted: { _eq: false }
      }
      order_by: { created_at: desc }
      limit: $limit offset: $offset
    ) { blob_name owner created_at size }
  }`;

export async function fetchAllListings(network: string, limit = 20, offset = 0): Promise<BlobMeta[]> {
  const data = await gql<{ blobs: BlobMeta[] }>(network, ALL_LISTINGS, { limit, offset });
  return data.blobs ?? [];
}

export async function fetchListingsByOwner(owner: string, network: string, limit = 20): Promise<BlobMeta[]> {
  const data = await gql<{ blobs: BlobMeta[] }>(network, LISTINGS_BY_OWNER, { owner, limit, offset: 0 });
  return data.blobs ?? [];
}

export async function fetchListing(owner: string, listingId: string, network: string): Promise<MarketListing> {
  return fetchBlob<MarketListing>(owner, `market/listing/${listingId}.json`, network);
}

export async function writePurchaseRequest(params: {
  listing: import("./types.js").MarketListing;
  buyerAddress: string;
  buyerX25519Pub: Uint8Array;
  txHash: string;
  network: string;
  signAndSubmitBlob: (blobData: Uint8Array, blobName: string) => Promise<void>;
}): Promise<void> {
  const request: import("./types.js").PurchaseRequest = {
    schemaVersion:  "1.0",
    listingId:      params.listing.listingId,
    buyerAddress:   params.buyerAddress,
    buyerX25519Pub: Array.from(params.buyerX25519Pub).map(b => b.toString(16).padStart(2, "0")).join(""),
    txHash:         params.txHash,
    priceOctas:     params.listing.priceUsd,
    requestedAt:    Date.now(),
  };
  const blobName = `market/purchase/${params.listing.listingId}/${params.buyerAddress}.json`;
  await params.signAndSubmitBlob(
    new TextEncoder().encode(JSON.stringify(request)),
    blobName
  );
}

export async function fetchAccessGrant(sellerAddress: string, listingId: string, buyerAddress: string, network: string): Promise<AccessGrant | null> {
  try {
    return await fetchBlob<AccessGrant>(sellerAddress, `market/access/${listingId}/${buyerAddress}.json`, network);
  } catch {
    return null;
  }
}

// ─── Sales / Purchases history ────────────────────────────────────────────────

const ACCESS_GRANTS_BY_OWNER = `
  query AccessGrantsByOwner($owner: String!, $limit: Int!, $offset: Int!) {
    blobs(
      where: {
        owner: { _eq: $owner },
        blob_name: { _like: "market/access/%" },
        is_deleted: { _eq: false }
      }
      order_by: { created_at: desc }
      limit: $limit offset: $offset
    ) { blob_name owner created_at expires_at size blob_commitment is_written }
  }`;

const ACCESS_GRANTS_ALL = `
  query AccessGrantsAll($limit: Int!, $offset: Int!) {
    blobs(
      where: {
        blob_name: { _like: "market/access/%" },
        is_deleted: { _eq: false }
      }
      order_by: { created_at: desc }
      limit: $limit offset: $offset
    ) { blob_name owner created_at expires_at size blob_commitment is_written }
  }`;

/** Returns access grant blobs issued BY sellerAddress (i.e., sales) */
export async function fetchMySales(sellerAddress: string, network: string, limit = 50, offset = 0): Promise<BlobMeta[]> {
  const data = await gql<{ blobs: BlobMeta[] }>(network, ACCESS_GRANTS_BY_OWNER, { owner: sellerAddress, limit, offset });
  return data.blobs ?? [];
}

/** Returns all access grant blobs, then filters client-side to those containing buyerAddress in blob_name */
export async function fetchMyPurchases(buyerAddress: string, network: string, limit = 200, offset = 0): Promise<BlobMeta[]> {
  const data = await gql<{ blobs: BlobMeta[] }>(network, ACCESS_GRANTS_ALL, { limit, offset });
  const blobs = data.blobs ?? [];
  // blob_name format: market/access/{listingId}/{buyerAddress}.json
  return blobs.filter(b => b.blob_name.endsWith(`/${buyerAddress}.json`));
}
