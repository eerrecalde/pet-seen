import { useState } from 'react'
import { Icon } from '../Icon'
import { getCurrentCoordinates, type Coordinates } from '../../lib/geolocation'
import { LocationSearch, type PlaceResult } from './LocationSearch'

type NearbyLocationSearchProps = {
  onSelect: (location: Coordinates & { label: string }) => void
  strings: {
    help: string
    useLocation: string
    locationUnavailable: string
    locationDenied: string
    search: {
      label: string
      placeholder: string
      search: string
      searching: string
      noResults: string
      error: string
    }
  }
}

/** Reuses reporting's place search and geolocation contract for public discovery. */
export function NearbyLocationSearch({
  onSelect,
  strings,
}: NearbyLocationSearchProps) {
  const [locationError, setLocationError] = useState('')

  async function requestCurrentLocation() {
    setLocationError('')
    const result = await getCurrentCoordinates({
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 15_000,
    })
    if (!result.ok) {
      setLocationError(
        result.reason === 'unavailable'
          ? strings.locationUnavailable
          : strings.locationDenied,
      )
      return
    }
    onSelect({ ...result.coordinates, label: strings.useLocation })
  }

  function selectPlace(place: PlaceResult) {
    setLocationError('')
    onSelect(place)
  }

  return (
    <div className="nearby-location-search">
      <p>{strings.help}</p>
      <button
        className="secondary-button location-button"
        onClick={() => void requestCurrentLocation()}
        type="button"
      >
        <Icon name="navigation" />
        {strings.useLocation}
      </button>
      <LocationSearch onSelect={selectPlace} strings={strings.search} />
      {locationError && (
        <p className="location-error" role="alert">
          {locationError}
        </p>
      )}
    </div>
  )
}
