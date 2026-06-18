import L from 'leaflet';

// Custom brand pin via divIcon — avoids Leaflet's broken default-marker asset
// paths under bundlers and matches the app accent color. Shared by every map
// that needs to drop a pin (editable picker, read-only displays).
export const markerIcon = L.divIcon({
  // `!` defeats Leaflet's .leaflet-div-icon white box/border regardless of CSS order.
  className: 'border-0! bg-transparent!',
  html: `<svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="var(--color-accent)" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="9" r="2.5" fill="white"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});
