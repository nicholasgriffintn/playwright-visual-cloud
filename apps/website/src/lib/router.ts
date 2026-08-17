import type { Route } from "./types";

const patterns = {
  app: /^\/dashboard(?:\/([^/]+))?\/?$/u,
  project: /^\/projects\/([^/]+)\/?$/u,
  team: /^\/workspaces\/([^/]+)\/team\/?$/u,
  build: /^\/builds\/([^/]+)(?:\/([^/]+))?\/?$/u,
  invite: /^\/accept-invite\/([^/]+)\/?$/u,
};

export function parseRoute(pathname: string): Route {
  if (pathname === "/") {
    return { kind: "marketing" };
  }

  const app = patterns.app.exec(pathname);

  if (app) {
    return { kind: "app", ...(app[1] ? { workspaceId: decode(app[1]) } : {}) };
  }

  const project = patterns.project.exec(pathname);

  if (project?.[1]) {
    return { kind: "project", projectId: decode(project[1]) };
  }

  const team = patterns.team.exec(pathname);

  if (team?.[1]) {
    return { kind: "team", workspaceId: decode(team[1]) };
  }

  const build = patterns.build.exec(pathname);

  if (build?.[1]) {
    return {
      kind: "build",
      buildId: decode(build[1]),
      ...(build[2] ? { snapshotId: decode(build[2]) } : {}),
    };
  }

  const invite = patterns.invite.exec(pathname);

  if (invite?.[1]) {
    return { kind: "invite", token: decode(invite[1]) };
  }

  return { kind: "app" };
}

export function routeHref(route: Route): string {
  switch (route.kind) {
    case "marketing":
      return "/";
    case "app":
      return route.workspaceId
        ? `/dashboard/${encodeURIComponent(route.workspaceId)}`
        : "/dashboard";
    case "project":
      return `/projects/${encodeURIComponent(route.projectId)}`;
    case "team":
      return `/workspaces/${encodeURIComponent(route.workspaceId)}/team`;
    case "build":
      return `/builds/${encodeURIComponent(route.buildId)}${route.snapshotId ? `/${encodeURIComponent(route.snapshotId)}` : ""}`;
    case "invite":
      return `/accept-invite/${encodeURIComponent(route.token)}`;
  }
}

export function githubSignInHref(
  returnTo = `${window.location.pathname}${window.location.search}`,
): string {
  const parameters = new URLSearchParams();

  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    parameters.set("returnTo", returnTo);
  }

  return `/api/auth/github${parameters.size ? `?${parameters}` : ""}`;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
