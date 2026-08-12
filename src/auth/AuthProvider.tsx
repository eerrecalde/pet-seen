import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true)
  const [justSignedIn, setJustSignedIn] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_IN') setJustSignedIn(true)
      if (event === 'SIGNED_OUT') setJustSignedIn(false)
      setIsLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({ acknowledgeSignIn: () => setJustSignedIn(false), isLoading, justSignedIn, session }), [isLoading, justSignedIn, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
