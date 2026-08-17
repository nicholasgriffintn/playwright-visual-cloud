import { AuthError } from "@ngriffin_uk/auth-core";
import { createGitHubAuth } from "@ngriffin_uk/auth-provider-github";
import type { AuthFlowResult } from "@ngriffin_uk/auth-protocol";

import type { Env } from "../types";
import { createD1Auth, createD1OAuthStateStore } from "./d1-adapter";
import { resolveGitHubIdentity } from "./github-profile";
import type { GitHubUser } from "./model";

export interface Authentication {
  currentUser(rawSession: string): Promise<GitHubUser | null>;
  logout(rawSession: string): Promise<void>;
  startGitHub(): Promise<URL>;
  completeGitHub(code: string, state: string): Promise<AuthFlowResult<GitHubUser>>;
}

export function createAuthentication(db: D1Database, env: Env, origin: string): Authentication {
  const auth = createD1Auth(db);

  const github = () =>
    auth.use(
      createGitHubAuth<GitHubUser>({
        clientId: requiredSecret(env.GITHUB_CLIENT_ID),
        clientSecret: requiredSecret(env.GITHUB_CLIENT_SECRET),
        redirectUri: `${origin}/api/auth/github/callback`,
        scopes: ["read:user", "user:email"],
        stateStore: createD1OAuthStateStore(db),
        resolveIdentity: resolveGitHubIdentity,
      }),
    ).providers.github;

  return {
    currentUser: (rawSession) => auth.validateSession(rawSession),
    logout: (rawSession) => auth.revokeSession(rawSession),
    startGitHub: () => github().startAuthorization(),
    completeGitHub: (code, state) => github().completeAuthorization({ code, state }),
  };
}

function requiredSecret(value: string | undefined): string {
  const secret = value?.trim();

  if (!secret) {
    throw new AuthError("provider_not_found");
  }

  return secret;
}
