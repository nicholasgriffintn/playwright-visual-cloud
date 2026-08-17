export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type WorkspaceRole = "owner" | "member";

export function requiredString(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${label} is required`);
  }
  const result = value.trim();

  if (!result) {
    throw new ValidationError(`${label} is required`);
  }

  if (result.length > maxLength) {
    throw new ValidationError(`${label} is too long`);
  }

  return result;
}

export function optionalString(value: unknown, label: string, maxLength = 500): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return requiredString(value, label, maxLength);
}

export function normaliseEmail(value: unknown): string {
  const email = requiredString(value, "email", 254).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new ValidationError("Enter a valid email address");
  }

  return email;
}

export function toSlug(value: unknown): string {
  const name = requiredString(value, "name", 80);
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64);

  if (!slug) {
    throw new ValidationError("name must contain letters or numbers");
  }

  return slug;
}

export function parseRole(value: unknown): WorkspaceRole {
  if (value === "owner" || value === "member") {
    return value;
  }
  throw new ValidationError("role must be owner or member");
}

export function positiveInteger(
  value: unknown,
  label: string,
  fallback: number,
  max: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ValidationError(`${label} must be between 1 and ${max}`);
  }

  return parsed;
}

export function imageKey(value: unknown, label: string): string {
  const key = requiredString(value, label, 64);

  if (!/^[a-f0-9]{64}$/u.test(key)) {
    throw new ValidationError(`${label} must be a SHA-256 image key`);
  }

  return key;
}
