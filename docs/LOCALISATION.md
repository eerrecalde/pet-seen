# Localisation

Pet Seen uses [i18next](https://www.i18next.com/) with `react-i18next`.

- `en-GB` is the default and fallback locale. It has no URL prefix, so `/find/milo-victoria-park` is UK English. Neutral Latin American Spanish uses the short public prefix `/es`, for example `/es/find/milo-victoria-park`; it maps internally to `es-419`.
- `es-419` is neutral Latin American Spanish. Avoid country-specific vocabulary unless the feature requires it.
- Resources live in `src/i18n/resources.ts`. The English resource is the typed source of truth; a missing or misspelled key in the app is caught by TypeScript. `src/i18n/format.ts` provides the shared locale-aware date/time and number formatters.
- The URL is the source of truth for the selected language. The language selector updates it, so links can be shared in the intended language. An unprefixed URL always opens in UK English; the app does not infer a language from the browser or save a separate preference.

## Adding a locale

1. Add its resource object under the locale tag in `src/i18n/resources.ts`, with the same shape as `en-GB`.
2. Add the tag to `supportedLocales` in `src/i18n/index.ts` and add a picker label under `language` in each resource.
3. Use `t('section.key')` for interface copy. Put values into `{{placeholders}}` rather than concatenating translated strings.
4. Format dates, numbers and currencies with `Intl.*Format(i18n.language, ...)`, never a hard-coded locale.
5. Check the default desktop and mobile interfaces, then switch to the new locale and repeat.

Translations are currently bundled with the app. If translation files become large or are managed outside the repository, configure an i18next backend rather than changing the component API.
