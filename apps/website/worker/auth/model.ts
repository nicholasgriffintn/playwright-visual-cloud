import type { AuthUserWithEmail } from "@ngriffin_uk/auth-core";

import type { Plan } from "../types";

export interface GitHubUser extends AuthUserWithEmail {
  displayName: string;
  avatarUrl?: string;
  plan: Plan;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  plan: Plan;
  created_at: string;
}

export function mapUser(row: UserRow): GitHubUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.name,
    plan: row.plan,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    createdAt: new Date(`${row.created_at.replace(" ", "T")}Z`),
  };
}
