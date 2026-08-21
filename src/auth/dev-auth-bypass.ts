import { supabase } from '../lib/supabase'

export type DevBypassRole = 'owner' | 'moderator' | 'administrator'

type DevAuthBypass = {
  identity: string
  identityType: 'email' | 'userId'
  role: DevBypassRole
}

const localSupabaseHosts = new Set(['127.0.0.1', 'localhost'])

export function readDevAuthBypass(): DevAuthBypass | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return null

  let isLocalSupabase = false
  try {
    isLocalSupabase = localSupabaseHosts.has(new URL(supabaseUrl).hostname)
  } catch {
    return null
  }
  if (!isLocalSupabase) return null

  const value = window.localStorage.getItem('bypass')?.trim()
  if (!value) return null

  const separator = value.lastIndexOf(':')
  if (separator < 1) return null
  const identity = value.slice(0, separator).trim()
  const role = value.slice(separator + 1).trim()
  const identityType = /^\S+@\S+\.\S+$/.test(identity)
    ? 'email'
    : /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          identity,
        )
      ? 'userId'
      : null
  if (!identityType || !['owner', 'moderator', 'administrator'].includes(role))
    return null

  return { identity, identityType, role: role as DevBypassRole }
}

export async function signInWithDevBypass(bypass: DevAuthBypass) {
  if (!supabase) throw new Error('Local Supabase is not configured.')

  const { data, error } = await supabase.functions.invoke('dev-auth-bypass', {
    body: {
      [bypass.identityType === 'email' ? 'email' : 'userId']: bypass.identity,
      role: bypass.role,
    },
  })
  if (error) throw error
  if (
    !data ||
    typeof data.email !== 'string' ||
    typeof data.password !== 'string'
  )
    throw new Error('The local development sign-in could not be completed.')

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })
  if (signInError) throw signInError
}
