import { DomainError } from "../shared/domain-error";
import { hashToken } from "../shared/security";
import type { ProjectPrincipal } from "../types";

export interface ProjectAccess {
  authenticate(rawToken: string): Promise<ProjectPrincipal>;
}

export function createProjectAccess(db: D1Database): ProjectAccess {
  return {
    async authenticate(rawToken) {
      const row = await db
        .prepare(
          `SELECT p.*, t.id AS token_id
           FROM project_tokens t
           JOIN projects p ON p.id = t.project_id
           JOIN users u ON u.id = t.created_by
           WHERE t.token_hash = ?1
             AND u.plan = 'pro'
             AND (t.expires_at IS NULL OR t.expires_at > datetime('now'))`,
        )
        .bind(await hashToken(rawToken))
        .first<Record<string, string | number | null>>();

      if (!row) {
        throw new DomainError("Invalid project token", 401);
      }

      await db
        .prepare("UPDATE project_tokens SET last_used_at = datetime('now') WHERE id = ?1")
        .bind(row.token_id)
        .run();

      return {
        tokenId: row.token_id as string,
        project: {
          id: row.id as string,
          workspace_id: row.workspace_id as string,
          name: row.name as string,
          slug: row.slug as string,
          default_branch: row.default_branch as string,
          repository: row.repository as string | null,
          created_at: row.created_at as string,
          compare_threshold: row.compare_threshold as number | null,
          compare_max_diff_pixels: row.compare_max_diff_pixels as number | null,
          compare_max_diff_pixel_ratio: row.compare_max_diff_pixel_ratio as number | null,
          compare_include_aa: Number(row.compare_include_aa ?? 0),
          ignore_selectors: row.ignore_selectors as string | null,
        },
      };
    },
  };
}
