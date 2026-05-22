export interface HermesAction {
  id: string; timestamp: number; type: string;
  tool?: string; input?: unknown; output?: unknown;
  error?: string; durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface SealedKey {
  ephemeralPub: string;
  iv:           string;
  ciphertext:   string;
}

export interface BlobPublicMeta {
  schemaVersion:   "3.0";
  sessionId:       string;
  startedAt:       number;
  completedAt:     number;
  durationMs:      number;
  status:          "completed" | "failed";
  actionCount:     number;
  model?:          string;
  toolsUsed:       string[];
  actionHashes:    string[];
  sellerX25519Pub: string;
}

export interface BlobPrivateContent {
  taskDescription: string;
  actions: HermesAction[];
}

export interface ShelbyBlobPayload {
  public:           BlobPublicMeta;
  encryptedContent: { iv: string; ciphertext: string };
  sealedKey:        SealedKey;
}

export interface PreviewAction {
  index:  number;
  hash:   string;
  action: HermesAction;
}

export interface MarketListing {
  schemaVersion:  "1.0";
  listingId:      string;
  sellerAddress:  string;
  blobRef:        string;
  priceUsd:       number;
  title:          string;
  description:    string;
  tags?:          string[];
  previewActions: PreviewAction[];
  createdAt:      number;
  sessionMeta: {
    startedAt: number; completedAt: number; durationMs: number;
    actionCount: number; toolsUsed: string[]; model?: string; status: string;
  };
}

export interface PurchaseRequest {
  schemaVersion:  "1.0";
  listingId:      string;
  buyerAddress:   string;
  buyerX25519Pub: string;
  txHash:         string;
  priceOctas:     number;
  requestedAt:    number;
}

export interface AccessGrant {
  schemaVersion: "1.0";
  listingId:     string;
  buyerAddress:  string;
  blobRef:       string;
  sealedKey:     SealedKey;
  grantedAt:     number;
}
