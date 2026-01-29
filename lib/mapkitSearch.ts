/**
 * MapKit JS location search
 * Uses Apple's MapKit JS library for geocoding
 */

export interface GeocodingResult {
  id: string;
  name: string;
  fullAddress: string;
  lat: number;
  lng: number;
  category?: string;
}

// Track MapKit initialization state
let mapkitPromise: Promise<typeof mapkit> | null = null;
let isInitialized = false;

/**
 * Load and initialize MapKit JS
 */
async function getMapKit(): Promise<typeof mapkit> {
  if (isInitialized && window.mapkit) {
    return window.mapkit;
  }

  if (mapkitPromise) {
    return mapkitPromise;
  }

  mapkitPromise = new Promise(async (resolve, reject) => {
    try {
      // Load MapKit JS script if not already loaded
      if (!document.querySelector('script[src*="mapkit"]')) {
        const script = document.createElement("script");
        script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
        script.crossOrigin = "anonymous";

        await new Promise<void>((res, rej) => {
          script.onload = () => res();
          script.onerror = () => rej(new Error("Failed to load MapKit JS"));
          document.head.appendChild(script);
        });
      }

      // Wait for mapkit to be available
      while (!window.mapkit) {
        await new Promise((r) => setTimeout(r, 50));
      }

      // Get token from our API
      const tokenResponse = await fetch("/api/mapkit-token");
      if (!tokenResponse.ok) {
        throw new Error("Failed to get MapKit token");
      }
      const { token } = await tokenResponse.json();

      // Initialize MapKit
      window.mapkit.init({
        authorizationCallback: (done: (token: string) => void) => {
          done(token);
        },
      });

      isInitialized = true;
      resolve(window.mapkit);
    } catch (error) {
      mapkitPromise = null;
      reject(error);
    }
  });

  return mapkitPromise;
}

/**
 * Search for locations using MapKit JS
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

  try {
    const mk = await getMapKit();
    const search = new mk.Search();

    const searchOptions: mapkit.SearchOptions = {
      language: "en",
    };

    if (options?.proximity) {
      searchOptions.coordinate = new mk.Coordinate(
        options.proximity.lat,
        options.proximity.lng
      );
    }

    return new Promise((resolve) => {
      search.search(query, (error, data) => {
        if (error || !data?.places) {
          console.error("MapKit search error:", error);
          resolve([]);
          return;
        }

        console.log("MapKit search returned", data.places.length, "results for:", query);

        const limit = options?.limit ?? 5;
        const results = data.places.slice(0, limit).map((place, index) => ({
          id: `mapkit-${index}-${place.coordinate.latitude}-${place.coordinate.longitude}`,
          name: place.name || place.formattedAddress?.split(",")[0] || "Unknown",
          fullAddress: place.formattedAddress || place.name || "Unknown location",
          lat: place.coordinate.latitude,
          lng: place.coordinate.longitude,
        }));

        resolve(results);
      }, searchOptions);
    });
  } catch (error) {
    console.error("MapKit search error:", error);
    return [];
  }
}

/**
 * Search for POIs using Apple Maps Server API (via our backend)
 */
