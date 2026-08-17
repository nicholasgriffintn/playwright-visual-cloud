export type Plan = "free" | "pro";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  plan: Plan;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "member";
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  default_branch: string;
  repository: string | null;
  created_at: string;
}

export interface ProjectWithRole extends Project {
  role: "owner" | "member";
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "owner" | "member";
  created_at: string;
}

export interface Build {
  id: string;
  project_id: string;
  external_id: string;
  environment: string;
  branch: string;
  commit_sha: string;
  message: string;
  status: "running" | "finished";
  review_status: "pending" | "approved" | "none";
  created_at: string;
  completed_at: string | null;
}

export interface Snapshot {
  id: string;
  build_id: string;
  name: string;
  variant: string;
  status: "passed" | "failed" | "new" | "approved";
  diff_pixels: number | null;
  diff_ratio: number | null;
  expected_key: string | null;
  actual_key: string;
  diff_key: string | null;
  width: number;
  height: number;
  approved_at: string | null;
}

export interface BuildPayload {
  build: Build;
  snapshots: Snapshot[];
}

export type Route =
  | { kind: "marketing" }
  | { kind: "app"; workspaceId?: string }
  | { kind: "project"; projectId: string }
  | { kind: "team"; workspaceId: string }
  | { kind: "build"; buildId: string; snapshotId?: string }
  | { kind: "invite"; token: string };
