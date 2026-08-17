const encoder = new TextEncoder();
const TOKEN_BYTE_LENGTH = 32;

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}

export function randomToken(prefix = ""): string {
  return `${prefix}${encode(crypto.getRandomValues(new Uint8Array(TOKEN_BYTE_LENGTH)))}`;
}

export async function hashToken(token: string): Promise<string> {
  return encode(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export function canonicalOrigin(request: Request, configured?: string): string {
  const origin = new URL(configured?.trim() || request.url);
  const local =
    origin.protocol === "http:" &&
    (origin.hostname === "localhost" || origin.hostname === "127.0.0.1");

  if (
    (!local && origin.protocol !== "https:") ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/"
  ) {
    throw new Error("SITE_ORIGIN must be a secure origin");
  }

  return origin.origin;
}

export function safeReturnPath(value: string | undefined): string | undefined {
  if (
    !value ||
    value.length > 1_024 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return undefined;
  }

  return value;
}
