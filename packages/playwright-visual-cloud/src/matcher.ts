import type {
  ElementHandle,
  Page,
  Locator,
  PageScreenshotOptions} from "@playwright/test";
import {
  expect as baseExpect,
  test
} from "@playwright/test";
import { getBuild, getClient } from "./client";
import type { CompareOptions} from "./compare";
import { comparePngs, pngDimensions } from "./compare";

export interface VisualSnapshotOptions extends CompareOptions {
  fullPage?: boolean;
  mask?: Locator[];
  clip?: PageScreenshotOptions["clip"];
  timeout?: number;
  animations?: "disabled" | "allow";
  caret?: "hide" | "initial";
  stylePath?: string | string[];
  variant?: string;
}

function isPage(subject: Page | Locator): subject is Page {
  return typeof (subject as Page).goto === "function";
}

function asPage(subject: Page | Locator): Page {
  return isPage(subject) ? subject : subject.page();
}

function slug(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

  return cleaned || "snapshot";
}

const snapshotCounters = new Map<string, number>();

function nextSnapshotName(rawName: string): string {
  const next = (snapshotCounters.get(rawName) ?? 0) + 1;

  snapshotCounters.set(rawName, next);

  return next === 1 ? rawName : `${rawName} (${next})`;
}

function stylePaths(stylePath?: string | string[]): string[] {
  if (!stylePath) {
    return [];
  }

  return Array.isArray(stylePath) ? [...stylePath] : [stylePath];
}

async function capture(subject: Page | Locator, options: VisualSnapshotOptions): Promise<Buffer> {
  const page = asPage(subject);
  const styleTags: ElementHandle[] = [];
  let cleanup = async () => {};

  if (stylePaths(options.stylePath).length > 0) {
    try {
      for (const stylesheet of stylePaths(options.stylePath)) {
        const handle = await page.addStyleTag({ path: stylesheet });

        if (handle) {
          styleTags.push(handle);
        }
      }

      cleanup = async () => {
        for (const handle of styleTags) {
          try {
            await handle.evaluate((el: Element) => el.remove());
          } catch {}

          await handle.dispose().catch(() => {});
        }
      };
    } catch (err) {
      await cleanup();
      throw err;
    }
  }

  const common = {
    animations: options.animations ?? ("disabled" as const),
    caret: options.caret ?? ("hide" as const),
    mask: options.mask,
    timeout: options.timeout,
    type: "png" as const,
  };

  try {
    if (isPage(subject)) {
      return await subject.screenshot({
        ...common,
        fullPage: options.fullPage ?? false,
        clip: options.clip,
      });
    }

    return await subject.screenshot(common);
  } finally {
    await cleanup();
  }
}

export const toMatchVisualSnapshot = async function (
  this: { isNot: boolean },
  subject: Page | Locator,
  name?: string,
  options: VisualSnapshotOptions = {},
) {
  if (this.isNot) {
    throw new Error("toMatchVisualSnapshot does not support .not");
  }

  const info = test.info();
  const client = getClient();
  const { config } = client;

  const baseName = slug(name ?? info.titlePath.slice(1).join(" - "));
  const snapshotName = nextSnapshotName(baseName);
  const variant = options.variant ?? `${info.project.name || "default"}-${process.platform}`;

  const build = await getBuild();
  const actualPng = await capture(subject, options);
  const { width, height } = pngDimensions(actualPng);

  const baseline = await client.resolveBaseline(snapshotName, variant);

  if (!baseline) {
    const actualKey = await client.uploadImage(actualPng);

    await client.recordSnapshot(build.id, {
      name: snapshotName,
      variant,
      status: "new",
      actualKey,
      width,
      height,
      autoBaseline: config.onMissingBaseline === "accept",
    });
    await info.attach(`${snapshotName} (new)`, { body: actualPng, contentType: "image/png" });

    const reviewUrl = `${config.serverUrl}/builds/${encodeURIComponent(build.id)}`;

    if (config.onMissingBaseline === "fail") {
      return {
        pass: false,
        message: () =>
          `New snapshot "${snapshotName}" has no baseline. Review and approve it: ${reviewUrl}`,
      };
    }

    return {
      pass: true,
      message: () =>
        config.onMissingBaseline === "accept"
          ? `New snapshot "${snapshotName}" accepted as baseline.`
          : `New snapshot "${snapshotName}" recorded, pending review: ${reviewUrl}`,
    };
  }

  const expectedPng = await client.downloadImage(baseline.imageKey);
  const result = comparePngs(expectedPng, actualPng, options);

  if (result.pass) {
    const actualKey = await client.uploadImage(actualPng);

    await client.recordSnapshot(build.id, {
      name: snapshotName,
      variant,
      status: "passed",
      diffPixels: result.diffPixels,
      diffRatio: result.diffRatio,
      expectedKey: baseline.imageKey,
      actualKey,
      width,
      height,
    });

    return { pass: true, message: () => `Snapshot "${snapshotName}" matches baseline.` };
  }

  const [actualKey, diffKey] = await Promise.all([
    client.uploadImage(actualPng),
    client.uploadImage(result.diffPng),
  ]);

  await client.recordSnapshot(build.id, {
    name: snapshotName,
    variant,
    status: "failed",
    diffPixels: result.diffPixels,
    diffRatio: result.diffRatio,
    expectedKey: baseline.imageKey,
    actualKey,
    diffKey,
    width,
    height,
  });

  await info.attach(`${snapshotName}-expected`, { body: expectedPng, contentType: "image/png" });
  await info.attach(`${snapshotName}-actual`, { body: actualPng, contentType: "image/png" });
  await info.attach(`${snapshotName}-diff`, { body: result.diffPng, contentType: "image/png" });

  const reviewUrl = `${config.serverUrl}/builds/${encodeURIComponent(build.id)}`;
  const detail = result.sizeMismatch
    ? `size changed (baseline vs actual dimensions differ)`
    : `${result.diffPixels} pixels differ (${(result.diffRatio * 100).toFixed(3)}%)`;
  const message = () =>
    `Snapshot "${snapshotName}" [${variant}] does not match baseline: ${detail}.\nReview: ${reviewUrl}`;

  if (!config.failOnDiff) {
    return { pass: true, message };
  }

  return { pass: false, message };
};

export const expect = baseExpect.extend({ toMatchVisualSnapshot });