export async function searchPOIsServerAPI(
  query: string,
  center: { lat: number; lng: number }
): Promise<GeocodingResult[]> {
  try {
    const response = await fetch(
      `/api/apple-maps-search?q=${encodeURIComponent(query)}&lat=${center.lat}&lng=${center.lng}`
    );

    if (!response.ok) {
      console.error("Server API search failed:", response.status);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Server API search error:", error);
    return [];
  }
}

/**
 * Search for multiple POI categories near a location
 */
export async function searchNearbyPOIs(
  center: { lat: number; lng: number },
  options?: { limit?: number }
): Promise<GeocodingResult[]> {
  const limit = options?.limit ?? 30;

  // Search for various POI types in parallel
  const queries = [
    "attractions landmarks",
    "restaurants cafes",
    "parks",
    "museums",
    "shops stores",
  ];

  const results = await Promise.all(
    queries.map((q) => searchPOIsServerAPI(q, center))
  );

  // Flatten and dedupe
  const allResults: GeocodingResult[] = [];
  const seen = new Set<string>();

  for (const queryResults of results) {
    for (const poi of queryResults) {
      const key = `${poi.name.toLowerCase()}-${poi.lat.toFixed(4)}-${poi.lng.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        allResults.push(poi);
      }
    }
  }

  // Sort by distance from center
  allResults.sort((a, b) => {
    const distA = Math.sqrt(Math.pow(a.lat - center.lat, 2) + Math.pow(a.lng - center.lng, 2));
    const distB = Math.sqrt(Math.pow(b.lat - center.lat, 2) + Math.pow(b.lng - center.lng, 2));
    return distA - distB;
  });

  return allResults.slice(0, limit);
}

/**
 * Search for points of interest near a location using PointsOfInterestSearch API
 * @deprecated Use searchNearbyPOIs instead (uses Server API)
 */
export async function searchPOIsNearby(
  center: { lat: number; lng: number },
  options?: {
    radius?: number; // in meters, default 500
    limit?: number;
  }
): Promise<GeocodingResult[]> {
  try {
    const mk = await getMapKit();
    const limit = options?.limit ?? 30;
    const radius = options?.radius ?? 500;

    const coordinate = new mk.Coordinate(center.lat, center.lng);

    // Categories useful for scavenger hunts - landmarks, attractions, public places
    const categories = [
      mk.PointOfInterestCategory.Landmark,
      mk.PointOfInterestCategory.Museum,
      mk.PointOfInterestCategory.Park,
      mk.PointOfInterestCategory.NationalPark,
      mk.PointOfInterestCategory.Beach,
      mk.PointOfInterestCategory.Marina,
      mk.PointOfInterestCategory.Stadium,
      mk.PointOfInterestCategory.Theater,
      mk.PointOfInterestCategory.Zoo,
      mk.PointOfInterestCategory.Aquarium,
      mk.PointOfInterestCategory.AmusementPark,
      mk.PointOfInterestCategory.Library,
      mk.PointOfInterestCategory.School,
      mk.PointOfInterestCategory.University,
      mk.PointOfInterestCategory.PublicTransport,
      mk.PointOfInterestCategory.Restaurant,
      mk.PointOfInterestCategory.Cafe,
      mk.PointOfInterestCategory.Bakery,
      mk.PointOfInterestCategory.Brewery,
      mk.PointOfInterestCategory.Winery,
      mk.PointOfInterestCategory.Nightlife,
      mk.PointOfInterestCategory.Store,
      mk.PointOfInterestCategory.FoodMarket,
    ];

    const filter = mk.PointOfInterestFilter.including(categories);

    console.log("POI search center:", center, "radius:", radius);

    const poiSearch = new mk.PointsOfInterestSearch({
      center: coordinate,
      radius: radius,
      pointOfInterestFilter: filter,
    });

    return new Promise((resolve) => {
      poiSearch.search((error, data) => {
        if (error) {
          console.error("PointsOfInterestSearch error:", error);
          // Fall back to text search if POI search fails
          resolve(searchPOIsNearbyFallback(center, options));
          return;
        }

        if (!data?.places || data.places.length === 0) {
          console.log("No POIs found, trying fallback search");
          resolve(searchPOIsNearbyFallback(center, options));
          return;
        }

        console.log("PointsOfInterestSearch returned:", data.places.length, "places");

        const results = data.places.slice(0, limit).map((place, index) => ({
          id: `poi-${index}-${place.coordinate.latitude.toFixed(6)}-${place.coordinate.longitude.toFixed(6)}`,
          name: place.name || "Unknown place",
          fullAddress: place.formattedAddress || place.name || "Unknown location",
          lat: place.coordinate.latitude,
          lng: place.coordinate.longitude,
          category: place.pointOfInterestCategory || undefined,
        }));

        // Sort by distance from center
        results.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.lat - center.lat, 2) + Math.pow(a.lng - center.lng, 2));
          const distB = Math.sqrt(Math.pow(b.lat - center.lat, 2) + Math.pow(b.lng - center.lng, 2));
          return distA - distB;
        });

        resolve(results);
      });
    });
  } catch (error) {
    console.error("MapKit POI search error:", error);
    return searchPOIsNearbyFallback(center, options);
  }
}

/**
 * Fallback: Search for POIs using text-based Search API
 */
async function searchPOIsNearbyFallback(
  center: { lat: number; lng: number },
  options?: {
    radius?: number;
    limit?: number;
  }
): Promise<GeocodingResult[]> {
  try {
    const mk = await getMapKit();
    const limit = options?.limit ?? 30;
    const radius = options?.radius ?? 500;

    const coordinate = new mk.Coordinate(center.lat, center.lng);
    const span = new mk.CoordinateSpan(
      radius / 111000 * 2,
      radius / (111000 * Math.cos(center.lat * Math.PI / 180)) * 2
    );
    const region = new mk.CoordinateRegion(coordinate, span);

    const poiQueries = [
      "landmark monument",
      "attractions",
      "museum",
      "park",
      "cafe restaurant",
    ];

    const allResults: GeocodingResult[] = [];

    const searchPromises = poiQueries.map((query) => {
      const search = new mk.Search();
      return new Promise<GeocodingResult[]>((resolve) => {
        search.search(query, (error, data) => {
          if (error || !data?.places) {
            resolve([]);
            return;
          }
          const places = data.places.map((place, index) => ({
            id: `poi-fallback-${query.replace(/\s+/g, "-")}-${index}-${place.coordinate.latitude.toFixed(6)}`,
            name: place.name || "Unknown place",
            fullAddress: place.formattedAddress || place.name || "Unknown location",
            lat: place.coordinate.latitude,
            lng: place.coordinate.longitude,
            category: query.split(" ")[0],
          }));
          resolve(places);
        }, { coordinate, region });
      });
    });

    const resultsArrays = await Promise.all(searchPromises);
    for (const results of resultsArrays) {
      allResults.push(...results);
    }

    // Dedupe
    const seen = new Set<string>();
    const deduped = allResults.filter((poi) => {
      const key = `${poi.name.toLowerCase()}-${poi.lat.toFixed(4)}-${poi.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    deduped.sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.lat - center.lat, 2) + Math.pow(a.lng - center.lng, 2));
      const distB = Math.sqrt(Math.pow(b.lat - center.lat, 2) + Math.pow(b.lng - center.lng, 2));
      return distA - distB;
    });

    return deduped.slice(0, limit);
  } catch (error) {
    console.error("Fallback POI search error:", error);
    return [];
  }
}

