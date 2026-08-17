import { Hono } from "hono";
import { createImageVault } from "../images/vault";
import { DomainError } from "../shared/domain-error";
import { requireProjectToken, type AppContext } from "../shared/http";
import { buildInput, buildLimit, routeParam, snapshotInput } from "../shared/request-input";
import { imageKey, requiredString } from "../shared/validation";
import type { Env } from "../types";
import { createVisualRuns } from "./visual-runs";

const ciRoutes = new Hono<{ Bindings: Env }>();

ciRoutes.post("/builds", createBuild);
ciRoutes.get("/builds", listBuilds);
ciRoutes.get("/builds/:buildId", getBuild);
ciRoutes.post("/builds/:buildId/finish", finishBuild);
ciRoutes.post("/builds/:buildId/snapshots", recordSnapshot);
ciRoutes.get("/baselines/resolve", getBaseline);
ciRoutes.put("/images/:key", putImage);
ciRoutes.get("/images/:key", getImage);

async function createBuild(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);
  const build = await runs(context).createBuild(project.id, await buildInput(context));

  return context.json(build);
}

async function listBuilds(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);
  const builds = await runs(context).listProjectBuilds(project.id, buildLimit(context));

  return context.json({ builds });
}

async function getBuild(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);

  return context.json(
    await runs(context).getBuildForProject(project.id, routeParam(context, "buildId")),
  );
}

async function finishBuild(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);

  return context.json(await runs(context).finishBuild(project.id, routeParam(context, "buildId")));
}

async function recordSnapshot(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);
  const snapshot = await runs(context).recordSnapshot(
    project.id,
    routeParam(context, "buildId"),
    await snapshotInput(context),
  );

  return context.json(snapshot);
}

async function getBaseline(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);
  const baseline = await runs(context).resolveBaseline(project.id, {
    branch: context.req.query("branch") || project.default_branch,
    defaultBranch: project.default_branch,
    name: requiredString(context.req.query("name"), "name"),
    variant: requiredString(context.req.query("variant"), "variant"),
  });

  if (!baseline) {
    throw new DomainError("No baseline", 404);
  }

  return context.json(baseline);
}

async function putImage(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);
  const key = imageKey(context.req.param("key"), "image key");
  await images(context).put(
    project.id,
    key,
    context.req.header("content-type"),
    await context.req.arrayBuffer(),
  );

  return context.json({ key });
}

async function getImage(context: AppContext): Promise<Response> {
  const { project } = await requireProjectToken(context);

  return imageResponse(
    await images(context).get(project.id, imageKey(context.req.param("key"), "image key")),
  );
}

function runs(context: AppContext) {
  return createVisualRuns(context.env.DB);
}

function images(context: AppContext) {
  return createImageVault(context.env.DB, context.env.IMAGES);
}

function imageResponse(object: R2ObjectBody): Response {
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export { ciRoutes };
