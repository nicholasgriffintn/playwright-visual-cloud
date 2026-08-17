import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import type { Env } from "../types";
import { canonicalOrigin } from "./security";

export const protectBrowserMutations: MiddlewareHandler<{ Bindings: Env }> = async (
  context,
  next,
) => {
  if (context.req.method !== "GET" && context.req.method !== "HEAD") {
    const origin = canonicalOrigin(context.req.raw, context.env.SITE_ORIGIN);

    if (context.req.header("Origin") !== origin) {
      throw new HTTPException(403, { message: "Request origin is not allowed" });
    }
  }

  await next();
};
