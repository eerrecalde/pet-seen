import { useEffect, useRef } from 'react'
import { maplibregl } from '../../lib/maplibre'
import type { Map, Marker } from '../../lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

export type SightingMapPoint = { id: string, latitude: number, longitude: number, label: string }

const fallbackStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e7f0df' } }] } as const

export function OwnerSightingMap({ points }: { points: SightingMapPoint[] }) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<Map | null>(null)
  const markers = useRef<Marker[]>([])
  const pointsRef = useRef(points)
  pointsRef.current = points
  const pointsKey = points.map(({ id, latitude, longitude, label }) => `${id}:${latitude}:${longitude}:${label}`).join('|')

  useEffect(() => {
    const currentPoints = pointsRef.current
    if (!container.current || map.current || currentPoints.length === 0) return
    const instance = new maplibregl.Map({ container: container.current, center: [currentPoints[0].longitude, currentPoints[0].latitude], zoom: 13, style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle })
    markers.current = currentPoints.map((point) => new maplibregl.Marker({ color: '#47724a' }).setLngLat([point.longitude, point.latitude]).setPopup(new maplibregl.Popup({ offset: 18 }).setText(point.label)).addTo(instance))
    if (currentPoints.length > 1) {
      const bounds = currentPoints.reduce((current, point) => current.extend([point.longitude, point.latitude]), new maplibregl.LngLatBounds([currentPoints[0].longitude, currentPoints[0].latitude], [currentPoints[0].longitude, currentPoints[0].latitude]))
      instance.fitBounds(bounds, { padding: 42, maxZoom: 15, duration: 0 })
    }
    map.current = instance
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; instance.remove(); map.current = null }
  }, [pointsKey])

  return <div className="owner-sighting-map" ref={container} aria-label="Exact sighting locations for this case" />
}
