import { brandPalette } from "@shared/brandPalette";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Map as MapIcon, RotateCcw } from "lucide-react";
import type { FeatureCollection, Point, Polygon } from "geojson";
import type { CircleMarker as LeafletCircleMarker, Layer as LeafletLayer, Map as LeafletMap } from "leaflet";
import type { GeoJSONSource, Map as MapLibreMap, Popup as MapLibrePopup } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { VISIT_PURPOSES } from "@shared/fieldOps";
import { groupVisitsByCity, PURPOSE_COLORS, type CityVisitGroup, type DailyMapVisit } from "./indiaMapData";

const OPENFREEMAP_STYLE_URL = "/api/map-tiles/styles/liberty";
const OPENFREEMAP_VECTOR_URL = "/api/map-tiles/planet/latest/{z}/{x}/{y}.pbf";
const OPENFREEMAP_ATTRIBUTION = '<a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const INDIA_CENTER: [number, number] = [78.9629, 22.5937];
const MAPLIBRE_BAR_SOURCE = "field-visit-bars";
const MAPLIBRE_PIN_SOURCE = "field-visit-pins";
const MAPLIBRE_BAR_LAYER = "field-visit-bars-3d";
const MAPLIBRE_PIN_LAYER = "field-visit-city-pins";

function transformOpenFreeMapRequest(url: string) {
  try {
    const resource = new URL(url, window.location.origin);
    if (resource.protocol === "https:" && resource.hostname === "tiles.openfreemap.org") {
      return { url: `/api/map-tiles${resource.pathname}${resource.search}` };
    }
  } catch {
    // Keep MapLibre's original URL if it is not a valid OpenFreeMap resource.
  }
  return { url };
}

type BarProperties = { cityKey: string; purpose: string; color: string; baseHeight: number; height: number; selected: boolean };
type PinProperties = { cityKey: string; count: number; color: string; selected: boolean };
type Renderer = "maplibre" | "leaflet";
type Props = { visits: DailyMapVisit[]; selectedCityKey: string | null; focusRequest: number; onCitySelect: (cityKey: string) => void; onUnavailable: () => void };
type LeafletVectorStyle = { color?: string; weight?: number; opacity?: number; fillColor?: string; fillOpacity?: number; fill?: boolean; radius?: number; dashArray?: string };
type LeafletVectorStyleResolver = (properties: Record<string, unknown>, zoom: number, geometryDimension: number) => LeafletVectorStyle;
type LeafletVectorGridOptions = { attribution: string; maxNativeZoom: number; rendererFactory: unknown; vectorTileLayerStyles: Record<string, LeafletVectorStyle | LeafletVectorStyleResolver> };
type LeafletModule = typeof import("leaflet");
type LeafletWithVectorGrid = LeafletModule & { vectorGrid: { protobuf: (url: string, options: LeafletVectorGridOptions) => LeafletLayer }; canvas: LeafletModule["canvas"] & { tile: unknown } };

function formatVisitTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(date);
}

function popupContent(city: CityVisitGroup) {
  const root = document.createElement("div");
  root.className = "india-map-popup";
  const title = document.createElement("strong");
  title.className = "india-map-popup-title";
  title.textContent = `${city.name} · ${city.count} ${city.count === 1 ? "visit" : "visits"}`;
  root.append(title);

  for (const visit of city.visits) {
    const card = document.createElement("article");
    card.className = "india-map-popup-visit";
    const person = document.createElement("strong");
    person.textContent = visit.employeeName;
    const customer = document.createElement("span");
    customer.textContent = visit.customerName;
    const details = document.createElement("span");
    details.textContent = `${visit.purpose} · ${visit.outcome}`;
    const time = document.createElement("small");
    time.textContent = formatVisitTime(visit.createdAt);
    card.append(person, customer, details, time);
    root.append(card);
  }
  return root;
}

function cityBounds(cities: CityVisitGroup[]) {
  const points = cities.flatMap(city => city.coordinates ? [city.coordinates] : []);
  if (!points.length) return null;
  let west = points[0][0];
  let east = points[0][0];
  let south = points[0][1];
  let north = points[0][1];
  for (const [lng, lat] of points.slice(1)) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, east, south, north, points };
}

