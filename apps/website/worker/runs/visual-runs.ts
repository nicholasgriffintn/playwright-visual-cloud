import { DomainError } from "../shared/domain-error";
import type { Build, Snapshot } from "../types";

export interface CreateBuildInput {
  externalId: string;
  environment: string;
  branch: string;
  commitSha: string;
  message: string;
}

export interface RecordSnapshotInput {
  name: string;
  variant: string;
  status: "passed" | "failed" | "new";
  diffPixels: number | null;
  diffRatio: number | null;
  expectedKey: string | null;
  actualKey: string;
  diffKey: string | null;
  width: number;
  height: number;
  autoBaseline: boolean;
}

export interface BaselineQuery {
  branch: string;
  defaultBranch: string;
  name: string;
  variant: string;
}

export interface BuildPayload {
  build: Build;
  snapshots: Snapshot[];
}

export interface VisualRuns {
  createBuild(projectId: string, input: CreateBuildInput): Promise<Build>;
  listProjectBuilds(projectId: string, limit: number, environment?: string): Promise<Build[]>;
  listBuilds(
    userId: string,
    projectId: string,
    limit: number,
    environment?: string,
  ): Promise<Build[]>;
  listEnvironments(userId: string, projectId: string): Promise<string[]>;
  getBuildForProject(projectId: string, buildId: string): Promise<BuildPayload>;
  getBuildForUser(userId: string, buildId: string): Promise<BuildPayload>;
  finishBuild(projectId: string, buildId: string): Promise<Build>;
  recordSnapshot(projectId: string, buildId: string, input: RecordSnapshotInput): Promise<Snapshot>;
  resolveBaseline(
    projectId: string,
    query: BaselineQuery,
  ): Promise<{ imageKey: string; width: number; height: number; branch: string } | null>;
  approveSnapshot(userId: string, buildId: string, snapshotId: string): Promise<Snapshot>;
  approveBuild(userId: string, buildId: string): Promise<number>;
}

