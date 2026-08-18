import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { routeHref } from "../../lib/router";
import type { Project, Workspace } from "../../lib/types";
import { Link } from "react-router-dom";

export function WorkspacePage({ workspace }: { workspace: Workspace }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    api
      .projects(workspace.id)
      .then((result) => {
        if (live) {
          setProjects(result.projects);
        }
      })
      .catch((cause: Error) => setError(cause.message));

    return () => {
      live = false;
    };
  }, [workspace.id]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span>Projects</span> {projects.length} connected
          </p>
          <h1>What should we work on next??</h1>
          <p>Select a project or configure a new one to monitor.</p>
        </div>
        {workspace.role === "owner" ? (
          <button className="button button-primary" onClick={() => setCreating(true)} type="button">
            New project
          </button>
        ) : null}
      </div>
      <div className="workspace-actions">
        <Link className="action-tile" to={routeHref({ kind: "team", workspaceId: workspace.id })}>
          <span>Team</span>
          <strong>Manage reviewers</strong>
          <i>→</i>
        </Link>
        <div className="action-tile static">
          <span>Cloud</span>
          <strong>Cloudflare native</strong>
          <i className="live-dot" />
        </div>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
      {projects.length ? (
        <div className="project-grid">
          {projects.map((project) => (
            <ProjectCard project={project} key={project.id} />
          ))}
        </div>
      ) : (
        <EmptyProjects onCreate={() => setCreating(true)} canCreate={workspace.role === "owner"} />
      )}
      {creating ? (
        <ProjectDialog
          workspaceId={workspace.id}
          onClose={() => setCreating(false)}
          onCreated={(project) => {
            setProjects((current) => [project, ...current]);
            setCreating(false);
          }}
        />
      ) : null}
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link className="project-card" to={routeHref({ kind: "project", projectId: project.id })}>
      <div className="project-card-top">
        <span className="project-glyph">{project.name.slice(0, 1).toUpperCase()}</span>
        <span className="status-chip clean">connected</span>
      </div>
      <h2>{project.name}</h2>
      <p>{project.repository || "Repository not linked"}</p>
      <footer>
        <span>default / {project.default_branch}</span>
        <strong>Open project →</strong>
      </footer>
    </Link>
  );
}

function EmptyProjects({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-visual">⌗</span>
      <h2>No projects yet.</h2>
      <p>Connect your first Playwright suite and start collecting visual runs.</p>
      {canCreate ? (
        <button className="button button-primary" onClick={onCreate} type="button">
          Create a project
        </button>
      ) : null}
    </div>
  );
}

function ProjectDialog({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const result = await api.createProject(workspaceId, {
        name: String(form.get("name") || ""),
        repository: String(form.get("repository") || ""),
        defaultBranch: String(form.get("defaultBranch") || "main"),
      });

      onCreated(result.project);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
      >
        <button className="dialog-close" onClick={onClose} type="button">
          ×
        </button>
        <p className="eyebrow">Project setup</p>
        <h2 id="new-project-title">Connect a Playwright project</h2>
        <form className="stack-form" onSubmit={(event) => void submit(event)}>
          <label>
            Project name
            <input name="name" required placeholder="Marketing site" />
          </label>
          <label>
            Repository
            <input name="repository" placeholder="organisation/repository" />
          </label>
          <label>
            Default branch
            <input name="defaultBranch" defaultValue="main" required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button button-primary" type="submit">
            Create project
          </button>
        </form>
      </section>
    </div>
  );
}
