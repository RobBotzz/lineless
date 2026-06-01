// Geocoding via Nominatim (OpenStreetMap). These calls go DIRECTLY to
// nominatim.openstreetmap.org, not through the /api proxy (that targets our own
// backend) and not through apiFetch (which would attach our Bearer token).
// Nominatim sends CORS headers; the browser Referer satisfies the usage policy
// for this low request volume. Callers must debounce/throttle (~1 req/s).
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export interface GeocodeResult {
  // Display label for the place (used as Location.locationName).
  displayName: string;
  lat: number;
  lng: number;
}

interface NominatimSearchEntry {
  display_name: string;
  lat: string;
  lon: string;
}

interface NominatimReverseEntry {
  display_name?: string;
}

// Address / free text -> candidate coordinates. Returns [] on empty query or error.
export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q === '') return [];

  const params = new URLSearchParams({
    format: 'json',
    q,
    limit: '5',
    addressdetails: '1',
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimSearchEntry[];
    return data.map((entry) => ({
      displayName: entry.display_name,
      lat: Number(entry.lat),
      lng: Number(entry.lon),
    }));
  } catch {
    // Network error or aborted request — treat as no results.
    return [];
  }
}

// Coordinates -> a human-readable address, or null if none/unavailable.
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const params = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lng),
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimReverseEntry;
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
