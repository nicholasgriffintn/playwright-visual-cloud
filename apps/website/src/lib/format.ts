export function shortCommit(value: string): string {
  return value.slice(0, 8) || "unknown";
}

export function formatDate(value: string): string {
  const date = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / 86_400_000),
    "day",
  );
}

export function diffMetric(diffPixels: number | null, diffRatio: number | null): string {
  if (diffPixels === null) {
    return "No pixel difference recorded";
  }

  return `${diffPixels.toLocaleString()} px · ${((diffRatio ?? 0) * 100).toFixed(2)}%`;
}
