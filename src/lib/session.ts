import { createHmac, timingSafeEqual } from "node:crypto";

import type { UserRole } from "@/lib/users";

export const SESSION_COOKIE_NAME = "mossc_session";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type SessionPayload = {
  sub: string;   // user ID
  role: UserRole;
  iat: number;   // issued-at
  exp: number;   // expiry
};

const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

const base64url = (input: string): string =>
  Buffer.from(input).toString("base64url");

const fromBase64url = (input: string): string =>
  Buffer.from(input, "base64url").toString("utf8");

export const createSessionToken = (userId: string, role: UserRole): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: userId,
    role,
    iat: now,
    exp: now + SESSION_EXPIRY_SECONDS,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const secret = getSecret();
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
};

export type SessionData = {
  userId: string;
  role: UserRole;
};

export const verifySessionToken = (token: string): SessionData | null => {
  if (!token) return null;
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const encodedPayload = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);

  const secret = getSecret();
  const expectedSig = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  // Timing-safe comparison
  try {
    const sigBuf = Buffer.from(signature, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromBase64url(encodedPayload)) as SessionPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || !payload.role || typeof payload.exp !== "number") return null;
  if (payload.exp < now) return null;

  return { userId: payload.sub, role: payload.role };
};
