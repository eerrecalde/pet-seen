import { useEffect, useRef, useState } from 'react'

type SignedPhoto = { id: string; path: string | null }

/** Loads each private image once and drops results from an obsolete report list. */
export function useSignedPhotoUrls(
  items: SignedPhoto[],
  load: (path: string) => Promise<string | null>,
) {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const requested = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    const pending = items.filter(
      ({ id, path }) => path && !requested.current.has(id),
    )
    pending.forEach(({ id }) => requested.current.add(id))
    if (!pending.length)
      return () => {
        cancelled = true
      }
    void Promise.all(
      pending.map(async ({ id, path }) => [id, await load(path!)] as const),
    ).then((resolved) => {
      if (!cancelled)
        setUrls((current) => ({ ...current, ...Object.fromEntries(resolved) }))
    })
    return () => {
      cancelled = true
    }
  }, [items, load])

  return urls
}
