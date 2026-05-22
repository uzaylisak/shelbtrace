// ─── Agent session ────────────────────────────────────────────────────────────

export interface HermesAction {
  id: string;
  timestamp: number;
  type: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskSession {
  sessionId: string;
  taskDescription: string;
  model?: string;
  startedAt: number;
  actions: HermesAction[];
  status: "active" | "completed" | "failed";
}

// ─── Blob payload (stored on Shelby) ─────────────────────────────────────────

/** Sealed box: contentKey encrypted for one recipient via ephemeral X25519 ECDH */
export interface SealedKey {
  ephemeralPub: string;   // hex — ephemeral X25519 public key
  iv:           string;   // base64 — AES-GCM nonce
  ciphertext:   string;   // base64 — encrypted contentKey (32 bytes) + 16-byte auth tag
}

/** Public metadata — visible to everyone, not encrypted */
export interface BlobPublicMeta {
  schemaVersion:  "3.0";
  sessionId:      string;
  startedAt:      number;
  completedAt:    number;
  durationMs:     number;
  status:         "completed" | "failed";
  actionCount:    number;
  model?:         string;
  toolsUsed:      string[];    // unique tool names, proves capabilities
  actionHashes:   string[];    // SHA-256 of JSON(action) per action — for preview proof
  sellerX25519Pub: string;     // hex — seller's X25519 public key (for access grants)
}

/** Private content — AES-256-GCM encrypted with random contentKey */
export interface BlobPrivateContent {
  taskDescription: string;
  actions: HermesAction[];
}

/** Full blob stored on Shelby */
export interface ShelbyBlobPayload {
  public:           BlobPublicMeta;
  encryptedContent: { iv: string; ciphertext: string };
  sealedKey:        SealedKey;   // contentKey sealed for seller
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface PreviewAction {
  index:   number;       // position in original action list
  hash:    string;       // must match actionHashes[index]
  action:  HermesAction; // revealed plaintext — buyer can verify hash
}

/** Stored as market/listing/{listingId}.json — public blob */
export interface MarketListing {
  schemaVersion:  "1.0";
  listingId:      string;
  sellerAddress:  string;
  blobRef:        string;          // "<address>/hermes/<sessionId>.json"
  priceUsd:       number;          // ShelbyUSD in octas (1 USD = 1e8)
  title:          string;
  description:    string;
  tags?:          string[];        // e.g. ["debugging", "research", "coding"]
  previewActions: PreviewAction[]; // seller-chosen, cryptographically verifiable
  createdAt:      number;
  // Snapshot of public meta (buyer can cross-check)
  sessionMeta:    Pick<BlobPublicMeta, "startedAt" | "completedAt" | "durationMs" | "actionCount" | "toolsUsed" | "model" | "status">;
}

/** Stored as market/access/{listingId}/{buyerAddress}.json — public blob */
export interface AccessGrant {
  schemaVersion: "1.0";
  listingId:     string;
  buyerAddress:  string;
  blobRef:       string;
  sealedKey:     SealedKey;  // contentKey sealed for buyer
  grantedAt:     number;
}

/** Written by buyer after payment — market/purchase/{listingId}/{buyerAddress}.json */
export interface PurchaseRequest {
  schemaVersion:  "1.0";
  listingId:      string;
  buyerAddress:   string;
  buyerX25519Pub: string;   // hex — used to seal the content key for buyer
  txHash:         string;   // Aptos transaction hash to verify
  priceOctas:     number;   // expected payment amount
  requestedAt:    number;
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface FlushResult {
  blobRef:     string;
  sessionId:   string;
  actionCount: number;
  uploadedAt:  number;
}
