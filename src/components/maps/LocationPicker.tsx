import { useEffect, useRef } from 'react'
import { maplibregl } from '../../lib/maplibre'
import type { Map, MapMouseEvent, Marker } from '../../lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

type Coordinates = { latitude: number; longitude: number }

type LocationPickerProps = {
  coordinates: Coordinates | null
  onChange: (coordinates: Coordinates) => void
}

const london = { latitude: 51.5074, longitude: -0.1278 }

const fallbackStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#e7f0df' },
    },
  ],
} as const

function validCoordinates(
  coordinates: Coordinates | null,
): coordinates is Coordinates {
  return Boolean(
    coordinates &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude),
  )
}

export function LocationPicker({ coordinates, onChange }: LocationPickerProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<Map | null>(null)
  const marker = useRef<Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const initialCoordinates = useRef(
    validCoordinates(coordinates) ? coordinates : london,
  )
  const startsAtPreciseLocation = useRef(validCoordinates(coordinates))
  const latitude = coordinates?.latitude
  const longitude = coordinates?.longitude

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!container.current || map.current) return
    const instance = new maplibregl.Map({
      container: container.current,
      center: [
        initialCoordinates.current.longitude,
        initialCoordinates.current.latitude,
      ],
      zoom: startsAtPreciseLocation.current ? 15 : 11,
      style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle,
    })
    function setMarker(latitude: number, longitude: number) {
      if (!marker.current) {
        const nextMarker = new maplibregl.Marker({
          color: '#d76f4e',
          draggable: true,
        }).addTo(instance)
        nextMarker.on('dragend', () => {
          const point = nextMarker.getLngLat()
          onChangeRef.current({ latitude: point.lat, longitude: point.lng })
        })
        marker.current = nextMarker
      }
      marker.current.setLngLat([longitude, latitude])
    }
    if (startsAtPreciseLocation.current)
      setMarker(
        initialCoordinates.current.latitude,
        initialCoordinates.current.longitude,
      )
    instance.on('click', (event: MapMouseEvent) => {
      setMarker(event.lngLat.lat, event.lngLat.lng)
      onChangeRef.current({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      })
    })
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(() => {
    if (
      !map.current ||
      latitude === undefined ||
      longitude === undefined ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    )
      return
    if (!marker.current) {
      const nextMarker = new maplibregl.Marker({
        color: '#d76f4e',
        draggable: true,
      })
        .setLngLat([longitude, latitude])
        .addTo(map.current)
      nextMarker.on('dragend', () => {
        const point = nextMarker.getLngLat()
        onChangeRef.current({ latitude: point.lat, longitude: point.lng })
      })
      marker.current = nextMarker
    } else marker.current.setLngLat([longitude, latitude])
    map.current.easeTo({ center: [longitude, latitude], duration: 350 })
  }, [latitude, longitude])

  return (
    <div
      className="location-map"
      ref={container}
      aria-label="Map for choosing the last seen location"
    />
  )
}
