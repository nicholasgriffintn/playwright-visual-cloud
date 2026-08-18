import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/layout/app-shell";
import { api } from "../../lib/api";
import { routeHref } from "../../lib/router";
import type { Route, User, Workspace } from "../../lib/types";
import { InvitePage } from "../invites/invite-page";
import { ProjectPage } from "../projects/project-page";
import { BuildReviewPage } from "../runs/build-review-page";
import { TeamPage } from "../team/team-page";
import { WorkspacePage } from "../workspaces/workspace-page";
import { WorkspacePicker } from "../workspaces/workspace-picker";
import { useNavigate } from "react-router-dom";

type AuthenticatedAppProps = {
  route: Exclude<Route, { kind: "marketing" }>;
  user: User;
  onLogout: () => Promise<void>;
};

export function AuthenticatedApp({ route, user, onLogout }: AuthenticatedAppProps) {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .workspaces()
      .then((result) => setWorkspaces(result.workspaces))
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);
  const workspaceId =
    route.kind === "app"
      ? route.workspaceId
      : route.kind === "team"
        ? route.workspaceId
        : undefined;
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId),
    [workspaceId, workspaces],
  );

  if (loading) {
    return (
      <div className="app-loading">
        <span />
        <p>Opening visual cloud…</p>
      </div>
    );
  }

  if (error) {
    return <p className="notice error">{error}</p>;
  }

  return (
    <AppShell
      user={user}
      workspaces={workspaces}
      activeWorkspace={activeWorkspace}
      onLogout={onLogout}
    >
      {route.kind === "app" ? (
        activeWorkspace ? (
          <WorkspacePage workspace={activeWorkspace} />
        ) : (
          <WorkspacePicker
            workspaces={workspaces}
            onCreated={(workspace) => {
              setWorkspaces((current) => [...current, workspace]);
              navigate(routeHref({ kind: "app", workspaceId: workspace.id }));
            }}
          />
        )
      ) : null}
      {route.kind === "project" ? <ProjectPage projectId={route.projectId} /> : null}
      {route.kind === "team" && activeWorkspace ? <TeamPage workspace={activeWorkspace} /> : null}
      {route.kind === "build" ? (
        <BuildReviewPage buildId={route.buildId} snapshotId={route.snapshotId} />
      ) : null}
      {route.kind === "invite" ? <InvitePage token={route.token} /> : null}
    </AppShell>
  );
}
