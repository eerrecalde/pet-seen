const areaRadiusMetres = 50

export function approximateArea(latitude: number, longitude: number) {
  const points = Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2
    const latitudeOffset = (areaRadiusMetres * Math.sin(angle)) / 111_320
    const longitudeOffset = (areaRadiusMetres * Math.cos(angle)) / (111_320 * Math.cos(latitude * Math.PI / 180))
    return [longitude + longitudeOffset, latitude + latitudeOffset]
  })
  points.push(points[0])
  const latitudeOffset = areaRadiusMetres / 111_320
  const longitudeOffset = areaRadiusMetres / (111_320 * Math.cos(latitude * Math.PI / 180))

  return {
    bounds: [[longitude - longitudeOffset, latitude - latitudeOffset], [longitude + longitudeOffset, latitude + latitudeOffset]] as [[number, number], [number, number]],
    data: { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [points] } },
  }
}
