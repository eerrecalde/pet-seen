import { createClient } from '@supabase/supabase-js'

type Role = 'owner' | 'moderator' | 'administrator'

const localHosts = new Set(['localhost', '127.0.0.1'])

function localOrigin(origin: string | null) {
  if (!origin) return null
  try {
    return localHosts.has(new URL(origin).hostname) ? origin : null
  } catch {
    return null
  }
}

function response(
  request: Request,
  status: number,
  body?: Record<string, string>,
) {
  const origin = request.headers.get('origin')
  const allowOrigin = localOrigin(origin)
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(allowOrigin
        ? {
            'access-control-allow-origin': allowOrigin,
            'access-control-allow-headers':
              'authorization, x-client-info, apikey, content-type',
            'access-control-allow-methods': 'POST, OPTIONS',
            vary: 'origin',
          }
        : {}),
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response(request, 204)
  if (request.method !== 'POST')
    return response(request, 405, { error: 'Method not allowed.' })

  const origin = request.headers.get('origin')
  const isLocalRequest = Boolean(localOrigin(origin))
  if (Deno.env.get('DENO_DEPLOYMENT_ID') || !isLocalRequest)
    return response(request, 403, {
      error:
        'This development helper is only available on a local Supabase stack.',
    })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey)
    return response(request, 500, {
      error: 'Local Supabase is not configured.',
    })

  const {
    email,
    userId: inputUserId,
    role,
  } = (await request.json().catch(() => ({}))) as {
    email?: unknown
    userId?: unknown
    role?: unknown
  }
  const hasEmail = typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email)
  const hasUserId =
    typeof inputUserId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      inputUserId,
    )
  if (
    (!hasEmail && !hasUserId) ||
    (hasEmail && hasUserId) ||
    !['owner', 'moderator', 'administrator'].includes(String(role))
  )
    return response(request, 400, {
      error:
        'Use one local user email or ID and one of: owner, moderator, administrator.',
    })

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const password = crypto.randomUUID() + crypto.randomUUID()
  let userId: string | undefined
  let accountEmail: string | undefined
  if (hasUserId) {
    let page = 1
    while (!accountEmail) {
      const { data: users, error: listError } =
        await admin.auth.admin.listUsers({ page, perPage: 1_000 })
      if (listError) return response(request, 500, { error: listError.message })
      const existing = users.users.find((user) => user.id === inputUserId)
      if (existing?.email) {
        userId = existing.id
        accountEmail = existing.email
      }
      if (users.users.length < 1_000) break
      page += 1
    }
    if (!userId || !accountEmail)
      return response(request, 404, {
        error: 'That local user ID was not found.',
      })
  } else {
    accountEmail = email as string
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: accountEmail,
        password,
        email_confirm: true,
      })
    if (created.user) userId = created.user.id
    if (createError) {
      let page = 1
      while (!userId) {
        const { data: users, error: listError } =
          await admin.auth.admin.listUsers({ page, perPage: 1_000 })
        if (listError)
          return response(request, 500, { error: listError.message })
        userId = users.users.find(
          (user) => user.email?.toLowerCase() === accountEmail?.toLowerCase(),
        )?.id
        if (users.users.length < 1_000) break
        page += 1
      }
      if (!userId) return response(request, 500, { error: createError.message })
    }
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    userId!,
    { password, email_confirm: true },
  )
  if (updateError) return response(request, 500, { error: updateError.message })

  const { error: clearRolesError } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
  if (clearRolesError)
    return response(request, 500, { error: clearRolesError.message })
  if (role !== 'owner') {
    const { error: roleError } = await admin
      .from('user_roles')
      .upsert(
        { user_id: userId, role: role as Exclude<Role, 'owner'> },
        { onConflict: 'user_id,role' },
      )
    if (roleError) return response(request, 500, { error: roleError.message })
  }

  return response(request, 200, { email: accountEmail!, password })
})
