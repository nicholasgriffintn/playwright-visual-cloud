import type { WorkspaceRole } from "./shared/validation";

export type Plan = "free" | "pro";

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  AUTH_RATE_LIMIT: RateLimit;
  SITE_ORIGIN?: string;
  IMAGE_RETENTION_DAYS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  plan: Plan;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
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
  is_connected?: boolean;
  compare_threshold: number | null;
  compare_max_diff_pixels: number | null;
  compare_max_diff_pixel_ratio: number | null;
  compare_include_aa: number;
  ignore_selectors: string | null;
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
  status: "passed" | "failed" | "new" | "approved" | "ignored" | "archived";
  diff_pixels: number | null;
  diff_ratio: number | null;
  expected_key: string | null;
  actual_key: string;
  diff_key: string | null;
  width: number;
  height: number;
  created_at: string;
  approved_at: string | null;
  ignored_selectors: string | null;
}

export interface SessionPrincipal {
  user: User;
  token: string;
}

export interface ProjectPrincipal {
  project: Project;
  tokenId: string;
}
