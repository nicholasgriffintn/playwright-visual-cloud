import { useState } from "react";
import { api } from "../../lib/api";
import { routeHref } from "../../lib/router";
import type { Workspace } from "../../lib/types";

export function WorkspacePicker({
  workspaces,
  onCreated,
}: {
  workspaces: Workspace[];
  onCreated: (workspace: Workspace) => void;
}) {
  const [showForm, setShowForm] = useState(workspaces.length === 0);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "");
    try {
      onCreated((await api.createWorkspace(name)).workspace);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <section className="workspace-picker">
      <p className="eyebrow">
        <span>Workspaces</span> choose a home
      </p>
      <h1>Where are we reviewing?</h1>
      <div className="workspace-choice-grid">
        {workspaces.map((workspace) => (
          <a href={routeHref({ kind: "app", workspaceId: workspace.id })} key={workspace.id}>
            <span>{workspace.name.slice(0, 2).toUpperCase()}</span>
            <strong>{workspace.name}</strong>
            <small>{workspace.role}</small>
          </a>
        ))}
        <button onClick={() => setShowForm(true)} type="button">
          <span>+</span>
          <strong>New workspace</strong>
          <small>Create a separate team</small>
        </button>
      </div>
      {showForm ? (
        <form className="inline-create" onSubmit={(event) => void submit(event)}>
          <label>
            Workspace name
            <input name="name" required autoFocus placeholder="Design systems" />
          </label>
          <button className="button button-primary" type="submit">
            Create workspace
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
