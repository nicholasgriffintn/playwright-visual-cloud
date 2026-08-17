import { createHash } from "node:crypto";

import type { VisualCloudConfig } from "./config";
import { resolveConfig } from "./config";

export interface BuildRecord {
  id: string;
  external_id: string;
  environment: string;
  branch: string;
  commit_sha: string;
  message: string;
  status: "running" | "finished";
  review_status: "pending" | "approved" | "none";
  created_at: string;
}

export interface SnapshotRecord {
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
}

export interface BaselineInfo {
  imageKey: string;
  width: number;
  height: number;
  branch: string;
}

export interface BuildRecordList {
  builds: BuildRecord[];
}

export interface BuildPayload {
  build: BuildRecord;
  snapshots: SnapshotRecord[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class VisualCloudClient {
  readonly config: VisualCloudConfig;

  constructor(config?: VisualCloudConfig) {
    this.config = config ?? resolveConfig();
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.config.token}`, ...extra };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;

    try {
      res = await fetch(`${this.config.serverUrl}${path}`, {
        ...init,
        headers: this.headers((init.headers as Record<string, string> | undefined) ?? {}),
      });
    } catch (cause) {
      throw new ApiError(0, `request failed: ${(cause as Error).message}`);
    }

    let body: unknown = null;
    let bodyText = "";

    try {
      bodyText = await res.text();

      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {}

    if (!res.ok) {
      const errorMessage =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error?: unknown }).error)
          : bodyText;

      throw new ApiError(
        res.status,
        `${init.method ?? "GET"} ${path} → ${res.status}: ${errorMessage}`,
      );
    }

    if (body === null && bodyText === "") {
      return null as T;
    }

    return body as T;
  }

  async ensureBuild(): Promise<BuildRecord> {
    const { branch, commit, environment, message, runId } = this.config;

    return this.request<BuildRecord>("/api/builds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch,
        commitSha: commit,
        environment,
        message,
        externalId: runId,
      }),
    });
  }

  async finishBuild(buildId: string): Promise<BuildRecord> {
    return this.request<BuildRecord>(`/api/builds/${buildId}/finish`, { method: "POST" });
  }

  async getBuild(buildId: string): Promise<BuildPayload> {
    return this.request<BuildPayload>(`/api/builds/${buildId}`);
  }

  async listBuilds(limit?: number): Promise<BuildRecord[]> {
    const params = new URLSearchParams();

    params.set("environment", this.config.environment);

    if (typeof limit === "number") {
      params.set("limit", String(limit));
    }

    const path = `/api/builds${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await this.request<BuildRecordList>(path);

    return response.builds;
  }

  async getLatestBuild(): Promise<BuildRecord | null> {
    const builds = await this.listBuilds(1);

    return builds[0] ?? null;
  }

  async resolveBaseline(name: string, variant: string): Promise<BaselineInfo | null> {
    const { branch } = this.config;
    const qs = new URLSearchParams();

    qs.set("branch", branch);
    qs.set("name", name);
    qs.set("variant", variant);
    try {
      return await this.request<BaselineInfo>(`/api/baselines/resolve?${qs}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async downloadImage(key: string): Promise<Buffer> {
    let res: Response;

    try {
      res = await fetch(`${this.config.serverUrl}/api/images/${key}`, {
        headers: this.headers(),
      });
    } catch (cause) {
      throw new ApiError(0, `request failed: ${(cause as Error).message}`);
    }

    if (!res.ok) {
      throw new ApiError(res.status, `failed to download image ${key}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  async uploadImage(png: Buffer): Promise<string> {
    const key = createHash("sha256").update(png).digest("hex");

    await this.request<{ key: string }>(`/api/images/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(png),
    });

    return key;
  }

  async recordSnapshot(
    buildId: string,
    snapshot: {
      name: string;
      variant: string;
      status: "passed" | "failed" | "new";
      diffPixels?: number;
      diffRatio?: number;
      expectedKey?: string;
      actualKey: string;
      diffKey?: string;
      width: number;
      height: number;
      autoBaseline?: boolean;
    },
  ): Promise<SnapshotRecord> {
    return this.request<SnapshotRecord>(`/api/builds/${buildId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
  }
}

let sharedClient: VisualCloudClient | null = null;
let sharedBuild: Promise<BuildRecord> | null = null;

export function getClient(): VisualCloudClient {
  if (!sharedClient) {
    sharedClient = new VisualCloudClient();
  }

  return sharedClient;
}

export function getBuild(): Promise<BuildRecord> {
  if (!sharedBuild) {
    sharedBuild = getClient().ensureBuild();
  }

  return sharedBuild;
}

export function resetClientState(): void {
  sharedBuild = null;
  sharedClient = null;
}
