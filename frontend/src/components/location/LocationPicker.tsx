import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import { reverseGeocode, searchAddress, type GeocodeResult } from '@/api/geocoding';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import {
  emptyLocation,
  fromLatLng,
  hasCoordinates,
  toLatLng,
  type Location,
} from '@/types/location';

import { markerIcon } from './markerIcon';

// Default view before a point is chosen — centered on Munich (TUM).
const DEFAULT_CENTER: [number, number] = [48.1374, 11.5755];
const DEFAULT_ZOOM = 11;
const POINT_ZOOM = 15;

interface LocationPickerProps {
  value: Location;
  onChange: (next: Location) => void;
  defaultCenter?: [number, number];
}

// Re-centers the map whenever the selected coordinates change (search, manual, clear).
function RecenterOnChange({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat === null || lng === null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), POINT_ZOOM), { duration: 0.5 });
  }, [lat, lng, map]);
  return null;
}

// Drops/moves the pin when the user clicks the map.
function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ value, onChange, defaultCenter }: LocationPickerProps) {
  const position = toLatLng(value);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Manual coordinate fields are kept as text so partial input isn't clobbered.
  // They re-sync when the coordinates change externally (map/search/clear) using
  // the "adjust state during render" pattern instead of an effect.
  const [latText, setLatText] = useState(() => value.yCoordinate?.toString() ?? '');
  const [lngText, setLngText] = useState(() => value.xCoordinate?.toString() ?? '');
  const coordKey = `${value.yCoordinate ?? ''}|${value.xCoordinate ?? ''}`;
  const [syncedKey, setSyncedKey] = useState(coordKey);
  if (coordKey !== syncedKey) {
    setSyncedKey(coordKey);
    setLatText(value.yCoordinate?.toString() ?? '');
    setLngText(value.xCoordinate?.toString() ?? '');
  }

  const reverseAbort = useRef<AbortController | null>(null);

  // Debounced address search (Nominatim usage policy ~1 req/s). All state
  // updates happen inside the timer callback, never synchronously in the effect.
  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (q.length < 3) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const found = await searchAddress(q, ctrl.signal);
        if (!ctrl.signal.aborted) setResults(found);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  // Set a point from the map (click/drag), then reverse-geocode for a name.
  function handlePoint(lat: number, lng: number) {
    onChange(fromLatLng(lat, lng, null));
    reverseAbort.current?.abort();
    const ctrl = new AbortController();
    reverseAbort.current = ctrl;
    void reverseGeocode(lat, lng, ctrl.signal)
      .then((name) => {
        if (!ctrl.signal.aborted && name) onChange(fromLatLng(lat, lng, name));
      })
      .catch(() => {
        // Reverse geocoding only fills the name; the point is already set from the click.
      });
  }

  function selectResult(result: GeocodeResult) {
    onChange(fromLatLng(result.lat, result.lng, result.name));
    setQuery('');
    setResults([]);
  }

  function commitManual() {
    const lat = Number(latText);
    const lng = Number(lngText);
    if (latText.trim() === '' || lngText.trim() === '') return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onChange(fromLatLng(lat, lng, value.locationName));
  }

  function clear() {
    reverseAbort.current?.abort();
    onChange(emptyLocation);
    setQuery('');
    setResults([]);
  }

  const mapsUrl =
    position &&
    `https://www.openstreetmap.org/?mlat=${position[0]}&mlon=${position[1]}#map=16/${position[0]}/${position[1]}`;

  return (
    <div className="space-y-3">
      {/* Address / free-text search */}
      <div className="relative">
        <TextField
          autoComplete="off"
          id="location-search"
          label="Search address or place"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Stephansplatz, Vienna"
          type="text"
          value={query}
        />
        {(results.length > 0 || searching) && (
          <ul className="absolute z-[1002] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface shadow-md">
            {searching && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-text-muted">Searching…</li>
            )}
            {results.map((result, index) => (
              <li key={`${result.lat}-${result.lng}-${index}`}>
                <button
                  className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-surface-muted"
                  onClick={() => selectResult(result)}
                  type="button"
                >
                  {result.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Interactive map */}
      <div className="overflow-hidden rounded-lg border border-border">
        <MapContainer
          center={position ?? defaultCenter ?? DEFAULT_CENTER}
          className="h-64 w-full"
          scrollWheelZoom={false}
          zoom={position ? POINT_ZOOM : DEFAULT_ZOOM}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={handlePoint} />
          <RecenterOnChange lat={value.yCoordinate} lng={value.xCoordinate} />
          {position && (
            <Marker
              draggable
              eventHandlers={{
                dragend(e) {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  handlePoint(lat, lng);
                },
              }}
              icon={markerIcon}
              position={position}
            />
          )}
        </MapContainer>
      </div>

      {/* Manual coordinate entry */}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="location-lat"
          inputMode="decimal"
          label="Latitude"
          onBlur={commitManual}
          onChange={(e) => setLatText(e.target.value)}
          placeholder="48.20861"
          type="text"
          value={latText}
        />
        <TextField
          id="location-lng"
          inputMode="decimal"
          label="Longitude"
          onBlur={commitManual}
          onChange={(e) => setLngText(e.target.value)}
          placeholder="16.37342"
          type="text"
          value={lngText}
        />
      </div>

      {/* Display name shown to attendees/operators */}
      <TextField
        id="location-name"
        label="Display name (optional)"
        maxLength={200}
        onChange={(e) => onChange({ ...value, locationName: e.target.value || null })}
        placeholder="e.g. Main Entrance"
        type="text"
        value={value.locationName ?? ''}
      />

      <div className="flex items-center justify-between">
        {mapsUrl ? (
          <a
            className="text-sm font-medium text-accent hover:underline"
            href={mapsUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open in Maps
          </a>
        ) : (
          <span className="text-xs text-text-muted">
            Search, click the map, or enter coordinates.
          </span>
        )}
        <Button
          disabled={!hasCoordinates(value) && !value.locationName}
          onClick={clear}
          size="sm"
          type="button"
          variant="outline"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
