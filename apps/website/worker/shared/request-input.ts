import { HTTPException } from "hono/http-exception";

import type { CreateBuildInput, RecordSnapshotInput } from "../runs/visual-runs";
import type {
  CreateInviteInput,
  CreateProjectInput,
  ProjectSettingsInput,
} from "../workspaces/directory";
import type { AppContext } from "./http";
import {
  imageKey,
  normaliseEmail,
  optionalString,
  parseRole,
  positiveInteger,
  requiredString,
  toSlug,
} from "./validation";

export async function readObject(
  context: AppContext,
  maxBytes = 64 * 1024,
): Promise<Record<string, unknown>> {
  const length = Number(context.req.header("content-length") ?? 0);

  if (length > maxBytes) {
    throw new HTTPException(413, { message: "Request body is too large" });
  }

  try {
    const body: unknown = await context.req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("not an object");
    }

    return body as Record<string, unknown>;
  } catch {
    throw new HTTPException(400, { message: "A JSON object is required" });
  }
}

export async function workspaceInput(context: AppContext): Promise<{ name: string; slug: string }> {
  const body = await readObject(context);
  const name = requiredString(body.name, "name", 80);

  return { name, slug: toSlug(name) };
}

export async function projectInput(context: AppContext): Promise<CreateProjectInput> {
  const body = await readObject(context);
  const name = requiredString(body.name, "name", 80);

  return {
    name,
    slug: toSlug(name),
    defaultBranch: optionalString(body.defaultBranch, "default branch", 120) ?? "main",
    repository: optionalString(body.repository, "repository", 240),
  };
}

export async function inviteInput(context: AppContext): Promise<CreateInviteInput> {
  const body = await readObject(context);

  return {
    email: normaliseEmail(body.email),
    role: body.role === undefined ? "member" : parseRole(body.role),
  };
}

export async function namedTokenInput(context: AppContext): Promise<string> {
  return requiredString((await readObject(context)).name, "name", 80);
}

export async function inviteTokenInput(context: AppContext): Promise<string> {
  return requiredString((await readObject(context)).token, "invite token", 200);
}

export async function buildInput(context: AppContext): Promise<CreateBuildInput> {
  const body = await readObject(context);

  return {
    externalId: requiredString(body.externalId, "externalId", 200),
    environment: optionalString(body.environment, "environment", 80) ?? "default",
    branch: optionalString(body.branch, "branch", 200) ?? "unknown",
    commitSha: optionalString(body.commitSha, "commitSha", 200) ?? "unknown",
    message: optionalString(body.message, "message", 500) ?? "",
  };
}

export async function snapshotInput(context: AppContext): Promise<RecordSnapshotInput> {
  const body = await readObject(context);
  const status = requiredString(body.status, "status");

  if (status !== "passed" && status !== "failed" && status !== "new") {
    throw new HTTPException(400, { message: "status must be passed, failed, or new" });
  }

  return {
    name: requiredString(body.name, "name", 240),
    variant: requiredString(body.variant, "variant", 200),
    status,
    diffPixels: optionalNumber(body.diffPixels, "diffPixels"),
    diffRatio: optionalNumber(body.diffRatio, "diffRatio"),
    expectedKey: body.expectedKey ? imageKey(body.expectedKey, "expectedKey") : null,
    actualKey: imageKey(body.actualKey, "actualKey"),
    diffKey: body.diffKey ? imageKey(body.diffKey, "diffKey") : null,
    width: positiveInteger(body.width, "width", 0, 100_000),
    height: positiveInteger(body.height, "height", 0, 100_000),
    autoBaseline: body.autoBaseline === true,
    ignoredSelectors: selectorList(body.ignoredSelectors),
  };
}

function selectorList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const selectors = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (selectors.some((selector) => selector.length > 240)) {
    throw new HTTPException(400, { message: "ignoredSelectors entries must be under 240 characters" });
  }

  return selectors.slice(0, 50);
}

export async function projectSettingsInput(context: AppContext): Promise<ProjectSettingsInput> {
  const body = await readObject(context);

  return {
    threshold: boundedNumber(body.threshold, "threshold", 0, 1),
    maxDiffPixels: boundedNumber(body.maxDiffPixels, "maxDiffPixels", 0, 100_000_000),
    maxDiffPixelRatio: boundedNumber(body.maxDiffPixelRatio, "maxDiffPixelRatio", 0, 1),
    includeAA: body.includeAA === true,
    ignoreSelectors: selectorList(body.ignoreSelectors),
  };
}

function boundedNumber(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new HTTPException(400, { message: `${label} must be a number between ${min} and ${max}` });
  }

  return parsed;
}

export function buildLimit(context: AppContext): number {
  return positiveInteger(context.req.query("limit"), "limit", 50, 200);
}

export function buildEnvironment(context: AppContext): string | undefined {
  return optionalString(context.req.query("environment"), "environment", 80) ?? undefined;
}

export function bearerToken(context: AppContext): string {
  const authorization = context.req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Project token required" });
  }

  return requiredString(authorization.slice(7), "project token", 200);
}

export function routeParam(context: AppContext, name: string): string {
  return requiredString(context.req.param(name), name, 200);
}

function optionalNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new HTTPException(400, { message: `${label} must be a non-negative number` });
  }

  return number;
}
