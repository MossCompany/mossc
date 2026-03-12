import { type NextRequest, NextResponse } from "next/server";

import { HEADER_USER_ID, HEADER_USER_ROLE } from "@/lib/user-context";

const SESSION_COOKIE_NAME = "mossc_session";
const encoder = new TextEncoder();

const getSecret = (): string => {
  const secret = process.env.MOSSC_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MOSSC_SECRET environment variable is required in production. " +
          "Set it to a long random string to sign session tokens."
      );
    }
    return "mossc_insecure_dev_secret_CHANGE_ME";
  }
  return secret;
};

/**
 * Decodes a base64url string to UTF-8 (edge-compatible, no Buffer needed).
 */
const decodeBase64url = (input: string): string => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  return atob(padded);
};

/**
 * Converts a base64url string to a Uint8Array<ArrayBuffer> (edge-compatible).
 */
const base64urlToBytes = (input: string): Uint8Array<ArrayBuffer> => {
  const decoded = decodeBase64url(input);
  const buf = new ArrayBuffer(decoded.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
};

type SessionPayload = {
  sub: string;
  role: "admin" | "user";
  exp: number;
};

/**
 * Verifies the session token and extracts payload. Edge-compatible (Web Crypto).
 */
const verifySessionToken = async (
  token: string
): Promise<SessionPayload | null> => {
  if (!token) return null;
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const encodedPayload = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);

  const secret = getSecret();
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = base64urlToBytes(signature);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(encodedPayload)
    );
    if (!valid) return null;

    const payloadJson = decodeBase64url(encodedPayload);
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (!payload.sub || !payload.role || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes without any session check or header injection.
  if (
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/status" ||
    pathname === "/api/auth/setup"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const session = await verifySessionToken(token);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Inject user context headers for downstream API routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HEADER_USER_ID, session.sub);
  requestHeaders.set(HEADER_USER_ROLE, session.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

