import { useState } from 'react'

export type PlaceResult = {
  label: string
  latitude: number
  longitude: number
}

type LocationSearchProps = {
  onSelect: (place: PlaceResult) => void
  strings: {
    label: string
    placeholder: string
    search: string
    searching: string
    noResults: string
    error: string
  }
}

type NominatimPlace = { display_name: string; lat: string; lon: string }

export function LocationSearch({ onSelect, strings }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>(
    'idle',
  )

  async function search() {
    const trimmed = query.trim()
    if (!trimmed) return
    setStatus('loading')
    setResults([])
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(trimmed)}`,
      )
      if (!response.ok) throw new Error('Search failed')
      const places = (await response.json()) as NominatimPlace[]
      const nextResults = places
        .map((place) => ({
          label: place.display_name,
          latitude: Number(place.lat),
          longitude: Number(place.lon),
        }))
        .filter(
          (place) =>
            Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
        )
      setResults(nextResults)
      setStatus(nextResults.length ? 'idle' : 'empty')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="location-search">
      <label>
        {strings.label}
        <span className="location-search-row">
          <input
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void search()
              }
            }}
            placeholder={strings.placeholder}
            type="search"
            value={query}
          />
          <button
            className="secondary-button"
            disabled={status === 'loading'}
            onClick={() => void search()}
            type="button"
          >
            {status === 'loading' ? strings.searching : strings.search}
          </button>
        </span>
      </label>
      {status === 'empty' && (
        <p className="location-search-message">{strings.noResults}</p>
      )}
      {status === 'error' && (
        <p className="location-error" role="alert">
          {strings.error}
        </p>
      )}
      {results.length > 0 && (
        <ul className="location-results" aria-label={strings.label}>
          {results.map((place) => (
            <li key={`${place.latitude}:${place.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(place)
                  setResults([])
                  setStatus('idle')
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
