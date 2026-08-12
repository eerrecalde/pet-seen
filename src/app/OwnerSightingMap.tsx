import { useEffect, useRef } from 'react'
import { maplibregl } from '../lib/maplibre'
import type { Map, Marker } from '../lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

export type SightingMapPoint = { id: string, latitude: number, longitude: number, label: string }

const fallbackStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e7f0df' } }] } as const

export function OwnerSightingMap({ points }: { points: SightingMapPoint[] }) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<Map | null>(null)
  const markers = useRef<Marker[]>([])

  useEffect(() => {
    if (!container.current || map.current || points.length === 0) return
    const instance = new maplibregl.Map({ container: container.current, center: [points[0].longitude, points[0].latitude], zoom: 13, style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle })
    markers.current = points.map((point) => new maplibregl.Marker({ color: '#47724a' }).setLngLat([point.longitude, point.latitude]).setPopup(new maplibregl.Popup({ offset: 18 }).setText(point.label)).addTo(instance))
    if (points.length > 1) {
      const bounds = points.reduce((current, point) => current.extend([point.longitude, point.latitude]), new maplibregl.LngLatBounds([points[0].longitude, points[0].latitude], [points[0].longitude, points[0].latitude]))
      instance.fitBounds(bounds, { padding: 42, maxZoom: 15, duration: 0 })
    }
    map.current = instance
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; instance.remove(); map.current = null }
  }, [points])

  return <div className="owner-sighting-map" ref={container} aria-label="Exact sighting locations for this case" />
}
