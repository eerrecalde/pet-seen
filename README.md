# Pet Seen

Pet Seen helps people report missing dogs and cats, share sightings quickly, and bring pets home.

The initial beta serves the United Kingdom and will concentrate promotion in one local area to build a useful network of owners and helpers.

## Status

Release 0 is in progress. The initial application shell, visual foundation, and delivery breakdown are now in place.

See [the delivery breakdown](docs/PROJECT_BREAKDOWN.md) and the product plan for the roadmap.

## Development

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm run typecheck
npm run lint
npm run build
```

## Product principles

- A missing-pet case needs a signed-in creator.
- A sighting must be possible without an account.
- Public pages never show precise sensitive locations.
- The beta supports dogs and cats only.
- The product must remain fast, calm, accessible, and mobile-first.
