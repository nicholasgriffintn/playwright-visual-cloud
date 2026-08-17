import { detectGit } from "./git";

export interface VisualCloudConfig {
  /** Base URL of your deployed worker, e.g. https://pvc.example.workers.dev */
  serverUrl: string;
  /** Project-scoped CI token generated in the Visual Cloud dashboard. */
  token: string;
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

function parseString(value: string | undefined, label: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`playwright-visual-cloud: ${label} cannot be empty.`);
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

  const runId =
    parseString(overrides.runId, "PVC_RUN_ID") ??
    parseString(env("PVC_RUN_ID"), "PVC_RUN_ID") ??
    (githubRunId ? `${githubRunId}-${githubRunAttempt ?? "1"}` : undefined) ??
    parseString(env("CI_PIPELINE_ID"), "CI_PIPELINE_ID") ??
    commit;
  const message =
    parseString(overrides.message, "message") ?? parseString(git.message, "commit message") ?? "";
  const onMissingBaseline =
    parseOnMissing(overrides.onMissingBaseline) ??
    parseOnMissing(env("PVC_ON_MISSING")) ??
    "accept";

  cached = {
    serverUrl: serverUrl.replace(/\/+$/, ""),
    token,
    branch,
    commit,
    message,
    onMissingBaseline,
    failOnDiff: parseFailOnDiff(overrides.failOnDiff, env("PVC_FAIL_ON_DIFF")),
    runId,
  };

  return cached;
}

export function resetVisualCloudConfig(): void {
  cached = null;
  overrides = {};
}
