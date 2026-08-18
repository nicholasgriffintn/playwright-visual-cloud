import { type FormEvent, useState } from "react";

import { api } from "../../lib/api";
import type { ProjectWithRole } from "../../lib/types";

function parseSelectors(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function numberOrNull(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw);
}

export function ComparisonSettings({
  project,
  onSaved,
}: {
  project: ProjectWithRole;
  onSaved: (project: ProjectWithRole) => void;
}) {
  const [threshold, setThreshold] = useState(project.compare_threshold?.toString() ?? "");
  const [maxDiffPixels, setMaxDiffPixels] = useState(
    project.compare_max_diff_pixels?.toString() ?? "",
  );
  const [maxDiffPixelRatio, setMaxDiffPixelRatio] = useState(
    project.compare_max_diff_pixel_ratio?.toString() ?? "",
  );
  const [includeAA, setIncludeAA] = useState(project.compare_include_aa === 1);
  const [ignoreSelectors, setIgnoreSelectors] = useState(() => {
    if (!project.ignore_selectors) {
      return "";
    }

    try {
      return (JSON.parse(project.ignore_selectors) as string[]).join("\n");
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  if (project.role !== "owner") {
    return null;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const result = await api.updateProjectSettings(project.id, {
        threshold: numberOrNull(threshold),
        maxDiffPixels: numberOrNull(maxDiffPixels),
        maxDiffPixelRatio: numberOrNull(maxDiffPixelRatio),
        includeAA,
        ignoreSelectors: parseSelectors(ignoreSelectors),
      });

      onSaved(result.project);
      setStatus("saved");
    } catch (cause) {
      setError((cause as Error).message);
      setStatus("idle");
    }
  }

  return (
    <section className="comparison-settings">
      <div className="page-heading">
        <div>
          <h2>Comparison defaults</h2>
          <p>
            Applied to every snapshot in this project. Test options still override them.
          </p>
        </div>
      </div>
      <form onSubmit={(event) => void save(event)}>
        <label>
          <span>Threshold</span>
          <input
            inputMode="decimal"
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="0.2"
            value={threshold}
          />
          <small>Per-pixel colour distance, 0–1.</small>
        </label>
        <label>
          <span>Max diff pixels</span>
          <input
            inputMode="numeric"
            onChange={(event) => setMaxDiffPixels(event.target.value)}
            placeholder="none"
            value={maxDiffPixels}
          />
          <small>Absolute differing pixels allowed.</small>
        </label>
        <label>
          <span>Max diff ratio</span>
          <input
            inputMode="decimal"
            onChange={(event) => setMaxDiffPixelRatio(event.target.value)}
            placeholder="none"
            value={maxDiffPixelRatio}
          />
          <small>Share of the image allowed to differ, 0–1.</small>
        </label>
        <label className="checkbox-row">
          <input
            checked={includeAA}
            onChange={(event) => setIncludeAA(event.target.checked)}
            type="checkbox"
          />
          <span>Count anti-aliased pixels as differences</span>
        </label>
        <label className="full-width">
          <span>Ignore selectors</span>
          <textarea
            onChange={(event) => setIgnoreSelectors(event.target.value)}
            placeholder=".last-updated&#10;[data-live-count]"
            rows={4}
            value={ignoreSelectors}
          />
          <small>One per line. These regions are painted over before capture.</small>
        </label>
        <div className="comparison-settings-actions">
          <button className="button button-primary" disabled={status === "saving"} type="submit">
            {status === "saving" ? "Saving…" : "Save defaults"}
          </button>
          {status === "saved" ? <span className="saved-note">Saved</span> : null}
          {error ? <span className="notice error">{error}</span> : null}
        </div>
      </form>
    </section>
  );
}
