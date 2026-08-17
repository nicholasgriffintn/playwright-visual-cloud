import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export interface CompareOptions {
  /** Per-pixel color distance threshold, 0–1. Default 0.2 (matches Playwright). */
  threshold?: number;
  /** Absolute number of differing pixels allowed. */
  maxDiffPixels?: number;
  /** Ratio (0–1) of differing pixels allowed. */
  maxDiffPixelRatio?: number;
}

export interface CompareResult {
  pass: boolean;
  diffPixels: number;
  diffRatio: number;
  width: number;
  height: number;
  /** PNG buffer highlighting differences. Present whenever a comparison ran. */
  diffPng: Buffer;
  sizeMismatch: boolean;
}

/** Pad an image into a (width × height) canvas, transparent fill. */
function padTo(png: PNG, width: number, height: number): PNG {
  if (png.width === width && png.height === height) {
    return png;
  }

  const out = new PNG({ width, height });

  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);

  return out;
}

function safeReadPng(buf: Buffer, label: string): PNG {
  try {
    return PNG.sync.read(buf);
  } catch {
    throw new Error(`compare failed: ${label} is not a valid PNG`);
  }
}

export function comparePngs(
  expectedBuf: Buffer,
  actualBuf: Buffer,
  options: CompareOptions = {},
): CompareResult {
  const expected = safeReadPng(expectedBuf, "expected");
  const actual = safeReadPng(actualBuf, "actual");

  const width = Math.max(expected.width, actual.width);
  const height = Math.max(expected.height, actual.height);
  const sizeMismatch = expected.width !== actual.width || expected.height !== actual.height;

  const a = padTo(expected, width, height);
  const b = padTo(actual, width, height);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: options.threshold ?? 0.2,
    includeAA: false,
  });
  const diffRatio = diffPixels / (width * height);

  let pass: boolean;

  if (sizeMismatch) {
    pass = false;
  } else if (options.maxDiffPixels !== undefined) {
    pass = diffPixels <= options.maxDiffPixels;
  } else if (options.maxDiffPixelRatio !== undefined) {
    pass = diffRatio <= options.maxDiffPixelRatio;
  } else {
    pass = diffPixels === 0;
  }

  return {
    pass,
    diffPixels,
    diffRatio,
    width,
    height,
    diffPng: PNG.sync.write(diff),
    sizeMismatch,
  };
}

export function pngDimensions(buf: Buffer): { width: number; height: number } {
  const png = safeReadPng(buf, "snapshot");

  return { width: png.width, height: png.height };
}
