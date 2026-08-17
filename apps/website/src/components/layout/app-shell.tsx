import type { ReactNode } from "react";
import { Logo } from "../brand/logo";
import { routeHref } from "../../lib/router";
import type { User, Workspace } from "../../lib/types";

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
        <a className="sidebar-brand" href="/">
          <Logo />
        </a>
        <div className="workspace-stack" aria-label="Workspaces">
          {workspaces.map((workspace) => (
            <a
              className={`workspace-avatar ${workspace.id === activeWorkspace?.id ? "active" : ""}`}
              href={routeHref({ kind: "app", workspaceId: workspace.id })}
              key={workspace.id}
              title={workspace.name}
            >
              {workspace.name.slice(0, 2).toUpperCase()}
            </a>
          ))}
        </div>
        <a className="sidebar-add" href={routeHref({ kind: "app" })} title="Create workspace">
          +
        </a>
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
