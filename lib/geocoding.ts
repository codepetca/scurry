/**
 * MapTiler Geocoding API utilities
 */

export interface GeocodingResult {
  id: string;
  name: string;
  fullAddress: string;
  lat: number;
  lng: number;
}

interface MapTilerFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
}

interface MapTilerResponse {
  features: MapTilerFeature[];
}

/**
 * Search for locations using MapTiler Geocoding API
 */
export async function searchLocations(
  query: string,
  options?: {
    limit?: number;
    proximity?: { lat: number; lng: number };
  }
): Promise<GeocodingResult[]> {
  if (!query.trim()) {
    return [];
  }

  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
  if (!apiKey) {
    console.error("NEXT_PUBLIC_MAPTILER_API_KEY is not set");
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    limit: String(options?.limit ?? 5),
  });

  // Add proximity bias if provided
  if (options?.proximity) {
    params.set("proximity", `${options.proximity.lng},${options.proximity.lat}`);
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.maptiler.com/geocoding/${encodedQuery}.json?${params}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    const data: MapTilerResponse = await response.json();

    return data.features.map((feature) => ({
      id: feature.id,
      name: feature.text,
      fullAddress: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
    }));
  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
}
