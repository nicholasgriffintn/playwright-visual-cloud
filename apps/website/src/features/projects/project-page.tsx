import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import { api } from "../../lib/api";
import type { Project, ProjectWithRole } from "../../lib/types";
import { ComparisonSettings } from "./comparison-settings";
import { ProjectBuilds } from "./project-builds";

export function ProjectPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectWithRole | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    api
      .project(projectId)
      .then((projectResult) => {
        if (live) {
          setProject(projectResult.project);
        }
      })
      .catch((cause: Error) => setError(cause.message));

    return () => {
      live = false;
    };
  }, [projectId]);

  if (error) {
    return <p className="notice error">{error}</p>;
  }

  if (!project) {
    return <p className="loading-line">Loading project…</p>;
  }

  return (
    <section>
      <div className="page-heading project-heading">
        <div>
          <p className="eyebrow">
            <span>Project</span> {project.repository || "local repository"}
          </p>
          <h1>{project.name}</h1>
          <p>
            Default baseline branch: <code>{project.default_branch}</code>
          </p>
        </div>
        {project.role === "owner" ? (
          <button
            className="button button-primary"
            onClick={() => void createToken(project.id, setToken, setError, setProject)}
            type="button"
          >
            Generate CI token
          </button>
        ) : null}
      </div>
      {token ? <TokenReveal token={token} onClose={() => setToken(null)} /> : null}
      {!project.is_connected ? <SetupPanel project={project} /> : null}
      <ProjectBuilds projectId={project.id} />
      <ComparisonSettings project={project} onSaved={setProject} />
    </section>
  );
}

async function createToken(
  projectId: string,
  setToken: (value: string) => void,
  setError: (value: string) => void,
  setProject: Dispatch<SetStateAction<ProjectWithRole | null>>,
) {
  try {
    const token = (await api.createProjectToken(projectId, "CI")).token;

    setToken(token);
    setProject((current) => (current ? { ...current, is_connected: true } : current));
  } catch (cause) {
    setError((cause as Error).message);
  }
}

function SetupPanel({ project }: { project: Project }) {
  const install = "pnpm add -D playwright-visual-cloud";
  const config = `import { expect } from "playwright-visual-cloud";\n\nawait expect(page).toMatchVisualSnapshot("homepage");`;

  return (
    <section className="setup-panel">
      <div className="setup-copy">
        <p className="eyebrow">
          <span>Setup</span> three steps
        </p>
        <h2>Connect this test suite</h2>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Install the matcher</strong>
              <code>{install}</code>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Capture a visual</strong>
              <pre>
                <code>{config}</code>
              </pre>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Add CI configuration</strong>
              <p>
                <code>PVC_SERVER_URL</code>, <code>PVC_TOKEN</code>, and{" "}
                <code>PVC_ENVIRONMENT</code>
              </p>
            </div>
          </li>
        </ol>
      </div>
      <div className="setup-aside">
        <span>Project identifier</span>
        <code>{project.slug}</code>
        <span>Default branch</span>
        <code>{project.default_branch}</code>
        <a
          href="https://github.com/nicholasgriffintn/playwright-visual-cloud/blob/main/examples/.github/workflows/visual-tests.yml"
          rel="noreferrer"
          target="_blank"
        >
          View workflow template →
        </a>
      </div>
    </section>
  );
}

function TokenReveal({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  }

  return (
    <aside className="token-reveal">
      <div>
        <strong>Copy this token now</strong>
        <p>
          It is shown once. Store it as the <code>PVC_TOKEN</code> CI secret.
        </p>
      </div>
      <code>{token}</code>
      <button className="button button-ink" onClick={() => void copy()} type="button">
        {copied ? "Copied" : "Copy token"}
      </button>
      <button className="icon-button" onClick={onClose} type="button">
        ×
      </button>
    </aside>
  );
}
