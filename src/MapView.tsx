import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Restaurant } from "./App";

/**
 * YES THIS MAP WAS VIBE CODED I WAS IN TOO DEEP WITH THE MAPBOX API AT THIS POINT.
 */

// Crunch palette for pin colors
const PIN_COLORS = ["#e75a18", "#e87c17", "#c85637", "#b8401a", "#af9250"];

interface MapViewProps {
  restaurants: Restaurant[];
}

export function MapView({ restaurants }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string | null>(null);

  // Fetch Mapbox token from our API
  useEffect(() => {
    fetch("/api/mapbox-token")
      .then((res) => res.json())
      .then((data) => setToken(data.token))
      .catch(() => {});
  }, []);

  // Initialize map once we have the token
  useEffect(() => {
    if (!token || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-73.99, 40.735], // NYC default
      zoom: 12,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );
  }, [token]);

  // Update markers when restaurants change
  useEffect(() => {
    if (!map.current) return;

    // Clear old markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    // Only restaurants with coordinates
    const geoRestaurants = restaurants.filter((r) => r.geoCode);
    if (geoRestaurants.length === 0) return;

    // Add new markers
    const bounds = new mapboxgl.LngLatBounds();

    geoRestaurants.forEach((r, i) => {
      const { lat, lng } = r.geoCode!;
      const color = PIN_COLORS[i % PIN_COLORS.length];

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div style="font-family: 'DM Sans', sans-serif; padding: 4px;">
          <strong style="font-family: 'Playfair Display', serif;">${r.name}</strong>
          <br/><span style="font-size: 12px; color: #666;">${r.cuisine} &middot; ${r.neighborhood}</span>
          <br/><span style="font-size: 11px; color: #888;">${r.reason}</span>
        </div>`,
      );

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
      bounds.extend([lng, lat]);
    });

    // Fit map to show all pins with padding
    if (geoRestaurants.length > 1) {
      map.current.fitBounds(bounds, { padding: 40, maxZoom: 15 });
    } else {
      map.current.flyTo({
        center: [
          geoRestaurants[0].geoCode!.lng,
          geoRestaurants[0].geoCode!.lat,
        ],
        zoom: 14,
      });
    }
  }, [restaurants]);

  if (!token) return null;

  return (
    <div
      ref={mapContainer}
      className="w-full rounded-lg overflow-hidden border-2 border-crunch-mahogany-700"
      style={{ height: "200px" }}
    />
  );
}
