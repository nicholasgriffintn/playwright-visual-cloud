#!/usr/bin/env node
import { BuildRecord, VisualCloudClient } from "./client";

const HELP = `playwright-visual-cloud (pvc)

Usage:
  pvc status [buildId] [--json]
                           Show snapshot results for the token's latest build.
                           Exits 1 if there are unapproved changes.
  pvc builds               List recent builds for the token's project.
                           Use --limit=<n> to control the result count.

Environment:
  PVC_SERVER_URL   Worker URL (required)
  PVC_TOKEN        Project-scoped CI token (required)
`;

function parseArgs(): {
  cmd: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const [cmd, ...rest] = process.argv.slice(2);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];

    if (!item.startsWith("-")) {
      positional.push(item);
      continue;
    }

    if (item === "--json") {
      flags.json = true;
      continue;
    }

    if (item.includes("=")) {
      const [key, value] = item.split("=", 2);
      flags[key] = value;
      continue;
    }

    const next = rest[index + 1];

    if (next !== undefined && !next.startsWith("-")) {
      index += 1;
      flags[item] = next;
      continue;
    }

    flags[item] = true;
  }

  return { cmd, positional, flags };
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatBuild(build: BuildRecord): string {
  return `${build.id}  ${String(build.branch || "").padEnd(20)} ${String(build.commit_sha || "").slice(0, 8)}  ${String(
    build.review_status,
  )}  ${build.created_at || ""}`;
}

function parseLimit(value: unknown, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const next = Number(value);

  if (!Number.isInteger(next) || next <= 0 || next > 200) {
    throw new Error(`--limit must be an integer between 1 and 200`);
  }

  return next;
}

async function main() {
  const { cmd, positional, flags } = parseArgs();

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);

    return;
  }

  const client = new VisualCloudClient();

  if (cmd === "builds") {
    const limit = parseLimit(flags["--limit"], 100);
    const builds = await client.listBuilds(limit);

    if (flags.json) {
      console.log(json({ builds }));

      return;
    }

    if (!builds.length) {
      console.log("No builds found.");

      return;
    }
    for (const build of builds) {
      console.log(formatBuild(build));
    }

    return;
  }

  if (cmd === "status") {
    const buildId = positional[0] ?? (await client.getLatestBuild())?.id;

    if (!buildId) {
      if (flags.json) {
        console.log(json({ error: "no builds found" }));
      } else {
        console.log("No builds found.");
      }
      process.exit(1);

      return;
    }

    const { build, snapshots } = await client.getBuild(buildId);
    const failed = snapshots.filter((s) => s.status === "failed");
    const fresh = snapshots.filter((s) => s.status === "new");
    const ok = snapshots.filter((s) => s.status === "passed" || s.status === "approved");

    if (flags.json) {
      console.log(
        json({
          build,
          summary: {
            matched: ok.length,
            changed: failed.length,
            new: fresh.length,
            review_status: build.review_status,
          },
          changes: snapshots.map((s) => ({
            id: s.id,
            name: s.name,
            variant: s.variant,
            status: s.status,
            diff_pixels: s.diff_pixels,
            diff_ratio: s.diff_ratio,
          })),
        }),
      );
    } else {
      console.log(
        `build ${build.id} (${build.branch} @ ${(build.commit_sha || "").slice(0, 8)}) — ${build.review_status}`,
      );
      console.log(`  matched:  ${ok.length}`);
      console.log(`  changed:  ${failed.length}`);
      console.log(`  new:      ${fresh.length}`);
      for (const s of [...failed, ...fresh]) {
        console.log(`    ${s.status.padEnd(7)} ${s.name} [${s.variant}]`);
      }
    }

    if (failed.length + fresh.length > 0 && build.review_status !== "approved") {
      if (!flags.json) {
        console.log(`\nreview: ${client.config.serverUrl}/builds/${encodeURIComponent(build.id)}`);
      }
      process.exit(1);
    }

    return;
  }

  console.error(`unknown command: ${cmd}\n`);
  console.log(HELP);
  process.exit(2);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
