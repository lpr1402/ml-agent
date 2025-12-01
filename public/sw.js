/**
 * ML Agent Service Worker - iOS PWA Production 2025
 * Push Notifications 24/7 + Cache Inteligente + Auto-Recovery
 *
 * OTIMIZADO PARA:
 * - iOS 16+ PWA Standalone (notificações persistentes)
 * - Windows Desktop (requireInteraction)
 * - Android Chrome
 *
 * FEATURES:
 * - Background Sync para notificações perdidas
 * - Periodic Sync para keep-alive
 * - Auto-recovery quando SW "morre"
 * - Som de notificação via postMessage
 */

// Versão do Service Worker - BUMP para forçar update
const SW_VERSION = '5.0.0';
const APP_NAME = 'ML Agent';
const CACHE_NAME = `ml-agent-cache-v${SW_VERSION}`;
const RUNTIME_CACHE = `ml-agent-runtime-v${SW_VERSION}`;

// Detectar iOS
const isIOS = /iPhone|iPad|iPod/i.test(self.navigator?.userAgent || '');

// VAPID Public Key
const VAPID_PUBLIC_KEY = 'BFDQNvQB1cWQbPHStt5S6mRtVCGldecWfKMDWfyBx2HTPhvitpZdVE7kMIAQPpGawd5GN7XrzMnvfMq3n7NOM0g';

// Recursos essenciais para cache
const ESSENTIAL_CACHE = [
  '/manifest.json',
  '/offline.html',
  '/apple-touch-icon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/ios-icon-120.png',
  '/icons/ios-icon-152.png',
  '/icons/ios-icon-167.png',
  '/icons/ios-icon-180.png',
  '/notification-new.mp3',
  '/mlagent-logo-3d.png'
];

// Timeout para network requests
const NETWORK_TIMEOUT = 5000;

// ==========================================
// CACHE STRATEGIES
// ==========================================

async function networkFirst(request, timeoutMs = NETWORK_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response && response.ok && request.method === 'GET') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Try cache fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Offline page for navigation
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

