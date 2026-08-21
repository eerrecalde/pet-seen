export type Coordinates = { latitude: number; longitude: number }

export type GeolocationResult =
  | { ok: true; coordinates: Coordinates }
  | { ok: false; reason: 'unavailable' | 'denied' }

/** Keeps browser-only geolocation details out of page workflows. */
export function getCurrentCoordinates(
  options: PositionOptions = {},
): Promise<GeolocationResult> {
  if (!navigator.geolocation)
    return Promise.resolve({ ok: false, reason: 'unavailable' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          ok: true,
          coordinates: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
        }),
      () => resolve({ ok: false, reason: 'denied' }),
      options,
    )
  })
}
