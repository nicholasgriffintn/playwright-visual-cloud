import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { diffMetric } from "../../lib/format";
import type { Snapshot } from "../../lib/types";
import {
  isReviewableSnapshot,
  snapshotStatusLabel,
  type SnapshotReviewAction,
} from "./snapshot-status";

type ViewMode = "split" | "slider" | "diff";

export function SnapshotViewer({
  buildId,
  snapshot,
  onApproved,
}: {
  buildId: string;
  snapshot: Snapshot;
  onApproved: () => void;
}) {
  const [mode, setMode] = useState<ViewMode>(snapshot.diff_key ? "slider" : "split");
  const [slider, setSlider] = useState(50);
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<SnapshotReviewAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(snapshot.diff_key ? "slider" : "split");
    setSlider(50);
    setError(null);
  }, [snapshot]);
  const expected = snapshot.expected_key ? api.imageUrl(buildId, snapshot.expected_key) : null;
  const actual = api.imageUrl(buildId, snapshot.actual_key);
  const diff = snapshot.diff_key ? api.imageUrl(buildId, snapshot.diff_key) : null;
  const reviewable = isReviewableSnapshot(snapshot);

  async function review(review: SnapshotReviewAction) {
    setMenuOpen(false);
    setAction(review);
    try {
      if (review === "approve") {
        await api.approveSnapshot(buildId, snapshot.id);
      } else if (review === "ignore") {
        await api.ignoreSnapshot(buildId, snapshot.id);
      } else if (review === "archive") {
        await api.archiveSnapshot(buildId, snapshot.id);
      } else {
        throw new Error("Unknown review type provided.");
      }

      onApproved();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setAction(null);
    }
  }

  const status = snapshotStatusLabel(snapshot);

  return (
    <section className="snapshot-viewer">
      <header className="viewer-header">
        <div>
          <p className="eyebrow">
            <span>{snapshot.variant}</span> {snapshot.width} × {snapshot.height}
          </p>
          <h2>{snapshot.name}</h2>
          <p>{diffMetric(snapshot.diff_pixels, snapshot.diff_ratio)}</p>
        </div>
        <div className="viewer-actions">
          <div className="view-modes" aria-label="Comparison mode">
            <ModeButton value="split" current={mode} onChange={setMode} label="Split" />
            <ModeButton
              value="slider"
              current={mode}
              onChange={setMode}
              label="Slider"
              disabled={!expected}
            />
            <ModeButton
              value="diff"
              current={mode}
              onChange={setMode}
              label="Diff"
              disabled={!diff}
            />
          </div>
          {reviewable ? (
            <div className="review-action-group">
              <button
                className="button button-primary"
                disabled={Boolean(action)}
                onClick={() => void review("approve")}
                type="button"
              >
                {action === "approve"
                  ? "Approving…"
                  : snapshot.status === "new"
                    ? "Accept baseline"
                    : "Approve change"}
              </button>
              <details
                className="review-action-menu"
                open={menuOpen}
                onToggle={(event) => {
                  setMenuOpen(event.currentTarget.open);
                }}
              >
                <summary
                  aria-label="More review options"
                  className="button button-small"
                  role="button"
                >
                  <span>⋯</span>
                </summary>
                <div className="review-action-menu-list">
                  <button
                    className="button button-small"
                    disabled={Boolean(action)}
                    onClick={() => void review("ignore")}
                    type="button"
                  >
                    {action === "ignore" ? "Ignoring…" : "Ignore change"}
                  </button>
                  <button
                    className="button button-small"
                    disabled={Boolean(action)}
                    onClick={() => void review("archive")}
                    type="button"
                  >
                    {action === "archive" ? "Archiving…" : "Archive change"}
                  </button>
                </div>
              </details>
            </div>
          ) : (
            <span className={`status-chip ${snapshot.status}`}>{status}</span>
          )}
        </div>
      </header>
      {error ? <p className="notice error">{error}</p> : null}
      <Comparison mode={mode} expected={expected} actual={actual} diff={diff} slider={slider} />
      <footer className="viewer-footer">
        {mode === "slider" && expected ? (
          <label>
            Reveal actual
            <input
              type="range"
              min="0"
              max="100"
              value={slider}
              onChange={(event) => setSlider(Number(event.target.value))}
            />
          </label>
        ) : (
          <span>Rendered artifact · private</span>
        )}
        <span>{status}</span>
      </footer>
    </section>
  );
}

function ModeButton({
  value,
  current,
  onChange,
  label,
  disabled = false,
}: {
  value: ViewMode;
  current: ViewMode;
  onChange: (value: ViewMode) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={current === value ? "active" : ""}
      disabled={disabled}
      onClick={() => onChange(value)}
      type="button"
    >
      {label}
    </button>
  );
}

function Comparison({
  mode,
  expected,
  actual,
  diff,
  slider,
}: {
  mode: ViewMode;
  expected: string | null;
  actual: string;
  diff: string | null;
  slider: number;
}) {
  if (mode === "diff") {
    return (
      <div className="image-stage single">
        {diff ? <img src={diff} alt="Visual pixel difference" /> : null}
      </div>
    );
  }

  if (mode === "slider") {
    return (
      <div className="image-stage slider-stage">
        <img src={expected ?? actual} alt="Baseline" />
        <div className="slider-actual" style={{ width: `${slider}%` }}>
          <img src={actual} alt="Actual" />
        </div>
        <i style={{ left: `${slider}%` }} />
      </div>
    );
  }

  return (
    <div className="split-stage">
      {expected ? (
        <figure>
          <figcaption>Baseline</figcaption>
          <div className="image-stage">
            <img src={expected} alt="Baseline" />
          </div>
        </figure>
      ) : null}
      <figure>
        <figcaption>Actual</figcaption>
        <div className="image-stage">
          <img src={actual} alt="Actual" />
        </div>
      </figure>
    </div>
  );
}
