import { useEffect, useRef, useState } from 'react';

type Location = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  heartbeatAt?: string | null;
};

declare global {
  interface Window {
    google?: any;
    __blmGoogleMapsPromise?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__blmGoogleMapsPromise) return window.__blmGoogleMapsPromise;
  window.__blmGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'));
    document.head.appendChild(script);
  });
  return window.__blmGoogleMapsPromise;
}

export default function LiveTrackingMap({ location }: { location: Location }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [error, setError] = useState('');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let active = true;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!active || !containerRef.current || !window.google?.maps) return;
        const position = { lat: location.latitude, lng: location.longitude };
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(containerRef.current, {
            center: position,
            zoom: 15,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          });
          markerRef.current = new window.google.maps.Marker({
            map: mapRef.current,
            position,
            title: 'BLM vehicle location',
          });
        } else {
          mapRef.current.panTo(position);
          markerRef.current?.setPosition(position);
        }
      })
      .catch((loadError) => setError(loadError.message));
    return () => { active = false; };
  }, [apiKey, location.latitude, location.longitude]);

  if (!apiKey) {
    return <p className="rounded-lg border border-outline bg-surface-container p-4 text-xs font-semibold text-on-surface-variant">Live coordinates are available, but the map provider is not configured.</p>;
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-lg border border-outline bg-surface-container" aria-label="Live vehicle location map" />
      {error && <p role="alert" className="text-xs font-semibold text-error">{error}</p>}
      {location.heartbeatAt && <p className="text-[11px] font-medium text-on-surface-variant">Last location update: {new Date(location.heartbeatAt).toLocaleString()}</p>}
    </div>
  );
}