/**
 * Reset for testing
 */
export function resetTokenCache() {
  isInitialized = false;
  mapkitPromise = null;
}

// Type declarations for MapKit JS
declare global {
  interface Window {
    mapkit: typeof mapkit;
  }

  namespace mapkit {
    function init(options: {
      authorizationCallback: (done: (token: string) => void) => void;
    }): void;

    class Coordinate {
      constructor(latitude: number, longitude: number);
      latitude: number;
      longitude: number;
    }

    class CoordinateSpan {
      constructor(latitudeDelta: number, longitudeDelta: number);
      latitudeDelta: number;
      longitudeDelta: number;
    }

    class CoordinateRegion {
      constructor(center: Coordinate, span: CoordinateSpan);
      center: Coordinate;
      span: CoordinateSpan;
    }

    // Map class for rendering
    class Map {
      constructor(container: HTMLElement, options?: MapConstructorOptions);
      _impl: { zoomLevel: number };
      center: Coordinate;
      selectableMapFeatures: string[];
      destroy(): void;
      addAnnotation(annotation: Annotation): void;
      removeAnnotation(annotation: Annotation): void;
      setCenterAnimated(coordinate: Coordinate, animate: boolean): void;
      setRegionAnimated(region: CoordinateRegion, animate: boolean): void;
      addEventListener(type: string, handler: (event: MapEvent) => void): void;
      removeEventListener(type: string, handler: (event: MapEvent) => void): void;
    }

    interface MapEvent {
      annotation?: Annotation;
      feature?: {
        coordinate: Coordinate;
        name?: string;
        formattedAddress?: string;
        pointOfInterestCategory?: string;
      };
      pointOfInterest?: {
        coordinate: Coordinate;
        name: string;
        formattedAddress?: string;
      };
    }

    interface MapConstructorOptions {
      center?: Coordinate;
      showsCompass?: FeatureVisibility;
      showsZoomControl?: boolean;
      showsMapTypeControl?: boolean;
      showsPointsOfInterest?: boolean;
      pointOfInterestFilter?: PointOfInterestFilter;
    }

    const FeatureVisibility: {
      Hidden: FeatureVisibility;
      Visible: FeatureVisibility;
      Adaptive: FeatureVisibility;
    };

    type FeatureVisibility = symbol;

    // Annotations
    class MarkerAnnotation {
      constructor(coordinate: Coordinate, options?: MarkerAnnotationOptions);
      coordinate: Coordinate;
      color: string;
      data?: unknown;
    }

    interface MarkerAnnotationOptions {
      color?: string;
      glyphText?: string;
      title?: string;
      subtitle?: string;
      data?: unknown;
    }

    interface Annotation {
      coordinate: Coordinate;
      color: string;
      data?: unknown;
    }

    interface POISelectEvent {
      pointOfInterest: {
        coordinate: Coordinate;
        name: string;
        formattedAddress: string;
      } | null;
    }

    interface MapFeatureSelectEvent {
      feature?: {
        coordinate: Coordinate;
        name?: string;
        formattedAddress?: string;
        pointOfInterestCategory?: string;
      };
    }

    const MapFeatureType: {
      PointOfInterest: string;
    };

    interface BoundingRegion {
      toCoordinateRegion(): CoordinateRegion;
    }

    const BoundingRegion: {
      fromCoordinates(coordinates: Coordinate[]): BoundingRegion;
    };

    // Search
    class Search {
      search(
        query: string,
        callback: (error: Error | null, data: SearchResponse | null) => void,
        options?: SearchOptions
      ): void;
    }

    interface SearchOptions {
      language?: string;
      coordinate?: Coordinate;
      region?: CoordinateRegion;
    }

    interface SearchResponse {
      places: Place[];
    }

    interface Place {
      name: string;
      formattedAddress: string;
      coordinate: Coordinate;
      pointOfInterestCategory?: string;
    }

    // Points of Interest Search
    class PointsOfInterestSearch {
      constructor(options: {
        center: Coordinate;
        radius: number;
        pointOfInterestFilter?: PointOfInterestFilter;
      });
      search(
        callback: (error: Error | null, data: SearchResponse | null) => void
      ): void;
    }

    class PointOfInterestFilter {
      static including(categories: PointOfInterestCategory[]): PointOfInterestFilter;
      static excluding(categories: PointOfInterestCategory[]): PointOfInterestFilter;
    }

    // POI Categories
    const PointOfInterestCategory: {
      Airport: PointOfInterestCategory;
      AmusementPark: PointOfInterestCategory;
      Aquarium: PointOfInterestCategory;
      ATM: PointOfInterestCategory;
      Bakery: PointOfInterestCategory;
      Bank: PointOfInterestCategory;
      Beach: PointOfInterestCategory;
      Brewery: PointOfInterestCategory;
      Cafe: PointOfInterestCategory;
      Campground: PointOfInterestCategory;
      CarRental: PointOfInterestCategory;
      EVCharger: PointOfInterestCategory;
      FireStation: PointOfInterestCategory;
      FitnessCenter: PointOfInterestCategory;
      FoodMarket: PointOfInterestCategory;
      GasStation: PointOfInterestCategory;
      Hospital: PointOfInterestCategory;
      Hotel: PointOfInterestCategory;
      Laundry: PointOfInterestCategory;
      Library: PointOfInterestCategory;
      Landmark: PointOfInterestCategory;
      Marina: PointOfInterestCategory;
      MovieTheater: PointOfInterestCategory;
      Museum: PointOfInterestCategory;
      NationalPark: PointOfInterestCategory;
      Nightlife: PointOfInterestCategory;
      Park: PointOfInterestCategory;
      Parking: PointOfInterestCategory;
      Pharmacy: PointOfInterestCategory;
      Police: PointOfInterestCategory;
      PostOffice: PointOfInterestCategory;
      PublicTransport: PointOfInterestCategory;
      Restaurant: PointOfInterestCategory;
      Restroom: PointOfInterestCategory;
      School: PointOfInterestCategory;
      Stadium: PointOfInterestCategory;
      Store: PointOfInterestCategory;
      Theater: PointOfInterestCategory;
      University: PointOfInterestCategory;
      Winery: PointOfInterestCategory;
      Zoo: PointOfInterestCategory;
    };

    type PointOfInterestCategory = string;
  }
}