function hasWebGLSupport() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function focusMapLibre(map: MapLibreMap, cities: CityVisitGroup[], is3d: boolean, animate = false) {
  const bounds = cityBounds(cities);
  if (!bounds) {
    map.easeTo({ center: INDIA_CENTER, zoom: 4.2, pitch: is3d ? 52 : 0, bearing: is3d ? -10 : 0, duration: animate ? 650 : 0 });
    return;
  }
  if (bounds.points.length === 1 || (Math.abs(bounds.east - bounds.west) < 0.08 && Math.abs(bounds.north - bounds.south) < 0.08)) {
    map.easeTo({ center: bounds.points[0], zoom: Math.min(7, Math.max(6.2, map.getZoom())), pitch: is3d ? 52 : 0, bearing: is3d ? -10 : 0, duration: animate ? 650 : 0 });
    return;
  }
  map.fitBounds([[bounds.west, bounds.south], [bounds.east, bounds.north]], { padding: 58, maxZoom: 6.4, pitch: is3d ? 52 : 0, bearing: is3d ? -10 : 0, duration: animate ? 650 : 0 });
}

function polygonAround(map: MapLibreMap, coordinates: [number, number]) {
  const center = map.project(coordinates);
  const radius = 8;
  const offsets = [[-radius, -radius], [radius, -radius], [radius, radius], [-radius, radius], [-radius, -radius]] as const;
  return offsets.map(([dx, dy]) => {
    const point = map.unproject([center.x + dx, center.y + dy]);
    return [point.lng, point.lat] as [number, number];
  });
}

function barFeatures(map: MapLibreMap, cities: CityVisitGroup[], selectedCityKey: string | null): FeatureCollection<Polygon, BarProperties> {
  const features: FeatureCollection<Polygon, BarProperties>["features"] = [];
  for (const city of cities) {
    if (!city.coordinates) continue;
    let baseHeight = 0;
    for (const purpose of VISIT_PURPOSES) {
      const count = city.purposeCounts[purpose];
      if (!count) continue;
      const height = baseHeight + count * 55_000;
      features.push({
        type: "Feature",
        properties: { cityKey: city.key, purpose, color: PURPOSE_COLORS[purpose], baseHeight, height, selected: city.key === selectedCityKey },
        geometry: { type: "Polygon", coordinates: [polygonAround(map, city.coordinates)] },
      });
      baseHeight = height;
    }
  }
  return { type: "FeatureCollection", features };
}

function pinFeatures(cities: CityVisitGroup[], selectedCityKey: string | null): FeatureCollection<Point, PinProperties> {
  return {
    type: "FeatureCollection",
    features: cities.flatMap(city => city.coordinates ? [{
      type: "Feature" as const,
      properties: { cityKey: city.key, count: city.count, color: PURPOSE_COLORS[city.dominantPurpose], selected: city.key === selectedCityKey },
      geometry: { type: "Point" as const, coordinates: city.coordinates },
    }] : []),
  };
}

function updateMapSources(map: MapLibreMap, cities: CityVisitGroup[], selectedCityKey: string | null) {
  const bars = map.getSource(MAPLIBRE_BAR_SOURCE) as GeoJSONSource | undefined;
  const pins = map.getSource(MAPLIBRE_PIN_SOURCE) as GeoJSONSource | undefined;
  bars?.setData(barFeatures(map, cities, selectedCityKey));
  pins?.setData(pinFeatures(cities, selectedCityKey));
}

function fitLeafletMap(map: LeafletMap, cities: CityVisitGroup[], animate = false) {
  const bounds = cityBounds(cities);
  if (!bounds) {
    map.setView([INDIA_CENTER[1], INDIA_CENTER[0]], 4, { animate });
  } else if (bounds.points.length === 1 || (Math.abs(bounds.east - bounds.west) < 0.08 && Math.abs(bounds.north - bounds.south) < 0.08)) {
    map.setView([bounds.points[0][1], bounds.points[0][0]], 7, { animate });
  } else {
    map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], { padding: [46, 46], maxZoom: 6, animate });
  }
}

