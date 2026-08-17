import { useCallback, useEffect, useState } from "react";

import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { shortCommit } from "../../lib/format";
import { routeHref } from "../../lib/router";
import type { BuildPayload } from "../../lib/types";
import { SnapshotViewer } from "./snapshot-viewer";
import { isPendingSnapshot } from "./snapshot-status";

export function BuildReviewPage({ buildId, snapshotId }: { buildId: string; snapshotId?: string }) {
  const [payload, setPayload] = useState<BuildPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"approve" | "ignore" | "archive" | null>(null);
  const load = useCallback(async () => {
    try {
      setPayload(await api.build(buildId));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [buildId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <p className="notice error">{error}</p>;
  }

  if (!payload) {
    return <p className="loading-line">Loading visual run…</p>;
  }

  const selected =
    payload.snapshots.find((snapshot) => snapshot.id === snapshotId) ?? payload.snapshots[0];
  const pending = payload.snapshots.filter(isPendingSnapshot);

  async function apply(actionType: "approve" | "ignore" | "archive") {
    setAction(actionType);
    try {
      if (actionType === "approve") {
        await api.approveBuild(buildId);
      } else if (actionType === "ignore") {
        await api.ignoreBuild(buildId);
      } else if (actionType === "archive") {
        await api.archiveBuild(buildId);
      } else {
        throw new Error("Unknown action type provided.");
      }

      await load();
      setError(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="review-page">
      <aside className="review-sidebar">
        <div className="review-summary">
          <p className="eyebrow">
            <span>Build</span> {shortCommit(payload.build.commit_sha)}
          </p>
          <h1>{payload.build.message || "Visual run"}</h1>
          <p>
            {payload.build.environment} · {payload.build.branch}
          </p>
          <div>
            <span className={`status-chip ${payload.build.review_status}`}>
              {payload.build.review_status === "none" ? "clean" : payload.build.review_status}
            </span>
            <small>{payload.snapshots.length} snapshots</small>
          </div>
          {pending.length ? (
            <div className="review-actions">
              <button
                className="button button-primary"
                disabled={Boolean(action)}
                onClick={() => void apply("approve")}
                type="button"
              >
                {action === "approve" ? "Approving…" : `Approve all · ${pending.length}`}
              </button>
              <button
                className="button"
                disabled={Boolean(action)}
                onClick={() => void apply("ignore")}
                type="button"
              >
                {action === "ignore" ? "Ignoring…" : `Ignore all · ${pending.length}`}
              </button>
              <button
                className="button"
                disabled={Boolean(action)}
                onClick={() => void apply("archive")}
                type="button"
              >
                {action === "archive" ? "Archiving…" : `Archive all · ${pending.length}`}
              </button>
            </div>
          ) : null}
        </div>
        <nav className="snapshot-list" aria-label="Snapshots">
          {payload.snapshots.map((snapshot) => (
            <a
              aria-label={`${snapshot.name}, ${snapshot.variant}`}
              className={snapshot.id === selected?.id ? "active" : ""}
              href={routeHref({ kind: "build", buildId, snapshotId: snapshot.id })}
              key={snapshot.id}
            >
              <span>
                <strong>{snapshot.name}</strong>
                <small>{snapshot.variant}</small>
              </span>
              <i className={`snapshot-dot ${snapshot.status}`} />
            </a>
          ))}
        </nav>
      </aside>
      <div className="review-main">
        {selected ? (
          <SnapshotViewer buildId={buildId} snapshot={selected} onApproved={() => void load()} />
        ) : (
          <div className="empty-state">
            <h2>No snapshots in this run.</h2>
          </div>
        )}
      </div>
    </section>
  );
}