// ==========================================
// FETCH HANDLER
// ==========================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const { pathname } = url;

  // Skip non-same-origin (except ML APIs)
  if (!url.origin.includes(self.location.origin) && !url.host.includes('mercadolibre.com')) {
    return;
  }

  // API & dynamic: Network First
  if (pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/data/') ||
      pathname === '/' ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/agente') ||
      pathname.startsWith('/answer/') ||
      pathname.startsWith('/approve/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static chunks: Cache First
  if (pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Media: Cache First
  if (pathname.match(/\.(png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|mp3|mp4|webm)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Default: Network First
  event.respondWith(networkFirst(event.request));
});

// ==========================================
// INSTALL & ACTIVATE
// ==========================================

self.addEventListener('install', (event) => {
  console.log(`[SW v${SW_VERSION}] Installing...`);

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ESSENTIAL_CACHE).catch(err => {
        console.warn('[SW] Cache error:', err);
      });
    })
  );

  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW v${SW_VERSION}] Activating...`);

  event.waitUntil(
    Promise.all([
      // Take control
      clients.claim(),

      // Clear old caches
      caches.keys().then(names => {
        return Promise.all(
          names.map(name => {
            if (name !== CACHE_NAME && name !== RUNTIME_CACHE) {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            }
          })
        );
      }),

      // Notify clients
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: SW_VERSION
          });
        });
      }),

      // Register periodic sync for keep-alive
      registerPeriodicSync()
    ])
  );
});

// ==========================================
// PUSH NOTIFICATIONS - iOS/Windows Optimized
// ==========================================

self.addEventListener('push', (event) => {
  console.log(`[SW v${SW_VERSION}] Push received`);

  // Play sound via client
  playNotificationSound('/notification-new.mp3', 0.8);

  let data = {
    title: 'ML Agent',
    body: 'Nova notificacao',
    icon: '/mlagent-logo-3d.png',
    badge: '/icons/icon-96x96.png',
    tag: 'ml-notification',
    requireInteraction: true,
    silent: false,
    renotify: true,
    data: { url: '/agente' }
  };

  if (event.data) {
    try {
      const payload = event.data.json();

      switch (payload.type) {
        case 'new_question':
          playNotificationSound('/notification-new.mp3', 0.9);
          data = {
            title: `${payload.sellerName || 'ML Agent'}`,
            body: `Cliente perguntou: "${truncate(payload.questionText, 80)}"`,
            icon: '/mlagent-logo-3d.png',
            badge: '/icons/icon-96x96.png',
            tag: `question-${payload.questionId}`,
            requireInteraction: true,
            silent: false,
            renotify: true,
            vibrate: [300, 100, 300],
            data: {
              type: 'question',
              questionId: payload.questionId,
              url: payload.url || '/agente'
            },
            actions: [
              { action: 'answer', title: 'Responder' },
              { action: 'later', title: 'Depois' }
            ]
          };
          break;

        case 'batch_questions':
          playNotificationSound('/notification-new.mp3', 1.0);
          data = {
            title: `${payload.sellerName || 'ML Agent'}`,
            body: `${payload.count} perguntas aguardando resposta`,
            icon: '/mlagent-logo-3d.png',
            badge: '/icons/icon-96x96.png',
            tag: 'questions-batch',
            requireInteraction: true,
            silent: false,
            renotify: true,
            vibrate: [300, 150, 300, 150, 300],
            data: { type: 'batch', url: '/agente' }
          };
          break;

        case 'urgent_question':
          playNotificationSound('/notification-new.mp3', 1.0, 2);
          data = {
            title: `URGENTE - ${payload.sellerName}`,
            body: `Aguardando ha ${payload.hours}h: "${truncate(payload.questionText, 60)}"`,
            icon: '/mlagent-logo-3d.png',
            badge: '/icons/icon-96x96.png',
            tag: `urgent-${payload.questionId}`,
            requireInteraction: true,
            silent: false,
            renotify: true,
            vibrate: [500, 200, 500, 200, 500],
            data: {
              type: 'urgent',
              questionId: payload.questionId,
              url: payload.url || '/agente'
            }
          };
          break;

        default:
          data.body = payload.message || data.body;
          data.data = payload;
      }

      if (payload.productImage) {
        data.image = payload.productImage;
      }
    } catch (e) {
      console.error('[SW] Push parse error:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, data)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};

  notification.close();

  const url = data.url || '/agente';
  const fullUrl = data.questionId
    ? `${url}?questionId=${data.questionId}&source=push`
    : `${url}?source=push`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus().then(c => c.navigate(fullUrl));
        }
      }
      // Open new window
      return clients.openWindow(fullUrl);
    })
  );
});

// Push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then(subscription => {
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, resubscribe: true })
      });
    })
  );
});

// ==========================================
// BACKGROUND SYNC - For missed notifications
// ==========================================

self.addEventListener('sync', (event) => {
  console.log(`[SW] Sync event: ${event.tag}`);

  if (event.tag === 'check-notifications' || event.tag === 'sync-questions') {
    event.waitUntil(checkForMissedNotifications());
  }

  if (event.tag === 'keep-alive') {
    event.waitUntil(keepAliveSync());
  }
});

async function checkForMissedNotifications() {
  try {
    const response = await fetch('/api/push/check-missed');
    const data = await response.json();

    if (data.missedNotifications > 0) {
      playNotificationSound('/notification-new.mp3', 0.8);

      await self.registration.showNotification('ML Agent', {
        body: `${data.missedNotifications} notificacoes nao lidas`,
        icon: '/mlagent-logo-3d.png',
        badge: '/icons/icon-96x96.png',
        tag: 'missed-notifications',
        requireInteraction: true,
        data: { url: '/agente' }
      });
    }
  } catch (err) {
    console.error('[SW] Check missed error:', err);
  }
}

async function keepAliveSync() {
  try {
    await fetch('/api/push/keep-alive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('[SW] Keep-alive success');
  } catch (err) {
    console.error('[SW] Keep-alive error:', err);
  }
}

// ==========================================
// PERIODIC SYNC - iOS/Windows keep-alive
// ==========================================

self.addEventListener('periodicsync', (event) => {
  console.log(`[SW] Periodic sync: ${event.tag}`);

  if (event.tag === 'check-questions' || event.tag === 'keep-alive') {
    event.waitUntil(
      Promise.all([
        keepAliveSync(),
        checkForNewQuestions()
      ])
    );
  }
});

async function checkForNewQuestions() {
  try {
    const response = await fetch('/api/push/check-questions');
    const data = await response.json();

    if (data.newQuestions > 0) {
      playNotificationSound('/notification-new.mp3', 0.9);

      await self.registration.showNotification('Novas Perguntas', {
        body: `${data.newQuestions} perguntas aguardando`,
        icon: '/mlagent-logo-3d.png',
        badge: '/icons/icon-96x96.png',
        tag: 'new-questions',
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: '/agente' }
      });
    }
  } catch (err) {
    console.error('[SW] Check questions error:', err);
  }
}

async function registerPeriodicSync() {
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });

    if (status.state === 'granted') {
      await self.registration.periodicSync.register('check-questions', {
        minInterval: 15 * 60 * 1000 // 15 minutes
      });
      await self.registration.periodicSync.register('keep-alive', {
        minInterval: 5 * 60 * 1000 // 5 minutes
      });
      console.log('[SW] Periodic sync registered');
    }
  } catch (err) {
    console.log('[SW] Periodic sync not supported:', err.message);
  }
}

// ==========================================
// HEARTBEAT - Keep SW alive
// ==========================================

let heartbeatInterval = null;

function startHeartbeat() {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(async () => {
    console.log(`[SW v${SW_VERSION}] Heartbeat - ${new Date().toISOString()}`);

    const clientList = await clients.matchAll();

    if (clientList.length > 0) {
      // Register sync to check notifications
      try {
        await self.registration.sync.register('check-notifications');
      } catch {
        // Sync not supported
      }

      // Ping server to keep subscription active
      keepAliveSync().catch(() => {});
    }
  }, 3 * 60 * 1000); // Every 3 minutes
}

startHeartbeat();

// ==========================================
// MESSAGE HANDLER - Communication with clients
// ==========================================

self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'KEEP_ALIVE':
      console.log('[SW] Keep-alive ping from client');
      event.ports[0]?.postMessage({ status: 'alive', version: SW_VERSION });
      break;

    case 'CHECK_NOTIFICATIONS':
      checkForMissedNotifications();
      break;

    case 'REGISTER_PUSH':
      // Re-subscribe to push
      self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      }).then(subscription => {
        event.ports[0]?.postMessage({ subscription: subscription.toJSON() });
      }).catch(err => {
        event.ports[0]?.postMessage({ error: err.message });
      });
      break;
  }
});

// ==========================================
// HELPERS
// ==========================================

function playNotificationSound(sound, volume = 0.8, repeat = 1) {
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
    clientList.forEach(client => {
      client.postMessage({
        type: 'PLAY_NOTIFICATION_SOUND',
        sound,
        volume,
        repeat,
        timestamp: Date.now()
      });
    });
  }).catch(() => {});
}

function truncate(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

console.log(`[SW v${SW_VERSION}] ML Agent Service Worker loaded - iOS PWA Production 2025`);
