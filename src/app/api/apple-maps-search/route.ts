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
    const query = searchParams.get("q");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!query || !lat || !lng) {
      return NextResponse.json(
        { error: "Missing required parameters: q, lat, lng" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    // Search for POIs
    const searchUrl = new URL("https://maps-api.apple.com/v1/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("searchLocation", `${lat},${lng}`);
    searchUrl.searchParams.set("lang", "en-US");

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error("Search failed:", error);
      return NextResponse.json(
        { error: "Search failed" },
        { status: searchResponse.status }
      );
    }

    const data = await searchResponse.json();

    // Transform results to our format
    const results = (data.results || []).map((result: {
      id: string;
      name: string;
      formattedAddressLines?: string[];
      coordinate: { latitude: number; longitude: number };
      poiCategory?: string;
    }) => ({
      id: result.id || `poi-${result.coordinate.latitude}-${result.coordinate.longitude}`,
      name: result.name,
      fullAddress: result.formattedAddressLines?.join(", ") || result.name,
      lat: result.coordinate.latitude,
      lng: result.coordinate.longitude,
      category: result.poiCategory,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Apple Maps search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
