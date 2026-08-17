import { Hono } from "hono";

import { createImageVault } from "../images/vault";
import { protectBrowserMutations } from "../shared/browser-security";
import { requireSession, type AppContext } from "../shared/http";
import { routeParam } from "../shared/request-input";
import { imageKey } from "../shared/validation";
import type { Env } from "../types";
import { createVisualRuns } from "./visual-runs";

const reviewRoutes = new Hono<{ Bindings: Env }>();

reviewRoutes.use("*", protectBrowserMutations);
reviewRoutes.get("/builds/:buildId", getBuild);
reviewRoutes.post("/builds/:buildId/approve", approveBuild);
reviewRoutes.post("/builds/:buildId/snapshots/:snapshotId/approve", approveSnapshot);
reviewRoutes.get("/builds/:buildId/images/:key", getImage);

async function getBuild(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);

  return context.json(await runs(context).getBuildForUser(user.id, routeParam(context, "buildId")));
}

async function approveBuild(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const approved = await runs(context).approveBuild(user.id, routeParam(context, "buildId"));

  return context.json({ approved });
}

async function approveSnapshot(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const snapshot = await runs(context).approveSnapshot(
    user.id,
    routeParam(context, "buildId"),
    routeParam(context, "snapshotId"),
  );

  return context.json(snapshot);
}

async function getImage(context: AppContext): Promise<Response> {
  const { user } = await requireSession(context);
  const payload = await runs(context).getBuildForUser(user.id, routeParam(context, "buildId"));
  const object = await createImageVault(context.env.DB, context.env.IMAGES).get(
    payload.build.project_id,
    imageKey(context.req.param("key"), "image key"),
  );

  return new Response(object.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function runs(context: AppContext) {
  return createVisualRuns(context.env.DB);
}

export { reviewRoutes };