export function createVisualRuns(db: D1Database): VisualRuns {
  async function getBuild(buildId: string): Promise<Build | null> {
    return db.prepare("SELECT * FROM builds WHERE id = ?1").bind(buildId).first<Build>();
  }

  async function payload(build: Build): Promise<BuildPayload> {
    const snapshots = await db
      .prepare(
        "SELECT * FROM snapshots WHERE build_id = ?1 ORDER BY status IN ('failed','new') DESC, name",
      )
      .bind(build.id)
      .all<Snapshot>();

    return { build, snapshots: snapshots.results };
  }

  async function requireProjectBuild(projectId: string, buildId: string): Promise<Build> {
    const build = await getBuild(buildId);

    if (!build || build.project_id !== projectId) {
      throw new DomainError("Build not found", 404);
    }

    return build;
  }

  async function requireUserBuild(userId: string, buildId: string): Promise<Build> {
    const build = await db
      .prepare(
        `SELECT b.* FROM builds b JOIN projects p ON p.id = b.project_id
       JOIN workspace_members m ON m.workspace_id = p.workspace_id
       WHERE b.id = ?1 AND m.user_id = ?2`,
      )
      .bind(buildId, userId)
      .first<Build>();

    if (!build) {
      throw new DomainError("Build not found", 404);
    }

    return build;
  }

  async function requireProjectAccess(userId: string, projectId: string): Promise<void> {
    const access = await db
      .prepare(
        `SELECT 1 AS allowed FROM projects p JOIN workspace_members m ON m.workspace_id = p.workspace_id
         WHERE p.id = ?1 AND m.user_id = ?2`,
      )
      .bind(projectId, userId)
      .first<{ allowed: number }>();

    if (!access) {
      throw new DomainError("Project not found", 404);
    }
  }

  async function promote(build: Build, snapshot: Snapshot): Promise<void> {
    await db
      .prepare(
        `INSERT INTO baselines (project_id, branch, name, variant, image_key, width, height, source_build_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT (project_id, branch, name, variant) DO UPDATE SET image_key = excluded.image_key,
         width = excluded.width, height = excluded.height, source_build_id = excluded.source_build_id, updated_at = datetime('now')`,
      )
      .bind(
        build.project_id,
        build.branch,
        snapshot.name,
        snapshot.variant,
        snapshot.actual_key,
        snapshot.width,
        snapshot.height,
        build.id,
      )
      .run();
  }

  async function refreshReviewStatus(buildId: string): Promise<void> {
    const counts = await db
      .prepare(
        `SELECT SUM(status IN ('failed','new')) AS pending, SUM(status = 'approved') AS approved
       FROM snapshots WHERE build_id = ?1`,
      )
      .bind(buildId)
      .first<{ pending: number | null; approved: number | null }>();
    const status =
      (counts?.pending ?? 0) > 0 ? "pending" : (counts?.approved ?? 0) > 0 ? "approved" : "none";

    await db
      .prepare("UPDATE builds SET review_status = ?1 WHERE id = ?2")
      .bind(status, buildId)
      .run();
  }

  return {
    async createBuild(projectId, input) {
      return (await db
        .prepare(
          `INSERT INTO builds (id, project_id, external_id, environment, branch, commit_sha, message)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (project_id, external_id) DO UPDATE SET branch = excluded.branch,
           commit_sha = excluded.commit_sha, environment = excluded.environment, message = excluded.message
         RETURNING *`,
        )
        .bind(
          crypto.randomUUID(),
          projectId,
          input.externalId,
          input.environment,
          input.branch,
          input.commitSha,
          input.message,
        )
        .first<Build>())!;
    },

    async listProjectBuilds(projectId, limit, environment) {
      const result = environment
        ? await db
            .prepare(
              "SELECT * FROM builds WHERE project_id = ?1 AND environment = ?2 ORDER BY created_at DESC LIMIT ?3",
            )
            .bind(projectId, environment, limit)
            .all<Build>()
        : await db
            .prepare("SELECT * FROM builds WHERE project_id = ?1 ORDER BY created_at DESC LIMIT ?2")
            .bind(projectId, limit)
            .all<Build>();

      return result.results;
    },

    async listBuilds(userId, projectId, limit, environment) {
      await requireProjectAccess(userId, projectId);

      return this.listProjectBuilds(projectId, limit, environment);
    },

    async listEnvironments(userId, projectId) {
      await requireProjectAccess(userId, projectId);
      const result = await db
        .prepare(
          "SELECT DISTINCT environment FROM builds WHERE project_id = ?1 ORDER BY environment",
        )
        .bind(projectId)
        .all<{ environment: string }>();

      return result.results.map(({ environment }) => environment);
    },

    async getBuildForProject(projectId, buildId) {
      return payload(await requireProjectBuild(projectId, buildId));
    },

    async getBuildForUser(userId, buildId) {
      return payload(await requireUserBuild(userId, buildId));
    },

    async finishBuild(projectId, buildId) {
      const build = await requireProjectBuild(projectId, buildId);

      await refreshReviewStatus(buildId);
      await db
        .prepare(
          "UPDATE builds SET status = 'finished', completed_at = datetime('now') WHERE id = ?1",
        )
        .bind(buildId)
        .run();

      return (await getBuild(build.id))!;
    },

    async recordSnapshot(projectId, buildId, input) {
      const build = await requireProjectBuild(projectId, buildId);
      const autoApproved = input.status === "new" && input.autoBaseline;
      const snapshot = (await db
        .prepare(
          `INSERT INTO snapshots (id, build_id, name, variant, status, diff_pixels, diff_ratio, expected_key, actual_key, diff_key, width, height, approved_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT (build_id, name, variant) DO UPDATE SET status = excluded.status, diff_pixels = excluded.diff_pixels,
           diff_ratio = excluded.diff_ratio, expected_key = excluded.expected_key, actual_key = excluded.actual_key,
           diff_key = excluded.diff_key, width = excluded.width, height = excluded.height, approved_at = excluded.approved_at
         RETURNING *`,
        )
        .bind(
          crypto.randomUUID(),
          buildId,
          input.name,
          input.variant,
          autoApproved ? "approved" : input.status,
          input.diffPixels,
          input.diffRatio,
          input.expectedKey,
          input.actualKey,
          input.diffKey,
          input.width,
          input.height,
          autoApproved ? new Date().toISOString() : null,
        )
        .first<Snapshot>())!;

      if (autoApproved) {
        await promote(build, snapshot);
      }

      await refreshReviewStatus(buildId);

      return snapshot;
    },

    async resolveBaseline(projectId, query) {
      for (const branch of new Set([query.branch, query.defaultBranch])) {
        const baseline = await db
          .prepare(
            `SELECT image_key AS imageKey, width, height, branch FROM baselines
           WHERE project_id = ?1 AND branch = ?2 AND name = ?3 AND variant = ?4`,
          )
          .bind(projectId, branch, query.name, query.variant)
          .first<{ imageKey: string; width: number; height: number; branch: string }>();

        if (baseline) {
          return baseline;
        }
      }

      return null;
    },

    async approveSnapshot(userId, buildId, snapshotId) {
      const build = await requireUserBuild(userId, buildId);
      const snapshot = await db
        .prepare("SELECT * FROM snapshots WHERE id = ?1 AND build_id = ?2")
        .bind(snapshotId, buildId)
        .first<Snapshot>();

      if (!snapshot) {
        throw new DomainError("Snapshot not found", 404);
      }

      await promote(build, snapshot);
      await db
        .prepare(
          "UPDATE snapshots SET status = 'approved', approved_at = datetime('now') WHERE id = ?1",
        )
        .bind(snapshotId)
        .run();
      await refreshReviewStatus(buildId);

      return (await db
        .prepare("SELECT * FROM snapshots WHERE id = ?1")
        .bind(snapshotId)
        .first<Snapshot>())!;
    },

    async approveBuild(userId, buildId) {
      const build = await requireUserBuild(userId, buildId);
      const current = await payload(build);
      const pending = current.snapshots.filter(
        (snapshot) => snapshot.status === "failed" || snapshot.status === "new",
      );

      for (const snapshot of pending) {
        await promote(build, snapshot);
      }

      await db
        .prepare(
          "UPDATE snapshots SET status = 'approved', approved_at = datetime('now') WHERE build_id = ?1 AND status IN ('failed','new')",
        )
        .bind(buildId)
        .run();
      await refreshReviewStatus(buildId);

      return pending.length;
    },
  };
}
