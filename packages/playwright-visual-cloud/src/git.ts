import { execSync } from "node:child_process";

export interface GitInfo {
  branch?: string;
  commit?: string;
  message?: string;
}

let cached: GitInfo | null = null;

function run(cmd: string): string | undefined {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout: 3000 })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

export function detectGit(): GitInfo {
  if (cached) {
    return cached;
  }
  cached = {
    branch: run("git rev-parse --abbrev-ref HEAD"),
    commit: run("git rev-parse HEAD"),
    message: run("git log -1 --pretty=%s"),
  };

  if (cached.branch === "HEAD") {
    cached.branch = undefined;
  } // detached (CI)

  return cached;
}
