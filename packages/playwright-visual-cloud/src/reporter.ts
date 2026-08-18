import type { Reporter, FullResult, TestCase, TestResult } from "@playwright/test/reporter";

import { VisualCloudClient } from "./client";

/**
 * Optional reporter. Marks the build finished and prints a summary:
 *
 *   reporter: [["list"], ["playwright-visual-cloud/reporter"]]
 */
export default class VisualCloudReporter implements Reporter {
  private snapshotAttachments = 0;
  private testsRun = 0;

  printsToStdio() {
    return true;
  }

  onTestEnd(_test: TestCase, result: TestResult) {
    this.testsRun += 1;
    this.snapshotAttachments += result.attachments.filter((attachment) =>
      attachment.name.includes("-actual") || attachment.name.endsWith("(new)")
    ).length;
  }

  async onEnd(_result: FullResult) {
    let client: VisualCloudClient;

    try {
      client = new VisualCloudClient();
    } catch {
      return;
    }

    if (this.testsRun === 0) {
      console.log("");
      console.log("  playwright-visual-cloud");
      console.log("    no tests ran, so no snapshots were recorded");
      console.log("");

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

      if (snapshots.length === 0) {
        console.log(
          `    ${this.testsRun} tests ran but recorded no snapshots — check PVC_SERVER_URL and PVC_TOKEN are set`,
        );
      }

      if (failed > 0 || fresh > 0) {
        console.log(`    review: ${url}`);
      }

      console.log("");
    } catch (err) {
      console.error(`  playwright-visual-cloud: failed to finalize build — ${String(err)}`);
    }
  }
}
