import { useEffect, useRef, useState } from 'react'

type SignedPhoto = { id: string; path: string | null }

/** Loads each private image once and drops results from an obsolete report list. */
export function useSignedPhotoUrls(
  items: SignedPhoto[],
  load: (path: string) => Promise<string | null>,
) {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const loaded = useRef(new Set<string>())
  const loading = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    const loadingIds = loading.current
    const pending = items.filter(
      ({ id, path }) => path && !loaded.current.has(id) && !loadingIds.has(id),
    )
    pending.forEach(({ id }) => loadingIds.add(id))
    if (!pending.length)
      return () => {
        cancelled = true
      }
    void Promise.all(
      pending.map(async ({ id, path }) => [id, await load(path!)] as const),
    ).then((resolved) => {
      pending.forEach(({ id }) => loadingIds.delete(id))
      if (!cancelled) {
        pending.forEach(({ id }) => loaded.current.add(id))
        setUrls((current) => ({ ...current, ...Object.fromEntries(resolved) }))
      }
    })
    return () => {
      cancelled = true
      // An effect cleanup can occur before its request resolves (including in
      // React Strict Mode). Let the replacement effect request these URLs.
      pending.forEach(({ id }) => loadingIds.delete(id))
    }
  }, [items, load])

  return urls
}
