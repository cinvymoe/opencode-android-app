import { createMemo } from "solid-js";

export type SyncStatus =
  | "idle"
  | "disconnected"
  | "connecting"
  | "syncing"
  | "synced";

export function createSyncStatus(
  serverStatus: () => "disconnected" | "connecting" | "connected",
  isDraining: () => boolean
): () => SyncStatus {
  return createMemo<SyncStatus>(() => {
    const status = serverStatus();

    if (status === "disconnected") return "disconnected";
    if (status === "connecting") return "connecting";
    if (isDraining()) return "syncing";
    return "idle";
  });
}
