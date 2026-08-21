import { useEffect, useRef } from 'react'
import { approximateArea } from '../../lib/approximate-area'
import { maplibregl } from '../../lib/maplibre'
import type { Map } from '../../lib/maplibre'

type PublicLocationMapProps = {
  latitude: number
  longitude: number
  label: string
}

const fallbackStyle = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e7f0df' } }],
} as const

// This component accepts only the coarse coordinates exposed by
// public_missing_cases. It deliberately has no API for an exact point.
export function PublicLocationMap({ latitude, longitude, label }: PublicLocationMapProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<Map | null>(null)
  const initialPosition = useRef({ latitude, longitude })

  useEffect(() => {
    if (!container.current || map.current) return
    const instance = new maplibregl.Map({
      container: container.current,
      center: [initialPosition.current.longitude, initialPosition.current.latitude],
      zoom: 16,
      interactive: false,
      style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle,
    })
    instance.on('load', () => {
      const area = approximateArea(initialPosition.current.latitude, initialPosition.current.longitude)
      instance.addSource('approximate-area', {
        type: 'geojson',
        data: area.data,
      })
      instance.addLayer({
        id: 'approximate-area-fill',
        type: 'fill',
        source: 'approximate-area',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.62 },
      })
      instance.addLayer({
        id: 'approximate-area-outline',
        type: 'line',
        source: 'approximate-area',
        paint: { 'line-color': '#426c68', 'line-width': 2, 'line-opacity': 0.8 },
      })
      instance.fitBounds(area.bounds, { padding: 48, maxZoom: 16, duration: 0 })
    })
    map.current = instance
    return () => { instance.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance?.getSource('approximate-area')) return
    const area = approximateArea(latitude, longitude)
    ;(instance.getSource('approximate-area') as maplibregl.GeoJSONSource).setData(area.data)
    instance.fitBounds(area.bounds, { padding: 48, maxZoom: 16, duration: 0 })
  }, [latitude, longitude])

  return <div className="public-location-map" ref={container} role="img" aria-label={label} />
}
