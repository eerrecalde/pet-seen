import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthContextValue = {
  acknowledgeSignIn: () => void
  isLoading: boolean
  justSignedIn: boolean
  session: Session | null
}

export const AuthContext = createContext<AuthContextValue>({
  acknowledgeSignIn: () => undefined,
  isLoading: true,
  justSignedIn: false,
  session: null,
})
