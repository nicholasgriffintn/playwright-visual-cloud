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
  stabilise?: boolean;
  stabiliseTimeout?: number;
  ignoreSelectors?: string[];
  retryOnDiff?: boolean;
}

const IGNORE_ATTRIBUTE = "data-pvc-ignored";

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

function nextSnapshotName(rawName: string, variant: string): string {
  const key = `${rawName}\u0000${variant}`;
  const next = (snapshotCounters.get(key) ?? 0) + 1;

  snapshotCounters.set(key, next);

  return next === 1 ? rawName : `${rawName} (${next})`;
}

function stylePaths(stylePath?: string | string[]): string[] {
  if (!stylePath) {
    return [];
  }

  return Array.isArray(stylePath) ? [...stylePath] : [stylePath];
}

function mergeCompareOptions(
  defaults: CompareOptions,
  options: VisualSnapshotOptions,
): CompareOptions {
  const merged: CompareOptions = { ...defaults };

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

async function waitForFonts(page: Page): Promise<void> {
  await page
    .evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined))
    .catch(() => { });
}

async function settle(
  page: Page,
  take: () => Promise<Buffer>,
  timeoutMs: number,
): Promise<Buffer> {
  const deadline = Date.now() + timeoutMs;
  let previous = await take();

  while (Date.now() < deadline) {
    await page.waitForTimeout(120);

    const next = await take();

    if (next.equals(previous)) {
      return next;
    }

    previous = next;
  }

  return previous;
}

async function applyIgnoreSelectors(page: Page, selectors: string[]): Promise<() => Promise<void>> {
  if (selectors.length === 0) {
    return async () => { };
  }

  const handle = await page.addStyleTag({
    content: `[${IGNORE_ATTRIBUTE}] { background: #ff00ff !important; color: transparent !important; }
[${IGNORE_ATTRIBUTE}] * { visibility: hidden !important; }`,
  });

  await page.evaluate(
    ([list, attribute]) => {
      for (const selector of list) {
        for (const element of document.querySelectorAll(selector)) {
          element.setAttribute(attribute, "");
        }
      }
    },
    [selectors, IGNORE_ATTRIBUTE] as const,
  );

  return async () => {
    await page
      .evaluate((attribute) => {
        for (const element of document.querySelectorAll(`[${attribute}]`)) {
          element.removeAttribute(attribute);
        }
      }, IGNORE_ATTRIBUTE)
      .catch(() => { });
    await handle.evaluate((el: Element) => el.remove()).catch(() => { });
    await handle.dispose().catch(() => { });
  };
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

  const restoreIgnored = await applyIgnoreSelectors(page, options.ignoreSelectors ?? []);
  const take = () =>
    isPage(subject)
      ? subject.screenshot({ ...common, fullPage: options.fullPage ?? false, clip: options.clip })
      : subject.screenshot(common);

  try {
    const shouldStabilise = options.stabilise ?? isPage(subject);

    if (!shouldStabilise) {
      return await take();
    }

    await waitForFonts(page);

    return await settle(page, take, options.stabiliseTimeout ?? 1500);
  } finally {
    await restoreIgnored();
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
  const variant = options.variant ?? `${info.project.name || "default"}-${process.platform}`;
  const snapshotName = nextSnapshotName(baseName, variant);

  const settings = await client.getProjectSettings();
  const captureOptions: VisualSnapshotOptions = {
    ...options,
    ignoreSelectors: [
      ...settings.ignoreSelectors,
      ...config.ignoreSelectors,
      ...(options.ignoreSelectors ?? []),
    ],
  };

  const build = await getBuild();
  const actualPng = await capture(subject, captureOptions);
  const { width, height } = pngDimensions(actualPng);

  const baseline = await client.resolveBaseline(snapshotName, variant);

  if (!baseline) {
    const actualKey = await client.uploadImage(actualPng);

    await client.recordSnapshot(build.id, {
      name: snapshotName,
      variant,
      status: "new",
      ignoredSelectors: captureOptions.ignoreSelectors,
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
  const compareOptions = mergeCompareOptions(
    mergeCompareOptions(settings.compare, config.compare),
    options,
  );
  let finalPng = actualPng;
  let result = comparePngs(expectedPng, finalPng, compareOptions);

  if (!result.pass && !result.sizeMismatch && (options.retryOnDiff ?? config.retryOnDiff)) {
    const retryPng = await capture(subject, captureOptions);
    const retryResult = comparePngs(expectedPng, retryPng, compareOptions);

    if (retryResult.pass) {
      finalPng = retryPng;
      result = retryResult;
    }
  }

  if (result.pass) {
    const actualKey = await client.uploadImage(finalPng);

    await client.recordSnapshot(build.id, {
      name: snapshotName,
      variant,
      status: "passed",
      ignoredSelectors: captureOptions.ignoreSelectors,
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
    client.uploadImage(finalPng),
    client.uploadImage(result.diffPng),
  ]);

  await client.recordSnapshot(build.id, {
    name: snapshotName,
    variant,
    status: "failed",
    ignoredSelectors: captureOptions.ignoreSelectors,
    diffPixels: result.diffPixels,
    diffRatio: result.diffRatio,
    expectedKey: baseline.imageKey,
    actualKey,
    diffKey,
    width,
    height,
  });

  await info.attach(`${snapshotName}-expected`, { body: expectedPng, contentType: "image/png" });
  await info.attach(`${snapshotName}-actual`, { body: finalPng, contentType: "image/png" });
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
