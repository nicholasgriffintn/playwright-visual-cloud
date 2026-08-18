import type { ReactNode } from "react";
import { Logo } from "../brand/logo";
import { routeHref } from "../../lib/router";
import type { User, Workspace } from "../../lib/types";
import { Link } from "react-router-dom";

type AppShellProps = {
  user: User;
  workspaces: Workspace[];
  activeWorkspace?: Workspace;
  onLogout: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({ user, workspaces, activeWorkspace, onLogout, children }: AppShellProps) {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Link className="sidebar-brand" to="/">
          <Logo />
        </Link>
        <div className="workspace-stack" aria-label="Workspaces">
          {workspaces.map((workspace) => (
            <Link
              className={`workspace-avatar ${workspace.id === activeWorkspace?.id ? "active" : ""}`}
              to={routeHref({ kind: "app", workspaceId: workspace.id })}
              key={workspace.id}
              title={workspace.name}
            >
              {workspace.name.slice(0, 2).toUpperCase()}
            </Link>
          ))}
        </div>
        <Link className="sidebar-add" to={routeHref({ kind: "app" })} title="Create workspace">
          +
        </Link>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="topbar-label">Workspace</span>
            <strong>{activeWorkspace?.name ?? "Visual Cloud"}</strong>
          </div>
          <div className="topbar-user">
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <button
              className="avatar-button"
              onClick={() => void onLogout()}
              title="Sign out"
              type="button"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" />
              ) : (
                user.name.slice(0, 1).toUpperCase()
              )}
            </button>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
