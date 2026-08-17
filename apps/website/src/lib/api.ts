import type {
  Build,
  BuildPayload,
  Member,
  Project,
  ProjectWithRole,
  User,
  Workspace,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  const value: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      value && typeof value === "object" && "error" in value && typeof value.error === "string"
        ? value.error
        : `${response.status} ${response.statusText}`;

    throw new ApiError(response.status, message);
  }

  return value as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const api = {
  session: () => request<{ user: User | null }>("/api/auth/session"),
  logout: () => post<{ ok: true }>("/api/auth/logout"),
  workspaces: () => request<{ workspaces: Workspace[] }>("/api/workspaces"),
  createWorkspace: (name: string) => post<{ workspace: Workspace }>("/api/workspaces", { name }),
  projects: (workspaceId: string) =>
    request<{ projects: Project[] }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/projects`),
  createProject: (
    workspaceId: string,
    input: { name: string; defaultBranch: string; repository: string },
  ) =>
    post<{ project: Project }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/projects`,
      input,
    ),
  project: (projectId: string) =>
    request<{ project: ProjectWithRole }>(`/api/projects/${encodeURIComponent(projectId)}`),
  builds: (projectId: string, environment?: string) => {
    const query = environment ? `?environment=${encodeURIComponent(environment)}` : "";

    return request<{ builds: Build[]; environments: string[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/builds${query}`,
    );
  },
  createProjectToken: (projectId: string, name: string) =>
    post<{ token: string }>(`/api/projects/${encodeURIComponent(projectId)}/tokens`, { name }),
  members: (workspaceId: string) =>
    request<{ members: Member[] }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/members`),
  invite: (workspaceId: string, email: string, role: Member["role"]) =>
    post<{ inviteUrl: string; expiresInDays: number }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/invites`,
      { email, role },
    ),
  acceptInvite: (token: string) =>
    post<{ workspaceId: string }>("/api/workspaces/accept-invite", { token }),
  build: (buildId: string) =>
    request<BuildPayload>(`/api/review/builds/${encodeURIComponent(buildId)}`),
  approveBuild: (buildId: string) =>
    post<{ approved: number }>(`/api/review/builds/${encodeURIComponent(buildId)}/approve`),
  ignoreBuild: (buildId: string) =>
    post<{ ignored: number }>(`/api/review/builds/${encodeURIComponent(buildId)}/ignore`),
  archiveBuild: (buildId: string) =>
    post<{ archived: number }>(`/api/review/builds/${encodeURIComponent(buildId)}/archive`),
  approveSnapshot: (buildId: string, snapshotId: string) =>
    post(
      `/api/review/builds/${encodeURIComponent(buildId)}/snapshots/${encodeURIComponent(snapshotId)}/approve`,
    ),
  ignoreSnapshot: (buildId: string, snapshotId: string) =>
    post(
      `/api/review/builds/${encodeURIComponent(buildId)}/snapshots/${encodeURIComponent(snapshotId)}/ignore`,
    ),
  archiveSnapshot: (buildId: string, snapshotId: string) =>
    post(
      `/api/review/builds/${encodeURIComponent(buildId)}/snapshots/${encodeURIComponent(snapshotId)}/archive`,
    ),
  imageUrl: (buildId: string, key: string) =>
    `/api/review/builds/${encodeURIComponent(buildId)}/images/${encodeURIComponent(key)}`,
};
