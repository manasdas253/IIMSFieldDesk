import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { DailyMapVisit } from "./indiaMapData";

const IndiaVisitsMap = lazy(() => import("./IndiaVisitsMap"));

function MapLoadingState() {
  return <div className="india-map-loading" aria-label="Loading visit map"><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div>;
}

class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

export default function OverviewMapSection({ visits, selectedCityKey, focusRequest, onCitySelect, loading = false }: { visits: DailyMapVisit[]; selectedCityKey: string | null; focusRequest: number; onCitySelect: (cityKey: string) => void; loading?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const hideUnavailableMap = useCallback(() => setUnavailable(true), []);

  useEffect(() => {
    if (shouldLoad || !visits.length || typeof IntersectionObserver === "undefined" || !sectionRef.current) {
      if (visits.length && typeof IntersectionObserver === "undefined") setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "220px 0px" });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [shouldLoad, visits.length]);

  if (unavailable) return null;

  return <section ref={sectionRef} className="panel india-map-panel" aria-label="Today's visits on the India map">
    <div className="panel-heading"><div><p className="eyebrow">FIELD ACTIVITY MAP</p><h2>Today by city</h2></div><span className="panel-count">{visits.length} {visits.length === 1 ? "visit" : "visits"}</span></div>
    {loading ? <MapLoadingState /> : !visits.length ? <div className="empty-state india-map-empty"><div className="empty-mark">—</div><strong>No visits logged today</strong><p>City activity will appear here when today’s field visits are recorded.</p></div> : shouldLoad ? <MapErrorBoundary onError={hideUnavailableMap}><Suspense fallback={<MapLoadingState />}><IndiaVisitsMap visits={visits} selectedCityKey={selectedCityKey} focusRequest={focusRequest} onCitySelect={onCitySelect} onUnavailable={hideUnavailableMap} /></Suspense></MapErrorBoundary> : <MapLoadingState />}
  </section>;
}
