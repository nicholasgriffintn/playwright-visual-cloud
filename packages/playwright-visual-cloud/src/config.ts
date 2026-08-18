import { detectGit } from "./git";

export interface VisualCloudConfig {
  /** Base URL of your deployed worker, e.g. https://pvc.example.workers.dev */
  serverUrl: string;
  /** Project-scoped CI token generated in the Visual Cloud dashboard. */
  token: string;
  /** Named execution lane used to group and filter builds. */
  environment: string;
  /** Current branch. Auto-detected from CI env / git if omitted. */
  branch: string;
  /** Current commit sha. Auto-detected if omitted. */
  commit: string;
  /** Commit message, best-effort. */
  message: string;
  /**
   * What to do when no baseline exists for a snapshot:
   * - "accept": store the screenshot as the new baseline and pass (Playwright-like default)
   * - "pending": record it for review in the UI and pass
   * - "fail": record it and fail the assertion
   */
  onMissingBaseline: "accept" | "pending" | "fail";
  /** Fail the test on visual diffs (default true). Set false for Chromatic-style
   *  "record everything, gate CI on review" via `pvc status`. */
  failOnDiff: boolean;
  /** Idempotency key for the build. Defaults to CI run id or the commit sha. */
  runId: string;
  compare: {
    threshold?: number;
    maxDiffPixels?: number;
    maxDiffPixelRatio?: number;
    includeAA?: boolean;
  };
  ignoreSelectors: string[];
  retryOnDiff: boolean;
}

export type VisualCloudUserConfig = Partial<VisualCloudConfig>;

let cached: VisualCloudConfig | null = null;
let overrides: VisualCloudUserConfig = {};

/** Optionally call once (e.g. in playwright.config.ts) to set options in code. */
export function configureVisualCloud(config: VisualCloudUserConfig): void {
  overrides = { ...overrides, ...config };
  cached = null;
}

function env(name: string): string | undefined {
  const v = process.env[name];

  return v && v.length > 0 ? v : undefined;
}

function parseOnMissing(
  value: string | undefined,
): VisualCloudConfig["onMissingBaseline"] | undefined {
  if (!value) {
    return undefined;
  }

  const normalised = value.trim().toLowerCase();

  if (normalised === "accept" || normalised === "pending" || normalised === "fail") {
    return normalised;
  }

  throw new Error(
    `playwright-visual-cloud: invalid PVC_ON_MISSING=${value}. Use "accept", "pending", or "fail".`,
  );
}

function parseFailOnDiff(
  value: string | boolean | undefined,
  fallback: string | undefined,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const envValue = value ?? fallback;

  if (envValue === undefined) {
    return true;
  }

  const normalised = envValue.trim().toLowerCase();

  if (normalised === "0" || normalised === "false" || normalised === "off" || normalised === "no") {
    return false;
  }

  if (normalised === "1" || normalised === "true" || normalised === "on" || normalised === "yes") {
    return true;
  }

  throw new Error(
    `playwright-visual-cloud: invalid PVC_FAIL_ON_DIFF=${envValue}. Use 0/1, true/false, on/off, or yes/no.`,
  );
}

function parseNumber(
  value: string | undefined,
  label: string,
  min?: number,
  max?: number,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`playwright-visual-cloud: ${label} must be a number.`);
  }

  if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
    const range = max === undefined ? `>= ${min}` : `between ${min} and ${max}`;

    throw new Error(`playwright-visual-cloud: ${label} must be ${range}.`);
  }

  return parsed;
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(",");
}

function parseBoolean(value: string | undefined, label: string): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalised = value.trim().toLowerCase();

  if (normalised === "0" || normalised === "false" || normalised === "off" || normalised === "no") {
    return false;
  }

  if (normalised === "1" || normalised === "true" || normalised === "on" || normalised === "yes") {
    return true;
  }

  throw new Error(`playwright-visual-cloud: invalid ${label}=${value}. Use 0/1 or true/false.`);
}

function parseString(
  value: string | undefined,
  label: string,
  maxLength?: number,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`playwright-visual-cloud: ${label} cannot be empty.`);
  }

  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new Error(`playwright-visual-cloud: ${label} cannot exceed ${maxLength} characters.`);
  }

  return trimmed;
}

