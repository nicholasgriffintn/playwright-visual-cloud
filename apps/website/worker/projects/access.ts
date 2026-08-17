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
        .first<Record<string, string | null>>();

      if (!row) {
        throw new DomainError("Invalid project token", 401);
      }
      await db
        .prepare("UPDATE project_tokens SET last_used_at = datetime('now') WHERE id = ?1")
        .bind(row.token_id)
        .run();

      return {
        tokenId: row.token_id!,
        project: {
          id: row.id!,
          workspace_id: row.workspace_id!,
          name: row.name!,
          slug: row.slug!,
          default_branch: row.default_branch!,
          repository: row.repository,
          created_at: row.created_at!,
        },
      };
    },
  };
}
