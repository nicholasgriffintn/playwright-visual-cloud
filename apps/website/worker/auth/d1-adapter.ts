import {
  AuthError,
  createAuth,
  type AuthSessionRecord,
  type ExternalIdentity,
  type IdentityStore,
  type SessionStore,
  type UserStore,
} from "@ngriffin_uk/auth-core";
import type { OAuthStateRecord, OAuthStateStore } from "@ngriffin_uk/auth-oauth2";

import type { GitHubUser, UserRow } from "./model";
import { mapUser } from "./model";

export function createD1Auth(db: D1Database) {
  return createAuth({
    users: createUserStore(db),
    sessions: createSessionStore(db),
    identities: createIdentityStore(db),
  });
}

export function createD1OAuthStateStore(db: D1Database): OAuthStateStore {
  return {
    create: (state) => storeOAuthState(db, state),
    consumeByStateHash: (stateHash) => consumeOAuthState(db, stateHash),
  };
}

function createUserStore(db: D1Database): UserStore<GitHubUser> {
  return {
    async findById(userId) {
      const row = await db
        .prepare("SELECT * FROM users WHERE id = ?1")
        .bind(userId)
        .first<UserRow>();

      return row ? mapUser(row) : null;
    },
  };
}

function createSessionStore(db: D1Database): SessionStore {
  return {
    create: (session) => storeSession(db, session),
    findByTokenHash: (tokenHash) => findSession(db, tokenHash),
    deleteByTokenHash: (tokenHash) => deleteSession(db, tokenHash),
    deleteByUserId: (userId) => deleteUserSessions(db, userId),
  };
}

function createIdentityStore(db: D1Database): IdentityStore<GitHubUser> {
  return {
    findUser: (provider, subject) => findIdentity(db, provider, subject),
    resolve: (identity) => resolveIdentity(db, identity),
  };
}

async function storeSession(db: D1Database, session: AuthSessionRecord): Promise<void> {
  await db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(
      session.tokenHash,
      session.userId,
      session.createdAt.toISOString(),
      session.expiresAt.toISOString(),
    )
    .run();
}

async function findSession(db: D1Database, tokenHash: string): Promise<AuthSessionRecord | null> {
  const row = await db
    .prepare(
      "SELECT * FROM sessions WHERE token_hash = ?1 AND julianday(expires_at) > julianday('now')",
    )
    .bind(tokenHash)
    .first<{ token_hash: string; user_id: string; created_at: string; expires_at: string }>();

  return row
    ? {
        tokenHash: row.token_hash,
        userId: row.user_id,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
      }
    : null;
}

async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
}

async function deleteUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId).run();
}

async function findIdentity(
  db: D1Database,
  provider: string,
  subject: string,
): Promise<GitHubUser | null> {
  const row = await db
    .prepare(
      `SELECT u.* FROM identities i JOIN users u ON u.id = i.user_id
     WHERE i.provider = ?1 AND i.provider_subject = ?2`,
    )
    .bind(provider, subject)
    .first<UserRow>();

  return row ? mapUser(row) : null;
}

async function resolveIdentity(db: D1Database, identity: ExternalIdentity): Promise<GitHubUser> {
  if (identity.provider !== "github" || !identity.email || identity.emailVerified !== true) {
    throw new AuthError("provider_error", "GitHub must provide a verified email address.");
  }

  const existingIdentity = await findIdentity(db, identity.provider, identity.providerSubject);

  if (existingIdentity) {
    return existingIdentity;
  }

  const email = identity.email.toLowerCase();
  const existingEmail = await db
    .prepare("SELECT * FROM users WHERE email = ?1 COLLATE NOCASE")
    .bind(email)
    .first<UserRow>();
  const userId = existingEmail?.id ?? crypto.randomUUID();
  const name =
    claimString(identity.claims.name) ?? claimString(identity.claims.login) ?? email.split("@")[0];
  const statements = existingEmail
    ? []
    : newUserStatements(db, userId, email, name, claimString(identity.claims.avatar_url));

  statements.push(
    db
      .prepare(
        "INSERT INTO identities (provider, provider_subject, user_id, email, claims_json) VALUES (?1, ?2, ?3, ?4, ?5)",
      )
      .bind("github", identity.providerSubject, userId, email, JSON.stringify(identity.claims)),
  );
  await db.batch(statements);
  const row = await db.prepare("SELECT * FROM users WHERE id = ?1").bind(userId).first<UserRow>();

  if (!row) {
    throw new AuthError("provider_error");
  }

  return mapUser(row);
}

function newUserStatements(
  db: D1Database,
  userId: string,
  email: string,
  name: string,
  avatar?: string,
): D1PreparedStatement[] {
  const workspaceId = crypto.randomUUID();

  return [
    db
      .prepare("INSERT INTO users (id, email, name, avatar_url) VALUES (?1, ?2, ?3, ?4)")
      .bind(userId, email, name, avatar ?? null),
    db
      .prepare("INSERT INTO workspaces (id, name, slug, created_by) VALUES (?1, ?2, ?3, ?4)")
      .bind(workspaceId, `${name}'s workspace`, `${slug(name)}-${userId.slice(0, 6)}`, userId),
    db
      .prepare(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?1, ?2, 'owner')",
      )
      .bind(workspaceId, userId),
  ];
}

async function storeOAuthState(db: D1Database, state: OAuthStateRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO oauth_states (state_hash, provider, code_verifier, nonce, redirect_uri, context_json, created_at, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      state.stateHash,
      state.provider,
      state.codeVerifier ?? null,
      state.nonce ?? null,
      state.redirectUri ?? null,
      JSON.stringify(state.context ?? {}),
      state.createdAt.toISOString(),
      state.expiresAt.toISOString(),
    )
    .run();
}

async function consumeOAuthState(
  db: D1Database,
  stateHash: string,
): Promise<OAuthStateRecord | null> {
  const row = await db
    .prepare(
      "DELETE FROM oauth_states WHERE state_hash = ?1 AND julianday(expires_at) > julianday('now') RETURNING *",
    )
    .bind(stateHash)
    .first<Record<string, string | null>>();

  if (!row) {
    return null;
  }

  return {
    stateHash: row.state_hash!,
    provider: row.provider!,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    context: JSON.parse(row.context_json ?? "{}") as Record<string, string>,
    ...(row.code_verifier ? { codeVerifier: row.code_verifier } : {}),
    ...(row.nonce ? { nonce: row.nonce } : {}),
    ...(row.redirect_uri ? { redirectUri: row.redirect_uri } : {}),
  };
}

function claimString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 2048
    ? value.trim()
    : undefined;
}

function slug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "workspace"
  );
}
