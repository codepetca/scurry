#!/usr/bin/env node

/**
 * Test script for Apple Maps Server API
 * Run with: node scripts/test-apple-maps-api.mjs
 */

import { SignJWT, importPKCS8 } from 'jose';
import { readFileSync } from 'fs';

// Load .env.local (handles multiline quoted values)
try {
  const envFile = readFileSync('.env.local', 'utf8');
  const envVars = {};

  // Match KEY="value" including multiline values
  const regex = /^([A-Z_]+)=["']?([\s\S]*?)["']?$/gm;
  let match;

  // Simple line-by-line for single-line values, special handling for multiline
  let currentKey = null;
  let currentValue = '';
  let inQuote = false;

  envFile.split('\n').forEach(line => {
    if (inQuote) {
      // Continue collecting multiline value
      if (line.includes('"') && line.endsWith('"')) {
        currentValue += '\n' + line.slice(0, -1);
        envVars[currentKey] = currentValue;
        inQuote = false;
      } else {
        currentValue += '\n' + line;
      }
    } else {
      const simpleMatch = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (simpleMatch) {
        const key = simpleMatch[1];
        let value = simpleMatch[2];

        // Check if it starts a multiline quoted string
        if (value.startsWith('"') && !value.endsWith('"')) {
          currentKey = key;
          currentValue = value.slice(1); // Remove opening quote
          inQuote = true;
        } else {
          // Single line value
          envVars[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  });

  Object.assign(process.env, envVars);
} catch (e) {
  console.log("Note: Could not load .env.local:", e.message);
}

// Load env vars
const teamId = process.env.APPLE_MAPS_TEAM_ID;
const keyId = process.env.APPLE_MAPS_KEY_ID;
const privateKey = process.env.APPLE_MAPS_PRIVATE_KEY;

console.log("=== Apple Maps Server API Test ===\n");

// Check env vars
console.log("1. Checking environment variables...");
if (!teamId) {
  console.error("   ❌ APPLE_MAPS_TEAM_ID not set");
  process.exit(1);
}
console.log(`   ✓ APPLE_MAPS_TEAM_ID: ${teamId}`);

if (!keyId) {
  console.error("   ❌ APPLE_MAPS_KEY_ID not set");
  process.exit(1);
}
console.log(`   ✓ APPLE_MAPS_KEY_ID: ${keyId}`);

if (!privateKey) {
  console.error("   ❌ APPLE_MAPS_PRIVATE_KEY not set");
  process.exit(1);
}
console.log(`   ✓ APPLE_MAPS_PRIVATE_KEY: ${privateKey.length} chars`);

// Normalize private key
function normalizePrivateKey(key) {
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

async function testAppleMapsAPI() {
  try {
    // Step 2: Generate JWT for Server API (no origin claim)
    console.log("\n2. Generating JWT for Server API...");
    const now = Math.floor(Date.now() / 1000);
    const keyContent = normalizePrivateKey(privateKey);
    const key = await importPKCS8(keyContent, "ES256");

    // Server API JWT - different from MapKit JS JWT (no origin)
    const serverJWT = await new SignJWT({})
      .setProtectedHeader({
        alg: "ES256",
        kid: keyId,
        typ: "JWT",
      })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    console.log(`   ✓ JWT generated (${serverJWT.length} chars)`);
    console.log(`   Preview: ${serverJWT.substring(0, 50)}...`);

    // Step 3: Try to get an access token
    console.log("\n3. Requesting access token from /v1/token...");
    const tokenResponse = await fetch("https://maps-api.apple.com/v1/token", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${serverJWT}`,
      },
    });

    const tokenStatus = tokenResponse.status;
    console.log(`   Status: ${tokenStatus}`);

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      console.log(`   ✓ Access token received!`);
      console.log(`   Token: ${JSON.stringify(tokenData).substring(0, 100)}...`);

      // Step 4: Test search with access token
      console.log("\n4. Testing /v1/search endpoint...");
      const accessToken = tokenData.accessToken;
      const searchResponse = await fetch(
        "https://maps-api.apple.com/v1/search?q=coffee&searchLocation=44.65,-63.57",
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      console.log(`   Status: ${searchResponse.status}`);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log(`   ✓ Search works! Found ${searchData.results?.length || 0} results`);
        if (searchData.results?.[0]) {
          console.log(`   First result: ${searchData.results[0].name}`);
        }
      } else {
        const errorText = await searchResponse.text();
        console.log(`   ❌ Search failed: ${errorText}`);
      }
    } else {
      const errorText = await tokenResponse.text();
      console.log(`   ❌ Token request failed: ${errorText}`);

      // Step 3b: Try direct search with JWT (some APIs allow this)
      console.log("\n3b. Trying direct search with JWT (no token exchange)...");
      const directResponse = await fetch(
        "https://maps-api.apple.com/v1/search?q=coffee&searchLocation=44.65,-63.57",
        {
          headers: {
            "Authorization": `Bearer ${serverJWT}`,
          },
        }
      );

      console.log(`   Status: ${directResponse.status}`);
      if (directResponse.ok) {
        const searchData = await directResponse.json();
        console.log(`   ✓ Direct search works! Found ${searchData.results?.length || 0} results`);
      } else {
        const errorText = await directResponse.text();
        console.log(`   ❌ Direct search failed: ${errorText}`);
      }
    }

    // Step 5: Test with MapKit JS style JWT (with origin)
    console.log("\n5. Testing with MapKit JS style JWT (with origin)...");
    const mapkitJWT = await new SignJWT({ origin: "https://localhost:3000" })
      .setProtectedHeader({
        alg: "ES256",
        kid: keyId,
        typ: "JWT",
      })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const mapkitSearchResponse = await fetch(
      "https://maps-api.apple.com/v1/search?q=coffee&searchLocation=44.65,-63.57",
      {
        headers: {
          "Authorization": `Bearer ${mapkitJWT}`,
        },
      }
    );

    console.log(`   Status: ${mapkitSearchResponse.status}`);
    const mapkitErrorText = await mapkitSearchResponse.text();
    console.log(`   Response: ${mapkitErrorText.substring(0, 200)}`);

    console.log("\n=== Summary ===");
    console.log("If all requests returned 401 'Not Authorized', your key");
    console.log("only has MapKit JS permissions, not Maps Server API.");
    console.log("\nTo enable Maps Server API:");
    console.log("1. Go to developer.apple.com → Certificates, Identifiers & Profiles");
    console.log("2. Check your key's capabilities or create a new key");
    console.log("3. Look for 'Maps Server API' option");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
  }
}

testAppleMapsAPI();
