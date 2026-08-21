import type { SupabaseClient } from '@supabase/supabase-js'

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

export function pushNotificationsSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function enablePushNotifications(
  client: SupabaseClient,
  vapidPublicKey: string,
) {
  if (!pushNotificationsSupported())
    throw new Error('Push notifications are not supported by this browser.')
  if (!vapidPublicKey)
    throw new Error('Push notifications have not been configured yet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted')
    throw new Error(
      'Notifications were not allowed. You can change this in your browser settings.',
    )
  await navigator.serviceWorker.register('/service-worker.js')
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
    }))
  const json = subscription.toJSON()
  const { error } = await client.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}