export default function IndiaVisitsMap({ visits, selectedCityKey, focusRequest, onCitySelect, onUnavailable }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapLibreRef = useRef<MapLibreMap | null>(null);
  const leafletRef = useRef<LeafletMap | null>(null);
  const leafletMarkersRef = useRef(new Map<string, LeafletCircleMarker>());
  const popupRef = useRef<MapLibrePopup | null>(null);
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [is3d, setIs3d] = useState(true);
  const selectedCityKeyRef = useRef(selectedCityKey);
  selectedCityKeyRef.current = selectedCityKey;
  const grouped = useMemo(() => groupVisitsByCity(visits), [visits]);
  const cities = grouped.cities;

  useEffect(() => {
    let disposed = false;
    let fallbackStarted = false;
    let mapLibreReady = false;

    const showUnavailable = () => {
      if (!disposed) onUnavailable();
    };

    const startLeafletFallback = async () => {
      if (fallbackStarted || disposed) return;
      fallbackStarted = true;
      mapLibreRef.current?.remove();
      mapLibreRef.current = null;
      try {
        const [leafletModule] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
        if (disposed || !containerRef.current) return;
        const globalWindow = window as Window & { L?: LeafletModule };
        globalWindow.L = leafletModule.default;
        await import("leaflet.vectorgrid");
        const leaflet = leafletModule.default as unknown as LeafletWithVectorGrid;
        if (!leaflet.vectorGrid?.protobuf || !leaflet.canvas?.tile) throw new Error("Leaflet vector grid is unavailable");
        const map = leaflet.map(containerRef.current, { zoomControl: true, touchZoom: true, scrollWheelZoom: false, attributionControl: true });
        leafletRef.current = map;
        const tileLayer = leaflet.vectorGrid.protobuf(OPENFREEMAP_VECTOR_URL, {
          attribution: OPENFREEMAP_ATTRIBUTION,
          rendererFactory: leaflet.canvas.tile,
          maxNativeZoom: 14,
          vectorTileLayerStyles: {
            landcover: { color: "#d7e3cf", weight: 0, fill: true, fillColor: "#d7e3cf", fillOpacity: 0.8 },
            landuse: { color: "#ebe6d9", weight: 0, fill: true, fillColor: "#ebe6d9", fillOpacity: 0.7 },
            park: { color: "#a9c89f", weight: 0.6, fill: true, fillColor: "#b8d4b0", fillOpacity: 0.95 },
            water: { color: "#9dc7d2", weight: 0.5, fill: true, fillColor: "#b9d8e1", fillOpacity: 0.98 },
            waterway: { color: "#9dc7d2", weight: 1.2, fill: false, opacity: 0.95 },
            boundary: { color: "#c8b4a1", weight: 1, dashArray: "4,4", fill: false, opacity: 0.8 },
            building: (properties, zoom) => ({ color: "#d0c9bb", weight: 0.4, fill: true, fillColor: "#e1dbcf", fillOpacity: zoom > 12 ? 0.75 : 0.2 }),
            transportation: (properties, zoom) => ({ color: String(properties.class ?? "") === "motorway" ? "#d6a67a" : "#fffaf0", weight: zoom > 8 ? 1.5 : 0.75, fill: false, opacity: 0.92 }),
            aeroway: { color: "#d5c9af", weight: 1, fill: true, fillColor: "#e8dfce", fillOpacity: 0.75 },
            place: (properties, zoom, dimension) => dimension === 1 ? { radius: zoom >= 6 ? 2.5 : 1.5, color: "#657167", weight: 0.5, fill: true, fillColor: "#657167", fillOpacity: 0.9 } : { color: "#657167", weight: 0.5, fill: false },
          },
        }).addTo(map);
        let loadedTiles = 0;
        let failedTiles = 0;
        tileLayer.on("tileload", () => { loadedTiles += 1; });
        tileLayer.on("tileerror", () => {
          failedTiles += 1;
          if (failedTiles >= 4 && loadedTiles === 0) {
            map.remove();
            leafletRef.current = null;
            showUnavailable();
          }
        });
        fitLeafletMap(map, cities);
        const markers = new Map<string, LeafletCircleMarker>();
        for (const city of cities) {
          if (!city.coordinates) continue;
          const marker = leaflet.circleMarker([city.coordinates[1], city.coordinates[0]], {
            radius: 6 + Math.min(9, Math.sqrt(city.count) * 3),
            color: city.key === selectedCityKey ? brandPalette.primary : "#fffaf3",
            weight: city.key === selectedCityKey ? 4 : 2,
            fillColor: PURPOSE_COLORS[city.dominantPurpose],
            fillOpacity: 0.96,
          }).addTo(map);
          marker.bindPopup(popupContent(city), { maxWidth: 320 });
          marker.on("click", () => onCitySelect(city.key));
          markers.set(city.key, marker);
        }
        leafletMarkersRef.current = markers;
        setIs3d(false);
        setRenderer("leaflet");
      } catch {
        showUnavailable();
      }
    };

    const startMapLibre = async () => {
      try {
        const [maplibre] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
        if (disposed || !containerRef.current) return;
        if (!hasWebGLSupport()) {
          await startLeafletFallback();
          return;
        }
        maplibre.setWorkerUrl(maplibreWorkerUrl);
        const map = new maplibre.Map({
          container: containerRef.current,
          style: OPENFREEMAP_STYLE_URL,
          transformRequest: transformOpenFreeMapRequest,
          center: INDIA_CENTER,
          zoom: 4.2,
          pitch: 52,
          bearing: -10,
          maxPitch: 70,
          dragRotate: true,
          touchZoomRotate: true,
          attributionControl: false,
          canvasContextAttributes: { antialias: true },
        });
        mapLibreRef.current = map;
        map.touchZoomRotate.enableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), "top-right");
        map.addControl(new maplibre.AttributionControl({ compact: false, customAttribution: OPENFREEMAP_ATTRIBUTION }), "bottom-right");
        map.once("load", () => {
          if (disposed) return;
          mapLibreReady = true;
          map.addSource(MAPLIBRE_BAR_SOURCE, { type: "geojson", data: barFeatures(map, cities, selectedCityKey) });
          map.addSource(MAPLIBRE_PIN_SOURCE, { type: "geojson", data: pinFeatures(cities, selectedCityKey) });
          map.addLayer({
            id: MAPLIBRE_BAR_LAYER,
            type: "fill-extrusion",
            source: MAPLIBRE_BAR_SOURCE,
            paint: {
              "fill-extrusion-color": ["get", "color"],
              "fill-extrusion-base": ["get", "baseHeight"],
              "fill-extrusion-height": ["get", "height"],
              // MapLibre fill-extrusion opacity is not data-driven.
              "fill-extrusion-opacity": 0.86,
              "fill-extrusion-vertical-gradient": true,
            },
          });
          map.addLayer({
            id: MAPLIBRE_PIN_LAYER,
            type: "circle",
            source: MAPLIBRE_PIN_SOURCE,
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 6, 4, 9, 10, 13],
              "circle-color": ["get", "color"],
              "circle-stroke-color": ["case", ["get", "selected"], brandPalette.primary, "#fffaf3"],
              "circle-stroke-width": ["case", ["get", "selected"], 4, 2],
              "circle-opacity": 0.96,
            },
          });
          popupRef.current = new maplibre.Popup({ closeButton: true, closeOnClick: true, maxWidth: "320px" });
          focusMapLibre(map, cities, true);
          setRenderer("maplibre");
          map.on("moveend", () => updateMapSources(map, cities, selectedCityKeyRef.current));
          map.on("mousemove", event => {
            const features = map.queryRenderedFeatures(event.point, { layers: [MAPLIBRE_PIN_LAYER, MAPLIBRE_BAR_LAYER] });
            map.getCanvas().style.cursor = features.length ? "pointer" : "";
          });
          map.on("click", event => {
            const feature = map.queryRenderedFeatures(event.point, { layers: [MAPLIBRE_PIN_LAYER, MAPLIBRE_BAR_LAYER] })[0];
            const key = String(feature?.properties?.cityKey ?? "");
            if (!key) return;
            const city = cities.find(item => item.key === key);
            if (!city?.coordinates) return;
            onCitySelect(key);
            popupRef.current?.setLngLat(city.coordinates).setDOMContent(popupContent(city)).addTo(map);
          });
        });
        map.on("error", event => {
          const message = String(event.error?.message ?? event.error ?? "").toLocaleLowerCase();
          if (!mapLibreReady || /worker|webgl|context lost|shader|gpu/.test(message)) {
            void startLeafletFallback();
          }
        });
        map.getCanvas().addEventListener("webglcontextlost", () => { void startLeafletFallback(); }, { once: true });
      } catch {
        await startLeafletFallback();
      }
    };

    void startMapLibre();
    return () => {
      disposed = true;
      popupRef.current?.remove();
      mapLibreRef.current?.remove();
      mapLibreRef.current = null;
      leafletRef.current?.remove();
      leafletRef.current = null;
      leafletMarkersRef.current.clear();
    };
  }, [cities, onCitySelect, onUnavailable]);

  useEffect(() => {
    const map = mapLibreRef.current;
    if (!map || renderer !== "maplibre") return;
    if (map.getLayer(MAPLIBRE_BAR_LAYER)) map.setLayoutProperty(MAPLIBRE_BAR_LAYER, "visibility", is3d ? "visible" : "none");
    map.easeTo({ pitch: is3d ? 52 : 0, bearing: is3d ? -10 : 0, duration: 450 });
  }, [is3d, renderer]);

  useEffect(() => {
    const map = mapLibreRef.current;
    if (map && renderer === "maplibre" && map.getSource(MAPLIBRE_BAR_SOURCE)) updateMapSources(map, cities, selectedCityKey);
    for (const city of cities) {
      const marker = leafletMarkersRef.current.get(city.key);
      if (marker) marker.setStyle({ color: city.key === selectedCityKey ? brandPalette.primary : "#fffaf3", weight: city.key === selectedCityKey ? 4 : 2 });
    }
  }, [cities, renderer, selectedCityKey]);

  useEffect(() => {
    if (!selectedCityKey) return;
    const city = cities.find(item => item.key === selectedCityKey);
    if (!city?.coordinates) return;
    const [longitude, latitude] = city.coordinates;
    if (renderer === "maplibre" && mapLibreRef.current) {
      const map = mapLibreRef.current;
      map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 6.3), pitch: is3d ? 52 : 0, bearing: is3d ? -10 : 0, duration: 700 });
    } else if (renderer === "leaflet" && leafletRef.current) {
      const map = leafletRef.current;
      map.setView([latitude, longitude], Math.max(map.getZoom(), 7), { animate: true, duration: 0.65 });
    }
  }, [cities, focusRequest, is3d, renderer, selectedCityKey]);

  const resetView = () => {
    setIs3d(true);
    if (mapLibreRef.current && renderer === "maplibre") focusMapLibre(mapLibreRef.current, cities, true, true);
    else if (leafletRef.current) fitLeafletMap(leafletRef.current, cities, true);
  };

  return <div className="india-map-content">
    <div className="india-map-toolbar"><span className="india-map-mode">{renderer === "leaflet" ? <><MapIcon size={14} /> 2D fallback</> : <><Box size={14} /> {is3d ? "3D view" : "2D view"}</>}</span><button type="button" className="button button-secondary button-small" onClick={resetView}><RotateCcw size={14} /> Reset view</button><button type="button" className="button button-secondary button-small" onClick={() => setIs3d(value => !value)} disabled={renderer === "leaflet"} aria-pressed={renderer === "leaflet" ? false : !is3d}>{renderer === "leaflet" ? "3D unavailable" : is3d ? "2D view" : "3D view"}</button></div>
    <div className="india-map-canvas-wrap"><div ref={containerRef} className="india-map-canvas" role="application" aria-label="Interactive map of today's visits in India" /></div>
    <div className="india-map-legend" aria-label="Visit purpose legend">{VISIT_PURPOSES.map(purpose => <span className="india-map-legend-item" key={purpose}><i style={{ backgroundColor: PURPOSE_COLORS[purpose] }} />{purpose}</span>)}</div>
    {grouped.unmappedLocations.length > 0 && <div className="india-map-unmapped"><strong>Unmapped locations</strong><span>{grouped.unmappedLocations.join(" · ")}</span></div>}
    <a className="india-map-issue-link" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a>
  </div>;
}
