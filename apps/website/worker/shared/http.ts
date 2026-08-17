import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { parseCookies } from "@ngriffin_uk/auth-cookie";

import { createAuthentication } from "../auth/authentication";
import { createProjectAccess } from "../projects/access";
import type { Env, ProjectPrincipal, SessionPrincipal } from "../types";
import { bearerToken } from "./request-input";
import { canonicalOrigin } from "./security";

export type AppContext = Context<{ Bindings: Env }>;

export function jsonHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function requireSession(context: AppContext): Promise<SessionPrincipal> {
  const token = parseCookies(context.req.header("Cookie") ?? "").get("__Host-pvc_session");

  if (!token) {
    throw new HTTPException(401, { message: "Sign in required" });
  }
  const origin = canonicalOrigin(context.req.raw, context.env.SITE_ORIGIN);
  const user = await createAuthentication(context.env.DB, context.env, origin).currentUser(token);

  if (!user) {
    throw new HTTPException(401, { message: "Session expired" });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.displayName,
      avatar_url: user.avatarUrl ?? null,
      plan: user.plan,
      created_at: user.createdAt.toISOString(),
    },
    token,
  };
}

export async function requireProSession(context: AppContext): Promise<SessionPrincipal> {
  const principal = await requireSession(context);

  if (principal.user.plan !== "pro") {
    throw new HTTPException(403, { message: "Pro plan required" });
  }

  return principal;
}

export async function requireProjectToken(context: AppContext): Promise<ProjectPrincipal> {
  return createProjectAccess(context.env.DB).authenticate(bearerToken(context));
}
