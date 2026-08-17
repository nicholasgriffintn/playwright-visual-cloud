import type { Reporter, FullResult } from "@playwright/test/reporter";
import { VisualCloudClient } from "./client";

/**
 * Optional reporter. Marks the build finished and prints a summary:
 *
 *   reporter: [["list"], ["playwright-visual-cloud/reporter"]]
 */
export default class VisualCloudReporter implements Reporter {
  printsToStdio() {
    return true;
  }

  async onEnd(_result: FullResult) {
    let client: VisualCloudClient;

    try {
      client = new VisualCloudClient();
    } catch {
      return;
    }

    try {
      // Reporters and matchers execute in separate Playwright processes, so the
      // idempotent external run ID is the shared source of truth for the build.
      const build = await client.ensureBuild();

      await client.finishBuild(build.id);
      const { snapshots } = await client.getBuild(build.id);
      const failed = snapshots.filter((s) => s.status === "failed").length;
      const fresh = snapshots.filter((s) => s.status === "new").length;
      const passed = snapshots.filter(
        (s) => s.status === "passed" || s.status === "approved",
      ).length;

      const url = `${client.config.serverUrl}/builds/${encodeURIComponent(build.id)}`;

      console.log("");
      console.log("  playwright-visual-cloud");
      console.log(`    ${passed} matched, ${failed} changed, ${fresh} new`);

      if (failed > 0 || fresh > 0) {
        console.log(`    review: ${url}`);
      }

      console.log("");
    } catch (err) {
      console.error(`  playwright-visual-cloud: failed to finalize build — ${String(err)}`);
    }
  }
}
