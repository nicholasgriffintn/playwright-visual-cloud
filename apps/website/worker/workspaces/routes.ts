import { Hono } from "hono";

import { createVisualRuns } from "../runs/visual-runs";
import { protectBrowserMutations } from "../shared/browser-security";
import { requireSession, type AppContext } from "../shared/http";
import {
  inviteInput,
  inviteTokenInput,
  namedTokenInput,
  projectInput,
  routeParam,
  workspaceInput,
} from "../shared/request-input";
import type { Env } from "../types";
import { canonicalOrigin } from "../shared/security";
import { createWorkspaceDirectory } from "./directory";

const workspaceRoutes = new Hono<{ Bindings: Env }>();
const projectRoutes = new Hono<{ Bindings: Env }>();

workspaceRoutes.use("*", protectBrowserMutations);
workspaceRoutes.get("/", listWorkspaces);
workspaceRoutes.post("/", createWorkspace);
workspaceRoutes.get("/:workspaceId/projects", listProjects);
workspaceRoutes.post("/:workspaceId/projects", createProject);
workspaceRoutes.get("/:workspaceId/members", listMembers);
workspaceRoutes.post("/:workspaceId/invites", createInvite);
workspaceRoutes.post("/accept-invite", acceptInvite);

projectRoutes.use("*", protectBrowserMutations);
projectRoutes.get("/:projectId", getProject);
projectRoutes.get("/:projectId/builds", listProjectBuilds);
projectRoutes.post("/:projectId/tokens", createProjectToken);

async function listWorkspaces(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);

  return context.json({ workspaces: await directory(context).listWorkspaces(user.id) });
}

async function createWorkspace(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const input = await workspaceInput(context);

  return context.json(
    { workspace: await directory(context).createWorkspace(user.id, input.name, input.slug) },
    201,
  );
}

async function listProjects(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);

  return context.json({
    projects: await directory(context).listProjects(user.id, routeParam(context, "workspaceId")),
  });
}

async function createProject(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const project = await directory(context).createProject(
    user.id,
    routeParam(context, "workspaceId"),
    await projectInput(context),
  );

  return context.json({ project }, 201);
}

async function listMembers(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);

  return context.json({
    members: await directory(context).listMembers(user.id, routeParam(context, "workspaceId")),
  });
}

async function createInvite(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const token = await directory(context).createInvite(
    user.id,
    routeParam(context, "workspaceId"),
    await inviteInput(context),
  );
  const inviteUrl = `${canonicalOrigin(context.req.raw, context.env.SITE_ORIGIN)}/accept-invite/${encodeURIComponent(token)}`;

  return context.json({ inviteUrl, expiresInDays: 7 }, 201);
}

async function acceptInvite(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const workspaceId = await directory(context).acceptInvite(user, await inviteTokenInput(context));

  return context.json({ workspaceId });
}

async function getProject(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);

  return context.json({
    project: await directory(context).getProject(user.id, routeParam(context, "projectId")),
  });
}

async function listProjectBuilds(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const builds = await createVisualRuns(context.env.DB).listBuilds(
    user.id,
    routeParam(context, "projectId"),
    100,
  );

  return context.json({ builds });
}

async function createProjectToken(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const token = await directory(context).createProjectToken(
    user.id,
    routeParam(context, "projectId"),
    await namedTokenInput(context),
  );

  return context.json({ token }, 201);
}

function directory(context: AppContext) {
  return createWorkspaceDirectory(context.env.DB);
}

export { projectRoutes, workspaceRoutes };