export function resolveConfig(): VisualCloudConfig {
  if (cached) {
    return cached;
  }

  const git = detectGit();

  const serverUrl = parseString(overrides.serverUrl ?? env("PVC_SERVER_URL"), "PVC_SERVER_URL");
  const token = parseString(overrides.token ?? env("PVC_TOKEN"), "PVC_TOKEN");
  const environment =
    parseString(overrides.environment ?? env("PVC_ENVIRONMENT"), "PVC_ENVIRONMENT", 80) ??
    "default";

  if (!serverUrl) {
    throw new Error(
      "playwright-visual-cloud: missing server URL. Set PVC_SERVER_URL or call configureVisualCloud({ serverUrl }).",
    );
  }

  if (!token) {
    throw new Error(
      "playwright-visual-cloud: missing API token. Set PVC_TOKEN or call configureVisualCloud({ token }).",
    );
  }

  const branch =
    parseString(
      overrides.branch ??
        env("PVC_BRANCH") ??
        env("GITHUB_HEAD_REF") ??
        env("GITHUB_REF_NAME") ??
        env("CI_COMMIT_REF_NAME") ??
        git.branch,
      "branch",
    ) ?? "unknown";
  const commit =
    parseString(
      overrides.commit ??
        env("PVC_COMMIT") ??
        env("GITHUB_SHA") ??
        env("CI_COMMIT_SHA") ??
        git.commit,
      "commit",
    ) ?? "unknown";
  const githubRunId = parseString(env("GITHUB_RUN_ID"), "GITHUB_RUN_ID");
  const githubRunAttempt = parseString(env("GITHUB_RUN_ATTEMPT"), "GITHUB_RUN_ATTEMPT");

  const sourceRunId =
    parseString(overrides.runId, "PVC_RUN_ID") ??
    parseString(env("PVC_RUN_ID"), "PVC_RUN_ID") ??
    (githubRunId ? `${githubRunId}-${githubRunAttempt ?? "1"}` : undefined) ??
    parseString(env("CI_PIPELINE_ID"), "CI_PIPELINE_ID") ??
    commit;
  const runId = environment === "default" ? sourceRunId : `${environment}:${sourceRunId}`;

  if (runId.length > 200) {
    throw new Error(
      "playwright-visual-cloud: environment and run ID cannot exceed 200 characters.",
    );
  }

  const message =
    parseString(overrides.message, "message") ?? parseString(git.message, "commit message") ?? "";
  const ignoreSelectors = (overrides.ignoreSelectors ?? parseList(env("PVC_IGNORE_SELECTORS"))).map(
    (selector) => selector.trim(),
  ).filter(Boolean);
  const compare = {
    threshold: parseNumber(env("PVC_THRESHOLD"), "PVC_THRESHOLD", 0, 1),
    maxDiffPixels: parseNumber(env("PVC_MAX_DIFF_PIXELS"), "PVC_MAX_DIFF_PIXELS", 0),
    maxDiffPixelRatio: parseNumber(env("PVC_MAX_DIFF_PIXEL_RATIO"), "PVC_MAX_DIFF_PIXEL_RATIO", 0, 1),
    includeAA: parseBoolean(env("PVC_INCLUDE_AA"), "PVC_INCLUDE_AA"),
    ...overrides.compare,
  };
  const onMissingBaseline =
    parseOnMissing(overrides.onMissingBaseline) ??
    parseOnMissing(env("PVC_ON_MISSING")) ??
    "accept";

  cached = {
    serverUrl: serverUrl.replace(/\/+$/, ""),
    token,
    environment,
    branch,
    commit,
    message,
    onMissingBaseline,
    failOnDiff: parseFailOnDiff(overrides.failOnDiff, env("PVC_FAIL_ON_DIFF")),
    runId,
    compare,
    ignoreSelectors,
    retryOnDiff: overrides.retryOnDiff ?? parseBoolean(env("PVC_RETRY_ON_DIFF"), "PVC_RETRY_ON_DIFF") ?? true,
  };

  return cached;
}

export function resetVisualCloudConfig(): void {
  cached = null;
  overrides = {};
}
