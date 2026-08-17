import { DomainError } from "../shared/domain-error";
import { hashToken, randomToken } from "../shared/security";
import type { WorkspaceRole } from "../shared/validation";
import type { Project, User, Workspace } from "../types";

export interface CreateProjectInput {
  name: string;
  slug: string;
  defaultBranch: string;
  repository: string | null;
}

export interface CreateInviteInput {
  email: string;
  role: WorkspaceRole;
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceDirectory {
  listWorkspaces(userId: string): Promise<Workspace[]>;
  createWorkspace(userId: string, name: string, slug: string): Promise<Workspace>;
  listProjects(userId: string, workspaceId: string): Promise<Project[]>;
  createProject(userId: string, workspaceId: string, input: CreateProjectInput): Promise<Project>;
  getProject(userId: string, projectId: string): Promise<Project & { role: WorkspaceRole }>;
  listMembers(userId: string, workspaceId: string): Promise<WorkspaceMember[]>;
  createInvite(userId: string, workspaceId: string, input: CreateInviteInput): Promise<string>;
  acceptInvite(user: User, rawToken: string): Promise<string>;
  createProjectToken(userId: string, projectId: string, name: string): Promise<string>;
}

export function createWorkspaceDirectory(db: D1Database): WorkspaceDirectory {
  async function role(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const row = await db
      .prepare("SELECT role FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2")
      .bind(workspaceId, userId)
      .first<{ role: WorkspaceRole }>();

    return row?.role ?? null;
  }

  async function requireMember(workspaceId: string, userId: string): Promise<WorkspaceRole> {
    const membership = await role(workspaceId, userId);

    if (!membership) {
      throw new DomainError("Workspace not found", 404);
    }

    return membership;
  }

  async function requireOwner(workspaceId: string, userId: string): Promise<void> {
    if ((await requireMember(workspaceId, userId)) !== "owner") {
      throw new DomainError("Only workspace owners can perform this action", 403);
    }
  }

  async function projectWithRole(
    projectId: string,
    userId: string,
  ): Promise<{ project: Project & { role: WorkspaceRole }; role: WorkspaceRole }> {
    const row = await db
      .prepare(
        `SELECT p.*, m.role FROM projects p JOIN workspace_members m ON m.workspace_id = p.workspace_id
       WHERE p.id = ?1 AND m.user_id = ?2`,
      )
      .bind(projectId, userId)
      .first<Project & { role: WorkspaceRole }>();

    if (!row) {
      throw new DomainError("Project not found", 404);
    }

    return { project: row, role: row.role };
  }

  return {
    async listWorkspaces(userId) {
      const result = await db
        .prepare(
          `SELECT w.*, m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
         WHERE m.user_id = ?1 ORDER BY w.name`,
        )
        .bind(userId)
        .all<Workspace>();

      return result.results;
    },

    async createWorkspace(userId, name, slug) {
      const id = crypto.randomUUID();
      try {
        await db.batch([
          db
            .prepare("INSERT INTO workspaces (id, name, slug, created_by) VALUES (?1, ?2, ?3, ?4)")
            .bind(id, name, slug, userId),
          db
            .prepare(
              "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?1, ?2, 'owner')",
            )
            .bind(id, userId),
        ]);
      } catch (cause) {
        if (String(cause).includes("UNIQUE")) {
          throw new DomainError("That workspace name is already in use", 409);
        }
        throw cause;
      }

      return (await db
        .prepare(
          `SELECT w.*, m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
         WHERE w.id = ?1 AND m.user_id = ?2`,
        )
        .bind(id, userId)
        .first<Workspace>())!;
    },

    async listProjects(userId, workspaceId) {
      await requireMember(workspaceId, userId);
      const result = await db
        .prepare("SELECT * FROM projects WHERE workspace_id = ?1 ORDER BY created_at DESC")
        .bind(workspaceId)
        .all<Project>();

      return result.results;
    },

    async createProject(userId, workspaceId, input) {
      await requireOwner(workspaceId, userId);
      try {
        return (await db
          .prepare(
            `INSERT INTO projects (id, workspace_id, name, slug, default_branch, repository)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING *`,
          )
          .bind(
            crypto.randomUUID(),
            workspaceId,
            input.name,
            input.slug,
            input.defaultBranch,
            input.repository,
          )
          .first<Project>())!;
      } catch (cause) {
        if (String(cause).includes("UNIQUE")) {
          throw new DomainError("That project name is already in use", 409);
        }
        throw cause;
      }
    },

    async getProject(userId, projectId) {
      return (await projectWithRole(projectId, userId)).project;
    },

    async listMembers(userId, workspaceId) {
      await requireMember(workspaceId, userId);
      const result = await db
        .prepare(
          `SELECT u.id, u.name, u.email, u.avatar_url, m.role, m.created_at FROM workspace_members m
         JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ?1 ORDER BY m.created_at`,
        )
        .bind(workspaceId)
        .all<WorkspaceMember>();

      return result.results;
    },

    async createInvite(userId, workspaceId, input) {
      await requireOwner(workspaceId, userId);
      const rawToken = randomToken("pvci_");
      try {
        await db
          .prepare(
            `INSERT INTO workspace_invites (id, workspace_id, email, role, token_hash, invited_by, expires_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now', '+7 days'))`,
          )
          .bind(
            crypto.randomUUID(),
            workspaceId,
            input.email,
            input.role,
            await hashToken(rawToken),
            userId,
          )
          .run();
      } catch (cause) {
        if (String(cause).includes("UNIQUE")) {
          throw new DomainError("An active invite already exists", 409);
        }
        throw cause;
      }

      return rawToken;
    },

    async acceptInvite(user, rawToken) {
      const invite = await db
        .prepare(
          `SELECT * FROM workspace_invites WHERE token_hash = ?1 AND accepted_at IS NULL AND expires_at > datetime('now')`,
        )
        .bind(await hashToken(rawToken))
        .first<{ id: string; workspace_id: string; email: string; role: WorkspaceRole }>();

      if (!invite || invite.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new DomainError(
          "This invite is invalid, expired, or belongs to another email address",
          400,
        );
      }
      await db.batch([
        db
          .prepare(
            `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?1, ?2, ?3)
           ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = excluded.role`,
          )
          .bind(invite.workspace_id, user.id, invite.role),
        db
          .prepare(
            "UPDATE workspace_invites SET accepted_at = datetime('now') WHERE id = ?1 AND accepted_at IS NULL",
          )
          .bind(invite.id),
      ]);

      return invite.workspace_id;
    },

    async createProjectToken(userId, projectId, name) {
      const access = await projectWithRole(projectId, userId);

      if (access.role !== "owner") {
        throw new DomainError("Only workspace owners can create project tokens", 403);
      }
      const token = randomToken("pvc_");
      await db
        .prepare(
          `INSERT INTO project_tokens (id, project_id, name, token_prefix, token_hash, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(
          crypto.randomUUID(),
          projectId,
          name,
          token.slice(0, 12),
          await hashToken(token),
          userId,
        )
        .run();

      return token;
    },
  };
}
