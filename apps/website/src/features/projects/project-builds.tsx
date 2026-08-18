import { useState } from "react";

import { formatDate, shortCommit } from "../../lib/format";
import { routeHref } from "../../lib/router";
import type { Build } from "../../lib/types";
import { useProjectBuilds } from "./use-project-builds";
import { Link } from "react-router-dom";

export function ProjectBuilds({ projectId }: { projectId: string }) {
  const [environment, setEnvironment] = useState("");
  const { builds, environments, error, loading } = useProjectBuilds(projectId, environment);

  return (
    <section className="runs-section">
      <header>
        <div>
          <p className="eyebrow">
            <span>Runs</span> latest first
          </p>
          <h2>Visual builds</h2>
        </div>
        <div className="run-controls">
          <label>
            <span>Environment</span>
            <select value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="">All environments</option>
              {environments.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <span className="run-count">{builds.length}</span>
        </div>
      </header>
      {error ? <p className="notice error">{error}</p> : null}
      {loading ? <p className="loading-line">Loading builds…</p> : null}
      {!loading && !error && builds.length ? (
        <div className="run-table">
          {builds.map((build) => (
            <BuildRow build={build} key={build.id} />
          ))}
        </div>
      ) : null}
      {!loading && !error && !builds.length ? (
        <div className="compact-empty">
          <strong>
            {environment ? "No builds in this environment." : "Waiting for the first run."}
          </strong>
          <span>
            {environment
              ? "Run the suite with this environment or choose another filter."
              : "Generate a token, add the matcher, and push a branch."}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function BuildRow({ build }: { build: Build }) {
  const label =
    build.review_status === "none"
      ? build.status === "running"
        ? "running"
        : "clean"
      : build.review_status;

  return (
    <Link className="run-row" to={routeHref({ kind: "build", buildId: build.id })}>
      <span className={`run-state ${label}`} />
      <span>
        <strong>{build.message || "Untitled visual run"}</strong>
        <small>
          {build.environment} · {build.branch} · {shortCommit(build.commit_sha)}
        </small>
      </span>
      <span className={`status-chip ${label}`}>{label}</span>
      <time>{formatDate(build.created_at)}</time>
      <b>→</b>
    </Link>
  );
}
