import { NextRequest, NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";

// Cache access token to avoid regenerating on every request
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

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

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300) {
    return cachedAccessToken.token;
  }

  const teamId = process.env.APPLE_MAPS_TEAM_ID;
  const keyId = process.env.APPLE_MAPS_KEY_ID;
  const privateKey = process.env.APPLE_MAPS_PRIVATE_KEY;

  if (!teamId || !keyId || !privateKey) {
    throw new Error("Apple Maps credentials not configured");
  }

  // Generate JWT for Server API (no origin claim)
  const keyContent = normalizePrivateKey(privateKey);
  const key = await importPKCS8(keyContent, "ES256");

  const jwt = await new SignJWT({})
    .setProtectedHeader({
      alg: "ES256",
      kid: keyId,
      typ: "JWT",
    })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://maps-api.apple.com/v1/token", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.accessToken;

  // Cache the token (expires in ~30 minutes typically)
  cachedAccessToken = {
    token: accessToken,
    expiresAt: now + 1800, // Cache for 30 minutes
  };

  return accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Missing required parameters: lat, lng" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    // Use reverse geocode endpoint
    const reverseGeocodeUrl = new URL("https://maps-api.apple.com/v1/reverseGeocode");
    reverseGeocodeUrl.searchParams.set("loc", `${lat},${lng}`);
    reverseGeocodeUrl.searchParams.set("lang", "en-US");

    const response = await fetch(reverseGeocodeUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Reverse geocode failed:", error);
      return NextResponse.json(
        { error: "Reverse geocode failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract useful location info from the result
    const result = data.results?.[0];
    if (!result) {
      return NextResponse.json({ name: null, locality: null });
    }

    // Apple Maps returns structured address components
    return NextResponse.json({
      name: result.name || null,
      locality: result.locality || result.subLocality || null,
      administrativeArea: result.administrativeArea || null,
      country: result.country || null,
      formattedAddressLines: result.formattedAddressLines || [],
    });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return NextResponse.json(
      { error: "Reverse geocode failed" },
      { status: 500 }
    );
  }
}
