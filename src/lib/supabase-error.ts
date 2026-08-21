import type { PostgrestError } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'

export class SupabaseRequestError extends Error {
  readonly code?: string
  readonly details?: string
  readonly hint?: string

  constructor(
    message: string,
    options: { code?: string; details?: string; hint?: string } = {},
  ) {
    super(message)
    this.name = 'SupabaseRequestError'
    this.code = options.code
    this.details = options.details
    this.hint = options.hint
  }
}

export function normalizeSupabaseError(
  error: unknown,
  fallback = 'We could not complete that request. Please try again.',
) {
  if (error instanceof SupabaseRequestError) return error
  if (error instanceof Error)
    return new SupabaseRequestError(error.message || fallback)

  const response = error as Partial<PostgrestError> | null | undefined
  return new SupabaseRequestError(response?.message || fallback, {
    code: response?.code,
    details: response?.details,
    hint: response?.hint,
  })
}

/** Returns the configured client or a normalised error suitable for query state. */
export function getSupabaseClient() {
  if (supabase) return supabase
  throw new SupabaseRequestError(
    isSupabaseConfigured
      ? 'The Pet Seen service is temporarily unavailable.'
      : 'Pet Seen is not configured yet.',
  )
}

export async function unwrapSupabaseResult<T>(
  result: PromiseLike<{ data: T; error: unknown }>,
  fallback?: string,
) {
  const { data, error } = await result
  if (error) throw normalizeSupabaseError(error, fallback)
  return data
}
