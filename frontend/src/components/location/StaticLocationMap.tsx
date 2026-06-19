import 'leaflet/dist/leaflet.css';

import { MapContainer, Marker, TileLayer } from 'react-leaflet';

import { markerIcon } from './markerIcon';

interface StaticLocationMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
}

// Map for displaying a single fixed point (e.g. a cashier stand). The viewer
// can pan/zoom freely to get their bearings, but the marker itself is fixed —
// not draggable, no search, nothing that changes the point being shown.
export function StaticLocationMap({
  lat,
  lng,
  zoom = 15,
  className = 'h-48 w-full',
}: StaticLocationMapProps) {
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border">
        <MapContainer center={[lat, lng]} className={className} zoom={zoom}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker icon={markerIcon} position={[lat, lng]} />
        </MapContainer>
      </div>
      <a
        className="text-sm font-medium text-accent hover:underline"
        href={mapsUrl}
        rel="noreferrer"
        target="_blank"
      >
        Open in Maps
      </a>
    </div>
  );
}
