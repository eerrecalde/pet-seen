self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'Pet Seen alert', {
    body: data.body || 'A sighting was reported near an area you watch.',
    icon: '/pet-seen-icon.svg',
    badge: '/pet-seen-icon.svg',
    data: { url: data.url || '/dashboard' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/dashboard'))
})
