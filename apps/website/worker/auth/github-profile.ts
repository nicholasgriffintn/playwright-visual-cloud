import { AuthError, isRecord, type ExternalIdentity } from "@ngriffin_uk/auth-core";
import type { OAuthTokenSet } from "@ngriffin_uk/auth-oauth2";
import { readResponseText, requestWithTimeout } from "@ngriffin_uk/auth-request";

export async function resolveGitHubIdentity(tokens: OAuthTokenSet): Promise<ExternalIdentity> {
  const profile = await githubJson("https://api.github.com/user", tokens.accessToken);

  if (!isRecord(profile)) {
    throw new AuthError("provider_error");
  }
  const subject = identifier(profile.id);
  const email = await verifiedEmail(profile, tokens.accessToken);

  return {
    provider: "github",
    providerSubject: subject,
    email,
    emailVerified: true,
    claims: {
      id: subject,
      login: text(profile.login),
      name: text(profile.name),
      avatar_url: text(profile.avatar_url),
    },
  };
}

async function verifiedEmail(
  profile: Readonly<Record<string, unknown>>,
  accessToken: string,
): Promise<string> {
  const publicEmail = text(profile.email);

  const value = await githubJson("https://api.github.com/user/emails", accessToken);

  if (!Array.isArray(value)) {
    throw new AuthError("provider_error");
  }
  const emails = value.filter(isRecord);
  const selected =
    emails.find((entry) => isVerifiedEmail(entry) && text(entry.email) === publicEmail) ??
    emails.find(isPrimaryVerifiedEmail) ??
    emails.find(isVerifiedEmail);
  const email = selected ? text(selected.email) : undefined;

  if (!email) {
    throw new AuthError("provider_error", "A verified GitHub email is required.");
  }

  return email;
}

async function githubJson(url: string, accessToken: string): Promise<unknown> {
  const response = await requestWithTimeout(
    fetch,
    url,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "playwright-visual-cloud",
      },
      redirect: "manual",
    },
    8_000,
  );

  if (!response.ok) {
    throw new AuthError("provider_error");
  }

  return JSON.parse(await readResponseText(response, 64 * 1024));
}

function identifier(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }

  if (typeof value === "string" && value.length > 0 && value.length <= 256) {
    return value;
  }
  throw new AuthError("provider_error");
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 2048
    ? value.trim()
    : undefined;
}

function isVerifiedEmail(value: Readonly<Record<string, unknown>>): boolean {
  return value.verified === true && Boolean(text(value.email));
}

function isPrimaryVerifiedEmail(value: Readonly<Record<string, unknown>>): boolean {
  return value.primary === true && isVerifiedEmail(value);
}
