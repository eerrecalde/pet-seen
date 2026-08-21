import { useEffect, useRef } from 'react'
import { approximateArea } from '../../lib/approximate-area'
import { maplibregl } from '../../lib/maplibre'
import type { Map, Marker } from '../../lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

type NearbyMapCoordinates = { id: string, latitude: number, longitude: number, label: string }
export type NearbyMapPoint =
  | (NearbyMapCoordinates & { kind: 'case' })
  | (NearbyMapCoordinates & { kind: 'sighting' })

const fallbackStyle = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e7f0df' } }] } as const

export function NearbyDiscoveryMap({ points, label }: { points: NearbyMapPoint[], label: string }) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<Map | null>(null)
  const markers = useRef<Marker[]>([])
  const pointsRef = useRef(points)
  pointsRef.current = points
  const pointsKey = points.map(({ id, latitude, longitude, label, kind }) => `${id}:${latitude}:${longitude}:${label}:${kind}`).join('|')

  useEffect(() => {
    const currentPoints = pointsRef.current
    if (!container.current || map.current || currentPoints.length === 0) return
    const instance = new maplibregl.Map({ container: container.current, center: [currentPoints[0].longitude, currentPoints[0].latitude], zoom: 12, style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle })
    const caseAreas = currentPoints.filter((point) => point.kind === 'case').map((point) => ({ ...approximateArea(point.latitude, point.longitude).data, properties: { label: point.label } }))
    instance.on('load', () => {
      instance.addSource('nearby-case-areas', { type: 'geojson', data: { type: 'FeatureCollection', features: caseAreas } })
      instance.addLayer({ id: 'nearby-case-areas-fill', type: 'fill', source: 'nearby-case-areas', paint: { 'fill-color': '#d76f4e', 'fill-opacity': 0.3 } })
      instance.addLayer({ id: 'nearby-case-areas-outline', type: 'line', source: 'nearby-case-areas', paint: { 'line-color': '#9b553a', 'line-width': 2 } })
      instance.on('mouseenter', 'nearby-case-areas-fill', () => { instance.getCanvas().style.cursor = 'pointer' })
      instance.on('mouseleave', 'nearby-case-areas-fill', () => { instance.getCanvas().style.cursor = '' })
      instance.on('click', 'nearby-case-areas-fill', (event) => {
        const label = event.features?.[0]?.properties?.label
        if (label) new maplibregl.Popup({ offset: 12 }).setLngLat(event.lngLat).setText(label).addTo(instance)
      })
    })
    markers.current = currentPoints.filter((point) => point.kind === 'sighting').map((point) => {
      const element = document.createElement('span')
      element.className = `nearby-map-pin ${point.kind}`
      element.setAttribute('aria-hidden', 'true')
      return new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([point.longitude, point.latitude]).setPopup(new maplibregl.Popup({ offset: 16 }).setText(point.label)).addTo(instance)
    })
    if (currentPoints.length > 1) {
      const bounds = currentPoints.reduce((current, point) => current.extend([point.longitude, point.latitude]), new maplibregl.LngLatBounds([currentPoints[0].longitude, currentPoints[0].latitude], [currentPoints[0].longitude, currentPoints[0].latitude]))
      instance.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 })
    }
    map.current = instance
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; instance.remove(); map.current = null }
  }, [pointsKey])

  return <div className="nearby-discovery-map" ref={container} role="img" aria-label={label} />
}
