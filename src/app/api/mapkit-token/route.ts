import { NextRequest, NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";

// Cache token to avoid regenerating on every request
let cachedToken: { token: string; expiresAt: number; origin: string } | null = null;

function normalizePrivateKey(key: string): string {
  let normalized = key.replace(/\\n/g, "\n");

  if (
    normalized.includes("-----BEGIN PRIVATE KEY-----") &&
    normalized.includes("-----END PRIVATE KEY-----")
  ) {
    return normalized;
  }

  normalized = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  return `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
}

export async function GET(request: NextRequest) {
  try {
    const teamId = process.env.APPLE_MAPS_TEAM_ID;
    const keyId = process.env.APPLE_MAPS_KEY_ID;
    const privateKey = process.env.APPLE_MAPS_PRIVATE_KEY;

    if (!teamId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: "Apple Maps credentials not configured" },
        { status: 500 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Get origin from request for MapKit JS (must be just protocol + host, not full URL)
    let origin = request.headers.get("origin");
    if (!origin) {
      const referer = request.headers.get("referer");
      if (referer) {
        try {
          const url = new URL(referer);
          origin = url.origin; // Gets just "http://localhost:3000"
        } catch {
          origin = "*";
        }
      } else {
        origin = "*";
      }
    }

    // Return cached token if still valid (with 5 min buffer) and same origin
    if (cachedToken && cachedToken.expiresAt > now + 300 && cachedToken.origin === origin) {
      return NextResponse.json({ token: cachedToken.token });
    }

    // Token expires in 1 hour
    const expiresAt = now + 3600;
    const keyContent = normalizePrivateKey(privateKey);

    const key = await importPKCS8(keyContent, "ES256");

    const token = await new SignJWT({
      origin, // Required for MapKit JS
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: keyId,
        typ: "JWT",
      })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .sign(key);

    cachedToken = { token, expiresAt, origin };

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Failed to generate MapKit token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
