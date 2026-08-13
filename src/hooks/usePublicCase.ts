import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type PublicCase = {
  public_slug: string
  title: string | null
  last_seen_at: string | null
  last_seen_description: string | null
  pet_name: string
  species: 'dog' | 'cat'
  breed: string | null
  colour: string | null
  pet_description: string | null
  public_latitude: number
  public_longitude: number
}

export type PublicCaseState = 'loading' | 'ready' | 'not-found' | 'error'

const publicCaseFields = 'public_slug,title,last_seen_at,last_seen_description,pet_name,species,breed,colour,pet_description,public_latitude,public_longitude'

/** Loads only the public-safe case view shared by public pages and posters. */
export function usePublicCase(slug: string | undefined) {
  const [caseData, setCaseData] = useState<PublicCase | null>(null)
  const [state, setState] = useState<PublicCaseState>(isSupabaseConfigured ? 'loading' : 'error')

  useEffect(() => {
    if (!supabase || !slug) return

    let active = true
    setState('loading')
    void supabase
      .from('public_missing_cases')
      .select(publicCaseFields)
      .eq('public_slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setState('error')
        } else if (!data) {
          setState('not-found')
        } else {
          setCaseData(data as PublicCase)
          setState('ready')
        }
      })

    return () => { active = false }
  }, [slug])

  return { caseData, state }
}
