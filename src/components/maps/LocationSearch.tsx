import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

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

type SearchResponse = { results?: PlaceResult[] }

export function LocationSearch({ onSelect, strings }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>(
    'idle',
  )
  const controller = useRef<AbortController | null>(null)
  const latestSearch = useRef(0)

  const search = useCallback(async () => {
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      controller.current?.abort()
      setResults([])
      setStatus('idle')
      return
    }
    if (!supabase || !isSupabaseConfigured) {
      setStatus('error')
      return
    }

    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    const searchId = ++latestSearch.current
    setStatus('loading')
    try {
      const { data, error } = await supabase.functions.invoke<SearchResponse>(
        'geocode-location',
        { body: { query: trimmed }, signal: nextController.signal },
      )
      if (searchId !== latestSearch.current) return
      if (error) throw error
      const nextResults = (data?.results ?? []).filter(
        (place) =>
          typeof place.label === 'string' &&
          Number.isFinite(place.latitude) &&
          Number.isFinite(place.longitude),
      )
      setResults(nextResults)
      setStatus(nextResults.length ? 'idle' : 'empty')
    } catch {
      if (nextController.signal.aborted || searchId !== latestSearch.current)
        return
      setResults([])
      setStatus('error')
    }
  }, [query])

  useEffect(
    () => () => {
      controller.current?.abort()
    },
    [],
  )

  return (
    <div className="location-search">
      <label>
        {strings.label}
        <span className="location-search-row">
          <input
            aria-busy={status === 'loading'}
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
