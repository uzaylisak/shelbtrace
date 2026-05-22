import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import {
  getX25519Keys, sealKey, encryptContent,
  hashActions,
} from "./crypto.js";
import type {
  ShelbyBlobPayload, BlobPrivateContent,
  MarketListing, AccessGrant, FlushResult, TaskSession,
} from "./types.js";

export interface ShelbyWriterConfig {
  privateKey: string;
  network?: "testnet" | "shelbynet" | "local";
  expirationOffsetMs?: number;
}

const NETWORK_MAP: Record<string, Network> = {
  testnet:   Network.TESTNET,
  shelbynet: Network.SHELBYNET,
  local:     Network.LOCAL,
};

export class ShelbyWriter {
  private client:             ShelbyNodeClient;
  private account:            Account;
  private privateKey:         string;
  private x25519Pub:          Uint8Array;
  private x25519Priv:         Uint8Array;
  private expirationOffsetMs: number;

  constructor(config: ShelbyWriterConfig) {
    this.privateKey = config.privateKey;
    this.account    = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(config.privateKey),
    });

    const { x25519Priv, x25519Pub } = getX25519Keys(config.privateKey);
    this.x25519Priv = x25519Priv;
    this.x25519Pub  = x25519Pub;

    const network = (NETWORK_MAP[config.network ?? "shelbynet"] ?? Network.SHELBYNET) as
      Network.TESTNET | Network.SHELBYNET | Network.LOCAL;

    this.client             = new ShelbyNodeClient({ network });
    this.expirationOffsetMs = config.expirationOffsetMs ?? 30 * 24 * 60 * 60 * 1000;
  }

  // ── Upload session blob ───────────────────────────────────────────────────

  async flush(session: TaskSession): Promise<FlushResult> {
    const completedAt = Date.now();

    // Private content
    const privateContent: BlobPrivateContent = {
      taskDescription: session.taskDescription,
      actions: session.actions,
    };

    const { contentKey, encryptedContent } = encryptContent(JSON.stringify(privateContent));
    const sealedKey  = sealKey(contentKey, this.x25519Pub);
    const actionHashes = hashActions(session.actions);
    const toolsUsed    = [...new Set(session.actions.map(a => a.tool).filter(Boolean) as string[])];

    const payload: ShelbyBlobPayload = {
      public: {
        schemaVersion:   "3.0",
        sessionId:       session.sessionId,
        startedAt:       session.startedAt,
        completedAt,
        durationMs:      completedAt - session.startedAt,
        status:          session.status as "completed" | "failed",
        actionCount:     session.actions.length,
        model:           session.model,
        toolsUsed,
        actionHashes,
        sellerX25519Pub: Buffer.from(this.x25519Pub).toString("hex"),
      },
      encryptedContent,
      sealedKey,
    };

    const blobName         = `hermes/${session.sessionId}.json` as const;
    const expirationMicros = (completedAt + this.expirationOffsetMs) * 1000;

    await this.client.upload({
      blobData: Buffer.from(JSON.stringify(payload), "utf-8"),
      signer:   this.account,
      blobName,
      expirationMicros,
    });

    return {
      blobRef:     `${this.account.accountAddress.toString()}/${blobName}`,
      sessionId:   session.sessionId,
      actionCount: session.actions.length,
      uploadedAt:  completedAt,
    };
  }

  // ── Create marketplace listing ────────────────────────────────────────────

  async createListing(params: {
    listing: Omit<MarketListing, "sellerAddress" | "createdAt">;
    expirationOffsetMs?: number;
  }): Promise<string> {
    const now     = Date.now();
    const payload: MarketListing = {
      ...params.listing,
      sellerAddress: this.account.accountAddress.toString(),
      createdAt:     now,
    };

    const blobName         = `market/listing/${params.listing.listingId}.json` as const;
    const expirationMicros = (now + (params.expirationOffsetMs ?? this.expirationOffsetMs)) * 1000;

    await this.client.upload({
      blobData: Buffer.from(JSON.stringify(payload), "utf-8"),
      signer:   this.account,
      blobName,
      expirationMicros,
    });

    return `${this.account.accountAddress.toString()}/${blobName}`;
  }

  // ── Grant access to buyer ─────────────────────────────────────────────────

  async grantAccess(params: {
    listingId:         string;
    blobRef:           string;
    buyerAddress:      string;
    buyerX25519Pub:    Uint8Array;
    sessionBlobPayload: ShelbyBlobPayload;
  }): Promise<void> {
    // Unseal contentKey with seller's X25519 key
    const { unsealKey } = await import("./crypto.js");
    const contentKey    = unsealKey(params.sessionBlobPayload.sealedKey, this.x25519Priv);

    // Re-seal for buyer
    const sealedForBuyer = sealKey(contentKey, params.buyerX25519Pub);

    const grant: AccessGrant = {
      schemaVersion: "1.0",
      listingId:     params.listingId,
      buyerAddress:  params.buyerAddress,
      blobRef:       params.blobRef,
      sealedKey:     sealedForBuyer,
      grantedAt:     Date.now(),
    };

    const blobName         = `market/access/${params.listingId}/${params.buyerAddress}.json` as const;
    const expirationMicros = (Date.now() + this.expirationOffsetMs) * 1000;

    await this.client.upload({
      blobData: Buffer.from(JSON.stringify(grant), "utf-8"),
      signer:   this.account,
      blobName,
      expirationMicros,
    });
  }
}
