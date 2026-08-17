import type { Snapshot } from "../../lib/types";

export type SnapshotReviewAction = "approve" | "ignore" | "archive";

export function isPendingSnapshot(snapshot: Snapshot): boolean {
  return snapshot.status === "failed" || snapshot.status === "new";
}

export function isReviewableSnapshot(snapshot: Snapshot): boolean {
  return snapshot.status === "failed" || snapshot.status === "new";
}

export function snapshotStatusLabel(snapshot: Snapshot): string {
  return snapshot.status;
}
