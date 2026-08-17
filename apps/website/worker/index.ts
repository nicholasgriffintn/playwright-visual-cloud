import { Hono } from "hono";
import type { Next } from "hono";
import { HTTPException } from "hono/http-exception";

import { authRoutes } from "./auth/routes";
import { cleanImages } from "./images/maintenance";
import { ciRoutes } from "./runs/ci-routes";
import { reviewRoutes } from "./runs/review-routes";
import { DomainError } from "./shared/domain-error";
import { jsonHeaders, type AppContext } from "./shared/http";
import { ValidationError } from "./shared/validation";
import type { Env } from "./types";
import { projectRoutes, workspaceRoutes } from "./workspaces/routes";

const app = new Hono<{ Bindings: Env }>();

app.use("*", applySecurityHeaders);
app.use("/api/*", applyApiHeaders);
app.get("/health", health);
app.route("/api/auth", authRoutes);
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/review", reviewRoutes);
app.route("/api", ciRoutes);
app.get("*", serveAssets);
app.onError(handleError);

async function applyApiHeaders(context: AppContext, next: Next): Promise<void> {
  await next();
  for (const [name, value] of Object.entries(jsonHeaders())) {
    context.header(name, value);
  }
}

async function applySecurityHeaders(context: AppContext, next: Next): Promise<void> {
  await next();
  context.header(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https://avatars.githubusercontent.com data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  context.header("Cross-Origin-Opener-Policy", "same-origin");
  context.header("Referrer-Policy", "no-referrer");
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
}

function health(context: AppContext): Response | Promise<Response> {
  return context.json({ ok: true });
}

function serveAssets(context: AppContext): Response | Promise<Response> {
  return context.env.ASSETS.fetch(context.req.raw);
}

function handleError(cause: Error, context: AppContext): Response {
  const status =
    cause instanceof HTTPException
      ? cause.status
      : cause instanceof DomainError
        ? cause.status
        : cause instanceof ValidationError
          ? 400
          : 500;

  if (status === 500) {
    console.error("Request failed", { path: context.req.path, cause: String(cause) });
  }
  const message = status === 500 ? "Internal server error" : cause.message;

  return context.json({ error: message }, status);
}

const handler: ExportedHandler<Env> = {
  fetch: app.fetch,
  scheduled: runScheduledMaintenance,
};

function runScheduledMaintenance(
  _controller: ScheduledController,
  env: Env,
  execution: ExecutionContext,
): void {
  execution.waitUntil(cleanImages(env).then(logCleanup));
}

function logCleanup(result: { deleted: number }): void {
  console.log("Image cleanup complete", result);
}

export default handler;
