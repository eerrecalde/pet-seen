import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map } from 'maplibre-gl'

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

  useEffect(() => {
    if (!container.current || map.current) return
    const instance = new maplibregl.Map({
      container: container.current,
      center: [longitude, latitude],
      zoom: 12,
      interactive: false,
      attributionControl: false,
      style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle,
    })
    instance.on('load', () => {
      instance.addSource('approximate-area', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [longitude, latitude] } },
      })
      instance.addLayer({
        id: 'approximate-area-fill',
        type: 'circle',
        source: 'approximate-area',
        paint: { 'circle-radius': 62, 'circle-color': '#ffffff', 'circle-opacity': 0.62, 'circle-stroke-color': '#426c68', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.8 },
      })
      instance.addLayer({
        id: 'approximate-area-centre',
        type: 'circle',
        source: 'approximate-area',
        paint: { 'circle-radius': 8, 'circle-color': '#d76f4e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
      })
    })
    map.current = instance
    return () => { instance.remove(); map.current = null }
  }, [latitude, longitude])

  return <div className="public-location-map" ref={container} role="img" aria-label={label} />
}
