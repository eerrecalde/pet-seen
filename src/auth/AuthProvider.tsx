import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true)
  const [justSignedIn, setJustSignedIn] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const handledMagicLinkCallback = useRef(false)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    function recordMagicLinkSignIn() {
      const query = new URLSearchParams(window.location.search)
      const fragment = new URLSearchParams(window.location.hash.slice(1))
      const isMagicLinkCallback = query.has('code') || query.has('token_hash') || fragment.has('access_token') || fragment.get('type') === 'magiclink'
      if (!isMagicLinkCallback || handledMagicLinkCallback.current) return

      handledMagicLinkCallback.current = true
      setJustSignedIn(true)
      query.delete('code'); query.delete('token_hash'); query.delete('type')
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query.size ? `?${query}` : ''}`)
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) recordMagicLinkSignIn()
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_IN') recordMagicLinkSignIn()
      if (event === 'SIGNED_OUT') setJustSignedIn(false)
      setIsLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({ acknowledgeSignIn: () => setJustSignedIn(false), isLoading, justSignedIn, session }), [isLoading, justSignedIn, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
