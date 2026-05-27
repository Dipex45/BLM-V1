import { useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  useMap, 
  useMapsLibrary
} from '@vis.gl/react-google-maps';

const API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';

const hasValidKey = Boolean(API_KEY);

function RouteVisualizer({ origin, destination }: { origin: string; destination: string }) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;

    // Clear previous polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport']
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const route = routes[0];
        
        const newPolylines = route.createPolylines();
        newPolylines.forEach(p => {
          p.setOptions({
            strokeColor: '#C1121F',
            strokeWeight: 5,
            strokeOpacity: 0.8
          });
          p.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (route.viewport) {
           map.fitBounds(route.viewport);
        }
      }
    }).catch(err => {
      console.error("Routing error:", err);
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [routesLib, map, origin, destination]);

  return null;
}

export default function RouteMap({ pickup, destination, height = "400px" }: { pickup: string; destination: string; height?: string }) {
  if (!hasValidKey) {
    return (
      <div className="w-full bg-surface-container rounded-lg flex flex-col items-center justify-center p-8 text-center border border-dashed border-outline" style={{ height }}>
         <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">map</span>
         <h4 className="text-sm font-bold text-on-surface-variant mb-2">Map unavailable</h4>
         <p className="text-xs text-on-surface-variant opacity-70 max-w-[240px]">Provide VITE_GOOGLE_MAPS_PLATFORM_KEY to enable live Nigerian and cross-border route previews.</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden border border-outline shadow-sm relative" style={{ height }}>
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat: 9.082, lng: 8.6753 }}
          defaultZoom={6}
          mapId="BLM_MOTORS_TAC_MAP"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          <RouteVisualizer origin={pickup} destination={destination} />
        </Map>
      </APIProvider>
      
      <div className="absolute top-4 left-4 p-3 bg-black/80 rounded-md border border-white/20">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-white">Route active</span>
         </div>
      </div>
    </div>
  );
}
