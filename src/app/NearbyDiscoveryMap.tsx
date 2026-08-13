import { useEffect, useRef } from 'react'
import { maplibregl } from '../lib/maplibre'
import type { Map, Marker } from '../lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

export type NearbyMapPoint = { id: string, kind: 'case' | 'sighting', latitude: number, longitude: number, label: string }

const fallbackStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e7f0df' } }] } as const

export function NearbyDiscoveryMap({ points, label }: { points: NearbyMapPoint[], label: string }) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<Map | null>(null)
  const markers = useRef<Marker[]>([])

  useEffect(() => {
    if (!container.current || map.current || points.length === 0) return
    const instance = new maplibregl.Map({ container: container.current, center: [points[0].longitude, points[0].latitude], zoom: 12, style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle })
    markers.current = points.map((point) => {
      const element = document.createElement('span')
      element.className = `nearby-map-pin ${point.kind}`
      element.setAttribute('aria-hidden', 'true')
      return new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([point.longitude, point.latitude]).setPopup(new maplibregl.Popup({ offset: 16 }).setText(point.label)).addTo(instance)
    })
    if (points.length > 1) {
      const bounds = points.reduce((current, point) => current.extend([point.longitude, point.latitude]), new maplibregl.LngLatBounds([points[0].longitude, points[0].latitude], [points[0].longitude, points[0].latitude]))
      instance.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 })
    }
    map.current = instance
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; instance.remove(); map.current = null }
  }, [points])

  return <div className="nearby-discovery-map" ref={container} role="img" aria-label={label} />
}
