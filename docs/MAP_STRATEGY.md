# Pet Seen map strategy

## Product outcome

Maps support three product experiences:

1. A person reporting a sighting can use their current location, move the suggested pin and confirm it with minimal input.
2. A case owner can see the exact last-seen location and authorised sightings on their private case map.
3. People can discover nearby missing cases and approximate sightings through distinct map markers after the controlled beta loop is working.

The public discovery map is not part of the first controlled beta. Release 3 introduces it with a list-first default and an optional map view.

## Reporting flows

### From a missing-pet page

```text
I saw this pet
→ use current location or choose a place manually
→ move the pin if needed
→ confirm the location and time
→ submit
```

The pet is already known. Time defaults to now but remains editable. A photo and notes are optional.

### Standalone sighting

```text
Choose dog or cat
→ use current location or choose a place manually
→ move the pin if needed
→ confirm the location and time
→ submit
```

Case selection is optional. Automatic matching is deferred.

Location permission is helpful but never required. The flow must handle denied permission, unavailable GPS and inaccurate coordinates.

## Privacy model

Store two deliberate location concepts where a record can be public:

- `exact_location`: available only to the case owner for their case and authorised administrators.
- `public_location`: a persisted, server-generated approximate point or area suitable for public display.

Public APIs must not return exact coordinates and rely on the interface to hide them. Public-safe locations must not be recalculated randomly on each request because repeated results could reveal the original point.

During the controlled beta:

- public case pages show an approximate last-seen area;
- owner case maps show exact authorised sightings; and
- standalone sightings do not appear as exact pins on a public discovery map.

Release 3 may show approximate public sighting pins after moderation, retention and abuse behaviour has been tested.

## Technical direction

- Use MapLibre GL JS for interactive map rendering.
- Use a hosted production tile service; do not use the public OpenStreetMap tile servers as the application tile backend.
- Keep tile style, attribution and provider credentials configurable.
- Use Supabase/PostgreSQL with PostGIS as the source of truth for coordinates, access rules and later proximity queries.
- Keep map rendering separate from geocoding, but begin with one provider where that is operationally simpler.
- Lazy-load interactive map code on routes that use it.
- Reverse geocoding improves the confirmation label but must not be required to save a valid coordinate.
- Apply origin restrictions, quotas, alerts and separate development/production credentials before launch.

The first provider decision comes from a small proof of concept using representative UK postcodes, streets, parks, towns and rural locations. It must evaluate map quality, GPS pin correction, forward and reverse geocoding, production licensing, quota behaviour and predictable cost.

## Smallest implementation

Begin with these shared concepts:

```text
PetMap
LocationPicker
MapMarker
map provider configuration
location types
```

Add specialised markers, clustering, viewport queries, search radiuses and additional provider adapters when a scheduled product task requires them. Do not build them as speculative infrastructure.

## Delivery mapping

`docs/PROJECT_BREAKDOWN.md` is the only implementation backlog:

- PS-102 owns spatial schema, indexes, access policies and exact/public-safe location separation.
- PS-105 owns missing-case location selection.
- PS-107 owns the public approximate case map.
- PS-110 owns the provider proof of concept and initial selection.
- PS-201 owns location-first anonymous reporting.
- PS-203 owns the exact owner sighting map and timeline.
- Release 3 owns nearby discovery and its two public marker types.

## Deferred work

Do not include these in the first map slice:

- marker clustering;
- nationwide viewport querying;
- public exact sighting pins;
- search-radius layers;
- automatic case-to-sighting matching;
- watch-area notifications;
- multiple working provider implementations; or
- React Native map components.

These remain compatible with the architecture and can be added when product evidence or scale requires them.
