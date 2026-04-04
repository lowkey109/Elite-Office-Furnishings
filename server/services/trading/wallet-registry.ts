// server/services/trading/wallet-registry.ts

import { randomUUID } from "crypto";
import type { Chain, TrackedWallet } from "./types/trading-types";

type CreateTrackedWalletInput = {
  address: string;
  chain?: Chain;
  label?: string;
};

type UpdateWalletScoresInput = {
  walletQualityScore?: number;
  copyabilityScore?: number;
};

const trackedWalletStore = new Map<string, TrackedWallet>();

function normalizeAddress(address: string): string {
  return address.trim();
}

function now(): Date {
  return new Date();
}

export function listTrackedWallets(): TrackedWallet[] {
  return Array.from(trackedWalletStore.values()).sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

export function getTrackedWalletById(id: string): TrackedWallet | null {
  return trackedWalletStore.get(id) ?? null;
}

export function getTrackedWalletByAddress(
  address: string,
  chain: Chain = "solana",
): TrackedWallet | null {
  const normalizedAddress = normalizeAddress(address);

  for (const wallet of trackedWalletStore.values()) {
    if (wallet.chain === chain && wallet.address === normalizedAddress) {
      return wallet;
    }
  }

  return null;
}

export function addTrackedWallet(
  input: CreateTrackedWalletInput,
): TrackedWallet {
  const address = normalizeAddress(input.address);
  const chain = input.chain ?? "solana";

  if (!address) {
    throw new Error("Wallet address is required");
  }

  const existing = getTrackedWalletByAddress(address, chain);
  if (existing) {
    return existing;
  }

  const timestamp = now();

  const wallet: TrackedWallet = {
    id: randomUUID(),
    chain,
    address,
    label: input.label?.trim() || undefined,
    isActive: true,
    walletQualityScore: 0,
    copyabilityScore: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  trackedWalletStore.set(wallet.id, wallet);
  return wallet;
}

export function deactivateTrackedWallet(id: string): TrackedWallet {
  const existing = getTrackedWalletById(id);

  if (!existing) {
    throw new Error(`Tracked wallet not found: ${id}`);
  }

  const updated: TrackedWallet = {
    ...existing,
    isActive: false,
    updatedAt: now(),
  };

  trackedWalletStore.set(updated.id, updated);
  return updated;
}

export function activateTrackedWallet(id: string): TrackedWallet {
  const existing = getTrackedWalletById(id);

  if (!existing) {
    throw new Error(`Tracked wallet not found: ${id}`);
  }

  const updated: TrackedWallet = {
    ...existing,
    isActive: true,
    updatedAt: now(),
  };

  trackedWalletStore.set(updated.id, updated);
  return updated;
}

export function updateTrackedWalletScores(
  id: string,
  scores: UpdateWalletScoresInput,
): TrackedWallet {
  const existing = getTrackedWalletById(id);

  if (!existing) {
    throw new Error(`Tracked wallet not found: ${id}`);
  }

  const updated: TrackedWallet = {
    ...existing,
    walletQualityScore:
      scores.walletQualityScore ?? existing.walletQualityScore,
    copyabilityScore: scores.copyabilityScore ?? existing.copyabilityScore,
    updatedAt: now(),
  };

  trackedWalletStore.set(updated.id, updated);
  return updated;
}

export function seedTrackedWallets(
  wallets: Array<CreateTrackedWalletInput>,
): TrackedWallet[] {
  return wallets.map((wallet) => addTrackedWallet(wallet));
}
