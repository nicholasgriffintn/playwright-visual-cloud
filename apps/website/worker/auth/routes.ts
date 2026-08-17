import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { AuthError } from "@ngriffin_uk/auth-core";
import {
  parseCookies,
  serializeExpiredCookie,
  serializeSessionCookie,
} from "@ngriffin_uk/auth-cookie";

import { protectBrowserMutations } from "../shared/browser-security";
import { requireSession, type AppContext } from "../shared/http";
import { canonicalOrigin, safeReturnPath } from "../shared/security";
import type { Env } from "../types";
import { createAuthentication } from "./authentication";

const SESSION_COOKIE = "__Host-pvc_session";
const STATE_COOKIE = "__Host-pvc_oauth_state";
const RETURN_COOKIE = "__Host-pvc_return_to";
const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.use("*", protectBrowserMutations);
authRoutes.get("/github", startGitHub);
authRoutes.get("/github/callback", completeGitHub);
authRoutes.get("/session", getSession);
authRoutes.post("/logout", logout);

async function startGitHub(context: AppContext): Promise<Response> {
  await assertRateLimit(context);
  const authentication = authenticationFor(context);
  const url = await authentication.startGitHub();
  const state = url.searchParams.get("state");
  const returnTo = safeReturnPath(context.req.query("returnTo"));

  if (!state) {
    throw new AuthError("provider_error");
  }
  context.header(
    "Set-Cookie",
    serializeSessionCookie(STATE_COOKIE, state, { maxAge: 600, priority: "high" }),
    { append: true },
  );
  context.header(
    "Set-Cookie",
    returnTo
      ? serializeSessionCookie(RETURN_COOKIE, returnTo, { maxAge: 600, priority: "high" })
      : expiredCookie(RETURN_COOKIE),
    { append: true },
  );

  return context.redirect(url.href);
}

async function completeGitHub(context: AppContext): Promise<Response> {
  const url = new URL(context.req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookies = parseCookies(context.req.header("Cookie") ?? "");
  const stateCookie = cookies.get(STATE_COOKIE);
  const returnTo = safeReturnPath(cookies.get(RETURN_COOKIE));

  if (!state || !code || !stateCookie || state !== stateCookie) {
    return failedCallback(context, "invalid_callback");
  }

  try {
    const result = await authenticationFor(context).completeGitHub(code, state);

    if (result.status !== "authenticated") {
      throw new AuthError("unsupported_operation");
    }
    context.header("Set-Cookie", expiredCookie(STATE_COOKIE), { append: true });
    context.header("Set-Cookie", expiredCookie(RETURN_COOKIE), { append: true });
    context.header("Set-Cookie", sessionCookie(result.session.token, result.session.expiresAt), {
      append: true,
    });

    return context.redirect(appDestination(context, returnTo).href);
  } catch (cause) {
    const codeValue = cause instanceof AuthError ? cause.code : "authentication_failed";
    console.error("GitHub OAuth callback failed", { code: codeValue });

    return failedCallback(context, codeValue);
  }
}

async function getSession(context: AppContext): Promise<Response> {
  try {
    const { user } = await requireSession(context);

    return context.json({ user });
  } catch (cause) {
    if (cause instanceof HTTPException && cause.status === 401) {
      return context.json({ user: null });
    }
    throw cause;
  }
}

async function logout(context: AppContext): Promise<Response> {
  const principal = await requireSession(context);
  await authenticationFor(context).logout(principal.token);
  context.header("Set-Cookie", expiredCookie(SESSION_COOKIE));

  return context.json({ ok: true });
}

function authenticationFor(context: AppContext) {
  const origin = canonicalOrigin(context.req.raw, context.env.SITE_ORIGIN);

  return createAuthentication(context.env.DB, context.env, origin);
}

async function assertRateLimit(context: AppContext): Promise<void> {
  const actor = context.req.header("CF-Connecting-IP") ?? "local";
  const result = await context.env.AUTH_RATE_LIMIT.limit({ key: `github:${actor}` });

  if (!result.success) {
    throw new HTTPException(429, { message: "Too many attempts. Try again shortly." });
  }
}

function failedCallback(context: AppContext, error: string): Response {
  const destination = appDestination(context);
  destination.searchParams.set("error", error);
  context.header("Set-Cookie", expiredCookie(STATE_COOKIE), { append: true });
  context.header("Set-Cookie", expiredCookie(RETURN_COOKIE), { append: true });

  return context.redirect(destination.href);
}

function appDestination(context: AppContext, returnTo?: string): URL {
  return new URL(
    safeReturnPath(returnTo) ?? "/dashboard",
    canonicalOrigin(context.req.raw, context.env.SITE_ORIGIN),
  );
}

function sessionCookie(token: string, expiresAt: Date): string {
  return serializeSessionCookie(SESSION_COOKIE, token, {
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    priority: "high",
  });
}

function expiredCookie(name: string): string {
  return serializeExpiredCookie(name, { path: "/", httpOnly: true, sameSite: "lax", secure: true });
}

export { authRoutes };
